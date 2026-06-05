# Supabase — IC

Infraestrutura de banco (PostgreSQL), Auth e Storage da plataforma IC.

## Migrations

- `migrations/0001_init.sql` — schema base do MVP (tabelas + RLS habilitado).
- As **policies de RLS** (quem vê o quê) serão adicionadas em `0002_rls_policies.sql`.

## Como aplicar (local)

Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase start                 # sobe Postgres/Auth/Storage local
supabase db reset              # aplica migrations do zero
```

Ou aplique o SQL diretamente em um banco existente:

```bash
psql "$DATABASE_URL" -f migrations/0001_init.sql
```

## Buckets de Storage (criar)

- `documents` — exames/receitas (privado, URLs assinadas).
- `meal-photos` — fotos de refeição para a IA (privado).

## Observações LGPD

Dados de saúde são sensíveis. Antes de produção: confirmar região do projeto,
assinar DPA, definir policies de RLS por paciente/clínica e política de retenção.
