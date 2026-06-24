# Financeiro por loja no Negócio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Múltiplas lojas no módulo Negócio (cars-web), cada uma com Banco, Despesas (fixas/var) e Recebimentos independentes; seletor de loja + gerenciamento; Painel por loja e "Todas as lojas".

**Architecture:** Uma lista `negocioLojas` + `negocioLojaAtiva` no estado do `App.jsx`. Os itens financeiros ganham `lojaId`; as páginas filtram pela loja ativa e novos itens nascem com o `lojaId` dela. Lógica pura (filtro/migração/resumo) isolada em `lib/negocioLojas.js` com testes; UI nova (`LojaSelector`, `GerenciarLojasModal`, `NegocioRecebimentos`) segue os padrões existentes do Negócio.

**Tech Stack:** React 18 (lazy/Suspense), Vite, lucide-react, vitest. Estilo inline com tokens `T`.

## Global Constraints

- App alvo: **somente** `apps/cars-web`. NÃO espelhar em `numvi-financas`.
- Sem dependências novas; tudo client-side; respeitar `hidden`.
- Build: `pnpm --filter @repo/cars-web build`; testes: `pnpm --filter @repo/cars-web test:once` (arquivos em `apps/cars-web/src/lib/__tests__/`).
- Branch: `claude/numvi-pessoal-changes-YHaEK`. Commits com committer `noreply@anthropic.com`.
- Compartilhados (NÃO mexer): estoque/veículos, serviços, clientes, `negocioFinCategorias`.
- Exclusão de loja **bloqueada** se houver itens financeiros nela; sempre ≥ 1 loja; nunca item com `lojaId` vazio.

## File Structure

- Create: `apps/cars-web/src/lib/negocioLojas.js` — helpers puros (filtro, migração, resumo).
- Create: `apps/cars-web/src/lib/__tests__/negocio-lojas.test.js` — testes.
- Create: `apps/cars-web/src/components/pages/Negocio/LojaSelector.jsx` — barra seletor + ⚙.
- Create: `apps/cars-web/src/components/pages/Negocio/GerenciarLojasModal.jsx` — criar/renomear/excluir lojas.
- Create: `apps/cars-web/src/components/pages/Negocio/NegocioRecebimentos.jsx` — entradas por loja (molde: `NegocioDespesasVar.jsx`).
- Modify: `apps/cars-web/src/App.jsx` — estados, SETTERS, persistência, migração, props das páginas, rota `negocio-recebimentos`.
- Modify: `apps/cars-web/src/lib/appPersistencia.js` — hidratar lojas/recebimentos + migração.
- Modify: `apps/cars-web/src/components/Header.jsx` — subtab `negocio-recebimentos` (2 arrays).
- Modify: `apps/cars-web/src/components/pages/Negocio/NegocioBanco.jsx` — filtro por loja + `lojaId` no novo.
- Modify: `apps/cars-web/src/components/pages/Negocio/NegocioDespesasFixas.jsx` — idem.
- Modify: `apps/cars-web/src/components/pages/Negocio/NegocioDespesasVar.jsx` — idem.
- Modify: `apps/cars-web/src/components/pages/Negocio/NegocioPainel.jsx` — resumo por loja/"todas" + seletor.

---

### Task 1: Lib `negocioLojas.js` (helpers puros) + testes [TDD]

**Files:**
- Create: `apps/cars-web/src/lib/negocioLojas.js`
- Test: `apps/cars-web/src/lib/__tests__/negocio-lojas.test.js`

**Interfaces — Produces:**
- `filtrarPorLoja(itens, lojaAtiva) → itens[]` — todos se `lojaAtiva === "todas"`, senão `itens.filter(i => i.lojaId === lojaAtiva)`.
- `resumoLoja({ contas, despesasFixas, despesasVar, recebimentos }, lojaAtiva) → { saldoBanco, despesasFixas, despesasVar, recebimentos, resultado }` (somatórios; "todas" consolida).
- `migrarNegocioLojas(data) → { negocioLojas, negocioLojaAtiva, negocioFinContas, negocioFinDespesasFixas, negocioFinDespesasVar, negocioRecebimentos }` — cria "Loja 1" se faltar e atribui `lojaId` aos itens sem.
- `LOJA_TODAS = "todas"`.

- [ ] **Step 1: Escrever o teste falhando**

Create `apps/cars-web/src/lib/__tests__/negocio-lojas.test.js`:

