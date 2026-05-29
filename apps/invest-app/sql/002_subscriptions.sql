-- ============================================================
-- Fase 4 · Assinaturas (estrutura). Rode no SQL Editor do Supabase.
-- Guarda o status da assinatura de cada cliente. O webhook do gateway
-- (Mercado Pago) atualiza esta tabela no servidor; o cliente só LÊ a própria.
-- ============================================================

create table if not exists public.subscriptions (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  status         text not null default 'inactive',  -- inactive | trialing | active | past_due | canceled
  plano          text,                               -- ex.: "mensal" | "anual"
  gateway        text default 'mercadopago',
  gateway_ref    text,                               -- id da assinatura no gateway (preapproval_id)
  trial_ate      timestamptz,                        -- fim do período de teste, se houver
  validade       timestamptz,                        -- até quando o acesso está pago
  atualizado_em  timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Cliente lê só a PRÓPRIA assinatura. (Escrita é feita pelo servidor via
-- service role no webhook, que ignora RLS — nunca pelo navegador.)
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);
