-- =====================================================================
-- IC — Limpeza de dados de EXEMPLO/DEMO (seguro para produção)
--
-- Regras (conforme combinado):
--   • NÃO apaga os treinos reais da Isabella (paciente.teste), que vêm do
--     Garmin com fonte='garmin'.
--   • NÃO apaga nada inserido HOJE (created_at::date = current_date).
--   • Apaga apenas dados simulados antigos: séries de wearable e diário
--     alimentar com fonte de demo ('rook','terra','demo','seed'), e o
--     paciente fictício "Douglas Senturiao" com sua clínica de demonstração.
--
-- Rode por partes e confira as contagens antes/depois. Transacional:
-- começa em BEGIN e só efetiva no COMMIT (troque por ROLLBACK para abortar).
-- =====================================================================

begin;

-- ── 0) Inventário rápido (rode antes de apagar) ──────────────────────
-- select fonte, count(*) from wearable_daily group by fonte;
-- select fonte, count(*) from wearable_activities group by fonte;
-- select u.nome, u.email, p.id from patients p join users u on u.id = p.user_id;

-- Guarda o patient_id da Isabella para blindar os dados dela.
create temporary table if not exists _keep_patient as
select p.id
  from patients p
  join users u on u.id = p.user_id
 where lower(u.email) = lower('paciente.teste@clinicaic.com');

-- ── 1) Séries diárias de wearable simuladas (não-Garmin), exceto hoje ─
delete from wearable_daily wd
 where coalesce(wd.fonte, '') in ('rook', 'terra', 'demo', 'seed')
   and wd.patient_id not in (select id from _keep_patient)
   and coalesce(wd.created_at::date, current_date - 1) <> current_date;

-- ── 2) Atividades/treinos simulados (não-Garmin), exceto hoje ────────
delete from wearable_activities wa
 where coalesce(wa.fonte, '') in ('rook', 'terra', 'demo', 'seed')
   and wa.patient_id not in (select id from _keep_patient)
   and coalesce(wa.created_at::date, current_date - 1) <> current_date;

-- ── 3) Diário alimentar de demonstração, exceto hoje ─────────────────
-- (mantém tudo da Isabella e tudo criado hoje)
delete from food_logs fl
 where fl.patient_id not in (select id from _keep_patient)
   and coalesce(fl.created_at::date, current_date - 1) <> current_date
   and exists (
     select 1 from patients p
      join users u on u.id = p.user_id
     where p.id = fl.patient_id
       and lower(u.nome) like '%douglas%'
   );

-- ── 4) Paciente fictício "Douglas Senturiao" e sua clínica de demo ───
-- Remove o paciente demo por completo (measurements, notes, wearable, etc.
-- caem por ON DELETE CASCADE). NÃO toca em outras clínicas/pacientes.
do $$
declare
  v_pid uuid;
  v_uid uuid;
  v_cid uuid;
begin
  select p.id, p.user_id, p.clinic_id into v_pid, v_uid, v_cid
    from patients p
    join users u on u.id = p.user_id
   where lower(u.nome) like '%douglas%'
     and p.id not in (select id from _keep_patient)
   limit 1;

  if v_pid is not null then
    delete from patients where id = v_pid;
    -- remove o usuário-paciente órfão
    delete from users where id = v_uid and role = 'paciente';
    -- se a clínica de demo ("... Douglas ...") ficou sem pacientes, remove-a
    if exists (select 1 from clinics c where c.id = v_cid and c.nome ilike '%douglas%') then
      if not exists (select 1 from patients where clinic_id = v_cid) then
        delete from users where clinic_id = v_cid;
        delete from clinics where id = v_cid;
      end if;
    end if;
    raise notice 'Paciente demo Douglas removido.';
  else
    raise notice 'Nenhum paciente demo Douglas encontrado.';
  end if;
end $$;

drop table if exists _keep_patient;

-- Confira as contagens e então:
commit;      -- efetiva a limpeza
-- rollback; -- aborta tudo (use no lugar do commit para testar)
