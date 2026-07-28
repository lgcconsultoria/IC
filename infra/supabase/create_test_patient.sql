-- =====================================================================
-- IC — Criar um PACIENTE de teste com login (para testar o fluxo Garmin)
--
-- Cria/garante: clínica + public.users (role=paciente) + conta no Supabase
-- Auth (email/senha, e-mail confirmado) + linha em public.patients, e vincula
-- o auth_uid. Idempotente: rodar de novo só reseta a senha.
--
-- Pré-requisito: aplicar antes as migrations 0001..0007 (o fluxo Garmin usa
-- garmin_connections/garmin_secrets da 0007).
--
-- >>> EDITE e-mail/senha abaixo se quiser. <<<
-- =====================================================================

do $$
declare
  v_email     text := 'paciente.teste@clinicaic.com';
  v_password  text := 'Teste@12345';
  v_nome      text := 'Paciente Teste';
  v_clinic_id uuid;
  v_user_id   uuid;   -- public.users.id
  v_auth_id   uuid;   -- auth.users.id
begin
  -- 1) clínica (usa a primeira; cria se não houver)
  select id into v_clinic_id from public.clinics limit 1;
  if v_clinic_id is null then
    insert into public.clinics (nome) values ('Clínica IC') returning id into v_clinic_id;
  end if;

  -- 2) public.users (role=paciente)
  select id into v_user_id from public.users where lower(email) = lower(v_email) limit 1;
  if v_user_id is null then
    insert into public.users (clinic_id, role, nome, email)
    values (v_clinic_id, 'paciente', v_nome, v_email)
    returning id into v_user_id;
  end if;

  -- 3) conta no Supabase Auth (email + senha, já confirmada)
  select id into v_auth_id from auth.users where lower(email) = lower(v_email);
  if v_auth_id is null then
    v_auth_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_auth_id,
      'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_auth_id::text, v_auth_id,
      jsonb_build_object('sub', v_auth_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_auth_id;
  end if;

  -- 4) vincula o auth_uid na linha de public.users
  update public.users set auth_uid = v_auth_id, updated_at = now() where id = v_user_id;

  -- 5) linha em public.patients (o fluxo Garmin resolve patient_id por aqui)
  if not exists (select 1 from public.patients where user_id = v_user_id) then
    insert into public.patients (clinic_id, user_id, sexo, objetivo, ativo)
    values (v_clinic_id, v_user_id, 'outro', 'Teste de integração Garmin', true);
  end if;

  raise notice 'Paciente de teste pronto: %  /  senha: %  (clinic %)', v_email, v_password, v_clinic_id;
end $$;
