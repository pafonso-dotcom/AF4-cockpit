-- ============================================================
-- LOTOAI APP PRO · schema inicial
-- Tabelas: concursos da Lotofácil + jogos do usuário + simulações
-- ============================================================

create table if not exists lf_concursos (
  numero      int primary key,
  data        date not null,
  dezenas     int[] not null check (array_length(dezenas, 1) = 15),
  arrecadado  numeric,
  ganhadores_15 int default 0,
  premio_15   numeric default 0,
  created_at  timestamptz not null default now()
);

create index if not exists lf_concursos_data_idx on lf_concursos(data desc);

create table if not exists lf_jogos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  dezenas     int[] not null check (array_length(dezenas, 1) between 15 and 20),
  estrategia  text,
  concurso_alvo int,
  conferido   boolean default false,
  acertos     int,
  created_at  timestamptz not null default now()
);

create index if not exists lf_jogos_user_idx on lf_jogos(user_id, created_at desc);

create table if not exists lf_simulacoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  estrategia    text not null,
  janela        int not null,
  jogos_por_concurso int not null default 1,
  total_apostas int,
  dist_acertos  jsonb,
  gasto_total   numeric,
  premio_total  numeric,
  roi           numeric,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- RLS · cada usuário só enxerga seus próprios jogos/simulações
-- Concursos são públicos (read-only)
-- ============================================================

alter table lf_concursos  enable row level security;
alter table lf_jogos      enable row level security;
alter table lf_simulacoes enable row level security;

drop policy if exists "concursos públicos" on lf_concursos;
create policy "concursos públicos"
  on lf_concursos for select
  using (true);

drop policy if exists "jogos do dono" on lf_jogos;
create policy "jogos do dono"
  on lf_jogos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "simulações do dono" on lf_simulacoes;
create policy "simulações do dono"
  on lf_simulacoes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
