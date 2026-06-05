-- =====================================================================
-- IC — Migration 0003: Provisionamento de usuários (Supabase Auth)
--
-- Vincula a conta do Supabase Auth (auth.users) à linha correspondente
-- em public.users, casando pelo e-mail. Assim a equipe pré-cadastra o
-- paciente (users + patients) e, quando ele faz signup com o mesmo e-mail,
-- o auth_uid é preenchido automaticamente — habilitando as policies de RLS.
-- =====================================================================

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set auth_uid = new.id,
         updated_at = now()
   where lower(email) = lower(new.email)
     and auth_uid is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();
