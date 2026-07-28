-- =====================================================================
-- IC — Migration 0008: Metabolismo (TMB/TDEE) + Bioimpedância (InBody)
--
-- 1) Campos de perfil no paciente para o cálculo automático de TMB
--    (Mifflin-St Jeor) e para guardar a calorimetria/TMB medido.
-- 2) Tabela body_composition: laudos de bioimpedância (InBody270) para
--    acompanhar a evolução de massa magra, gordura, % gordura, TMB, etc.
--    O TMB do aparelho é a calorimetria mais fiel e alimenta o metabolismo.
-- =====================================================================

-- ----- 1) Perfil metabólico do paciente ------------------------------
alter table patients
  add column if not exists peso_kg          numeric(5,1),
  add column if not exists nivel_atividade  text
      check (nivel_atividade in ('sedentario','leve','moderado','intenso','muito_intenso')),
  add column if not exists tmb_medido_kcal  integer,        -- calorimetria/InBody
  add column if not exists tmb_medido_por    uuid references users(id),
  add column if not exists tmb_medido_em     timestamptz;

-- ----- 2) Bioimpedância / composição corporal ------------------------
create table if not exists body_composition (
  id                       uuid primary key default gen_random_uuid(),
  patient_id               uuid not null references patients(id) on delete cascade,
  data_exame               date not null,
  peso_kg                  numeric(5,1),
  massa_magra_kg           numeric(5,1),   -- massa muscular esquelética
  massa_gorda_kg           numeric(5,1),
  pgc                      numeric(5,1),   -- percentual de gordura corporal
  imc                      numeric(5,1),
  massa_livre_gordura_kg   numeric(5,1),
  agua_corporal_l          numeric(5,1),
  proteina_kg              numeric(5,1),
  minerais_kg              numeric(5,1),
  gordura_visceral         numeric(5,1),
  tmb_kcal                 integer,        -- taxa metabólica basal do aparelho
  smi                      numeric(5,1),
  pontuacao                integer,
  relacao_cintura_quadril  numeric(4,2),
  fonte                    text not null default 'inbody',
  raw                      jsonb,
  criado_por               uuid references users(id),
  created_at               timestamptz not null default now(),
  unique (patient_id, data_exame, fonte)
);
create index if not exists idx_body_composition_patient
  on body_composition (patient_id, data_exame desc);

alter table body_composition enable row level security;

-- equipe da clínica do paciente: leitura/escrita
create policy body_composition_staff_all on body_composition
  for all using (app.is_staff() and exists (
    select 1 from patients p where p.id = body_composition.patient_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from patients p where p.id = body_composition.patient_id
      and p.clinic_id = app.current_clinic_id()));

-- paciente: leitura da própria evolução
create policy body_composition_patient_select on body_composition
  for select using (patient_id = app.current_patient_id());

grant select, insert, update, delete on body_composition to authenticated;
