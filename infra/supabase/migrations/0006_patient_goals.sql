-- Adds goals JSONB column to store per-patient prescribed goals
alter table public.patients
  add column if not exists goals jsonb;
