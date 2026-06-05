-- =====================================================================
-- IC — Migration 0002: Policies de Row Level Security (RLS)
--
-- Regras de acesso:
--   * Backend (secret key / service_role) faz BYPASS de RLS — acesso total.
--   * Equipe da clínica (admin/medico/nutri/recepcao): acessa dados da SUA clínica.
--   * Paciente: acessa SOMENTE os próprios dados (alguns só leitura).
--
-- O vínculo é feito por public.users.auth_uid = auth.uid() (Supabase Auth).
-- =====================================================================

-- ----- Schema e funções auxiliares (SECURITY DEFINER evita recursão de RLS) -----
create schema if not exists app;

create or replace function app.current_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.users where auth_uid = auth.uid() limit 1;
$$;

create or replace function app.current_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  select clinic_id from public.users where auth_uid = auth.uid() limit 1;
$$;

create or replace function app.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_uid = auth.uid()
      and role in ('admin','medico','nutri','recepcao')
  );
$$;

create or replace function app.current_patient_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id
  from public.patients p
  join public.users u on u.id = p.user_id
  where u.auth_uid = auth.uid()
  limit 1;
$$;

-- ----- Grants básicos (RLS continua gateando o acesso real) -----
grant usage on schema app to anon, authenticated;
grant execute on all functions in schema app to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- =====================================================================
-- POLICIES
-- =====================================================================

-- ----- clinics -----
create policy clinics_staff_select on clinics
  for select using (app.is_staff() and id = app.current_clinic_id());

-- ----- users -----
create policy users_self_select on users
  for select using (auth_uid = auth.uid());
create policy users_staff_select on users
  for select using (app.is_staff() and clinic_id = app.current_clinic_id());

-- ----- patients -----
create policy patients_staff_all on patients
  for all
  using (app.is_staff() and clinic_id = app.current_clinic_id())
  with check (app.is_staff() and clinic_id = app.current_clinic_id());
create policy patients_self_select on patients
  for select using (user_id = app.current_user_id());

-- ----- measurements (paciente só leitura) -----
create policy measurements_staff_all on measurements
  for all
  using (app.is_staff() and exists (
    select 1 from patients p where p.id = measurements.patient_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from patients p where p.id = measurements.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy measurements_patient_select on measurements
  for select using (patient_id = app.current_patient_id());

-- ----- clinical_notes (prontuário: somente equipe) -----
create policy clinical_notes_staff_all on clinical_notes
  for all
  using (app.is_staff() and exists (
    select 1 from patients p where p.id = clinical_notes.patient_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from patients p where p.id = clinical_notes.patient_id
      and p.clinic_id = app.current_clinic_id()));

-- ----- documents (paciente pode enviar exames e ver os próprios) -----
create policy documents_staff_all on documents
  for all
  using (app.is_staff() and exists (
    select 1 from patients p where p.id = documents.patient_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from patients p where p.id = documents.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy documents_patient_select on documents
  for select using (patient_id = app.current_patient_id());
create policy documents_patient_insert on documents
  for insert with check (patient_id = app.current_patient_id());

-- ----- appointments (paciente só leitura) -----
create policy appointments_staff_all on appointments
  for all
  using (app.is_staff() and clinic_id = app.current_clinic_id())
  with check (app.is_staff() and clinic_id = app.current_clinic_id());
create policy appointments_patient_select on appointments
  for select using (patient_id = app.current_patient_id());

-- ----- meal_plans (paciente só leitura) -----
create policy meal_plans_staff_all on meal_plans
  for all
  using (app.is_staff() and exists (
    select 1 from patients p where p.id = meal_plans.patient_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from patients p where p.id = meal_plans.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy meal_plans_patient_select on meal_plans
  for select using (patient_id = app.current_patient_id());

-- ----- meal_plan_items (via meal_plans) -----
create policy meal_plan_items_staff_all on meal_plan_items
  for all
  using (app.is_staff() and exists (
    select 1 from meal_plans mp join patients p on p.id = mp.patient_id
    where mp.id = meal_plan_items.meal_plan_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from meal_plans mp join patients p on p.id = mp.patient_id
    where mp.id = meal_plan_items.meal_plan_id
      and p.clinic_id = app.current_clinic_id()));
create policy meal_plan_items_patient_select on meal_plan_items
  for select using (exists (
    select 1 from meal_plans mp
    where mp.id = meal_plan_items.meal_plan_id
      and mp.patient_id = app.current_patient_id()));

-- ----- food_logs (paciente registra e edita os próprios) -----
create policy food_logs_staff_all on food_logs
  for all
  using (app.is_staff() and exists (
    select 1 from patients p where p.id = food_logs.patient_id
      and p.clinic_id = app.current_clinic_id()))
  with check (app.is_staff() and exists (
    select 1 from patients p where p.id = food_logs.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy food_logs_patient_select on food_logs
  for select using (patient_id = app.current_patient_id());
create policy food_logs_patient_insert on food_logs
  for insert with check (patient_id = app.current_patient_id());
create policy food_logs_patient_update on food_logs
  for update using (patient_id = app.current_patient_id())
  with check (patient_id = app.current_patient_id());

-- ----- wearable_connections (paciente conecta o próprio relógio) -----
create policy wearable_connections_staff_select on wearable_connections
  for select using (app.is_staff() and exists (
    select 1 from patients p where p.id = wearable_connections.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy wearable_connections_patient_select on wearable_connections
  for select using (patient_id = app.current_patient_id());
create policy wearable_connections_patient_insert on wearable_connections
  for insert with check (patient_id = app.current_patient_id());

-- ----- wearable_daily (ingestão pelo backend; leitura por equipe e paciente) -----
create policy wearable_daily_staff_select on wearable_daily
  for select using (app.is_staff() and exists (
    select 1 from patients p where p.id = wearable_daily.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy wearable_daily_patient_select on wearable_daily
  for select using (patient_id = app.current_patient_id());

-- ----- wearable_activities -----
create policy wearable_activities_staff_select on wearable_activities
  for select using (app.is_staff() and exists (
    select 1 from patients p where p.id = wearable_activities.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy wearable_activities_patient_select on wearable_activities
  for select using (patient_id = app.current_patient_id());

-- ----- adherence_weekly -----
create policy adherence_weekly_staff_select on adherence_weekly
  for select using (app.is_staff() and exists (
    select 1 from patients p where p.id = adherence_weekly.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy adherence_weekly_patient_select on adherence_weekly
  for select using (patient_id = app.current_patient_id());

-- ----- alerts (somente equipe) -----
create policy alerts_staff_all on alerts
  for all
  using (app.is_staff() and clinic_id = app.current_clinic_id())
  with check (app.is_staff() and clinic_id = app.current_clinic_id());

-- ----- reports (paciente vê os próprios relatórios) -----
create policy reports_staff_select on reports
  for select using (app.is_staff() and exists (
    select 1 from patients p where p.id = reports.patient_id
      and p.clinic_id = app.current_clinic_id()));
create policy reports_patient_select on reports
  for select using (patient_id = app.current_patient_id());

-- ----- audit_log -----
-- Sem policies: acessível apenas pelo backend (service_role), que faz bypass de RLS.
