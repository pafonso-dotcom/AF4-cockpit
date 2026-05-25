-- ===========================================================
-- Backups por usuário no Supabase.
-- ===========================================================
-- Cada user tem seus próprios snapshots do app (state completo),
-- isolados via RLS. Mantemos no máximo 5 backups por user via
-- trigger after-insert (rotação automática).
--
-- Substitui o storage anterior em localStorage (af4:backup:*).

create extension if not exists pgcrypto;

create table if not exists public.af4_backups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  label       text not null default 'manual',
  size_bytes  integer not null default 0,
  payload     jsonb not null
);

create index if not exists af4_backups_user_created_idx
  on public.af4_backups(user_id, created_at desc);

alter table public.af4_backups enable row level security;

drop policy if exists af4_backups_select on public.af4_backups;
drop policy if exists af4_backups_insert on public.af4_backups;
drop policy if exists af4_backups_delete on public.af4_backups;

create policy af4_backups_select on public.af4_backups
  for select using (auth.uid() = user_id);

create policy af4_backups_insert on public.af4_backups
  for insert with check (auth.uid() = user_id);

create policy af4_backups_delete on public.af4_backups
  for delete using (auth.uid() = user_id);

-- Rotação: mantém só os 5 backups mais novos por user.
-- A função roda como SECURITY DEFINER pra poder deletar mesmo se a
-- policy DELETE for desativada futuramente; o filtro WHERE garante que
-- só toca em rows do mesmo user_id do NEW.
create or replace function public.af4_backups_trim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  excedentes uuid[];
begin
  with ranked as (
    select id, row_number() over (order by created_at desc) as rn
      from public.af4_backups
     where user_id = new.user_id
  )
  select array_agg(id) into excedentes
    from ranked where rn > 5;

  if excedentes is not null then
    delete from public.af4_backups
     where id = any(excedentes)
       and user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists af4_backups_trim_after_insert on public.af4_backups;
create trigger af4_backups_trim_after_insert
after insert on public.af4_backups
for each row execute function public.af4_backups_trim();