```js
import { describe, it, expect } from "vitest";
import { filtrarPorLoja, resumoLoja, migrarNegocioLojas, LOJA_TODAS } from "../negocioLojas.js";

describe("filtrarPorLoja", () => {
  const itens = [{ lojaId: "a" }, { lojaId: "b" }, { lojaId: "a" }];
  it("filtra pela loja", () => { expect(filtrarPorLoja(itens, "a")).toHaveLength(2); });
  it("'todas' devolve tudo", () => { expect(filtrarPorLoja(itens, LOJA_TODAS)).toHaveLength(3); });
  it("entrada nula → []", () => { expect(filtrarPorLoja(null, "a")).toEqual([]); });
});

describe("resumoLoja", () => {
  const state = {
    contas: [{ lojaId: "a", saldo: 1000 }, { lojaId: "b", saldo: 500 }],
    despesasFixas: [{ lojaId: "a", valor: 100 }],
    despesasVar: [{ lojaId: "a", valor: 50 }, { lojaId: "b", valor: 20 }],
    recebimentos: [{ lojaId: "a", valor: 300 }],
  };
  it("resume uma loja", () => {
    const r = resumoLoja(state, "a");
    expect(r.saldoBanco).toBe(1000);
    expect(r.despesasFixas).toBe(100);
    expect(r.despesasVar).toBe(50);
    expect(r.recebimentos).toBe(300);
    expect(r.resultado).toBe(300 - 150); // recebimentos - (fixas+var)
  });
  it("'todas' consolida", () => {
    const r = resumoLoja(state, LOJA_TODAS);
    expect(r.saldoBanco).toBe(1500);
    expect(r.despesasVar).toBe(70);
  });
});

describe("migrarNegocioLojas", () => {
  it("cria Loja 1 e atribui lojaId aos itens sem", () => {
    const out = migrarNegocioLojas({
      negocioFinContas: [{ id: "c1", saldo: 10 }],
      negocioFinDespesasVar: [{ id: "d1", valor: 5 }],
    });
    expect(out.negocioLojas).toHaveLength(1);
    expect(out.negocioLojas[0].nome).toBe("Loja 1");
    const lojaId = out.negocioLojas[0].id;
    expect(out.negocioLojaAtiva).toBe(lojaId);
    expect(out.negocioFinContas[0].lojaId).toBe(lojaId);
    expect(out.negocioFinDespesasVar[0].lojaId).toBe(lojaId);
    expect(out.negocioRecebimentos).toEqual([]);
  });
  it("preserva lojas existentes e não re-migra", () => {
    const out = migrarNegocioLojas({
      negocioLojas: [{ id: "L9", nome: "Centro" }],
      negocioLojaAtiva: "L9",
      negocioFinContas: [{ id: "c1", saldo: 10, lojaId: "L9" }],
    });
    expect(out.negocioLojas).toEqual([{ id: "L9", nome: "Centro" }]);
    expect(out.negocioLojaAtiva).toBe("L9");
    expect(out.negocioFinContas[0].lojaId).toBe("L9");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @repo/cars-web exec vitest run src/lib/__tests__/negocio-lojas.test.js`
Expected: FAIL (Cannot find module `../negocioLojas.js`).

- [ ] **Step 3: Implementar**

Create `apps/cars-web/src/lib/negocioLojas.js`:

