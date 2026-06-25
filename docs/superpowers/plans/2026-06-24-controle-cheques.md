# Controle de Cheques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou superpowers:executing-plans. Steps em checkbox.

**Goal:** Controle de cheques a receber (Aguardando/Compensado/Devolvido); compensar credita conta + vira receita; cheques aguardando aparecem no relatório.

**Architecture:** Estado `cheques` no App; página `Cheques.jsx` (CRUD + compensar/devolver/estornar); `getGanhosDoMes` conta cheque aguardando como pendente (entra no Controle Anual + projeção). Liga os ganchos existentes (notificações, buildContext).

**Tech Stack:** React 18, Vite, lucide-react, vitest. Estilo inline `T`.

## Global Constraints
- Só `apps/cars-web`. Sem deps novas. Respeitar `hidden`.
- Build: `pnpm --filter @repo/cars-web build`; testes: `test:once`.
- Branch `claude/numvi-pessoal-changes-YHaEK`; committer `noreply@anthropic.com`.

## File Structure
- Modify: `lib/agregador.js` — `aplicarEscopo` (filtra `cheques`) + `getGanhosDoMes` (cheque aguardando = pendente).
- Test: `lib/__tests__/cheques-ganhos.test.js`.
- Create: `components/pages/Cheques.jsx` — página CRUD + ações.
- Modify: `App.jsx` — estado/SETTERS/persistência/rota/`checkAndNotify`; `appPersistencia.js` — hidrata.
- Modify: `Header.jsx` — subtab "Cheques".
- Modify: `components/pages/PergunteAoClaude.jsx` — `buildContext({ ..., cheques })`.

---

### Task 1: Agregador conta cheque aguardando (TDD)

**Files:** Modify `lib/agregador.js`; Test `lib/__tests__/cheques-ganhos.test.js`.

- [ ] **Step 1: teste falhando**

```js
import { describe, it, expect } from "vitest";
import { getGanhosDoMes } from "../agregador.js";

describe("cheques no getGanhosDoMes", () => {
  const state = {
    contas: [{ nome: "CC", escopo: "pessoal" }],
    cheques: [
      { id: "k1", de: "João", valor: 500, vencimento: "2026-07-10", status: "aguardando", escopo: "pessoal" },
      { id: "k2", de: "Maria", valor: 300, vencimento: "2026-07-20", status: "compensado", escopo: "pessoal" },
      { id: "k3", de: "Ana", valor: 200, vencimento: "2026-07-25", status: "devolvido", escopo: "pessoal" },
    ],
  };
  it("conta só o aguardando como pendente no mês do vencimento", () => {
    const g = getGanhosDoMes("2026-07", state, "tudo");
    const chs = g.filter(x => x.categoria === "Cheques");
    expect(chs).toHaveLength(1);
    expect(chs[0].valor).toBe(500);
    expect(chs[0].status).toBe("pendente");
  });
  it("não conta cheque fora do mês", () => {
    const g = getGanhosDoMes("2026-08", state, "tudo");
    expect(g.filter(x => x.categoria === "Cheques")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: rodar (FAIL)** — `pnpm --filter @repo/cars-web exec vitest run src/lib/__tests__/cheques-ganhos.test.js`

- [ ] **Step 3: implementar**

Em `aplicarEscopo` (no objeto retornado, junto a `devedores: ...`):
```js
    cheques: (state.cheques || []).filter(noEscopo),
```
Em `getGanhosDoMes`, após a seção "2. Transações tipo receita" (antes do `return out.sort`):
```js
  // 3. Cheques aguardando — recebível pendente no mês do vencimento.
  (state.cheques || []).forEach(c => {
    if (c.status !== "aguardando") return;
    if (!(c.vencimento || "").startsWith(mesISO)) return;
    out.push({
      id: `cheque::${c.id}`, fonte: "cheque", tipo: "ganho",
      descricao: `Cheque de ${c.de || "—"}`,
      data: c.vencimento, valor: Number(c.valor) || 0,
      status: "pendente", categoria: "Cheques",
    });
  });
