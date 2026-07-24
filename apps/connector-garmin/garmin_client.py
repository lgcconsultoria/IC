"""
Cliente MCP do Garmin (via amalgama).

Cada paciente tem uma URL MCP própria (ex.: https://garmin.amalgama.co/api/v1/
mcp/<uuid>) que o amalgama gera após conectar o Garmin dele. Este módulo fala o
protocolo MCP com essa URL, chama as tools de dados (atividades, sono, HRV) e
normaliza para o shape de wearable_daily / wearable_activities.

Vantagem sobre o login direto no Garmin: quem autentica no Garmin é o amalgama —
então não há bloqueio de IP (Cloudflare 1006) nem senha guardada por nós.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from typing import Any

from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client

logger = logging.getLogger("garmin_client")


# --------------------------------------------------------------------------- #
# Chamada MCP                                                                  #
# --------------------------------------------------------------------------- #
def _result_to_json(result: Any) -> Any:
    """Extrai o JSON do conteúdo textual de um CallToolResult."""
    parts: list[str] = []
    for c in getattr(result, "content", []) or []:
        text = getattr(c, "text", None)
        if text:
            parts.append(text)
    raw = "".join(parts).strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


async def _call(session: ClientSession, name: str, args: dict[str, Any]) -> Any:
    try:
        res = await session.call_tool(name, args)
        return _result_to_json(res)
    except Exception as exc:  # noqa: BLE001 — tool pode não existir/estar vazia
        logger.warning("tool %s falhou: %s", name, exc)
        return None


async def _collect(mcp_url: str, since_date: str, today: str) -> tuple[Any, Any, Any]:
    """Abre a sessão MCP e chama as tools; tenta streamable-http e cai para SSE."""

    async def via_streamable() -> tuple[Any, Any, Any]:
        async with streamablehttp_client(mcp_url) as (read, write, _get_sid):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return await _pull(session, since_date, today)

    async def via_sse() -> tuple[Any, Any, Any]:
        async with sse_client(mcp_url) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return await _pull(session, since_date, today)

    try:
        return await via_streamable()
    except Exception as exc:  # noqa: BLE001 — fallback para SSE
        logger.warning("streamable-http falhou (%s); tentando SSE", exc)
        return await via_sse()


async def _pull(session: ClientSession, since_date: str, today: str) -> tuple[Any, Any, Any]:
    activities = await _call(session, "list_activities", {"limit": 100})
    sleep = await _call(
        session, "get_sleep_summary", {"from_date": since_date, "to_date": today, "limit": 90}
    )
    hrv = await _call(
        session, "get_hrv_status", {"from_date": since_date, "to_date": today, "limit": 90}
    )
    return activities, sleep, hrv


# --------------------------------------------------------------------------- #
# Normalização                                                                 #
# --------------------------------------------------------------------------- #
def _first(d: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def _as_int(v: Any) -> int | None:
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return None


def _norm_activities(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(raw, list):
        return out
    for a in raw:
        if not isinstance(a, dict):
            continue
        inicio = _first(a, "start_time", "startTimeGMT", "startTimeLocal")
        if not inicio:
            continue
        inicio_iso = str(inicio).replace(" ", "T")
        dur = _first(a, "duration_seconds", "duration")
        fim_iso = None
        if dur:
            try:
                base = datetime.fromisoformat(inicio_iso.replace("Z", "+00:00"))
                fim_iso = (base + timedelta(seconds=float(dur))).isoformat()
            except (ValueError, TypeError):
                fim_iso = None
        tipo = _first(a, "activity_type", "activityType") or "atividade"
        out.append(
            {
                "inicio": inicio_iso,
                "fim": fim_iso,
                "tipo": str(tipo).lower(),
                "kcal": _as_int(_first(a, "calories", "active_kilocalories")),
                "fc_media": _as_int(_first(a, "average_heart_rate_in_beats_per_minute", "averageHR", "avg_hr")),
                "fc_max": _as_int(_first(a, "max_heart_rate_in_beats_per_minute", "maxHR", "max_hr")),
                "distancia_m": _as_int(_first(a, "distance_meters", "distance")),
                "raw": a,
            }
        )
    return out


def _daily_from(sleep: Any, hrv: Any) -> dict[str, dict[str, Any]]:
    """Constrói linhas diárias (por data) a partir de sono e HRV (best-effort)."""
    days: dict[str, dict[str, Any]] = {}

    def row(d: str) -> dict[str, Any]:
        return days.setdefault(d, {"data": d, "fonte": "garmin"})

    if isinstance(sleep, list):
        for s in sleep:
            if not isinstance(s, dict):
                continue
            d = _first(s, "calendar_date", "date", "day")
            if not d:
                continue
            d = str(d)[:10]
            secs = _first(s, "total_sleep_seconds", "sleep_time_seconds", "duration_seconds", "sleep_seconds")
            mins = _first(s, "total_sleep_minutes", "sleep_minutes")
            r = row(d)
            if secs is not None:
                r["sono_min"] = _as_int(float(secs) / 60)
            elif mins is not None:
                r["sono_min"] = _as_int(mins)
            r.setdefault("raw", {})["sleep"] = s

    if isinstance(hrv, list):
        for h in hrv:
            if not isinstance(h, dict):
                continue
            d = _first(h, "calendar_date", "date", "day")
            if not d:
                continue
            d = str(d)[:10]
            avg = _first(h, "last_night_avg", "avg", "weekly_avg", "hrv_avg", "value")
            r = row(d)
            if avg is not None:
                try:
                    r["hrv"] = float(avg)
                except (TypeError, ValueError):
                    pass
            r.setdefault("raw", {})["hrv"] = h

    return days


async def sync(mcp_url: str, since_date: str | None, days: int = 3) -> dict[str, Any]:
    """
    Coleta dados via MCP do paciente desde `since_date` (ou últimos `days` dias).
    Retorna {"daily": [...], "activities": [...]} normalizado.
    """
    today = date.today()
    start = date.fromisoformat(since_date) if since_date else today - timedelta(days=days)
    if start > today:
        start = today
    since_str = start.isoformat()
    today_str = today.isoformat()

    activities, sleep, hrv = await _collect(mcp_url, since_str, today_str)

    acts = _norm_activities(activities)
    daily_map = _daily_from(sleep, hrv)
    # mantém só linhas diárias com algum dado útil
    daily = [r for r in daily_map.values() if r.get("sono_min") is not None or r.get("hrv") is not None]
    return {"daily": daily, "activities": acts}