```js
// Helpers puros do "financeiro por loja" do Negócio.
import { uid } from "./format.js";

export const LOJA_TODAS = "todas";

const soma = (arr, sel = (x) => x.valor) =>
  (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(sel(x)) || 0), 0);

/** Itens da loja ativa (ou todos quando "todas"). */
export function filtrarPorLoja(itens, lojaAtiva) {
  const arr = Array.isArray(itens) ? itens : [];
  if (lojaAtiva === LOJA_TODAS || !lojaAtiva) return lojaAtiva === LOJA_TODAS ? arr : arr;
  return arr.filter((i) => i.lojaId === lojaAtiva);
}

/** Totais financeiros de uma loja (ou consolidado quando "todas"). */
export function resumoLoja({ contas = [], despesasFixas = [], despesasVar = [], recebimentos = [] } = {}, lojaAtiva) {
  const f = (arr) => filtrarPorLoja(arr, lojaAtiva);
  const saldoBanco = soma(f(contas), (c) => c.saldo);
  const dFixas = soma(f(despesasFixas));
  const dVar = soma(f(despesasVar));
  const receb = soma(f(recebimentos));
  return {
    saldoBanco,
    despesasFixas: dFixas,
    despesasVar: dVar,
    recebimentos: receb,
    resultado: +(receb - (dFixas + dVar)).toFixed(2),
  };
}

/** Migração: garante ≥1 loja e atribui lojaId aos itens financeiros sem. */
export function migrarNegocioLojas(data = {}) {
  let negocioLojas = Array.isArray(data.negocioLojas) ? data.negocioLojas : [];
  if (negocioLojas.length === 0) negocioLojas = [{ id: uid(), nome: "Loja 1" }];
  const padrao = negocioLojas[0].id;
  const negocioLojaAtiva = data.negocioLojaAtiva || padrao;
  const comLoja = (arr) =>
    (Array.isArray(arr) ? arr : []).map((i) => (i.lojaId ? i : { ...i, lojaId: padrao }));
  return {
    negocioLojas,
    negocioLojaAtiva,
    negocioFinContas: comLoja(data.negocioFinContas),
    negocioFinDespesasFixas: comLoja(data.negocioFinDespesasFixas),
    negocioFinDespesasVar: comLoja(data.negocioFinDespesasVar),
    negocioRecebimentos: comLoja(data.negocioRecebimentos),
  };
}
```

(Nota: simplificar `filtrarPorLoja` — ver Step 5 de revisão.)

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @repo/cars-web exec vitest run src/lib/__tests__/negocio-lojas.test.js`
Expected: PASS.

- [ ] **Step 5: Limpeza do `filtrarPorLoja`** (remover o ternário redundante)

```js
export function filtrarPorLoja(itens, lojaAtiva) {
  const arr = Array.isArray(itens) ? itens : [];
  if (lojaAtiva === LOJA_TODAS) return arr;
  return arr.filter((i) => i.lojaId === lojaAtiva);
}
```

Run de novo o vitest do arquivo → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/cars-web/src/lib/negocioLojas.js apps/cars-web/src/lib/__tests__/negocio-lojas.test.js
git commit -m "feat(pessoal): helpers de financeiro por loja no Negócio (filtro, resumo, migração)"
```

---

### Task 2: Estado, persistência e migração no App

**Files:**
- Modify: `apps/cars-web/src/App.jsx`
- Modify: `apps/cars-web/src/lib/appPersistencia.js`

**Interfaces — Consumes (Task 1):** `migrarNegocioLojas`. **Produces:** estados `negocioLojas/setNegocioLojas`, `negocioLojaAtiva/setNegocioLojaAtiva`, `negocioRecebimentos/setNegocioRecebimentos`.

- [ ] **Step 1: App.jsx — declarar estados** (após `const [negocioFinDespesasVar, setNegocioFinDespesasVar] = useState([]);`, ~linha 238)

```jsx
  const [negocioLojas, setNegocioLojas] = useState([]);
  const [negocioLojaAtiva, setNegocioLojaAtiva] = useState("");
  const [negocioRecebimentos, setNegocioRecebimentos] = useState([]);
```

- [ ] **Step 2: App.jsx — incluir no SETTERS** (no objeto `SETTERS`, junto aos `setNegocioFin*`)

```jsx
        setNegocioFinContas, setNegocioFinCategorias, setNegocioFinDespesasFixas, setNegocioFinDespesasVar,
        setNegocioLojas, setNegocioLojaAtiva, setNegocioRecebimentos,
```

- [ ] **Step 3: appPersistencia.js — hidratar com migração** (substituir as 4 linhas `S.setNegocioFin*` por:)

```js
  // Financeiro por loja: migra (cria "Loja 1" e atribui lojaId aos itens sem).
  const _nl = migrarNegocioLojas(data);
  S.setNegocioLojas(_nl.negocioLojas);
  S.setNegocioLojaAtiva(_nl.negocioLojaAtiva);
  S.setNegocioFinContas(_nl.negocioFinContas);
  S.setNegocioFinCategorias(data.negocioFinCategorias || []);
  S.setNegocioFinDespesasFixas(_nl.negocioFinDespesasFixas);
  S.setNegocioFinDespesasVar(_nl.negocioFinDespesasVar);
  S.setNegocioRecebimentos(_nl.negocioRecebimentos);
```

E no topo do arquivo: `import { migrarNegocioLojas } from "./negocioLojas.js";`
(Remover as linhas antigas `S.setNegocioFinContas/FinDespesasFixas/FinDespesasVar` que foram substituídas; manter `setNegocioFinCategorias`.)

