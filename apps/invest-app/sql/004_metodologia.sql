-- ============================================================
-- Metodologia de análise (por classe) — texto que guia a IA.
-- Uma linha por classe (fii/acao/stock/reit). Só o admin escreve.
-- Rode no SQL Editor do Supabase.
-- ============================================================

create table if not exists public.metodologia (
  classe        text primary key,           -- fii | acao | stock | reit | geral
  texto         text not null default '',    -- metodologia/critérios em texto livre
  atualizado_em timestamptz not null default now()
);

alter table public.metodologia enable row level security;

-- Leitura: qualquer usuário autenticado (a IA roda no servidor, mas o app pode ler).
drop policy if exists "metodologia_select_auth" on public.metodologia;
create policy "metodologia_select_auth"
  on public.metodologia for select
  using (auth.role() = 'authenticated');

-- Escrita: só via service role no servidor (sem políticas de insert/update).
