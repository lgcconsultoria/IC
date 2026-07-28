-- =====================================================================
-- IC — Migration 0007: Integração Garmin (login/senha via sidecar)
--
-- Substitui o fluxo ROOK (multi-provedor por webhook) por uma integração
-- Garmin-only, na qual o paciente conecta com email/senha do Garmin. O
-- backend obtém um token OAuth (garth) e o coleta os dados por polling.
--
-- Modelo de segurança:
--   * Os SEGREDOS (token OAuth, senha criptografada, estado de MFA) ficam em
--     garmin_secrets, gravados/lidos APENAS pelo backend (service_role, bypass
--     de RLS). Nenhuma policy para `authenticated` — nem a equipe nem o
--     paciente leem esses campos via API pública.
--   * O STATUS da conexão (sem segredos) fica em garmin_connections, legível
--     pelo próprio paciente e pela equipe da mesma clínica.
--   * Os dados coletados reaproveitam wearable_daily / wearable_activities
--     (fonte='garmin'), já expostos pelo painel — sem mudança no frontend.
-- =====================================================================

-- ----- 1) Constraint faltante em wearable_connections -----------------
-- O upsert de conexão usa onConflict('patient_id,provedor'); a constraint
-- correspondente não existia (bug latente herdado do código ROOK).
alter table wearable_connections
  add constraint wearable_connections_patient_provedor_key
  unique (patient_id, provedor);

-- ----- 2) Dedupe de atividades (backfill/poll idempotentes) -----------
alter table wearable_activities
  add constraint wearable_activities_dedupe
  unique (patient_id, inicio, tipo);

-- ----- 3) Status da conexão Garmin (SEM segredos; legível por RLS) -----
create table if not exists garmin_connections (
  patient_id   uuid primary key references patients(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending','active','mfa_pending','reauth_required','disconnected','error')),
  garmin_email text,
  last_sync_at timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_garmin_connections_status on garmin_connections (status);

-- ----- 4) Segredos Garmin (SOMENTE service_role; ciphertext) ----------
-- token_enc / password_enc / mfa_ctx_enc são AES-256-GCM (iv||tag||ct) com a
-- chave GARMIN_TOKEN_KEY guardada fora do banco, no secret store do host.
create table if not exists garmin_secrets (
  patient_id   uuid primary key references patients(id) on delete cascade,
  token_enc    text,
  password_enc text,
  mfa_ctx_enc  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----- 5) RLS -----------------------------------------------------------
alter table garmin_connections enable row level security;
alter table garmin_secrets     enable row level security;

-- garmin_connections: paciente lê a própria; equipe lê as da sua clínica.
create policy garmin_connections_patient_select on garmin_connections
  for select using (patient_id = app.current_patient_id());
create policy garmin_connections_staff_select on garmin_connections
  for select using (app.is_staff() and exists (
    select 1 from patients p
    where p.id = garmin_connections.patient_id
      and p.clinic_id = app.current_clinic_id()));

-- garmin_secrets: NENHUMA policy para authenticated.
-- Com RLS habilitado e sem policies, todo acesso via anon/authenticated é
-- negado; apenas o service_role (backend) enxerga a tabela.

-- ----- 6) Trigger de updated_at ----------------------------------------
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_garmin_connections_touch on garmin_connections;
create trigger trg_garmin_connections_touch
  before update on garmin_connections
  for each row execute function app.touch_updated_at();

drop trigger if exists trg_garmin_secrets_touch on garmin_secrets;
create trigger trg_garmin_secrets_touch
  before update on garmin_secrets
  for each row execute function app.touch_updated_at();
