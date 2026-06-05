-- =====================================================================
-- Seed: Douglas Senturiao — cliente fictício com dados simulados
-- Execute no SQL Editor do Supabase (dashboard → SQL Editor → New query)
-- =====================================================================

do $$
declare
  v_clinic_id   uuid;
  v_admin_id    uuid;
  v_patient_uid uuid;
  v_patient_id  uuid;
  v_today       date := current_date;
begin

  -- ── 1. Clínica ─────────────────────────────────────────────────────
  insert into clinics (nome, cnpj, config)
  values (
    'Clínica IC — Douglas Senturiao',
    null,
    '{"tema":"dark","idioma":"pt-BR"}'
  )
  returning id into v_clinic_id;

  -- ── 2. Usuário admin (equipe) ───────────────────────────────────────
  -- Após rodar este script, faça signup no Supabase Auth com este e-mail.
  -- A trigger on_auth_user_created preencherá o auth_uid automaticamente.
  insert into users (clinic_id, role, nome, email)
  values (v_clinic_id, 'admin', 'Douglas Senturiao', 'contato@licitacaogc.com.br')
  returning id into v_admin_id;

  -- ── 3. Usuário-paciente (para vincular ao registro patients) ────────
  insert into users (clinic_id, role, nome, email)
  values (v_clinic_id, 'paciente', 'Douglas Senturiao', 'contato@licitacaogc.com.br')
  returning id into v_patient_uid;

  -- ── 4. Registro patients ────────────────────────────────────────────
  insert into patients (
    clinic_id, user_id, data_nasc, sexo, altura_cm,
    objetivo, condicoes_clinicas, ativo
  )
  values (
    v_clinic_id, v_patient_uid,
    '1985-03-14', 'M', 178.0,
    'Melhorar condicionamento físico e reduzir percentual de gordura',
    'Sem condições crônicas conhecidas',
    true
  )
  returning id into v_patient_id;

  -- ── 5. Medições corporais (últimos 6 meses) ─────────────────────────
  insert into measurements (patient_id, data, peso_kg, imc, percentual_gordura, circ_cintura)
  values
    (v_patient_id, v_today - 180, 94.2, 29.8, 26.1, 98.0),
    (v_patient_id, v_today - 150, 93.0, 29.4, 25.6, 96.5),
    (v_patient_id, v_today - 120, 91.5, 28.9, 24.8, 94.0),
    (v_patient_id, v_today -  90, 90.1, 28.5, 24.1, 92.5),
    (v_patient_id, v_today -  60, 88.8, 28.1, 23.4, 90.0),
    (v_patient_id, v_today -  30, 87.4, 27.6, 22.7, 88.5),
    (v_patient_id, v_today      , 86.2, 27.2, 22.0, 87.0);

  -- ── 6. Notas clínicas ───────────────────────────────────────────────
  insert into clinical_notes (patient_id, author_id, data, conteudo)
  values
    (v_patient_id, v_admin_id, now() - interval '6 months',
     'Primeira consulta. Paciente relata sedentarismo nos últimos 2 anos. Iniciando protocolo de recomposição corporal com treino aeróbico 3x/semana e déficit calórico moderado de 400 kcal/dia.'),
    (v_patient_id, v_admin_id, now() - interval '3 months',
     'Revisão trimestral. Boa aderência ao plano. Perdeu 4,1 kg em 3 meses. Sono ainda irregular (média 5,8h). Ajustando meta de sono para 7h e incluindo treino de força 2x/semana.'),
    (v_patient_id, v_admin_id, now() - interval '1 month',
     'Revisão mensal. HRV melhorando consistentemente (47 → 58 ms). Paciente relatou sentir-se mais disposto. Reduzindo déficit calórico para 250 kcal para preservar massa muscular.');

  -- ── 7. Conexão wearable (Garmin simulado) ───────────────────────────
  insert into wearable_connections (patient_id, provedor, terra_user_id, status, escopos)
  values (
    v_patient_id, 'Garmin',
    'rook-' || left(v_patient_id::text, 8),
    'ativo',
    '["atividade","frequencia_cardiaca","sono","estresse","vo2max"]'
  );

  -- ── 8. Dados diários de wearable (últimos 30 dias) ──────────────────
  insert into wearable_daily (
    patient_id, data, passos, kcal_gastas, fc_media, fc_max,
    sono_min, hrv, distancia_m, minutos_ativos, fonte
  )
  select
    v_patient_id,
    v_today - s.i,
    -- passos: crescente com variação fim de semana
    case when extract(dow from v_today - s.i) in (0,6)
      then 4200 + (s.i * 80) + (random() * 1200)::int
      else 7800 + (s.i * 120) + (random() * 1500)::int
    end,
    -- kcal
    1800 + (s.i * 15) + (random() * 200)::int,
    -- fc média
    68 - (s.i / 10) + (random() * 8 - 4)::int,
    -- fc max
    142 + (random() * 20)::int,
    -- sono (minutos)
    (360 + (s.i * 2) + (random() * 40 - 20))::int,
    -- hrv (melhora ao longo do tempo)
    round((47 + (s.i * 0.37) + (random() * 8 - 4))::numeric, 1),
    -- distância metros
    5800 + (s.i * 90) + (random() * 1000)::int,
    -- minutos ativos
    28 + (s.i / 2) + (random() * 15)::int,
    'rook'
  from generate_series(0, 29) as s(i);

  -- ── 9. Alertas simulados ────────────────────────────────────────────
  -- (tabela alerts se existir no schema — senão ignorar)
  -- insert into alerts ...

  raise notice '✅ Cliente criado com sucesso!';
  raise notice '   Clínica ID : %', v_clinic_id;
  raise notice '   Admin ID   : %', v_admin_id;
  raise notice '   Paciente ID: %', v_patient_id;
  raise notice '';
  raise notice '👉 Próximo passo: no Supabase Auth, crie um usuário com';
  raise notice '   e-mail "contato@licitacaogc.com.br"';
  raise notice '   A trigger vinculará o auth_uid automaticamente.';

end $$;
