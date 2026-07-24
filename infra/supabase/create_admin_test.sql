-- =====================================================================
-- IC — Criar um ADMIN de teste com login (para ver os dados dos pacientes)
--
-- Cria/garante um usuário admin com conta no Supabase Auth (email/senha), na
-- MESMA clínica do paciente de teste — assim o painel da clínica lista esse
-- paciente e mostra os dados do Garmin dele. Idempotente (rerodar só reseta a
-- senha e o vínculo de clínica).
--
-- >>> EDITE e-mail/senha abaixo se quiser. <<<
-- =====================================================================

do $$
declare
  v_email     text := 'admin.teste@clinicaic.com';
  v_password  text := 'Admin@12345';
  v_nome      text := 'Admin Teste';
  v_clinic_id uuid;
  v_user_id   uuid;
  v_auth_id   uuid;
begin
  -- 1) usa a clínica do paciente de teste (para enxergar os dados dele);
  --    senão a primeira clínica; senão cria uma.
  select u.clinic_id into v_clinic_id
    from public.users u
   where lower(u.email) = lower('paciente.teste@clinicaic.com')
   limit 1;
  if v_clinic_id is null then
    select id into v_clinic_id from public.clinics limit 1;
  end if;
  if v_clinic_id is null then
    insert into public.clinics (nome) values ('Clínica IC') returning id into v_clinic_id;
  end if;

  -- 2) public.users (role=admin) na clínica escolhida
  select id into v_user_id from public.users where lower(email) = lower(v_email) limit 1;
  if v_user_id is null then
    insert into public.users (clinic_id, role, nome, email)
    values (v_clinic_id, 'admin', v_nome, v_email)
    returning id into v_user_id;
  else
    update public.users set clinic_id = v_clinic_id, role = 'admin', updated_at = now()
     where id = v_user_id;
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
      crypt(v_password, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''
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

  -- 4) vincula o auth_uid
  update public.users set auth_uid = v_auth_id, updated_at = now() where id = v_user_id;
end $$;
