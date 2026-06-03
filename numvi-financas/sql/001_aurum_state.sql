-- ==========================================================
-- Aurum Finanças · Migration — sync de dados via Supabase
-- Banco: Postgres (Supabase)
--
-- Como aplicar:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Cole TODO este arquivo
--   3. Run
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ==========================================================
-- Estratégia: uma única tabela JSONB armazena o blob completo do
-- estado do app (contas, transações, ativos, veículos, vendas,
-- clientes, cheques, leads, banco, dívidas, metas, cofrinho).
-- O app continua funcionando IGUAL (load → blob, save → blob).
-- A mudança é só onde o blob é guardado: localStorage → Supabase.
-- ==========================================================

CREATE TABLE IF NOT EXISTS aurum_state (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger pra atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION aurum_state_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aurum_state_updated_at ON aurum_state;
CREATE TRIGGER aurum_state_updated_at
  BEFORE UPDATE ON aurum_state
  FOR EACH ROW EXECUTE FUNCTION aurum_state_touch_updated_at();

-- Row Level Security: cada user só lê/escreve a própria linha
ALTER TABLE aurum_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aurum_state_self_select ON aurum_state;
CREATE POLICY aurum_state_self_select ON aurum_state
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS aurum_state_self_insert ON aurum_state;
CREATE POLICY aurum_state_self_insert ON aurum_state
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS aurum_state_self_update ON aurum_state;
CREATE POLICY aurum_state_self_update ON aurum_state
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS aurum_state_self_delete ON aurum_state;
CREATE POLICY aurum_state_self_delete ON aurum_state
  FOR DELETE USING (user_id = auth.uid());

-- ==========================================================
-- Tabela opcional: aurum_keys (api keys do user — Brapi, Anthropic)
-- Guardar separado do estado pra não trafegar a cada save.
-- ==========================================================

CREATE TABLE IF NOT EXISTS aurum_keys (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  keys       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS aurum_keys_updated_at ON aurum_keys;
CREATE TRIGGER aurum_keys_updated_at
  BEFORE UPDATE ON aurum_keys
  FOR EACH ROW EXECUTE FUNCTION aurum_state_touch_updated_at();

ALTER TABLE aurum_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aurum_keys_self_select ON aurum_keys;
CREATE POLICY aurum_keys_self_select ON aurum_keys
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS aurum_keys_self_insert ON aurum_keys;
CREATE POLICY aurum_keys_self_insert ON aurum_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS aurum_keys_self_update ON aurum_keys;
CREATE POLICY aurum_keys_self_update ON aurum_keys
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS aurum_keys_self_delete ON aurum_keys;
CREATE POLICY aurum_keys_self_delete ON aurum_keys
  FOR DELETE USING (user_id = auth.uid());

-- ==========================================================
-- Pronto! Rode no SQL Editor e siga as instruções no app.
-- ==========================================================
