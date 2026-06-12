-- =====================================================================
-- IC — Migration 0006: Metas do paciente (patient_goals)
--
-- Uma linha por paciente com as metas prescritas pela equipe.
-- RLS: equipe da clínica gerencia; paciente lê as próprias metas.
-- Usa as funções auxiliares do schema app (definidas em 0002).
-- =====================================================================

create table if not exists patient_goals (
  patient_id      uuid primary key references patients(id) on delete cascade,
  meta_passos     integer,
  meta_kcal       integer,
  meta_treinos    integer,
  meta_min_ativos integer,
  meta_sono_h     numeric(3,1),
  meta_peso_kg    numeric(5,1),
  updated_by      uuid references users(id),
  updated_at      timestamptz not null default now()
);

alter table patient_goals enable row level security;

-- equipe da clínica do paciente: leitura/escrita
create policy patient_goals_staff_all on patient_goals
  for all
  using (app.is_staff() and exists (
    select 1 from patients p
    where p.id = patient_goals.patient_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from patients p
    where p.id = patient_goals.patient_id
      and p.clinic_id = app.current_clinic_id()));

-- paciente: leitura das próprias metas
create policy patient_goals_patient_select on patient_goals
  for select using (patient_id = app.current_patient_id());

grant select, insert, update, delete on patient_goals to authenticated;
