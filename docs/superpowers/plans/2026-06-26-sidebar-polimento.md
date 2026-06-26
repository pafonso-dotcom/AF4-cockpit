# Sidebar (layout vertical) — polimento "Cloud Dock" · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans (inline) ou subagent-driven-development. Steps usam checkbox (`- [ ]`).

**Goal:** Deixar a sidebar vertical (já existente, `HeaderVertical`) com a cara do print: painel flutuante arredondado, pastas em árvore com linhas-guia, card de atalho no rodapé, e ligada por padrão no desktop. App **pessoal** (`apps/cars-web`). Mobile não muda.

**Architecture:** Mexer só no `HeaderVertical` (em `Header.jsx`) + defaults em `useLayout.js`/`Configuracoes.jsx` + passar `onQuickAction` no caminho do vertical (App.jsx). Footprint da sidebar segue 220px (painel recuado por dentro), então o `marginLeft:220` do conteúdo não muda.

**Tech Stack:** React, estilos inline com tokens `T`, lucide-react, vite. Verificação: build + screenshot headless (Chromium/playwright-core, seed `af4:layout=vertical`).

## Global Constraints

- App pessoal apenas: `apps/cars-web`. NÃO tocar no comercial nesta fase.
- Mobile retrato continua forçando horizontal (não alterar `forcaHorizontal`).
- Sidebar mantém footprint 220px (não alterar `marginLeft:220` em App.jsx:1274).
- Build pessoal: `pnpm --filter @repo/cars-web build`.
- Verificação runtime exige patch TEMPORÁRIO `supabaseConfigured = false` em `src/lib/supabase.js` (reverter antes de cada commit).
- Committer já configurado (`noreply@anthropic.com`).

---

### Task 1: Sidebar como padrão no desktop

**Files:**
- Modify: `apps/cars-web/src/lib/useLayout.js`
- Modify: `apps/cars-web/src/components/pages/Configuracoes.jsx`

- [ ] **Step 1:** Em `useLayout.js`, trocar os dois fallbacks `|| "horizontal"` por `|| "vertical"` (no `useState` inicial). Mobile retrato segue forçando horizontal via `forcaHorizontal`.
- [ ] **Step 2:** Em `Configuracoes.jsx` (linha ~62), trocar `localStorage.getItem("af4:layout") || "horizontal"` por `|| "vertical"`.
- [ ] **Step 3:** Build: `pnpm --filter @repo/cars-web build` → sucesso.
- [ ] **Step 4:** Runtime: sem `af4:layout` salvo, viewport 1280×900 → app abre já no vertical (sidebar visível). Em viewport 390×800 (retrato) → menu de topo.
- [ ] **Step 5:** Reverter patch supabase; commit `feat(pessoal): sidebar vertical como padrão no desktop`.

---

### Task 2: Painel flutuante + bordas arredondadas + pílulas

**Files:**
- Modify: `apps/cars-web/src/components/Header.jsx` (`HeaderVertical`, `<aside>` ~706 e topbar ~848)

**Interfaces:** mantém footprint 220px. Painel: `position:fixed; top/left/bottom: 10; width: 200; borderRadius: 20; box-shadow`. Conteúdo segue com `marginLeft:220`.

- [ ] **Step 1:** No `<aside>`, mudar `left:0,width:220, padding:"16px 14px"` para painel flutuante: `top:10,left:10,bottom:10,width:200, borderRadius:20, boxShadow:"0 10px 30px rgba(0,0,0,.25)", padding:"14px 12px"`. Remover `borderRight` (vira `border:1px solid NAV_BORDER`).
- [ ] **Step 2:** Itens de módulo (botão `abrirModulo`) e subitens: aumentar `borderRadius` (módulo 12→14; subitem 5→10) e usar fundo pílula no ativo/hover (já tem fundo no ativo; adicionar `onMouseEnter/Leave` sutil OU manter só ativo pra simplicidade).
- [ ] **Step 3:** Topbar (`<header>` ~848): manter `marginLeft:220`.
- [ ] **Step 4:** Build → sucesso.
- [ ] **Step 5:** Runtime (seed vertical): painel aparece "solto" com cantos arredondados e sombra; conteúdo não deslocou.
- [ ] **Step 6:** Reverter supabase; commit `feat(pessoal): sidebar — painel flutuante com bordas arredondadas`.