- [ ] **Step 4: App.jsx — `aplicarSeeds`** (garantir loja inicial quando não há dados). No `aplicarSeeds`, após os setters de negócio, adicionar:

```jsx
  const _seedLojas = migrarNegocioLojas({});
  S.setNegocioLojas(_seedLojas.negocioLojas);
  S.setNegocioLojaAtiva(_seedLojas.negocioLojaAtiva);
  S.setNegocioRecebimentos([]);
```

E `import { migrarNegocioLojas } from "./negocioLojas.js";` no topo do `appPersistencia.js` já cobre (mesmo arquivo).

- [ ] **Step 5: App.jsx — persistir** (no objeto `saveAll({...})` e no array de deps do `useEffect`, junto aos `negocioFin*`)

```jsx
      negocioFinContas, negocioFinCategorias, negocioFinDespesasFixas, negocioFinDespesasVar,
      negocioLojas, negocioLojaAtiva, negocioRecebimentos,
```
(adicionar nas DUAS ocorrências — objeto salvo + array de dependências.)

- [ ] **Step 6: Build + testes**

Run: `pnpm --filter @repo/cars-web build` → ✓
Run: `pnpm --filter @repo/cars-web test:once` → todos passam.

- [ ] **Step 7: Commit**

```bash
git add apps/cars-web/src/App.jsx apps/cars-web/src/lib/appPersistencia.js
git commit -m "feat(pessoal): estado/persistência/migração das lojas do Negócio"
```

---

### Task 3: `LojaSelector` + `GerenciarLojasModal`

**Files:**
- Create: `apps/cars-web/src/components/pages/Negocio/LojaSelector.jsx`
- Create: `apps/cars-web/src/components/pages/Negocio/GerenciarLojasModal.jsx`

**Interfaces — Produces:**
- `LojaSelector({ lojas, lojaAtiva, setLojaAtiva, onGerenciar, incluirTodas = true })` — dropdown + botão ⚙.
- `GerenciarLojasModal({ lojas, setLojas, lojaAtiva, setLojaAtiva, temItens, onClose })` — `temItens(lojaId) → boolean` (bloqueia exclusão).

- [ ] **Step 1: Criar `LojaSelector.jsx`**

```jsx
import React from "react";
import { Settings } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { LOJA_TODAS } from "../../../lib/negocioLojas.js";

export default function LojaSelector({ lojas = [], lojaAtiva, setLojaAtiva, onGerenciar, incluirTodas = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Loja</span>
      <select value={lojaAtiva} onChange={(e) => setLojaAtiva(e.target.value)}
challenge        style={{ background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, borderRadius: 8, padding: "5px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
        {incluirTodas && <option value={LOJA_TODAS}>Todas as lojas</option>}
        {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
      </select>
      {onGerenciar && (
        <button onClick={onGerenciar} title="Gerenciar lojas"
          style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
          <Settings size={14} />
        </button>
      )}
    </div>
  );
}
```
(Corrigir o atributo `challenge` digitado por engano → deve ser apenas `style`.)

- [ ] **Step 2: Criar `GerenciarLojasModal.jsx`**

