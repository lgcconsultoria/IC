# Deploy na Vercel (site + API)

O monorepo gera **dois projetos Vercel** a partir do mesmo repositório:

| Projeto | Root Directory | Framework | O que é |
|---|---|---|---|
| `ic-api` | `apps/api` | Other | API NestJS (serverless function) |
| `ic-web` | `apps/web` | Next.js | Site (portal + painel) |

> Importante: cada projeto aponta para uma **subpasta** (Root Directory). A
> Vercel detecta o workspace pnpm na raiz e instala tudo automaticamente.

---

## 1) Projeto da API (`ic-api`)

Já existe. Ajuste em **Settings**:

- **Root Directory:** `apps/api`
- **Framework Preset:** Other
- Build/Install/Output já vêm do `apps/api/vercel.json` (não precisa mexer).

### Variáveis de ambiente (Settings → Environment Variables)

| Nome | Valor | Observação |
|---|---|---|
| `SUPABASE_URL` | `https://abggorcelmvdanufjmff.supabase.co` | |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | **secreta** — só aqui, nunca no front |

Depois de salvar, faça **Redeploy**.

### Como funciona

- `apps/api/vercel.json` roda `pnpm build` (gera `dist/`) e expõe
  `apps/api/api/index.ts` como função serverless.
- O `rewrites` manda todas as rotas para essa função; o NestJS responde sob o
  prefixo `/api` (ex.: `/api/health`, `/api/patients`, Swagger em `/api/docs`).

### Teste rápido após o deploy

```
GET https://ic-api.vercel.app/api/health   ->  { "status": "ok", ... }
```

---

## 2) Projeto do site (`ic-web`)

Crie um **novo projeto** na Vercel a partir do mesmo repositório:

- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js (detectado automaticamente)

### Variáveis de ambiente

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abggorcelmvdanufjmff.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `NEXT_PUBLIC_API_URL` | `https://ic-api.vercel.app` |

> `NEXT_PUBLIC_API_URL` deve apontar para a **URL da API** (projeto `ic-api`).
> Variáveis `NEXT_PUBLIC_*` são embutidas no build — após alterá-las, refaça o deploy.

---

## Ordem recomendada

1. Configure e faça deploy da **API** (`ic-api`) → copie a URL final.
2. Configure o **site** (`ic-web`) com `NEXT_PUBLIC_API_URL` = URL da API.
3. Deploy do site.

## Pré-requisitos no Supabase (uma vez)

Antes de logar no ambiente publicado, aplique no **SQL Editor**:
`0001_init.sql` → `0002_rls_policies.sql` → `0003_auth_provisioning.sql` → `seed.sql`,
e crie a senha do admin no **Authentication** com o e-mail do seed.

## Limitações (serverless)

Filas (BullMQ/Redis), workers e webhooks de longa duração da Terra **não** rodam
bem em serverless. Quando entrarmos nessas integrações (Fase 3), a API deve
migrar para um host Node persistente (Railway/Render/Fly) — o código não muda,
só o destino do deploy.
