"""
Sidecar Garmin — API HTTP interna (FastAPI) consumida pelo backend NestJS.

Modelo atual: cada paciente tem uma URL MCP (gerada pelo amalgama após conectar
o Garmin dele). O backend guarda essa URL e a envia aqui; o sidecar age como
cliente MCP, puxa os dados e devolve normalizado. Sem login/senha do Garmin,
sem bloqueio de IP.

Não é exposta ao público: só o backend a acessa, com o header X-Connector-Secret.

Endpoints:
  GET  /health
  POST /sync   { mcp_url, since_date?, days? } -> { daily: [...], activities: [...] }
"""
from __future__ import annotations

import logging
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

import garmin_client as gc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("garmin_connector")

app = FastAPI(title="IC Garmin Connector (MCP)", version="2.0.0")

CONNECTOR_SECRET = os.environ.get("GARMIN_CONNECTOR_SECRET", "")


def require_secret(x_connector_secret: str | None = Header(default=None)) -> None:
    if not CONNECTOR_SECRET:
        logger.warning("GARMIN_CONNECTOR_SECRET ausente — sidecar sem proteção (dev)")
        return
    if x_connector_secret != CONNECTOR_SECRET:
        raise HTTPException(status_code=401, detail="segredo inválido")


class SyncBody(BaseModel):
    mcp_url: str
    since_date: str | None = None
    days: int = 3


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/sync", dependencies=[Depends(require_secret)])
async def sync(body: SyncBody) -> dict[str, object]:
    try:
        return await gc.sync(body.mcp_url, body.since_date, body.days)
    except Exception as exc:  # noqa: BLE001
        detail = (str(exc) or exc.__class__.__name__)[:400]
        logger.warning("sync falhou: %s", detail)
        raise HTTPException(status_code=502, detail=f"Falha ao coletar dados via MCP: {detail}") from exc