```jsx
import React, { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Modal from "../../ui/Modal.jsx";

export default function GerenciarLojasModal({ lojas = [], setLojas, lojaAtiva, setLojaAtiva, temItens, onClose }) {
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");

  const criar = () => {
    const nome = `Loja ${lojas.length + 1}`;
    const nova = { id: uid(), nome };
    setLojas([...lojas, nova]);
    toast.success(`${nome} criada.`);
  };
  const salvarNome = (l) => {
    const nome = editNome.trim();
    if (!nome) { toast.error("Nome obrigatório."); return; }
    setLojas(lojas.map((x) => (x.id === l.id ? { ...x, nome } : x)));
    setEditId(null); setEditNome("");
  };
  const excluir = async (l) => {
    if (lojas.length <= 1) { toast.error("Tem que existir ao menos uma loja."); return; }
    if (temItens && temItens(l.id)) {
      toast.error("Essa loja tem lançamentos financeiros. Remova ou mova antes de excluir.");
      return;
    }
    const ok = await confirm({ title: `Excluir "${l.nome}"?`, body: "A loja será removida.", danger: true, confirmLabel: "Excluir" });
    if (!ok) return;
    const resto = lojas.filter((x) => x.id !== l.id);
    setLojas(resto);
    if (lojaAtiva === l.id) setLojaAtiva(resto[0].id);
    toast.success("Loja excluída.");
  };

  return (
    <Modal title="Gerenciar lojas" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lojas.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12 }}>
            {editId === l.id ? (
              <>
                <input autoFocus value={editNome} onChange={(e) => setEditNome(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") salvarNome(l); }} style={{ flex: 1 }} />
                <button className="btn-gold" style={{ padding: "4px 8px" }} onClick={() => salvarNome(l)}><Check size={13} /></button>
                <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={() => { setEditId(null); setEditNome(""); }}><X size={13} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.ink }}>{l.nome}</span>
                <button onClick={() => { setEditId(l.id); setEditNome(l.nome); }} title="Renomear"
                        style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Renomear</button>
                <button onClick={() => excluir(l)} title="Excluir"
                        style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button className="btn-gold" onClick={criar}><Plus size={14} className="inline mr-1" /> Nova loja</button>
        <button className="btn-ghost" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Build** → ✓ (componentes ainda não usados; valida sintaxe).

Run: `pnpm --filter @repo/cars-web build`

- [ ] **Step 4: Commit**

```bash
git add apps/cars-web/src/components/pages/Negocio/LojaSelector.jsx apps/cars-web/src/components/pages/Negocio/GerenciarLojasModal.jsx
git commit -m "feat(pessoal): componentes LojaSelector e GerenciarLojasModal"
```

---

### Task 4: Página `NegocioRecebimentos` (entradas por loja)

**Files:**
- Create: `apps/cars-web/src/components/pages/Negocio/NegocioRecebimentos.jsx`

**Interfaces — Produces:** `NegocioRecebimentos({ recebimentos, setRecebimentos, categorias, contas, lojaAtiva, lojas, hidden })`.

- [ ] **Step 1: Criar a página** — cópia de `NegocioDespesasVar.jsx` adaptada: título "Recebimentos", cor verde (`T.green`), categorias tipo "receita", filtra por `lojaAtiva` via `filtrarPorLoja`, novo item recebe `lojaId`. Quando `lojaAtiva === "todas"`, mostra etiqueta da loja e o form pede a loja (default = primeira). Código completo:

```jsx
import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";
import { filtrarPorLoja, LOJA_TODAS } from "../../../lib/negocioLojas.js";

