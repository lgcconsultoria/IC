-- Fase 2: integração ROOK Connect
-- Adiciona coluna rook_user_id à tabela users para mapear o user_id do ROOK ao paciente.

alter table users add column if not exists rook_user_id text unique;
create index if not exists idx_users_rook_user_id on users (rook_user_id);

-- Permite que a equipe leia dados de wearable dos seus pacientes
create policy "staff_read_wearable_daily"
  on wearable_daily for select
  using (
    exists (
      select 1 from patients p
      join users u on u.id = auth.uid()
      where p.id = wearable_daily.patient_id
        and p.clinic_id = u.clinic_id
        and u.role in ('admin', 'medico', 'nutricionista', 'personal')
    )
  );

-- Paciente lê somente os próprios dados
create policy "patient_read_own_wearable_daily"
  on wearable_daily for select
  using (
    exists (
      select 1 from patients p
      where p.id = wearable_daily.patient_id
        and p.user_id = auth.uid()
    )
  );