---

### Task 3: Pastas em árvore com linhas-guia

**Files:**
- Modify: `apps/cars-web/src/components/Header.jsx` (`HeaderVertical`, bloco de subtabs ~753-826)

- [ ] **Step 1:** No container das sub-abas abertas (`aberto && <div ...>`), adicionar uma **linha vertical guia**: `borderLeft: 1px solid NAV_BORDER; marginLeft: 16; paddingLeft: 4` (ou um pseudo via wrapper). Cada subitem ganha um tracinho: um `<span>` curto (`width:8;height:1;background:NAV_BORDER`) antes do ícone, OU `position:relative` com `::before`. Como é estilo inline, usar um `<span>` conector dentro do botão.
- [ ] **Step 2:** Ajustar paddings dos subitens pra alinhar com a guia (recuo coerente). Filhos (contas/cartões/agenda) com recuo maior e mesma guia.
- [ ] **Step 3:** Build → sucesso.
- [ ] **Step 4:** Runtime: abrir pasta Finanças → subtelas com linha vertical + tracinhos (cara de árvore); abrir Contas → bancos como filhos recuados na mesma árvore.
- [ ] **Step 5:** Reverter supabase; commit `feat(pessoal): sidebar — pastas em árvore com linhas-guia`.

---

### Task 4: Card de atalho no rodapé

**Files:**
- Modify: `apps/cars-web/src/components/Header.jsx` (`HeaderVertical`: assinatura de props + rodapé antes do botão Configurações ~833)
- Modify: `apps/cars-web/src/App.jsx` (garantir `onQuickAction` chega ao `Header`)

**Interfaces:**
- Consumes: `onQuickAction(tipo)` — handler já usado pelo `HeaderHorizontal`. Tipos por módulo: `financas → "transacao"`, `invest → "aporte"`, `negocio → "recebimento"` (ajustar aos tipos que o App já entende; conferir em App.jsx o que `onQuickAction` aceita).

- [ ] **Step 1:** Conferir em App.jsx os tipos aceitos por `onQuickAction` e se já é passado ao `<Header>`. Se não, passar.
- [ ] **Step 2:** Adicionar `onQuickAction` à lista de props do `HeaderVertical`.
- [ ] **Step 3:** Antes do botão "Configurações", inserir um card arredondado (`background` gradiente/accent suave, `borderRadius:16, padding:12`) com um botão destacado cujo rótulo/ação dependem de `modulo`:
  - financas → "+ Nova transação"
  - invest → "+ Novo aporte"
  - negocio → "+ Recebimento"
  - config → esconder o card.
- [ ] **Step 4:** Build → sucesso.
- [ ] **Step 5:** Runtime: na pasta Finanças o card mostra "+ Nova transação"; trocar pra Investimentos → "+ Novo aporte"; clicar dispara a ação (modal abre).
- [ ] **Step 6:** Reverter supabase; commit `feat(pessoal): sidebar — card de atalho no rodapé`.

---

### Task 5: Verificação final + PR

- [ ] **Step 1:** Build limpo; `git diff --stat` só nos arquivos previstos; `supabaseConfigured = !!(URL && KEY)` restaurado.
- [ ] **Step 2:** Screenshot final da sidebar polida (enviar ao usuário).
- [ ] **Step 3:** Push `--force-with-lease`; abrir PR draft; mergear (squash) quando o GitHub estiver reautorizado.
- [ ] **Step 4:** Depois: replicar no comercial (`numvi-financas`) numa fase separada.

## Self-Review

- **Cobertura do spec:** 4 itens → Tasks 1–4; replicar comercial → Task 5/futuro. OK.
- **Placeholders:** Task 4 depende de conferir os tipos reais de `onQuickAction` (Step 1) — explicitado como ação, não placeholder.
- **Consistência:** footprint 220 mantido em Tasks 2–4; `onQuickAction` o mesmo nome do HeaderHorizontal.
