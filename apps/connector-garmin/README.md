# garmin-connector (sidecar Python)

Serviço HTTP interno que dá à plataforma IC acesso multi-tenant aos dados do
Garmin Connect. É a **camada de dados do [garmin_mcp](https://github.com/Taxuspt/garmin_mcp)**
(mesmas bibliotecas `garth` + `python-garminconnect`), empacotada como serviço
stateless que atende muitos pacientes — em vez do MCP single-account.

## Por que um sidecar (e não o MCP direto)

O `garmin_mcp` autentica **uma conta Garmin por processo** e guarda o token em
`~/.garminconnect`. Para um SaaS com vários pacientes isso não escala. Aqui o
backend NestJS guarda os tokens (criptografados) por paciente e os passa a cada
chamada; o sidecar não persiste nada.

## Endpoints (uso interno — exige `X-Connector-Secret`)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET  | `/health` | — | `{ status }` |
| POST | `/login` | `{ email, password }` | `{ status: "ok", token }` **ou** `{ status: "mfa_required", mfa_ctx }` |
| POST | `/login/mfa` | `{ mfa_ctx, code }` | `{ status: "ok", token }` |
| POST | `/sync` | `{ token, since_date?, days? }` | `{ daily: [...], activities: [...] }` |

`token` é o bundle OAuth do garth serializado em base64. `daily`/`activities` já
saem no shape das tabelas `wearable_daily` / `wearable_activities`.

## Rodar localmente

```bash
cd apps/connector-garmin
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export GARMIN_CONNECTOR_SECRET=um-segredo-forte
uvicorn main:app --reload --port 8000
```

## Variáveis de ambiente

| Nome | Descrição |
|---|---|
| `GARMIN_CONNECTOR_SECRET` | Segredo compartilhado com o backend (header `X-Connector-Secret`). |
| `PORT` | Porta HTTP (padrão 8000). |

## Deploy

Container próprio no mesmo host persistente do backend (Railway/Render/Fly), na
rede privada, **sem** exposição pública. O backend o alcança via
`GARMIN_CONNECTOR_URL`.

## ⚠️ Aviso

`garth`/`python-garminconnect` usam a API **não-oficial** do Garmin Connect.
Login server-side a partir de IPs de datacenter pode disparar captcha/limites.
Mantenha o polling de baixa frequência (com jitter). Avaliar a Garmin Health API
oficial como caminho de longo prazo.
