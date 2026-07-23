"""
Sidecar Garmin — API HTTP interna (FastAPI) consumida pelo backend NestJS.

Não é exposta ao público: só o backend a acessa, na rede privada, com o header
X-Connector-Secret. É stateless — recebe token/credenciais em cada chamada e
nunca persiste nada em disco.

Endpoints:
  GET  /health
  POST /login       { email, password }        -> { status: "ok"|"mfa_required", token?, mfa_ctx? }
  POST /login/mfa   { mfa_ctx, code }           -> { status: "ok", token }
  POST /sync        { token, since_date?, days? } -> { daily: [...], activities: [...] }
"""
from __future__ import annotations

import logging
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

import garmin_client as gc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("garmin_connector")

app = FastAPI(title="IC Garmin Connector", version="1.0.0")

CONNECTOR_SECRET = os.environ.get("GARMIN_CONNECTOR_SECRET", "")


def require_secret(x_connector_secret: str | None = Header(default=None)) -> None:
    if not CONNECTOR_SECRET:
        logger.warning("GARMIN_CONNECTOR_SECRET ausente — sidecar sem proteção (dev)")
        return
    if x_connector_secret != CONNECTOR_SECRET:
        raise HTTPException(status_code=401, detail="segredo inválido")


class LoginBody(BaseModel):
    email: str
    password: str


class MfaBody(BaseModel):
    mfa_ctx: str
    code: str


class SyncBody(BaseModel):
    token: str
    since_date: str | None = None
    days: int = 3


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/login", dependencies=[Depends(require_secret)])
def login(body: LoginBody) -> dict[str, str]:
    try:
        token = gc.login(body.email, body.password)
        return {"status": "ok", "token": token}
    except gc.MfaRequired as mfa:
        return {"status": "mfa_required", "mfa_ctx": mfa.mfa_ctx}
    except Exception as exc:  # noqa: BLE001
        logger.warning("login falhou: %s", exc)
        raise HTTPException(status_code=401, detail="Credenciais Garmin inválidas") from exc


@app.post("/login/mfa", dependencies=[Depends(require_secret)])
def login_mfa(body: MfaBody) -> dict[str, str]:
    try:
        token = gc.resume_mfa(body.mfa_ctx, body.code)
        return {"status": "ok", "token": token}
    except Exception as exc:  # noqa: BLE001
        logger.warning("mfa falhou: %s", exc)
        raise HTTPException(status_code=401, detail="Código MFA inválido ou expirado") from exc


@app.post("/sync", dependencies=[Depends(require_secret)])
def sync(body: SyncBody) -> dict[str, object]:
    try:
        return gc.sync(body.token, body.since_date, body.days)
    except Exception as exc:  # noqa: BLE001
        logger.warning("sync falhou: %s", exc)
        raise HTTPException(status_code=502, detail="Falha ao coletar dados do Garmin") from exc