```

- [ ] **Step 4: rodar (PASS)**
- [ ] **Step 5: commit** — `git commit -m "feat(pessoal): cheques aguardando contam como recebível no relatório"`

---

### Task 2: Estado / persistência / rota / integrações no App

**Files:** `App.jsx`, `appPersistencia.js`.

- [ ] **Step 1:** `App.jsx` — estado (junto aos outros): `const [cheques, setCheques] = useState([]);`
- [ ] **Step 2:** SETTERS — adicionar `setCheques,`.
- [ ] **Step 3:** `appPersistencia.js` — `aplicarDadosCarregados`: `S.setCheques(data.cheques || []);`; `aplicarSeeds`: `S.setCheques([]);`. (setCheques já no SETTERS.)
- [ ] **Step 4:** `App.jsx` `saveAll({...})` + array de deps — adicionar `cheques,` (nas duas ocorrências).
- [ ] **Step 5:** `App.jsx` — `checkAndNotify({ devedores, dividas, cheques });`
- [ ] **Step 6:** `App.jsx` — lazy import `const Cheques = lz(() => import("./components/pages/Cheques.jsx"));` e rota:
```jsx
      {tab === "cheques" && (
        <Cheques
          cheques={cheques} setCheques={setCheques}
          contas={contas} setContas={setContas}
          transacoes={transacoes} setTransacoes={setTransacoes}
          escopoAtivo={escopoAtivo} hidden={hidden}
        />
      )}
```
- [ ] **Step 7:** `PergunteAoClaude.jsx` — receber `cheques` (prop) e passar a `buildContext({ ..., cheques })`. Em `App.jsx`, no `<PergunteAoClaude .../>`, passar `cheques={cheques}`.
- [ ] **Step 8:** build + `test:once` ✓. Commit.

---

### Task 3: Header — subtab Cheques

**Files:** `Header.jsx`.

- [ ] Importar `FileText` (se faltar) no import do lucide. Nos DOIS arrays de nav de Finanças, após `relatorios-f` (ou após `audit`), inserir:
```js
      { id: "cheques", label: "Cheques", icon: FileText },
```
- [ ] build ✓. Commit.

---

### Task 4: Página `Cheques.jsx`

**Files:** Create `components/pages/Cheques.jsx`.

**Interface:** `Cheques({ cheques, setCheques, contas, setContas, transacoes, setTransacoes, escopoAtivo, hidden })`.

Comportamento (modelado em `NegocioRecebimentos`/`AReceberEDividas`):
- Filtra por escopo (`escopoAtivo`) como o resto; novos cheques nascem com `escopo: escopoAtivo === "tudo" ? "pessoal" : escopoAtivo`.
- KPIs: Total aguardando, Vencidos (aguardando, vencimento < hoje), Compensado no mês.
- Lista ordenada por vencimento; filtro por status (todos/aguardando/compensado/devolvido); badge de status.
- **Novo/Editar** (Modal): de, valor (MoneyInput), vencimento (date), banco, número, obs.
- **Compensar** (Modal): conta destino (select de `contas`) + data → cria tx
  `{ id, tipo: "receita", valor, descricao: "Cheque de {de}", categoria: "Cheques", conta, data, compensado: true, chequeId: id }`,
  `setContas(+valor na conta)`, `setCheques` status=compensado + contaCompensacao/dataCompensacao/txId.
- **Devolver**: status=devolvido (confirm). **Reativar**: devolvido/compensado → volta aguardando (estorna se era compensado).
- **Estornar compensação**: remove tx (txId), `setContas(-valor)`, status=aguardando, limpa campos.
- **Excluir**: se compensado, estorna junto (remove tx + devolve conta) com desfazer.

Código completo será escrito na implementação seguindo os padrões de
`NegocioRecebimentos.jsx` (CRUD/modal) e a baixa de `AReceberEDividas.jsx`
(compensar/estornar). Validação: descrição/de obrigatório, valor > 0, vencimento.

- [ ] build ✓ · commit.

---

### Task 5: Verificação em runtime
- [ ] Patch local (`supabaseConfigured=false`), vite, Chromium headless.
- [ ] Criar cheque (aguardando) → aparece na lista e como pendente no Controle Anual (mês do vencimento). Compensar → conta credita + transação receita + status compensado + sai do pendente. Estornar → conta volta, tx some, volta aguardando. Devolver → status, sem movimento.
- [ ] Reverter patch.

## Notas
- Push + PR. Não espelhar no comercial.
</content>
