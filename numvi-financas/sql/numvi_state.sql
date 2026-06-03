-- ============================================================
-- NUMVI Finanças — tabelas de estado por usuário (isoladas por RLS)
-- Rode no Supabase: Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Cria as tabelas das DUAS variantes (pessoal e comercial), separadas:
--   pessoal   → numvi_state     / numvi_keys
--   comercial → numvi_com_state / numvi_com_keys   (este produto usa estas)
-- Cada usuário só acessa as próprias linhas (auth.uid() = user_id).

do $$
declare t text;
begin
  foreach t in array array['numvi_state','numvi_keys','numvi_com_state','numvi_com_keys'] loop
    execute format($f$
      create table if not exists %I (
        user_id    uuid primary key references auth.users(id) on delete cascade,
        %I         jsonb,
        updated_at timestamptz not null default now()
      );
      alter table %I enable row level security;
      drop policy if exists owner_all on %I;
      create policy owner_all on %I
        for all to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $f$, t, (case when t like '%keys' then 'keys' else 'state' end), t, t, t);
  end loop;
end $$;
