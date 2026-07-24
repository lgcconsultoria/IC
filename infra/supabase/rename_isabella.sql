-- =====================================================================
-- IC — Renomear o paciente de teste para "Isabella Cruz"
--
-- O nome do paciente vive em public.users.nome (a tabela patients faz join
-- em users para exibir o nome). Atualiza também o metadado do Supabase Auth
-- para manter consistência no login. Idempotente.
-- =====================================================================

do $$
declare
  v_email text := 'paciente.teste@clinicaic.com';
  v_nome  text := 'Isabella Cruz';
begin
  update public.users
     set nome = v_nome, updated_at = now()
   where lower(email) = lower(v_email);

  update auth.users
     set raw_user_meta_data =
           coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('nome', v_nome, 'name', v_nome),
         updated_at = now()
   where lower(email) = lower(v_email);

  raise notice 'Paciente % renomeado para %', v_email, v_nome;
end $$;
