-- ============================================================
-- NUMVI Finanças (comercial) — armazenamento isolado por usuário
-- Rode no Supabase: Dashboard → SQL Editor → New Query → Run
-- ============================================================
-- Cria tabelas PRÓPRIAS do produto comercial (numvi_state / numvi_keys),
-- separadas do app pessoal (aurum_state). Cada usuário só acessa as
-- próprias linhas (RLS). Sem isso, o comercial compartilharia os dados
-- com o app pessoal.

create table if not exists numvi_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists numvi_keys (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  keys       jsonb,
  updated_at timestamptz not null default now()
);

alter table numvi_state enable row level security;
alter table numvi_keys  enable row level security;

drop policy if exists owner_all on numvi_state;
create policy owner_all on numvi_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists owner_all on numvi_keys;
create policy owner_all on numvi_keys
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
