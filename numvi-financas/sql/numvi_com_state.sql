-- ============================================================
-- NUMVI comercial — tabelas próprias no MESMO projeto Supabase
-- Rode no projeto pessoal (maqln…): Dashboard → SQL Editor → New Query → Run
-- ============================================================
-- Enquanto o comercial partilha o projeto do pessoal (limite de 2 projetos
-- grátis por conta), os dados ficam separados por TABELA:
--   pessoal   → numvi_state / numvi_keys      (já existentes)
--   comercial → numvi_com_state / numvi_com_keys  (estas)
-- Cada usuário só acessa as próprias linhas (RLS). O app comercial só lê/grava
-- nestas tabelas, então nunca enxerga os dados pessoais (numvi_state).

create table if not exists numvi_com_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists numvi_com_keys (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  keys       jsonb,
  updated_at timestamptz not null default now()
);

alter table numvi_com_state enable row level security;
alter table numvi_com_keys  enable row level security;

drop policy if exists owner_all on numvi_com_state;
create policy owner_all on numvi_com_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists owner_all on numvi_com_keys;
create policy owner_all on numvi_com_keys
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
