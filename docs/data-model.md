# AF4 Cockpit · Modelo de Dados

> Mapa de entidades do sistema preparado para migração da arquitetura atual (localStorage como source-of-truth + snapshot JSON em Supabase `aurum_state`) para tabelas relacionais normalizadas no PostgreSQL/Supabase.
>
> **Status atual:** dados rodam em localStorage + sync via blob JSON em `aurum_state`. Sem `user_id` nas entidades. FKs majoritariamente por NOME, não por ID.
>
> **Objetivo:** modelar 24 tabelas com FK por UUID, timestamps, `user_id`, RLS policies por usuário, e remover redundâncias.

---

## Sumário

- [Issues arquiteturais críticos](#issues-arquiteturais-críticos)
- [Convenções da nova arquitetura](#convenções-da-nova-arquitetura)
- [Entidades por domínio](#entidades-por-domínio)
- [Catálogo completo de entidades](#catálogo-completo-de-entidades)
- [Diagrama de relacionamentos](#diagrama-de-relacionamentos)
- [Checklist de migração](#checklist-de-migração)

---

## Issues arquiteturais críticos

| # | Problema | Impacto | Solução |
|---|---|---|---|
| 1 | **FK por NOME, não por ID** | Renomear conta/categoria quebra histórico silenciosamente | Migrar todas FKs pra UUID (`conta_id`, `categoria_id`, etc.) |
| 2 | **Sem `user_id`** em nenhuma entidade | Multi-perfil é só UI-side, sem isolamento real | Adicionar `user_id uuid` em TODAS tabelas + RLS policies |
| 3 | **Sem timestamps** (`created_at`/`updated_at`) | Impossível auditar, restaurar, ordenar por mais recente | `created_at TIMESTAMPTZ DEFAULT NOW()` + trigger de `updated_at` |
| 4 | **`devedores` e `dividas` quase idênticas** | DRY violation | Consolidar em 1 tabela `compromissos` com `tipo: receber\|pagar` |
| 5 | **Parcelamento duplicado** | Tabela `parcelamentos` + campo string `"1/3"` em devedores/dividas | Tabela unificada `parcelas_compromisso` ou JSONB |
| 6 | **Arrays nested**: `historico` em `carteira_proventos`, `diasFeitos` em `habitos` | Não dá pra fazer query relacional | Tabelas filhas (`provento_movimentos`, `habito_check_ins`) |
| 7 | **Referência implícita a ativo** via match de string em `transacao.descricao` | Frágil; renomear ticker quebra | FK explícita `ativo_id` em `transacoes` (nullable) |
| 8 | **IDs inconsistentes** | UUID na maioria, composto em `fixa_ocorrencias`, data em `diario` | Padronizar UUID + composite PK onde fizer sentido |
| 9 | **Entidade `notas` legacy** já migrada pra `agenda` | Código morto | Dropar tabela após confirmação |
| 10 | **`apiKeys` em localStorage separado** (Gemini key) | Chaves não sincronizam entre devices | Tabela `user_secrets` com `pgcrypto` para encrypt-at-rest |
| 11 | **`carteiraProventos.saldo` é redundante** com `historico` | Risco de divergência | Calcular saldo via SUM em query/view |
| 12 | **`modeloAtivoId` é state scalar**, não em tabela | Não persiste preferências por device | Tabela `user_preferences` (JSONB) |

---

## Convenções da nova arquitetura

### Coluna padrão em TODA tabela
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### RLS policies (padrão)
```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<tabela>_owner" ON <tabela>
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Trigger de `updated_at`
```sql
CREATE TRIGGER trg_<tabela>_updated_at
  BEFORE UPDATE ON <tabela>
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Indexes
- `(user_id)` em todas — RLS scan vai por user_id
- `(user_id, created_at DESC)` em tabelas com listagem por recência
- Indexes específicos por entidade (ex.: `transacoes(user_id, data DESC)`)

### Naming
- `snake_case` em colunas e tabelas (padrão Postgres)
- Tabelas no plural (`transacoes`, `categorias`, `contas`)
- FKs como `<entidade>_id` (`conta_id`, `categoria_id`)

### ENUMs
Usar tipos enumerados Postgres pra colunas com valores fixos:
- `escopo_tipo`: pessoal, negocio
- `transacao_tipo`: receita, despesa
- `ativo_tipo`: acao, fii, stock, reit, etf, cripto, tesouro, cdb
- `compromisso_tipo`: receber, pagar
- etc. (ver SQL inicial)

---

## Entidades por domínio

```
┌─────────────────────────────────────────────────────────────┐
│ AUTH & PREFS (3)                                            │
│   perfis · api_keys · user_preferences                      │
├─────────────────────────────────────────────────────────────┤
│ FINANCEIRO CORE (7)                                         │
│   contas · categorias · transacoes · cartoes                │
│   parcelamentos · compromissos · parcelas_compromisso       │
├─────────────────────────────────────────────────────────────┤
│ RECORRÊNCIA (2)                                             │
│   fixas · fixa_ocorrencias                                  │
├─────────────────────────────────────────────────────────────┤
│ INVESTIMENTOS (8)                                           │
│   ativos · objetivos_carteira · carteiras_modelo            │
│   provento_movimentos · proventos_recebidos                 │
│   trade_watchlist · trade_historico · trade_analises_idv    │
├─────────────────────────────────────────────────────────────┤
│ AGENDA & VIDA (7)                                           │
│   metas · agenda · habitos · habito_check_ins · diario      │
│   compras · ideias · tarefas                                │
└─────────────────────────────────────────────────────────────┘
```

Total: **27 tabelas** (3 a mais que o estado atual por causa de normalização de nested arrays + consolidação de dividas/devedores).

---

## Catálogo completo de entidades

### `perfis`

Multi-perfil dentro de um mesmo `auth.users`. Útil pra separar "Paulo" / "Esposa" / "Viewer-contador".

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK auth.users(id) |
| nome | text | não | — | |
| email | text | sim | — | contato opcional |
| cor | text | sim | — | hex `#c9a961` |
| role | text | não | 'admin' | ENUM: admin/viewer |
| permissoes | jsonb | não | '{}' | `{financas:true, invest:true, config:true}` |
| ativo | bool | não | true | perfil ativo atualmente? |
| created_at, updated_at | timestamptz | — | — | |

Index: `(user_id)`, `(user_id, ativo)`.

---

### `user_preferences`

Singleton por user. Substitui state scalars (`modeloAtivoId`, `themeId`, escopo ativo, etc.).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| user_id | uuid | não | — | PK + FK auth.users |
| modelo_ativo_id | uuid | sim | — | FK carteiras_modelo.id |
| escopo_ativo | text | não | 'tudo' | pessoal/negocio/tudo |
| theme_id | text | não | 'gold' | gold/emerald/cyan/violet/rose/amber/ice/papel/linho/perola |
| hidden_valores | bool | não | false | "ocultar valores" no header |
| onboarding_trade_visto | bool | não | false | |
| created_at, updated_at | timestamptz | — | — | |

---

### `api_keys`

Chaves de API criptografadas (1 por provider por user).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK auth.users |
| provider | text | não | — | brapi/alphavantage/anthropic/gemini |
| api_key_encrypted | bytea | não | — | `pgcrypto`: encrypt with pgp_sym_encrypt(...) |
| use_real_market | bool | não | true | só pra brapi/coingecko: usar reais? |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, provider)`.

---

### `contas`

Contas bancárias, carteiras, investimentos.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| nome | text | não | — | |
| instituicao | text | sim | — | Itaú, Nubank, XP |
| tipo | text | não | 'corrente' | ENUM conta_tipo: corrente/poupanca/investimento/cripto/carteira/credito |
| escopo | text | não | 'pessoal' | ENUM escopo_tipo: pessoal/negocio |
| saldo | numeric(14,2) | não | 0 | em R$ (12 inteiros + 2 decimais) |
| saldo_inicial | numeric(14,2) | sim | — | pra reconciliação |
| cor | text | sim | — | hex |
| ordem | int | sim | — | ordenação manual |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, nome)`.
Index: `(user_id)`, `(user_id, tipo)`.

---

### `categorias`

Taxonomia de receitas/despesas com hierarquia self-join (até 2 níveis).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| nome | text | não | — | |
| tipo | text | não | — | ENUM: receita/despesa |
| cor | text | sim | — | hex |
| limite | numeric(14,2) | sim | — | orçamento mensal (só despesas) |
| escopo | text | não | 'pessoal' | |
| parent_id | uuid | sim | — | self-FK |
| ativa | bool | não | true | soft-delete |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, nome, parent_id)` — permite mesma label em pais diferentes.
Index: `(user_id)`, `(user_id, parent_id)`.

---

### `transacoes`

Movimentações de dinheiro.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| tipo | text | não | — | ENUM transacao_tipo: receita/despesa |
| descricao | text | não | — | |
| valor | numeric(14,2) | não | — | sempre positivo |
| data | date | não | — | quando aconteceu |
| vencimento | date | sim | — | distinto de data (pendentes) |
| conta_id | uuid | sim | — | FK contas (nullable: ex. tx de cartão sem conta) |
| categoria_id | uuid | sim | — | FK categorias |
| ativo_id | uuid | sim | — | FK ativos (se for tx de aporte/venda) |
| cartao_id | uuid | sim | — | FK cartoes (se tx no cartão) |
| parcelamento_id | uuid | sim | — | FK parcelamentos (se vem de uma parcela) |
| compensado | bool | não | true | já efetivado? |
| fixa | bool | não | false | gerado por recorrência? |
| fixa_id | uuid | sim | — | FK fixas (origem) |
| obs | text | sim | — | livre |
| created_at, updated_at | timestamptz | — | — | |

Index: `(user_id, data DESC)`, `(user_id, conta_id)`, `(user_id, categoria_id)`, `(user_id, ativo_id)`.

---

### `cartoes`

Cartões de crédito/débito.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| nome | text | não | — | |
| banco | text | não | 'outro' | itau/bradesco/nubank/santander/inter/c6/picpay/xp/outro/custom |
| bandeira_custom | jsonb | sim | — | `{nome, cor}` se banco='custom' |
| limite | numeric(14,2) | não | — | |
| vencimento | smallint | não | 5 | 1-31 dia do mês |
| fechamento | smallint | não | 28 | 1-31 dia do mês |
| tipo | text | não | 'principal' | principal/suplementar/credito/debito |
| ativo | bool | não | true | em uso? |
| tags | text[] | sim | '{}' | livre |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, nome)`.

---

### `parcelamentos`

Compras parceladas (1 entry → N parcelas mensais).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| cartao_id | uuid | não | — | FK cartoes |
| categoria_id | uuid | sim | — | FK categorias |
| descricao | text | não | — | |
| valor_total | numeric(14,2) | não | — | |
| total_parcelas | smallint | não | — | 1-360 |
| data_compra | date | não | — | |
| data_primeira_parcela | date | sim | — | se null = mês seguinte da compra |
| parcelas_pagas | int[] | não | '{}' | array de números (ex.: {1,2,3}) |
| created_at, updated_at | timestamptz | — | — | |

---

### `compromissos`

**Consolida `devedores` + `dividas`.** Dinheiro a receber OU a pagar.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| tipo | text | não | — | ENUM compromisso_tipo: receber/pagar |
| nome | text | não | — | quem deve / a quem deve |
| credor | text | sim | — | só se tipo=pagar (banco, imobiliária, etc.) |
| telefone | text | sim | — | pra WhatsApp |
| descricao | text | sim | — | |
| combinado | text | sim | — | texto livre do acordo |
| valor | numeric(14,2) | não | — | |
| vencimento | date | sim | — | |
| categoria_id | uuid | sim | — | FK categorias |
| status | text | não | 'aberto' | aberto/baixado |
| data_baixa | date | sim | — | quando recebido/pago |
| conta_baixa_id | uuid | sim | — | FK contas (de/para onde foi o dinheiro) |
| transacao_baixa_id | uuid | sim | — | FK transacoes criada na baixa |
| grupo_parcelamento_id | uuid | sim | — | id comum pra parcelas do mesmo |
| parcela_numero | smallint | sim | — | "qual parcela este é" (1) |
| parcela_total | smallint | sim | — | "de quantas" (N) |
| created_at, updated_at | timestamptz | — | — | |

Index: `(user_id, tipo, status)`, `(user_id, vencimento)`, `(user_id, grupo_parcelamento_id)`.

---

### `fixas`

Templates de despesas/receitas recorrentes.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| descricao | text | não | — | |
| valor | numeric(14,2) | não | — | |
| categoria_id | uuid | sim | — | FK categorias |
| conta_padrao_id | uuid | sim | — | FK contas |
| dia_vencimento | smallint | não | 1 | 1-31 |
| inicio_em | date | sim | — | quando começa |
| termino_em | date | sim | — | quando termina (null = indeterminado) |
| created_at, updated_at | timestamptz | — | — | |

---

### `fixa_ocorrencias`

Instâncias mensais geradas das fixas.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| fixa_id | uuid | não | — | FK fixas (cascade delete) |
| mes_referencia | text | não | — | "YYYY-MM" indexável |
| data_vencimento | date | não | — | |
| valor | numeric(14,2) | não | — | herdado da fixa, pode editar |
| status | text | não | 'pendente' | pendente/paga/atrasada |
| data_pagamento | date | sim | — | |
| transacao_id | uuid | sim | — | FK transacoes criada na baixa |
| valor_pago | numeric(14,2) | sim | — | efetivo (pode diferir) |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, fixa_id, mes_referencia)`.

---

### `ativos`

Posições de investimento.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| ticker | text | não | — | uppercased (PETR4, KNRI11, BTC) |
| nome | text | sim | — | nome legível |
| tipo | text | não | — | ENUM ativo_tipo |
| segmento | text | sim | — | setor/segmento livre |
| qtd | numeric(20,8) | não | 0 | precisão pra cripto |
| pm | numeric(20,8) | não | 0 | preço médio |
| preco | numeric(20,8) | não | 0 | atual |
| base | numeric(20,8) | sim | — | primeira aquisição |
| variacao_24h | numeric(8,4) | sim | 0 | só cripto |
| ultima_atualizacao | timestamptz | sim | — | última cotação |
| realtime | bool | não | false | foi real ou simulado? |
| fonte_cotacao | text | sim | — | brapi/binance/coingecko/simulado |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, ticker)`.
Index: `(user_id, tipo)`.

---

### `objetivos_carteira`

Árvore IdV de alocação alvo. Self-join.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| parent_id | uuid | sim | — | self-FK (null = raiz) |
| label | text | não | — | |
| percent | numeric(5,2) | não | — | % do pai (0-100) |
| classe_match | text[] | sim | — | array de ativo_tipo (só folhas) |
| ordem | int | sim | — | ordenação visual |
| created_at, updated_at | timestamptz | — | — | |

Constraint: filhos de um nó devem somar 100% (validado em app ou trigger).

---

### `carteiras_modelo`

Modelos de carteira (IdV-style: builtin + custom).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | sim | — | FK (null = builtin compartilhado) |
| nome | text | não | — | |
| descricao | text | sim | — | |
| builtin | bool | não | false | é template do sistema? |
| estrutura | jsonb | não | — | árvore { rendaFixa: {...}, rendaVariavel: {...} } |
| created_at, updated_at | timestamptz | — | — | |

Index: `(user_id) WHERE user_id IS NOT NULL`.

> Builtins (IdV Iniciante / IdV Completo) ficam com `user_id IS NULL` — RLS policy precisa permitir leitura via `user_id IS NULL`.

---

### `provento_movimentos`

Histórico de movimentações da Carteira de Proventos (substitui array nested).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| data | date | não | — | |
| tipo | text | não | — | recebimento/transferencia_saida/reinvestimento/ajuste |
| valor | numeric(14,2) | não | — | + entradas, − saídas |
| descricao | text | não | — | |
| ativo_id | uuid | sim | — | FK ativos (origem do provento ou destino do reinvestimento) |
| provento_recebido_id | uuid | sim | — | FK proventos_recebidos |
| transacao_id | uuid | sim | — | FK transacoes (se transferiu) |
| created_at, updated_at | timestamptz | — | — | |

Saldo da carteira = `SUM(valor) WHERE user_id = ?`. Materialized view opcional.

---

### `proventos_recebidos`

Rastreio de quais proventos previstos foram baixados (evita duplicação).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| provento_key | text | não | — | id estável: "TICKER-YYYY-MM-DD-TIPO" |
| ativo_id | uuid | sim | — | FK ativos |
| ticker | text | não | — | denormalizado (caso ativo seja deletado) |
| data_prevista | date | não | — | quando o provento estava previsto |
| data_baixa | date | não | — | quando foi baixado |
| valor | numeric(14,2) | não | — | |
| destino | text | não | — | carteira_proventos/reinvestir/conta |
| ativo_destino_id | uuid | sim | — | FK ativos (se reinvestiu noutro) |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, provento_key)` — protege contra duplo recebimento.

---

### `trade_watchlist`

Criptos acompanhadas no Radar.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| symbol | text | não | — | BTCUSDT |
| display | text | não | — | "BTC/USDT" |
| nome | text | não | — | "Bitcoin" |
| icone | text | sim | — | 1 char |
| ordem | int | sim | — | |
| created_at, updated_at | timestamptz | — | — | |

Unique: `(user_id, symbol)`.

---

### `trade_historico`

Histórico de sinais do Radar (limitado a 30 por user via trigger BEFORE INSERT).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| symbol | text | não | — | |
| data | date | não | — | |
| horario | text | sim | — | HH:MM:SS |
| tipo | text | não | — | compra/venda/estudo |
| descricao | text | sim | — | |
| valor | numeric(20,8) | sim | — | preço naquele momento |
| created_at | timestamptz | — | — | |

Index: `(user_id, created_at DESC)`.

---

### `trade_analises_idv`

Análises detalhadas por ativo.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| ativo_id | uuid | sim | — | FK ativos |
| ticker | text | não | — | denormalizado (caso ativo seja deletado) |
| titulo | text | não | — | |
| conteudo | text | não | — | markdown |
| score | jsonb | sim | — | `{fundamentalista, tecnico, sentimento}` |
| consenso | numeric(5,2) | sim | — | 0-100 |
| data_analise | date | não | — | |
| created_at, updated_at | timestamptz | — | — | |

---

### `metas`

Objetivos financeiros pessoais.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| nome | text | não | — | |
| alvo | numeric(14,2) | não | — | |
| atual | numeric(14,2) | não | 0 | |
| prazo_meses | smallint | não | 12 | |
| aporte_mensal | numeric(14,2) | não | 500 | |
| taxa_mensal | numeric(5,3) | não | 0.85 | % a.m. |
| concluida | bool | não | false | |
| created_at, updated_at | timestamptz | — | — | |

---

### `agenda`

Eventos pessoais.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| titulo | text | não | — | |
| descricao | text | sim | — | |
| data | date | não | — | |
| horario | text | sim | — | HH:MM |
| duracao_minutos | int | sim | — | |
| categoria | text | não | 'compromisso' | compromisso/viagem/lembrete/pessoal/evento |
| local | text | sim | — | |
| link | text | sim | — | |
| status | text | não | 'agendado' | agendado/feito/cancelado |
| pinned | bool | não | false | |
| created_at, updated_at | timestamptz | — | — | |

Index: `(user_id, data)`, `(user_id, pinned DESC, data)`.

---

### `habitos`

Hábitos rastreados (sem `diasFeitos` nested — virou `habito_check_ins`).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| nome | text | não | — | |
| icone | text | sim | — | emoji |
| cor | text | sim | — | hex |
| meta_diaria | int | sim | — | |
| ativo | bool | não | true | |
| created_at, updated_at | timestamptz | — | — | |

---

### `habito_check_ins`

Marca dia + hábito feito. Substitui `habitos.diasFeitos` map.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| user_id | uuid | não | — | PK composite |
| habito_id | uuid | não | — | PK + FK habitos (cascade) |
| data | date | não | — | PK |
| created_at | timestamptz | não | NOW() | |

PK composta: `(user_id, habito_id, data)`.
Index: `(user_id, data DESC)` pra streak query.

---

### `diario`

Journal pessoal (1 entrada por dia).

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| user_id | uuid | não | — | PK composite |
| data | date | não | — | PK composite |
| humor | smallint | sim | — | 1-5 |
| gratidao | text | sim | — | |
| reflexao | text | sim | — | |
| created_at, updated_at | timestamptz | — | — | |

PK composta: `(user_id, data)`.

---

### `compras`

Lista de compras.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| nome | text | não | — | |
| categoria | text | não | 'mercado' | mercado/farmacia/casa/tech/outros |
| preco | numeric(14,2) | sim | — | unitário |
| qtd | int | não | 1 | |
| checked | bool | não | false | |
| created_at, updated_at | timestamptz | — | — | |

---

### `ideias`

Brain dump livre.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| texto | text | não | — | |
| pinned | bool | não | false | |
| created_at, updated_at | timestamptz | — | — | |

Index full-text: `to_tsvector('portuguese', texto)`.

---

### `tarefas`

To-do list.

| coluna | tipo | null | default | obs |
|---|---|---|---|---|
| id | uuid | não | gen_random_uuid() | PK |
| user_id | uuid | não | — | FK |
| titulo | text | não | — | |
| descricao | text | sim | — | |
| prioridade | text | não | 'media' | alta/media/baixa |
| projeto | text | sim | — | string livre |
| prazo | date | sim | — | |
| concluida | bool | não | false | |
| concluida_em | timestamptz | sim | — | |
| created_at, updated_at | timestamptz | — | — | |

Index: `(user_id, concluida, prioridade)`, `(user_id, prazo)`.

---

## Diagrama de relacionamentos

```
auth.users ──┬─< perfis
             ├─< user_preferences (1:1)
             ├─< api_keys
             │
             ├─< contas ─────────────┐
             ├─< categorias ─< categorias (self)
             │     │                  │
             │     └──────────┬───────┤
             │                ▼       │
             ├─< transacoes ──┴────┬──┘
             │     │                │
             │     ├─ ativo_id ─────┼─< ativos
             │     ├─ cartao_id ────┼─< cartoes ──< parcelamentos
             │     ├─ parcelamento_id
             │     └─ fixa_id ──────┼─< fixas ──< fixa_ocorrencias
             │
             ├─< compromissos (receber|pagar)
             │     ├─ categoria_id
             │     ├─ conta_baixa_id
             │     └─ transacao_baixa_id
             │
             ├─< ativos ─────────┬──< provento_movimentos
             │                    └──< proventos_recebidos
             │                    └──< trade_analises_idv
             │
             ├─< objetivos_carteira ─< objetivos_carteira (self)
             ├─< carteiras_modelo
             │
             ├─< trade_watchlist
             ├─< trade_historico
             │
             ├─< metas
             ├─< agenda
             ├─< habitos ──< habito_check_ins
             ├─< diario
             ├─< compras
             ├─< ideias
             └─< tarefas
```

---

## Checklist de migração

### Fase 1 — Schema (PR docs)
- [x] Mapear todas as entidades
- [x] Documentar issues
- [x] Gerar `001_initial_schema.sql`
- [ ] Revisar SQL com o time
- [ ] Aplicar no Supabase staging

### Fase 2 — Modelo de acesso (PR app refactor)
- [ ] Criar `lib/db/` com helpers por entidade (CRUD + queries comuns)
- [ ] Hook `useEntity(table, filters)` genérico
- [ ] Realtime subscriptions (Supabase Realtime) onde fizer sentido
- [ ] Manter localStorage como cache pra modo offline

### Fase 3 — Migração de dados (PR migração)
- [ ] Script JS lê localStorage atual → INSERT em todas as tabelas
- [ ] Resolução de FKs por NOME → ID (lookup table durante import)
- [ ] Deduplicação (proventos_recebidos)
- [ ] Validação pós-import: COUNT(*) por tabela igual ao localStorage

### Fase 4 — Cutover (PR por módulo)
Refatorar 1 módulo por vez (mantém localStorage como fallback até cada um estar OK):
- [ ] Contas + Transações (core)
- [ ] Cartões + Parcelamentos
- [ ] Categorias
- [ ] Compromissos (consolida devedores/dividas)
- [ ] Fixas + Ocorrências
- [ ] Ativos + Proventos
- [ ] Objetivos + Carteiras Modelo
- [ ] Trade
- [ ] Agenda + Tarefas + Hábitos + Diário + Compras + Ideias
- [ ] Metas
- [ ] Perfis + Preferências + API Keys

### Fase 5 — Deprecate localStorage
- [ ] Adicionar feature flag `USE_SUPABASE_AS_SOURCE_OF_TRUTH`
- [ ] Migrar usuários gradualmente
- [ ] Remover `aurum_state` (snapshot JSON) — ficou redundante
- [ ] Remover entidade `notas` (já migrada pra agenda)

---

_Documento gerado em 2026-05-25 como parte do refactor de arquitetura do AF4 Cockpit._
