# Design · Lógica compartilhada entre os apps (`packages/core`)

**Data:** 2026-06-09
**Status:** Aprovado (design) — aguardando plano de implementação

## Problema

O monorepo tem dois apps quase idênticos:

- `apps/cars-web` — versão pessoal (worker `af4cockpit`)
- `numvi-financas` — versão comercial (worker `numvi-financas`)

Eles compartilham **161 arquivos** com o mesmo caminho relativo, e **126 são
idênticos byte a byte** (~78% do código comum é cópia). Toda correção de lógica
(parser de centavos, agregador, formatação, relatórios) precisa ser feita
**duas vezes**, o que dobra tempo e custo de cada alteração.

Diagnóstico adicional (diffs reais dos arquivos "divergentes" de `lib/`):

- `agregador.js` (394 linhas, coração dos cálculos): as 16 diferenças são
  **só comentários** — a lógica é idêntica.
- `theme.js`: difere **só no nome da marca em um comentário**.
- `escopo.js`: difere em **1 linha** (lista `palavrasNegocio`).
- `navItems.js`, `storage.js`, `supabase.js`, `aiChat.js`, `gemini.js`:
  diferenças reais (features, auth, multi-tenant).

## Objetivo

Ter a **lógica de negócio em um lugar só**, de modo que uma correção valha para
os dois apps automaticamente. Escopo desta fase: **apenas a pasta `lib/`** (UI e
telas continuam duplicadas por enquanto — fase futura).

Critério de sucesso: editar um arquivo de `lib/` compartilhada **uma vez**, e os
dois apps (`cars-web` e `numvi-financas`) compilarem e usarem a mesma versão.

## Mecanismo escolhido

**Pasta de código compartilhada via alias do Vite** — sem etapa de build/publish.

- Criar `packages/core/src/` com a lógica compartilhada.
- Em cada `vite.config` adicionar `resolve.alias`: `@core` → `packages/core/src`.
- Trocar imports relativos por alias:
  `import { fmt } from "../../lib/format.js"` → `import { fmt } from "@core/format.js"`.

**Por que alias-de-fonte e não um pacote `@af4/core` com build próprio:** é o mais
simples para SPA Vite — zero passo de build extra, zero watch, e `git mv`
preserva o histórico. Pode evoluir para pacote publicável depois, se necessário.

### Alternativas consideradas (descartadas nesta fase)

- **De-duplicar tudo (lib + UI + telas):** maior payoff, mas refactor grande e
  arriscado (mexe em ~126 arquivos e imports dos dois apps). Fica para fase 2.
- **Unificar em um app só com flag pessoal/comercial:** o mais invasivo — mexe em
  auth, supabase e roteamento que hoje diferem de propósito. Descartado.

## O que vai para `packages/core`

1. **Os ~50 arquivos `lib/` idênticos** (format, extratoParser, importExport,
   fixas, invest-*, cotacoes, etc.) — mover sem alteração de comportamento.
2. **`agregador.js` e `theme.js`** — reconciliar os comentários (lógica/código já
   idênticos) e mover. A única diferença é texto de comentário (inclusive o nome
   da marca em `theme.js`); normalizar o comentário e mover. Sem injeção.

### Arquivos divergentes por *configuração* (mover + parametrizar)

- **`escopo.js`** → exportar função que recebe a lista `palavrasNegocio` (ou um
  array de palavras-extra) do app, em vez de embutir. `cars-web` passa as
  palavras extras (`santander`, `carros`, …); `numvi` passa a lista base.

### Fica em cada app (genuinamente diferente — não mexer nesta fase)

`storage.js`, `supabase.js`, `aiChat.js`, `gemini.js`, `navItems.js`,
`App.jsx`, `index.css`, `main.jsx`, `Login.jsx`, `AuthGate.jsx`.

## Ordem da migração (incremental, um commit por lote)

1. Criar `packages/core` (com `package.json` mínimo) + alias `@core` nos dois
   `vite.config` + adicionar ao `pnpm-workspace.yaml`. Build dos dois apps para
   validar a fundação.
2. Mover um lote pequeno de libs "folha" sem dependências entre si:
   `format.js`, `extratoParser.js`, `importExport.js` → atualizar imports nos
   dois apps → build dos dois.
3. Mover o restante dos arquivos idênticos em lotes (por área: cálculos de
   invest, backup/sync, util) → build a cada lote.
4. Reconciliar e mover `agregador.js` e `theme.js`.
5. Parametrizar e mover `escopo.js` (apps passam as palavras-chave).

## Tratamento de erros / riscos

- **Comportamento inalterado:** é só movimentação de código + troca de import.
  Nenhuma regra de negócio muda.
- **Validação por lote:** cada lote precisa buildar nos DOIS apps
  (`pnpm --filter @repo/cars-web build` e `pnpm --filter numvi-financas build`)
  antes de commitar.
- **Rollback:** cada lote é um commit isolado; se quebrar, reverte só aquele
  commit.
- **Imports dinâmicos:** alguns libs são importados dinamicamente
  (`brapi.js`, `gemini.js`) — conferir que o alias resolve em `import()` também.
- **Testes:** os 11 arquivos de `lib/__tests__` idênticos passam a rodar contra
  `packages/core` (mover junto e ajustar paths). Rodar a suíte após cada lote.

## Fora de escopo (fases futuras)

- Extrair UI (`components/ui`) e telas (`components/pages`) idênticas.
- Parametrizar `navItems.js`.
- Unificar `storage.js`/`supabase.js`.
