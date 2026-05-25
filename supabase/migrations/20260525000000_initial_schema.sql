-- ============================================================
-- AF4 Cockpit · Initial Schema (Supabase / PostgreSQL)
-- ============================================================
-- Cria todas as 27 tabelas com FKs por UUID, timestamps,
-- user_id em todas, RLS policies, ENUMs e triggers.
--
-- Aplicar via: Supabase Dashboard → SQL Editor → New Query → Run
-- Ou via CLI: supabase db push (se usar migrations)
--
-- IMPORTANTE: este script NÃO migra dados existentes em aurum_state.
-- A migração de dados está em 002_migrate_from_aurum_state.sql.
-- ============================================================

-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid + encrypt
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE escopo_tipo AS ENUM ('pessoal', 'negocio', 'tudo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE conta_tipo AS ENUM ('corrente', 'poupanca', 'investimento', 'cripto', 'carteira', 'credito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE categoria_tipo AS ENUM ('receita', 'despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transacao_tipo AS ENUM ('receita', 'despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ativo_tipo AS ENUM ('acao', 'fii', 'stock', 'reit', 'etf', 'cripto', 'tesouro', 'cdb', 'rf', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cartao_tipo AS ENUM ('principal', 'suplementar', 'credito', 'debito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE compromisso_tipo AS ENUM ('receber', 'pagar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE compromisso_status AS ENUM ('aberto', 'baixado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fixa_status AS ENUM ('pendente', 'paga', 'atrasada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agenda_categoria AS ENUM ('compromisso', 'viagem', 'lembrete', 'pessoal', 'evento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agenda_status AS ENUM ('agendado', 'feito', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tarefa_prioridade AS ENUM ('alta', 'media', 'baixa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE perfil_role AS ENUM ('admin', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trade_historico_tipo AS ENUM ('compra', 'venda', 'estudo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provento_movimento_tipo AS ENUM ('recebimento', 'reinvestimento', 'transferencia_saida', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provento_destino AS ENUM ('carteira_proventos', 'reinvestir', 'conta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE compras_categoria AS ENUM ('mercado', 'farmacia', 'casa', 'tech', 'outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper macro: aplica updated_at trigger numa tabela
-- Uso: SELECT install_updated_at_trigger('nome_tabela');
CREATE OR REPLACE FUNCTION install_updated_at_trigger(tname text)
RETURNS void AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
     CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
    tname, tname, tname, tname
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUTH & PREFS
-- ============================================================

-- ------------------------------------------------------------
-- perfis (multi-perfil dentro de um auth.users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfis (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  email      TEXT,
  cor        TEXT,
  role       perfil_role NOT NULL DEFAULT 'admin',
  permissoes JSONB NOT NULL DEFAULT '{"financas":true,"invest":true,"config":true}'::jsonb,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfis_user ON perfis(user_id);
CREATE INDEX IF NOT EXISTS idx_perfis_ativo ON perfis(user_id, ativo);
SELECT install_updated_at_trigger('perfis');

-- ------------------------------------------------------------
-- user_preferences (singleton por user)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  modelo_ativo_id        UUID,  -- FK adicionado depois (carteiras_modelo)
  escopo_ativo           escopo_tipo NOT NULL DEFAULT 'tudo',
  theme_id               TEXT NOT NULL DEFAULT 'gold',
  hidden_valores         BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_trade_visto BOOLEAN NOT NULL DEFAULT FALSE,
  perfil_ativo_id        UUID REFERENCES perfis(id) ON DELETE SET NULL,
  extras                 JSONB NOT NULL DEFAULT '{}'::jsonb,  -- bag pra flags futuras
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT install_updated_at_trigger('user_preferences');

-- ------------------------------------------------------------
-- api_keys (chaves criptografadas por provider)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,  -- brapi/alphavantage/anthropic/gemini
  api_key_encrypted BYTEA NOT NULL,  -- pgp_sym_encrypt(key, secret_pwd)
  use_real_market   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
SELECT install_updated_at_trigger('api_keys');

-- ============================================================
-- FINANCEIRO CORE
-- ============================================================

-- ------------------------------------------------------------
-- contas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  instituicao   TEXT,
  tipo          conta_tipo NOT NULL DEFAULT 'corrente',
  escopo        escopo_tipo NOT NULL DEFAULT 'pessoal',
  saldo         NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_inicial NUMERIC(14,2),
  cor           TEXT,
  ordem         INT,
  ativa         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_contas_user ON contas(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_tipo ON contas(user_id, tipo);
SELECT install_updated_at_trigger('contas');

-- ------------------------------------------------------------
-- categorias (self-join, 2 níveis)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  tipo       categoria_tipo NOT NULL,
  cor        TEXT,
  limite     NUMERIC(14,2),  -- só pra despesas
  escopo     escopo_tipo NOT NULL DEFAULT 'pessoal',
  parent_id  UUID REFERENCES categorias(id) ON DELETE SET NULL,
  ativa      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Permite mesma label em pais diferentes
  UNIQUE (user_id, nome, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_categorias_user ON categorias(user_id);
CREATE INDEX IF NOT EXISTS idx_categorias_parent ON categorias(user_id, parent_id);
SELECT install_updated_at_trigger('categorias');

-- ------------------------------------------------------------
-- cartoes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  banco           TEXT NOT NULL DEFAULT 'outro',
  bandeira_custom JSONB,
  limite          NUMERIC(14,2) NOT NULL,
  vencimento      SMALLINT NOT NULL DEFAULT 5 CHECK (vencimento BETWEEN 1 AND 31),
  fechamento      SMALLINT NOT NULL DEFAULT 28 CHECK (fechamento BETWEEN 1 AND 31),
  tipo            cartao_tipo NOT NULL DEFAULT 'principal',
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_cartoes_user ON cartoes(user_id);
SELECT install_updated_at_trigger('cartoes');

-- ------------------------------------------------------------
-- parcelamentos (compras parceladas no cartão)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parcelamentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id             UUID NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
  categoria_id          UUID REFERENCES categorias(id) ON DELETE SET NULL,
  descricao             TEXT NOT NULL,
  valor_total           NUMERIC(14,2) NOT NULL,
  total_parcelas        SMALLINT NOT NULL CHECK (total_parcelas BETWEEN 1 AND 360),
  data_compra           DATE NOT NULL,
  data_primeira_parcela DATE,  -- null = mês seguinte da compra
  parcelas_pagas        INT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parc_user ON parcelamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_parc_cartao ON parcelamentos(user_id, cartao_id);
SELECT install_updated_at_trigger('parcelamentos');

-- ------------------------------------------------------------
-- ativos (investimentos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ativos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker               TEXT NOT NULL,
  nome                 TEXT,
  tipo                 ativo_tipo NOT NULL,
  segmento             TEXT,
  qtd                  NUMERIC(20,8) NOT NULL DEFAULT 0,
  pm                   NUMERIC(20,8) NOT NULL DEFAULT 0,
  preco                NUMERIC(20,8) NOT NULL DEFAULT 0,
  base                 NUMERIC(20,8),
  variacao_24h         NUMERIC(8,4) DEFAULT 0,
  ultima_atualizacao   TIMESTAMPTZ,
  realtime             BOOLEAN NOT NULL DEFAULT FALSE,
  fonte_cotacao        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_ativos_user ON ativos(user_id);
CREATE INDEX IF NOT EXISTS idx_ativos_tipo ON ativos(user_id, tipo);
SELECT install_updated_at_trigger('ativos');

-- ------------------------------------------------------------
-- fixas (template de recorrência)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fixas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  valor           NUMERIC(14,2) NOT NULL,
  categoria_id    UUID REFERENCES categorias(id) ON DELETE SET NULL,
  conta_padrao_id UUID REFERENCES contas(id) ON DELETE SET NULL,
  dia_vencimento  SMALLINT NOT NULL DEFAULT 1 CHECK (dia_vencimento BETWEEN 1 AND 31),
  inicio_em       DATE,
  termino_em      DATE,
  ativa           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixas_user ON fixas(user_id);
SELECT install_updated_at_trigger('fixas');

-- ------------------------------------------------------------
-- transacoes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            transacao_tipo NOT NULL,
  descricao       TEXT NOT NULL,
  valor           NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data            DATE NOT NULL,
  vencimento      DATE,
  conta_id        UUID REFERENCES contas(id) ON DELETE SET NULL,
  categoria_id    UUID REFERENCES categorias(id) ON DELETE SET NULL,
  ativo_id        UUID REFERENCES ativos(id) ON DELETE SET NULL,
  cartao_id       UUID REFERENCES cartoes(id) ON DELETE SET NULL,
  parcelamento_id UUID REFERENCES parcelamentos(id) ON DELETE SET NULL,
  fixa_id         UUID REFERENCES fixas(id) ON DELETE SET NULL,
  compensado      BOOLEAN NOT NULL DEFAULT TRUE,
  fixa            BOOLEAN NOT NULL DEFAULT FALSE,
  obs             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_data ON transacoes(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_tx_conta ON transacoes(user_id, conta_id);
CREATE INDEX IF NOT EXISTS idx_tx_categoria ON transacoes(user_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_tx_ativo ON transacoes(user_id, ativo_id);
CREATE INDEX IF NOT EXISTS idx_tx_cartao ON transacoes(user_id, cartao_id);
SELECT install_updated_at_trigger('transacoes');

-- ------------------------------------------------------------
-- fixa_ocorrencias (instâncias mensais geradas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fixa_ocorrencias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixa_id          UUID NOT NULL REFERENCES fixas(id) ON DELETE CASCADE,
  mes_referencia   TEXT NOT NULL,  -- "YYYY-MM"
  data_vencimento  DATE NOT NULL,
  valor            NUMERIC(14,2) NOT NULL,
  status           fixa_status NOT NULL DEFAULT 'pendente',
  data_pagamento   DATE,
  transacao_id     UUID REFERENCES transacoes(id) ON DELETE SET NULL,
  valor_pago       NUMERIC(14,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fixa_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_fixaocc_user_mes ON fixa_ocorrencias(user_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_fixaocc_status ON fixa_ocorrencias(user_id, status);
SELECT install_updated_at_trigger('fixa_ocorrencias');

-- ------------------------------------------------------------
-- compromissos (UNIFICA devedores + dividas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compromissos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo                   compromisso_tipo NOT NULL,
  nome                   TEXT NOT NULL,
  credor                 TEXT,
  telefone               TEXT,
  descricao              TEXT,
  combinado              TEXT,
  valor                  NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  vencimento             DATE,
  categoria_id           UUID REFERENCES categorias(id) ON DELETE SET NULL,
  status                 compromisso_status NOT NULL DEFAULT 'aberto',
  data_baixa             DATE,
  conta_baixa_id         UUID REFERENCES contas(id) ON DELETE SET NULL,
  transacao_baixa_id     UUID REFERENCES transacoes(id) ON DELETE SET NULL,
  grupo_parcelamento_id  UUID,  -- agrupa parcelas do mesmo empréstimo
  parcela_numero         SMALLINT,
  parcela_total          SMALLINT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_user_tipo_status ON compromissos(user_id, tipo, status);
CREATE INDEX IF NOT EXISTS idx_comp_vencimento ON compromissos(user_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_comp_grupo ON compromissos(user_id, grupo_parcelamento_id);
SELECT install_updated_at_trigger('compromissos');

-- ============================================================
-- INVESTIMENTOS · OBJETIVOS, MODELOS, PROVENTOS, TRADE
-- ============================================================

-- ------------------------------------------------------------
-- objetivos_carteira (árvore self-join)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS objetivos_carteira (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES objetivos_carteira(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  percent       NUMERIC(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  classe_match  ativo_tipo[],  -- só folhas têm
  ordem         INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objcart_user ON objetivos_carteira(user_id);
CREATE INDEX IF NOT EXISTS idx_objcart_parent ON objetivos_carteira(user_id, parent_id);
SELECT install_updated_at_trigger('objetivos_carteira');

-- ------------------------------------------------------------
-- carteiras_modelo (templates IdV + custom)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carteiras_modelo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = builtin público
  nome        TEXT NOT NULL,
  descricao   TEXT,
  builtin     BOOLEAN NOT NULL DEFAULT FALSE,
  estrutura   JSONB NOT NULL,  -- árvore { rendaFixa: {...}, rendaVariavel: {...} }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carteira_modelo_user ON carteiras_modelo(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carteira_modelo_builtin ON carteiras_modelo(builtin) WHERE builtin = TRUE;
SELECT install_updated_at_trigger('carteiras_modelo');

-- Agora podemos adicionar a FK em user_preferences
ALTER TABLE user_preferences
  ADD CONSTRAINT user_pref_modelo_fk
  FOREIGN KEY (modelo_ativo_id) REFERENCES carteiras_modelo(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- proventos_recebidos (rastreio de proventos baixados)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proventos_recebidos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provento_key      TEXT NOT NULL,  -- "TICKER-YYYY-MM-DD-TIPO" estável
  ativo_id          UUID REFERENCES ativos(id) ON DELETE SET NULL,
  ticker            TEXT NOT NULL,  -- denormalizado p/ histórico se ativo deletado
  data_prevista     DATE NOT NULL,
  data_baixa        DATE NOT NULL,
  valor             NUMERIC(14,2) NOT NULL,
  destino           provento_destino NOT NULL,
  ativo_destino_id  UUID REFERENCES ativos(id) ON DELETE SET NULL,  -- se reinvestiu
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provento_key)
);

CREATE INDEX IF NOT EXISTS idx_provrec_user_data ON proventos_recebidos(user_id, data_baixa DESC);
CREATE INDEX IF NOT EXISTS idx_provrec_ticker ON proventos_recebidos(user_id, ticker);
SELECT install_updated_at_trigger('proventos_recebidos');

-- ------------------------------------------------------------
-- provento_movimentos (histórico da Carteira de Proventos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provento_movimentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data                  DATE NOT NULL,
  tipo                  provento_movimento_tipo NOT NULL,
  valor                 NUMERIC(14,2) NOT NULL,  -- + entradas, − saídas
  descricao             TEXT NOT NULL,
  ativo_id              UUID REFERENCES ativos(id) ON DELETE SET NULL,
  provento_recebido_id  UUID REFERENCES proventos_recebidos(id) ON DELETE SET NULL,
  transacao_id          UUID REFERENCES transacoes(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provmov_user_data ON provento_movimentos(user_id, data DESC);
SELECT install_updated_at_trigger('provento_movimentos');

-- View materializada de saldo (opcional, pode ser feita em app)
CREATE OR REPLACE VIEW v_carteira_proventos_saldo AS
SELECT user_id, COALESCE(SUM(valor), 0) AS saldo
FROM provento_movimentos
GROUP BY user_id;

-- ------------------------------------------------------------
-- trade_watchlist
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_watchlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  display     TEXT NOT NULL,
  nome        TEXT NOT NULL,
  icone       TEXT,
  ordem       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_tradewatch_user ON trade_watchlist(user_id);
SELECT install_updated_at_trigger('trade_watchlist');

-- ------------------------------------------------------------
-- trade_historico (últimas 30 entradas via trigger)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_historico (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  data        DATE NOT NULL,
  horario     TEXT,
  tipo        trade_historico_tipo NOT NULL,
  descricao   TEXT,
  valor       NUMERIC(20,8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tradehist_user_date ON trade_historico(user_id, created_at DESC);

-- Trigger: mantém máx 30 entradas por user (FIFO, remove mais antigas)
CREATE OR REPLACE FUNCTION trim_trade_historico()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM trade_historico
  WHERE id IN (
    SELECT id FROM trade_historico
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 30
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trim_trade_historico ON trade_historico;
CREATE TRIGGER trg_trim_trade_historico
  AFTER INSERT ON trade_historico
  FOR EACH ROW EXECUTE FUNCTION trim_trade_historico();

-- ------------------------------------------------------------
-- trade_analises_idv
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_analises_idv (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo_id     UUID REFERENCES ativos(id) ON DELETE SET NULL,
  ticker       TEXT NOT NULL,
  titulo       TEXT NOT NULL,
  conteudo     TEXT NOT NULL,
  score        JSONB,  -- { fundamentalista, tecnico, sentimento }
  consenso     NUMERIC(5,2),
  data_analise DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tradeidv_user_date ON trade_analises_idv(user_id, data_analise DESC);
CREATE INDEX IF NOT EXISTS idx_tradeidv_ativo ON trade_analises_idv(user_id, ativo_id);
SELECT install_updated_at_trigger('trade_analises_idv');

-- ============================================================
-- AGENDA & VIDA PESSOAL
-- ============================================================

-- ------------------------------------------------------------
-- metas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  alvo            NUMERIC(14,2) NOT NULL,
  atual           NUMERIC(14,2) NOT NULL DEFAULT 0,
  prazo_meses     SMALLINT NOT NULL DEFAULT 12,
  aporte_mensal   NUMERIC(14,2) NOT NULL DEFAULT 500,
  taxa_mensal     NUMERIC(5,3) NOT NULL DEFAULT 0.85,
  concluida       BOOLEAN NOT NULL DEFAULT FALSE,
  concluida_em    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metas_user ON metas(user_id);
SELECT install_updated_at_trigger('metas');

-- ------------------------------------------------------------
-- agenda (eventos pessoais)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agenda (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL,
  descricao        TEXT,
  data             DATE NOT NULL,
  horario          TEXT,  -- "HH:MM"
  duracao_minutos  INT,
  categoria        agenda_categoria NOT NULL DEFAULT 'compromisso',
  local            TEXT,
  link             TEXT,
  status           agenda_status NOT NULL DEFAULT 'agendado',
  pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_user_data ON agenda(user_id, data);
CREATE INDEX IF NOT EXISTS idx_agenda_pinned ON agenda(user_id, pinned DESC, data);
SELECT install_updated_at_trigger('agenda');

-- ------------------------------------------------------------
-- habitos + habito_check_ins
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habitos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  icone        TEXT,
  cor          TEXT,
  meta_diaria  INT,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habitos_user ON habitos(user_id);
SELECT install_updated_at_trigger('habitos');

CREATE TABLE IF NOT EXISTS habito_check_ins (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habito_id   UUID NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, habito_id, data)
);

CREATE INDEX IF NOT EXISTS idx_habitochk_user_date ON habito_check_ins(user_id, data DESC);

-- ------------------------------------------------------------
-- diario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diario (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  humor       SMALLINT CHECK (humor BETWEEN 1 AND 5),
  gratidao    TEXT,
  reflexao    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, data)
);

SELECT install_updated_at_trigger('diario');

-- ------------------------------------------------------------
-- compras
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  categoria   compras_categoria NOT NULL DEFAULT 'mercado',
  preco       NUMERIC(14,2),
  qtd         INT NOT NULL DEFAULT 1,
  checked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_user ON compras(user_id, checked);
SELECT install_updated_at_trigger('compras');

-- ------------------------------------------------------------
-- ideias (brain dump)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ideias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto       TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideias_user_pinned ON ideias(user_id, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideias_fts ON ideias USING GIN (to_tsvector('portuguese', texto));
SELECT install_updated_at_trigger('ideias');

-- ------------------------------------------------------------
-- tarefas (TODO list)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  prioridade    tarefa_prioridade NOT NULL DEFAULT 'media',
  projeto       TEXT,
  prazo         DATE,
  concluida     BOOLEAN NOT NULL DEFAULT FALSE,
  concluida_em  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_user_concl ON tarefas(user_id, concluida, prioridade);
CREATE INDEX IF NOT EXISTS idx_tarefas_prazo ON tarefas(user_id, prazo) WHERE prazo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_projeto ON tarefas(user_id, projeto) WHERE projeto IS NOT NULL;
SELECT install_updated_at_trigger('tarefas');

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Policy padrão: usuário só vê e modifica suas próprias linhas.
-- carteiras_modelo tem policy especial pra builtins.

-- ENABLE RLS em todas as tabelas
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixa_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE compromissos ENABLE ROW LEVEL SECURITY;
ALTER TABLE objetivos_carteira ENABLE ROW LEVEL SECURITY;
ALTER TABLE carteiras_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE proventos_recebidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE provento_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_analises_idv ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE habitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE habito_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

-- Policies padrão (auth.uid() = user_id)
DO $$ DECLARE
  t TEXT;
  tabs TEXT[] := ARRAY[
    'perfis','user_preferences','api_keys',
    'contas','categorias','cartoes','parcelamentos','ativos','fixas',
    'transacoes','fixa_ocorrencias','compromissos',
    'objetivos_carteira',
    'proventos_recebidos','provento_movimentos',
    'trade_watchlist','trade_historico','trade_analises_idv',
    'metas','agenda','habitos','habito_check_ins','diario',
    'compras','ideias','tarefas'
  ];
BEGIN
  FOREACH t IN ARRAY tabs LOOP
    EXECUTE format('DROP POLICY IF EXISTS owner_all ON %I;', t);
    EXECUTE format('
      CREATE POLICY owner_all ON %I
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    ', t);
  END LOOP;
END $$;

-- carteiras_modelo: usuário vê SUAS + builtins (user_id IS NULL)
DROP POLICY IF EXISTS cm_select ON carteiras_modelo;
CREATE POLICY cm_select ON carteiras_modelo
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS cm_insert ON carteiras_modelo;
CREATE POLICY cm_insert ON carteiras_modelo
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND builtin = FALSE);

DROP POLICY IF EXISTS cm_update ON carteiras_modelo;
CREATE POLICY cm_update ON carteiras_modelo
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND builtin = FALSE)
  WITH CHECK (auth.uid() = user_id AND builtin = FALSE);

DROP POLICY IF EXISTS cm_delete ON carteiras_modelo;
CREATE POLICY cm_delete ON carteiras_modelo
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND builtin = FALSE);

-- ============================================================
-- SEED · Carteiras modelo builtin (IdV Iniciante + IdV Completo)
-- ============================================================
-- user_id = NULL → visível a todos
INSERT INTO carteiras_modelo (id, user_id, nome, descricao, builtin, estrutura)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   NULL,
   'IdV · Iniciante',
   'Carteira mínima viável: 8 FIIs + 8 ações + VOO + VNQ. Ideal pra começar.',
   TRUE,
   '{"perfil":"iniciante","_atualizar_pelo_seed_da_app":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000002',
   NULL,
   'IdV · Completo',
   '11 FIIs em 5 segmentos, 12 ações em 9 setores, 10 stocks, REIT diversificado.',
   TRUE,
   '{"perfil":"completo","_atualizar_pelo_seed_da_app":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Saldo da carteira de proventos (substitui carteiraProventos.saldo)
CREATE OR REPLACE FUNCTION fn_saldo_carteira_proventos(p_user_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(valor), 0)
  FROM provento_movimentos
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL STABLE;

-- Streak atual de um hábito (dias consecutivos terminando hoje)
CREATE OR REPLACE FUNCTION fn_habito_streak(p_user_id UUID, p_habito_id UUID)
RETURNS INT AS $$
DECLARE
  streak INT := 0;
  current_date_check DATE := CURRENT_DATE;
BEGIN
  LOOP
    IF EXISTS (
      SELECT 1 FROM habito_check_ins
      WHERE user_id = p_user_id
        AND habito_id = p_habito_id
        AND data = current_date_check
    ) THEN
      streak := streak + 1;
      current_date_check := current_date_check - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN streak;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- FIM
-- ============================================================
-- Próximos passos:
-- 1. Aplicar este script no Supabase staging
-- 2. Criar 002_migrate_from_aurum_state.sql (lê aurum_state, INSERT em tabelas)
-- 3. Atualizar lib/storage.js no app pra usar tabelas em vez do blob JSON
