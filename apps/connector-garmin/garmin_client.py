"""
Camada de dados Garmin — o mesmo núcleo do projeto garmin_mcp
(github.com/Taxuspt/garmin_mcp): `python-garminconnect` (Garmin) + `garth` (auth).

Diferente do MCP — que autentica UMA conta por processo e guarda o token em
~/.garminconnect — aqui o serviço é STATELESS: quem chama (o backend NestJS)
passa o token/credenciais em cada requisição, atendendo muitos pacientes.

Fluxo de auth (python-garminconnect):
  g = Garmin(email, password, return_on_mfa=True)
  r1, r2 = g.login()            # r1 == "needs_mfa" → r2 é o client_state
  g.resume_login(client_state, code)
Token serializado via garth: g.garth.dumps() / g.garth.loads(str).
"""
from __future__ import annotations

import base64
import json
import logging
from datetime import date, timedelta
from typing import Any

from garminconnect import Garmin

logger = logging.getLogger("garmin_client")


class MfaRequired(Exception):
    """Sinaliza que o login precisa de um código MFA para prosseguir."""

    def __init__(self, mfa_ctx: str) -> None:
        super().__init__("MFA required")
        self.mfa_ctx = mfa_ctx


# --------------------------------------------------------------------------- #
# Autenticação                                                                 #
# --------------------------------------------------------------------------- #
def login(email: str, password: str) -> str:
    """
    Autentica no Garmin. Retorna o token bundle (base64 do garth) em sucesso.
    Levanta MfaRequired(mfa_ctx) quando a conta exige código MFA.
    """
    g = Garmin(email=email, password=password, return_on_mfa=True)
    result = g.login()
    # Com return_on_mfa=True, login() retorna (status, client_state) quando há MFA.
    if isinstance(result, tuple):
        status, client_state = result
        if status == "needs_mfa":
            mfa_ctx = base64.b64encode(json.dumps(client_state).encode("utf-8")).decode("ascii")
            raise MfaRequired(mfa_ctx)
    return g.garth.dumps()


def resume_mfa(mfa_ctx: str, code: str) -> str:
    """Conclui um login pendente de MFA. Retorna o token bundle (base64)."""
    client_state = json.loads(base64.b64decode(mfa_ctx.encode("ascii")).decode("utf-8"))
    g = Garmin(return_on_mfa=True)
    g.resume_login(client_state, code)
    return g.garth.dumps()


def login_with_token(token_b64: str) -> Garmin:
    """Instancia um cliente Garmin já autenticado a partir do token bundle."""
    g = Garmin()
    g.garth.loads(token_b64)
    try:
        profile = g.garth.profile or {}
        g.display_name = profile.get("displayName")
        g.full_name = profile.get("fullName")
    except Exception:  # noqa: BLE001 — perfil é opcional para puxar dados
        pass
    return g


# --------------------------------------------------------------------------- #
# Coleta e normalização                                                        #
# --------------------------------------------------------------------------- #
def _safe(fn, *args) -> Any:
    """Executa uma chamada da API tolerando ausência de dados no dia."""
    try:
        return fn(*args)
    except Exception as exc:  # noqa: BLE001 — dia sem dado é comum
        logger.warning("garmin call %s failed: %s", getattr(fn, "__name__", fn), exc)
        return None


def _daily_summary(api: Garmin, day: str) -> dict[str, Any] | None:
    """Normaliza o resumo diário para o shape de wearable_daily."""
    stats = _safe(api.get_stats, day) or {}
    sleep = _safe(api.get_sleep_data, day) or {}
    hrv = _safe(api.get_hrv_data, day) or {}

    dto = sleep.get("dailySleepDTO", {}) if isinstance(sleep, dict) else {}
    sono_seg = dto.get("sleepTimeSeconds")
    hrv_summary = hrv.get("hrvSummary", {}) if isinstance(hrv, dict) else {}
    hrv_avg = hrv_summary.get("lastNightAvg")

    passos = stats.get("totalSteps")
    kcal = stats.get("activeKilocalories") or stats.get("totalKilocalories")
    fc_media = stats.get("averageHeartRateInBeatsPerMinute") or stats.get("restingHeartRate")
    fc_max = stats.get("maxHeartRate")
    dist = stats.get("totalDistanceMeters")
    ativos_seg = stats.get("activeSeconds")

    # Nada de útil no dia → não gera linha
    if not any(v is not None for v in (passos, kcal, fc_media, sono_seg, hrv_avg)):
        return None

    return {
        "data": day,
        "passos": int(passos) if passos is not None else None,
        "kcal_gastas": round(kcal) if kcal is not None else None,
        "fc_media": int(fc_media) if fc_media is not None else None,
        "fc_max": int(fc_max) if fc_max is not None else None,
        "sono_min": round(sono_seg / 60) if sono_seg else None,
        "hrv": hrv_avg,
        "distancia_m": round(dist) if dist is not None else None,
        "minutos_ativos": round(ativos_seg / 60) if ativos_seg else None,
        "fonte": "garmin",
        "raw": {"stats": stats, "sleep": sleep, "hrv": hrv},
    }


def _activities(api: Garmin, start: str, end: str) -> list[dict[str, Any]]:
    """Normaliza atividades para o shape de wearable_activities."""
    raw = _safe(api.get_activities_by_date, start, end) or []
    out: list[dict[str, Any]] = []
    for a in raw:
        inicio = a.get("startTimeLocal") or a.get("startTimeGMT")
        if not inicio:
            continue
        out.append(
            {
                "inicio": str(inicio).replace(" ", "T"),
                "fim": None,
                "tipo": (a.get("activityType") or {}).get("typeKey") or "atividade",
                "kcal": round(a["calories"]) if a.get("calories") is not None else None,
                "fc_media": int(a["averageHR"]) if a.get("averageHR") is not None else None,
                "fc_max": int(a["maxHR"]) if a.get("maxHR") is not None else None,
                "distancia_m": round(a["distance"]) if a.get("distance") is not None else None,
                "raw": a,
            }
        )
    return out


def sync(token_b64: str, since_date: str | None, days: int = 3) -> dict[str, Any]:
    """
    Coleta dados de `since_date` (ou dos últimos `days` dias) até hoje.
    Retorna {"daily": [...], "activities": [...]} já normalizado.
    """
    api = login_with_token(token_b64)

    today = date.today()
    start = date.fromisoformat(since_date) if since_date else today - timedelta(days=days)
    if start > today:
        start = today

    daily: list[dict[str, Any]] = []
    d = start
    while d <= today:
        row = _daily_summary(api, d.isoformat())
        if row:
            daily.append(row)
        d += timedelta(days=1)

    activities = _activities(api, start.isoformat(), today.isoformat())
    return {"daily": daily, "activities": activities}
