-- ============================================================
-- Investimentos SaaS · esquema inicial (multi-tenant)
-- Rode este SQL no seu projeto Supabase: SQL Editor → New query → Run.
-- ============================================================

-- Estado de Investimentos por usuário (um JSON por cliente).
create table if not exists public.invest_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Liga Row Level Security: sem políticas, ninguém acessa nada.
alter table public.invest_state enable row level security;

-- Isolamento: cada usuário só enxerga/edita a PRÓPRIA linha.
drop policy if exists "invest_state_select_own" on public.invest_state;
create policy "invest_state_select_own"
  on public.invest_state for select
  using (auth.uid() = user_id);

drop policy if exists "invest_state_insert_own" on public.invest_state;
create policy "invest_state_insert_own"
  on public.invest_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "invest_state_update_own" on public.invest_state;
create policy "invest_state_update_own"
  on public.invest_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "invest_state_delete_own" on public.invest_state;
create policy "invest_state_delete_own"
  on public.invest_state for delete
  using (auth.uid() = user_id);
