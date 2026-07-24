-- =====================================================================
-- IC — Limpeza de dados de EXEMPLO (seguro para produção)
--
-- Confirmado com o cliente:
--   • MANTER o paciente "douglas" (douglas@senturiaoadv.com.br) na Clínica IC
--     — é o próprio dono, paciente real.
--   • MANTER a Isabella (paciente.teste@clinicaic.com) e todos os treinos dela.
--   • REMOVER a clínica de demonstração "Clínica IC — Douglas Senturiao"
--     (admin contato@licitacaogc.com.br) e tudo que pertence a ela.
--
-- Só toca na clínica de demonstração. Nada da "Clínica IC" é alterado.
-- Transacional: confira as contagens e troque commit por rollback se quiser.
-- =====================================================================

begin;

-- 0) Confira o que será removido ANTES (opcional):
-- select c.id, c.nome, count(p.id) as pacientes
--   from clinics c left join patients p on p.clinic_id = c.id
--  where c.nome ilike '%Douglas Senturiao%'
--  group by c.id, c.nome;

do $$
declare
  v_cid uuid;
begin
  select id into v_cid
    from clinics
   where nome ilike '%Douglas Senturiao%'   -- a clínica de demonstração
   limit 1;

  if v_cid is null then
    raise notice 'Nenhuma clínica de demonstração encontrada — nada a remover.';
    return;
  end if;

  -- Trava de segurança: nunca apagar a "Clínica IC" real.
  if exists (select 1 from clinics where id = v_cid and nome = 'Clínica IC') then
    raise exception 'Abortado: a clínica alvo é a Clínica IC real.';
  end if;

  -- Pacientes da clínica demo → apaga (measurements, wearable_*, food_logs,
  -- body_composition, etc. caem por ON DELETE CASCADE).
  delete from patients where clinic_id = v_cid;

  -- Usuários (equipe e pacientes) dessa clínica.
  delete from users where clinic_id = v_cid;

  -- A clínica em si.
  delete from clinics where id = v_cid;

  raise notice 'Clínica de demonstração removida (id=%).', v_cid;
end $$;

-- Confira e então:
commit;      -- efetiva
-- rollback; -- aborta (use no lugar do commit para testar antes)
