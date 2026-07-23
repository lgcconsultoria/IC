# Clínica IC — Plataforma Web

Sistema de gestão clínica e acompanhamento de emagrecimento saudável:
prontuário e evolução de pacientes, portal do paciente, nutrição (com contagem
de calorias por IA) e acompanhamento remoto via wearables (Garmin).

> 📐 Arquitetura completa em [`docs/arquitetura.md`](docs/arquitetura.md).

## Stack

- **Frontend:** Next.js + React + TypeScript (`apps/web`)
- **Backend:** NestJS + TypeScript (`apps/api`)
- **Banco/Auth/Storage:** Supabase (PostgreSQL) — `infra/supabase`
- **Filas:** BullMQ + Redis
- **Wearables:** Garmin — sidecar Python (`apps/connector-garmin`) reusando o núcleo
  do [garmin_mcp](https://github.com/Taxuspt/garmin_mcp) (`garth` + `python-garminconnect`)
- **IA de calorias:** modelo multimodal (Claude / GPT-4o)
- **Monorepo:** pnpm + Turborepo

## Estrutura

```
apps/
  web/                # Next.js (portal do paciente + painel da clínica)
  api/                # NestJS (REST + poller Garmin)
  connector-garmin/  # sidecar Python (FastAPI) — dados do Garmin Connect
packages/
  types/              # tipos/contratos compartilhados (TS)
  config/             # configs base compartilhadas
infra/
  supabase/           # migrations e setup do banco
  docker/             # serviços de apoio p/ dev (Redis)
docs/                 # documentação (arquitetura)
```

## Desenvolvimento

```bash
pnpm install            # instala dependências do monorepo
cp .env.example .env    # configure as variáveis

# serviços de apoio (Redis) e banco local
docker compose -f infra/docker/docker-compose.yml up -d
supabase start          # requer Supabase CLI

pnpm dev                # sobe web (3000) e api (3333)
```

- API: http://localhost:3333/api · Swagger: http://localhost:3333/api/docs
- Web: http://localhost:3000

## Scripts (raiz)

| Comando | Ação |
|---|---|
| `pnpm dev` | Sobe todos os apps em modo watch |
| `pnpm build` | Build de todos os apps/pacotes |
| `pnpm lint` | Lint |
| `pnpm typecheck` | Checagem de tipos |
| `pnpm test` | Testes |

## Status

Fase 0 (fundação do monorepo) — esqueleto inicial. Veja o roadmap por fases
em [`docs/arquitetura.md`](docs/arquitetura.md).
