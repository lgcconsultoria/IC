-- =====================================================================
-- IC — Seed de bootstrap (rodar UMA vez, manualmente)
--
-- Cria a primeira clínica e o primeiro usuário ADMIN da equipe.
-- O vínculo com o Supabase Auth acontece quando esse admin fizer signup
-- com o MESMO e-mail (a trigger de provisionamento preenche o auth_uid).
--
-- >>> EDITE os valores abaixo antes de rodar. <<<
-- =====================================================================

with nova_clinica as (
  insert into clinics (nome, cnpj)
  values ('Clínica IC', null)
  returning id
)
insert into users (clinic_id, role, nome, email)
select id, 'admin', 'Administrador IC', 'lgclicitacao@gmail.com'
from nova_clinica;

-- Próximos passos:
-- 1) No Supabase Auth, faça signup/convite com o e-mail acima.
-- 2) A trigger on_auth_user_created vincula o auth_uid automaticamente.
-- 3) Logado como admin, cadastre os demais usuários da equipe e pacientes.
