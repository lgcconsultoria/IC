-- Fase 2: integração ROOK Connect
-- Adiciona coluna rook_user_id à tabela users para mapear o user_id do ROOK ao paciente.

alter table users add column if not exists rook_user_id text unique;
create index if not exists idx_users_rook_user_id on users (rook_user_id);

-- Nota: a leitura de wearable_daily por equipe e por paciente já é coberta
-- corretamente em 0002_rls_policies.sql (via funções do schema app:
-- app.is_staff / app.current_clinic_id / app.current_patient_id).
-- As policies que existiam aqui foram REMOVIDAS por estarem quebradas:
--   1) referenciavam valores de enum inexistentes ('nutricionista','personal')
--      — o user_role válido é admin|medico|nutri|recepcao|paciente;
--   2) comparavam users.id com auth.uid(), quando o vínculo correto é
--      users.auth_uid = auth.uid().
-- Limpeza idempotente de eventuais resíduos:
drop policy if exists "staff_read_wearable_daily" on wearable_daily;
drop policy if exists "patient_read_own_wearable_daily" on wearable_daily;
