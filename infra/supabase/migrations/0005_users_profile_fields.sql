-- Adiciona campos de perfil profissional à tabela users
alter table users
  add column if not exists crm          text,
  add column if not exists especialidade text,
  add column if not exists ativo        boolean not null default true;