export default function NegocioRecebimentos({ recebimentos = [], setRecebimentos, categorias = [], contas = [], lojaAtiva, lojas = [], hidden }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [mesFiltro, setMesFiltro] = useState("");
  const ehTodas = lojaAtiva === LOJA_TODAS;
  const lojaPadrao = lojas[0]?.id || "";
  const nomeLoja = (id) => (lojas.find((l) => l.id === id)?.nome || "—");

  const catsReceita = (categorias || []).filter(c => c.tipo === "receita");
  const daLoja = useMemo(() => filtrarPorLoja(recebimentos, lojaAtiva), [recebimentos, lojaAtiva]);
  const mesesDisponiveis = useMemo(() => {
    const set = new Set();
    daLoja.forEach(d => { if (d.data) set.add(d.data.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [daLoja]);
  const filtradas = useMemo(() => {
    const arr = !mesFiltro ? daLoja : daLoja.filter(d => (d.data || "").startsWith(mesFiltro));
    return [...arr].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [daLoja, mesFiltro]);
  const total = filtradas.reduce((s, d) => s + (Number(d.valor) || 0), 0);

  const novo = () => setForm({ id: null, descricao: "", valor: "", categoria: "", data: todayISO(), conta: "", lojaId: ehTodas ? lojaPadrao : lojaAtiva });

  const save = () => {
    const errs = {};
    if (!form.descricao?.trim()) errs.descricao = "Descrição é obrigatória";
    const valorNum = Number(String(form.valor).replace(/\./g, "").replace(",", "."));
    if (form.valor === "" || form.valor == null || isNaN(valorNum) || valorNum <= 0) errs.valor = "Valor inválido";
    if (!form.data) errs.data = "Data é obrigatória";
    if (!form.lojaId) errs.lojaId = "Escolha a loja";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Verifique os campos destacados."); return; }
    const normalizado = { ...form, valor: valorNum };
    if (form.id && recebimentos.find(d => d.id === form.id)) {
      setRecebimentos(recebimentos.map(d => d.id === form.id ? normalizado : d));
      toast.success("Recebimento atualizado.");
    } else {
      setRecebimentos([...recebimentos, { ...normalizado, id: uid() }]);
      toast.success(`Recebimento "${form.descricao}" criado.`);
    }
    setForm(null); setFormErrors({});
  };
  const excluir = async (d) => {
    const ok = await confirm({ title: `Excluir "${d.descricao}"?`, body: "O recebimento será removido.", danger: true, confirmLabel: "Excluir" });
    if (!ok) return;
    setRecebimentos(recebimentos.filter(x => x.id !== d.id));
    toast.success(`${d.descricao} excluído.`);
  };
  const corCat = (nome) => (categorias || []).find(c => c.nome === nome)?.cor || T.green;
  const mesLabel = (iso) => { const [y, m] = iso.split("-"); const n = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]; return `${n[Number(m)-1]}/${y}`; };

  return (
    <div className="fade-up py-8">
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="label-eyebrow">Negócio</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>Recebimentos</h2>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>Entradas do Negócio por loja.</div>
        </div>
        <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }} onClick={novo}><Plus size={13} className="inline mr-1.5" />Novo recebimento</button>
      </div>

      <div style={{ marginBottom: 10, padding: "8px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: ".15em", color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>Total</span>
          <span className="num" style={{ fontFamily: T.serif, fontSize: 22, color: T.green, lineHeight: 1 }}>{hidden ? "R$ •••••" : fmt(total)}</span>
          <span className="num" style={{ fontSize: 10.5, color: T.faint }}>· {filtradas.length} {filtradas.length === 1 ? "lançamento" : "lançamentos"}</span>
        </div>
        <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, cursor: "pointer" }}>
          <option value="">Todos os meses</option>
          {mesesDisponiveis.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic", background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhum recebimento {mesFiltro ? `em ${mesLabel(mesFiltro)}` : "ainda"}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {filtradas.map(d => (
            <div key={d.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${corCat(d.categoria)}`, borderRadius: 16, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>{d.descricao}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1, fontSize: 11, color: T.muted, flexWrap: "wrap" }}>
                  {ehTodas && <span style={{ padding: "1px 7px", background: `${T.gold}22`, color: T.gold, borderRadius: 4, fontWeight: 600, fontSize: 9.5 }}>{nomeLoja(d.lojaId)}</span>}
                  {d.categoria && <span style={{ padding: "1px 7px", background: `${corCat(d.categoria)}22`, color: corCat(d.categoria), borderRadius: 4, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", fontSize: 9.5 }}>{d.categoria}</span>}
                  {d.data && <span>{d.data.slice(8, 10)}/{d.data.slice(5, 7)}/{d.data.slice(0, 4)}</span>}
                  {d.conta && <span style={{ fontStyle: "italic" }}>· {d.conta}</span>}
                </div>
              </div>
              <div className="num" style={{ color: T.green, fontFamily: T.serif, fontSize: 14.5, fontWeight: 600, minWidth: 100, textAlign: "right" }}>{hidden ? "•••" : fmt(d.valor)}</div>
              <button onClick={() => setForm({ ...d })} title="Editar" style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, padding: "5px 8px", borderRadius: 11, cursor: "pointer" }}><Edit3 size={12} /></button>
              <button onClick={() => excluir(d)} title="Excluir" style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, padding: "5px 8px", borderRadius: 11, cursor: "pointer" }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar recebimento" : "Novo recebimento"} onClose={() => setForm(null)}>
          <Field label="Descrição" required error={formErrors.descricao}>
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Venda balcão" />
          </Field>
          <Field label="Valor (R$)" required error={formErrors.valor} hint="Ex.: 1500 ou 1.500,00">
            <input type="text" inputMode="decimal" autoComplete="off" value={form.valor == null ? "" : String(form.valor)} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="Ex.: 250,00" />
          </Field>
          {(ehTodas || !lojaAtiva) && (
            <Field label="Loja" required error={formErrors.lojaId}>
              <select value={form.lojaId || ""} onChange={e => setForm({ ...form, lojaId: e.target.value })}>
                <option value="">— Escolha —</option>
                {lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </Field>
          )}
          <Field label="Categoria">
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
              <option value="">— Sem categoria —</option>
              {catsReceita.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Data" required error={formErrors.data}>
            <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
          </Field>
          <Field label="Conta">
            <select value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })}>
              <option value="">— Sem conta —</option>
              {(contas || []).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build** → ✓
- [ ] **Step 3: Commit**

```bash
git add apps/cars-web/src/components/pages/Negocio/NegocioRecebimentos.jsx
git commit -m "feat(pessoal): página Recebimentos do Negócio (entradas por loja)"
```

---

### Task 5: Filtrar Banco/Despesas por loja + nav + rotas + props

**Files:**
- Modify: `NegocioBanco.jsx`, `NegocioDespesasFixas.jsx`, `NegocioDespesasVar.jsx`
- Modify: `App.jsx` (props + rota + LojaSelector nas telas), `Header.jsx` (subtab).

**Interfaces — Consumes:** Task 1 (`filtrarPorLoja`, `LOJA_TODAS`), Task 3 (`LojaSelector`, `GerenciarLojasModal`), Task 4 (`NegocioRecebimentos`).

- [ ] **Step 1: Padrão de filtro nas 3 páginas existentes** (`NegocioBanco`, `NegocioDespesasFixas`, `NegocioDespesasVar`): aceitar props `lojaAtiva, lojas` e:
  - calcular a lista visível com `filtrarPorLoja(itens, lojaAtiva)` (em vez de usar a prop crua diretamente nas listas/totais);
  - no `novo()`, semear `lojaId: lojaAtiva === LOJA_TODAS ? (lojas[0]?.id || "") : lojaAtiva`;
  - quando `lojaAtiva === LOJA_TODAS`, no form incluir um `<select>` de Loja (required) e na lista uma etiqueta com o nome da loja (igual ao padrão de `NegocioRecebimentos`).
  - import: `import { filtrarPorLoja, LOJA_TODAS } from "../../../lib/negocioLojas.js";`

  (NegocioBanco: a lista/`total` passam a usar `filtrarPorLoja(contas, lojaAtiva)`; `novo()` inclui `lojaId`.)

- [ ] **Step 2: Header.jsx — subtab Recebimentos** (nos DOIS arrays de nav do Negócio, após `negocio-despesas-var`)

```js
      { id: "negocio-recebimentos", label: "Recebimentos", icon: HandCoins },
```
Importar `HandCoins` no import do lucide (se ainda não houver).

- [ ] **Step 3: App.jsx — lazy import da página**

```jsx
const NegocioRecebimentos = lz(() => import("./components/pages/Negocio/NegocioRecebimentos.jsx"));
```

- [ ] **Step 4: App.jsx — estado do modal de gerenciar + helper temItens** (no corpo do componente)

```jsx
  const [gerenciarLojasOpen, setGerenciarLojasOpen] = useState(false);
  const lojaTemItens = (lojaId) =>
    [negocioFinContas, negocioFinDespesasFixas, negocioFinDespesasVar, negocioRecebimentos]
      .some(arr => (arr || []).some(i => i.lojaId === lojaId));
```

- [ ] **Step 5: App.jsx — render: LojaSelector no topo do bloco Negócio financeiro + rota recebimentos + modal**. Envolver os tabs financeiros (painel/banco/categorias? não — categorias é compartilhada/sem loja/ então selector só em painel, banco, despesas-fixas, despesas-var, recebimentos). Adicionar antes desses blocos:

```jsx
      {["negocio-painel","negocio-banco","negocio-despesas-fixas","negocio-despesas-var","negocio-recebimentos"].includes(tab) || !tab.startsWith("negocio-") ? (
        <LojaSelector lojas={negocioLojas} lojaAtiva={negocioLojaAtiva} setLojaAtiva={setNegocioLojaAtiva} onGerenciar={() => setGerenciarLojasOpen(true)} />
      ) : null}
```
E a rota nova:
```jsx
      {tab === "negocio-recebimentos" && (
        <NegocioRecebimentos
          recebimentos={negocioRecebimentos} setRecebimentos={setNegocioRecebimentos}
          categorias={negocioFinCategorias} contas={filtrarPorLoja(negocioFinContas, negocioLojaAtiva)}
          lojaAtiva={negocioLojaAtiva} lojas={negocioLojas} hidden={hidden}
        />
      )}
```
E o modal (uma vez, ao final do bloco Negócio):
```jsx
      {gerenciarLojasOpen && (
        <GerenciarLojasModal lojas={negocioLojas} setLojas={setNegocioLojas}
          lojaAtiva={negocioLojaAtiva} setLojaAtiva={setNegocioLojaAtiva}
          temItens={lojaTemItens} onClose={() => setGerenciarLojasOpen(false)} />
      )}
```
Imports no topo: `import { filtrarPorLoja } from "./lib/negocioLojas.js";` e os componentes `LojaSelector`/`GerenciarLojasModal` (lazy ou import direto — usar import direto, são leves):
```jsx
import LojaSelector from "./components/pages/Negocio/LojaSelector.jsx";
import GerenciarLojasModal from "./components/pages/Negocio/GerenciarLojasModal.jsx";
```

- [ ] **Step 6: App.jsx — passar `lojaAtiva`/`lojas` às páginas existentes** (Banco, DespesasFixas, DespesasVar): adicionar `lojaAtiva={negocioLojaAtiva} lojas={negocioLojas}` nas props de cada uma.

- [ ] **Step 7: Build + testes**

Run: `pnpm --filter @repo/cars-web build` → ✓
Run: `pnpm --filter @repo/cars-web test:once` → ✓

- [ ] **Step 8: Commit**

```bash
git add apps/cars-web/src/App.jsx apps/cars-web/src/components/Header.jsx apps/cars-web/src/components/pages/Negocio/NegocioBanco.jsx apps/cars-web/src/components/pages/Negocio/NegocioDespesasFixas.jsx apps/cars-web/src/components/pages/Negocio/NegocioDespesasVar.jsx
git commit -m "feat(pessoal): filtro por loja em Banco/Despesas + nav/rota Recebimentos + seletor"
```

---

### Task 6: Painel do Negócio por loja + "Todas as lojas"

**Files:**
- Modify: `apps/cars-web/src/components/pages/Negocio/NegocioPainel.jsx`
- Modify: `apps/cars-web/src/App.jsx` (props do Painel)

**Interfaces — Consumes:** `resumoLoja`, `LOJA_TODAS` (Task 1).

- [ ] **Step 1: App.jsx — passar dados financeiros + loja ao Painel**

```jsx
        <NegocioPainel
          ...props atuais...
          negocioFinContas={negocioFinContas}
          negocioFinDespesasFixas={negocioFinDespesasFixas}
          negocioFinDespesasVar={negocioFinDespesasVar}
          negocioRecebimentos={negocioRecebimentos}
          lojaAtiva={negocioLojaAtiva} lojas={negocioLojas}
        />
```

- [ ] **Step 2: NegocioPainel.jsx — bloco de resumo financeiro da loja**. Adicionar no topo do Painel um cartão com `resumoLoja(...)`:

```jsx
import { resumoLoja, LOJA_TODAS } from "../../../lib/negocioLojas.js";
// ...
const resumo = resumoLoja({
  contas: negocioFinContas, despesasFixas: negocioFinDespesasFixas,
  despesasVar: negocioFinDespesasVar, recebimentos: negocioRecebimentos,
}, lojaAtiva);
const tituloLoja = lojaAtiva === LOJA_TODAS ? "Todas as lojas" : (lojas.find(l => l.id === lojaAtiva)?.nome || "Loja");
```
E renderizar um grid de 4 KPIs (Saldo em banco, Recebimentos, Despesas, Resultado) usando `resumo`, com `tituloLoja` no cabeçalho — seguindo o estilo de cartões já usado no Painel (fundo `T.card`, borda, `fmt`, respeitar `hidden`). Resultado em `T.green` se ≥ 0, senão `T.red`.

- [ ] **Step 3: Build** → ✓
- [ ] **Step 4: Commit**

```bash
git add apps/cars-web/src/components/pages/Negocio/NegocioPainel.jsx apps/cars-web/src/App.jsx
git commit -m "feat(pessoal): Painel do Negócio com resumo por loja e Todas as lojas"
```

---

### Task 7: Verificação em runtime

**Files:** nenhum.

- [ ] **Step 1:** Forçar modo local TEMP em `lib/supabase.js` (`supabaseConfigured = false`), subir `vite`, dirigir com Chromium headless (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
- [ ] **Step 2:** Criar Loja 2; renomear Loja 1; lançar uma conta de Banco, uma despesa fixa, uma variável e um recebimento na Loja 1 e outra(s) na Loja 2; alternar o seletor e conferir **isolamento**; abrir "Todas as lojas" e ver o **consolidado** no Painel; conferir etiqueta de loja nas listas no modo "todas".
- [ ] **Step 3:** Reverter o patch (`git checkout apps/cars-web/src/lib/supabase.js`).

## Notas de execução
- Ao final: push + PR draft. Não espelhar no comercial.
</content>
