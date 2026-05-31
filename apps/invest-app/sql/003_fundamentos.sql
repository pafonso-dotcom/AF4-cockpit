-- ============================================================
-- Fundamentos dos ativos (base central de curadoria).
-- Uma linha por ticker, com os indicadores usados pelos critérios IdV.
-- Escrita SÓ pelo admin (service role no servidor); leitura por todos os
-- usuários logados (a classificação é a mesma pra todo mundo).
-- Rode no SQL Editor do Supabase.
-- ============================================================

create table if not exists public.fundamentos (
  ticker        text primary key,
  classe        text not null default 'fii',     -- fii | acao | stock | reit
  nome          text,
  -- indicadores (JSON flexível: { dy: 9.2, roe: 12, dividaEbitda: 2.1, ... })
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.fundamentos enable row level security;

-- Leitura: qualquer usuário autenticado.
drop policy if exists "fundamentos_select_auth" on public.fundamentos;
create policy "fundamentos_select_auth"
  on public.fundamentos for select
  using (auth.role() = 'authenticated');

-- Escrita: ninguém pelo cliente (só service role no servidor, que ignora RLS).
-- Sem políticas de insert/update/delete = bloqueado para o anon/auth.
