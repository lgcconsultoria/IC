-- =====================================================================
-- IC — Criar/atualizar o usuário ADMIN de login direto pelo SQL Editor
--
-- Alternativa à tela Authentication > Add user. Cria a conta no Supabase Auth
-- (auth.users + auth.identities) com senha criptografada (bcrypt) e e-mail
-- já confirmado, garante a clínica + a linha em public.users (role=admin) e
-- vincula o auth_uid. Idempotente: rodar de novo apenas reseta a senha.
--
-- >>> EDITE o e-mail e a senha abaixo antes de rodar. <<<
-- Depois de logar, troque a senha por uma definitiva.
-- =====================================================================

do $$
declare
  v_email    text := 'lgclicitacao@gmail.com';
  v_password text := 'MudarEsta@123';   -- <<< defina sua senha aqui
  v_nome     text := 'Administrador IC';
  v_user_id  uuid;
  v_clinic_id uuid;
begin
  -- 1) garante uma clínica
  select id into v_clinic_id from public.clinics limit 1;
  if v_clinic_id is null then
    insert into public.clinics (nome) values ('Clínica IC') returning id into v_clinic_id;
  end if;

  -- 2) garante a linha em public.users (admin)
  if not exists (select 1 from public.users where lower(email) = lower(v_email)) then
    insert into public.users (clinic_id, role, nome, email)
    values (v_clinic_id, 'admin', v_nome, v_email);
  end if;

  -- 3) cria (ou recupera) a conta no Supabase Auth
  select id into v_user_id from auth.users where lower(email) = lower(v_email);

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id,
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
      gen_random_uuid(), v_user_id::text, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    -- já existe: apenas reseta a senha e garante e-mail confirmado
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_user_id;
  end if;

  -- 4) vincula o auth_uid na linha de public.users
  update public.users
     set auth_uid = v_user_id, updated_at = now()
   where lower(email) = lower(v_email);
end $$;
