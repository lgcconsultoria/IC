# Deploy no Railway (API + sidecar Garmin + Redis)

Guia para subir os serviços persistentes da plataforma IC no **Railway**. O
site (`ic-web`) continua na **Vercel** — aqui vão apenas a **API NestJS** (com o
poller BullMQ) e o **sidecar Python do Garmin**, que não rodam bem em serverless.

## Visão geral

Um único projeto Railway com **3 serviços** na mesma rede privada:

| Serviço | Origem | Root Directory | Público? |
|---|---|---|---|
| `ic-api` | este repositório (GitHub) | `/` (raiz) | **Sim** (o site chama a API) |
| `garmin-connector` | este repositório | `apps/connector-garmin` | **Não** (interno) |
| `Redis` | plugin do Railway | — | Não |

Os arquivos `railway.toml` (raiz e `apps/connector-garmin/`) já definem build e
start — o Railway lê ambos automaticamente por serviço.

---

## Passo 1 — Criar o projeto

1. Railway → **New Project** → **Deploy from GitHub repo** → selecione
   `lgcconsultoria/IC`.
2. Em **Settings → Environments/Branches**, escolha a branch a implantar
   (use `claude/saas-clinica-garmin-mcp-szjkbu` para testar em staging, ou
   `main`/branch default após o merge do PR #13).

## Passo 2 — Serviço `ic-api`

1. No serviço criado, **Settings → Root Directory** = `/` (raiz).
2. Build/Start já vêm do `railway.toml` da raiz (Nixpacks, Node 22).
3. **Settings → Networking → Generate Domain** (a API é pública).
4. Variáveis (Passo 5).

## Passo 3 — Serviço `garmin-connector`

1. **New Service → GitHub Repo** (mesmo repo) → **Settings → Root Directory** =
   `apps/connector-garmin` (usa o `Dockerfile`).
2. **NÃO** gere domínio público — é interno.
3. Variáveis:
   - `PORT=8000` (fixa a porta para a URL interna ficar determinística)
   - `GARMIN_CONNECTOR_SECRET=<mesmo segredo forte da API>`

## Passo 4 — Redis

1. **New → Database → Add Redis**. O Railway expõe `REDIS_URL` — referencie-a
   no `ic-api` (Passo 5).

## Passo 5 — Variáveis de ambiente do `ic-api`

| Nome | Valor / como obter |
|---|---|
| `SUPABASE_URL` | `https://abggorcelmvdanufjmff.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (Supabase → Settings → API) — **secreta** |
| `REDIS_URL` | referência ao Redis: `${{Redis.REDIS_URL}}` |
| `GARMIN_CONNECTOR_URL` | `http://garmin-connector.railway.internal:8000` (nome do serviço + porta do Passo 3) |
| `GARMIN_CONNECTOR_SECRET` | mesmo valor definido no sidecar (Passo 3) |
| `GARMIN_TOKEN_KEY` | gere: `openssl rand -base64 32` — **secreta**, 32 bytes |
| `GARMIN_STORE_PASSWORD` | `true` (re-login silencioso) |
| `GARMIN_BACKFILL_DAYS` | `30` |
| `GARMIN_POLL_INTERVAL_MS` | `21600000` (6h) |
| `GARMIN_POLL_ENABLED` | `true` |
| `CLAUDE_API_KEY` | chave da Anthropic (relatórios/IA) |
| `RESEND_API_KEY` | chave do Resend (e-mails), se for usar |

> `GARMIN_CONNECTOR_SECRET` deve ser **idêntico** nos dois serviços — é o header
> `X-Connector-Secret` que autentica a API no sidecar.

## Passo 6 — Migrations no Supabase

Aplique, em ordem, no SQL Editor do Supabase:
`0001` → `0002` → `0003` → `0004` → `0005` → `0006` → `0007_garmin_integration.sql`,
e depois `seed.sql` (uma vez). Se o projeto já tem até a `0006`, basta a `0007`.

## Passo 7 — Apontar o site (Vercel) para a API

No projeto `ic-web` da Vercel, ajuste `NEXT_PUBLIC_API_URL` para o domínio
público do `ic-api` gerado no Passo 2 (ex.: `https://ic-api-production.up.railway.app`)
e refaça o deploy.

## Passo 8 — Smoke test

1. `GET https://<ic-api>/api/health` → `{ "status": "ok" }`.
2. Portal do paciente → **Conectar Garmin** (email/senha; MFA se houver).
3. `POST /api/garmin/sync` (ou aguarde o poller) → conferir os gráficos no
   painel da clínica.
4. Logs do serviço `ic-api` devem mostrar `Poller Garmin ativo`.

---

## Notas

- **Rede privada IPv6:** o sidecar bind em `::` (já no Dockerfile) — exigência do
  Railway para `*.railway.internal`.
- **Segredos:** `GARMIN_TOKEN_KEY` fica só no `ic-api` (nunca no banco). Um dump
  do Postgres não revela tokens.
- **ToS do Garmin:** o sidecar usa a API não-oficial; mantenha o poll em 6h. Se
  houver bloqueio/captcha, reduza a frequência e avalie a Garmin Health API
  oficial (a troca fica isolada no sidecar).
