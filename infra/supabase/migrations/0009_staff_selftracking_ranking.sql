-- =====================================================================
-- IC — Migration 0009: Autoacompanhamento da equipe + suporte a ranking
--
-- Funcionários da clínica (médico, enfermeiro, nutri, recepção) também podem
-- conectar o próprio relógio e acompanhar a evolução. Para reaproveitar toda
-- a máquina existente (Garmin, medições, bioimpedância, metabolismo), cada
-- funcionário ganha um registro em `patients` vinculado ao próprio usuário,
-- marcado com `eh_funcionario = true`.
--
-- Esse flag também alimenta o filtro "Funcionários" do ranking e mantém a
-- lista de Pacientes limpa (só pacientes reais).
-- =====================================================================

alter table patients
  add column if not exists eh_funcionario boolean not null default false;

-- Índice para o ranking e para separar pacientes de funcionários por clínica.
create index if not exists idx_patients_clinic_funcionario
  on patients (clinic_id, eh_funcionario);
