-- =====================================================================
-- IC — Migration inicial (MVP)
-- Schema base: clínicas, usuários, pacientes, evolução, agenda,
-- nutrição, wearables, aderência, alertas e auditoria.
-- RLS é habilitado; as policies finais são adicionadas em migration própria.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ----- Núcleo -----
create table clinics (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cnpj        text,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create type user_role as enum ('admin', 'medico', 'nutri', 'recepcao', 'paciente');

create table users (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  auth_uid    uuid unique,                 -- referência ao Supabase Auth
  role        user_role not null,
  nome        text not null,
  email       text not null,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table patients (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  user_id            uuid not null references users(id) on delete cascade,
  data_nasc          date,
  sexo               text check (sexo in ('F','M','outro')),
  altura_cm          numeric(5,1),
  objetivo           text,
  condicoes_clinicas text,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ----- Evolução clínica -----
create table measurements (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references patients(id) on delete cascade,
  data               date not null,
  peso_kg            numeric(5,2),
  imc                numeric(4,1),
  percentual_gordura numeric(4,1),
  massa_magra        numeric(5,2),
  circ_cintura       numeric(5,1),
  pressao            text,
  obs                text,
  created_at         timestamptz not null default now()
);
create index idx_measurements_patient_data on measurements (patient_id, data);

create table clinical_notes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  author_id   uuid not null references users(id),
  data        timestamptz not null default now(),
  conteudo    text not null
);

create table documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id) on delete cascade,
  tipo          text not null check (tipo in ('exame','receita','outro')),
  storage_path  text not null,
  nome_arquivo  text not null,
  uploaded_by   uuid references users(id),
  data          timestamptz not null default now()
);

-- ----- Agenda -----
create table appointments (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  profissional_id uuid not null references users(id),
  inicio          timestamptz not null,
  fim             timestamptz not null,
  tipo            text not null check (tipo in ('consulta','retorno','online')),
  status          text not null default 'agendado',
  link_video      text,
  obs             text,
  created_at      timestamptz not null default now()
);
create index idx_appointments_patient on appointments (patient_id, inicio);

-- ----- Nutrição -----
create table meal_plans (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references patients(id) on delete cascade,
  nutri_id          uuid not null references users(id),
  titulo            text not null,
  vigencia_inicio   date,
  vigencia_fim      date,
  kcal_meta_dia     integer,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now()
);

create table meal_plan_items (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null references meal_plans(id) on delete cascade,
  refeicao      text not null,
  descricao     text,
  alimentos     jsonb not null default '[]'::jsonb,
  kcal_estimada integer
);

create table food_logs (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id) on delete cascade,
  data          date not null,
  refeicao      text not null,
  descricao     text,
  foto_path     text,
  kcal_estimada integer,
  fonte         text not null default 'manual' check (fonte in ('manual','ia')),
  ia_payload    jsonb,
  confirmado_por uuid references users(id),
  created_at    timestamptz not null default now()
);
create index idx_food_logs_patient_data on food_logs (patient_id, data);

-- ----- Wearables (Terra) -----
create table wearable_connections (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id) on delete cascade,
  provedor      text not null,
  terra_user_id text unique,
  status        text not null default 'ativo',
  escopos       jsonb not null default '[]'::jsonb,
  conectado_em  timestamptz not null default now()
);

create table wearable_daily (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references patients(id) on delete cascade,
  data           date not null,
  passos         integer,
  kcal_gastas    integer,
  fc_media       integer,
  fc_max         integer,
  sono_min       integer,
  hrv            numeric(6,2),
  distancia_m    integer,
  minutos_ativos integer,
  fonte          text,
  raw            jsonb,
  unique (patient_id, data, fonte)
);
create index idx_wearable_daily_patient_data on wearable_daily (patient_id, data);

create table wearable_activities (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  inicio       timestamptz not null,
  fim          timestamptz,
  tipo         text,
  kcal         integer,
  fc_media     integer,
  fc_max       integer,
  distancia_m  integer,
  raw          jsonb
);
create index idx_wearable_activities_patient on wearable_activities (patient_id, inicio);

-- ----- Aderência, alertas, relatórios, auditoria -----
create table adherence_weekly (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references patients(id) on delete cascade,
  semana             date not null,
  score              numeric(5,2),
  treinos_realizados integer,
  meta_treinos       integer,
  kcal_aderencia     numeric(5,2),
  detalhes           jsonb,
  unique (patient_id, semana)
);

create table alerts (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  tipo        text not null check (tipo in ('queda_atividade','excesso_carga','abaixo_meta','sem_dados')),
  severidade  text not null default 'media' check (severidade in ('baixa','media','alta')),
  mensagem    text not null,
  status      text not null default 'aberto' check (status in ('aberto','visto','resolvido')),
  data        timestamptz not null default now()
);
create index idx_alerts_clinic_status on alerts (clinic_id, status);

create table reports (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id) on delete cascade,
  periodo       text not null,
  storage_path  text not null,
  gerado_em     timestamptz not null default now()
);

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id),
  acao        text not null,
  entidade    text not null,
  entidade_id uuid,
  data        timestamptz not null default now(),
  ip          text
);

-- ----- RLS (habilitar; policies em migration dedicada) -----
alter table clinics              enable row level security;
alter table users                enable row level security;
alter table patients             enable row level security;
alter table measurements         enable row level security;
alter table clinical_notes       enable row level security;
alter table documents            enable row level security;
alter table appointments         enable row level security;
alter table meal_plans           enable row level security;
alter table meal_plan_items      enable row level security;
alter table food_logs            enable row level security;
alter table wearable_connections enable row level security;
alter table wearable_daily       enable row level security;
alter table wearable_activities  enable row level security;
alter table adherence_weekly     enable row level security;
alter table alerts               enable row level security;
alter table reports              enable row level security;
alter table audit_log            enable row level security;
