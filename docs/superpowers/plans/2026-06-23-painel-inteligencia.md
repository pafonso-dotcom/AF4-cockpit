# Painel de Inteligência (Finanças + Investimentos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a tela "Inteligência" no app pessoal que reúne score, insights, assinaturas e projeção de caixa (Finanças) + saúde da carteira (Investimentos), reaproveitando a inteligência já existente, com gancho de IA desativado.

**Architecture:** Uma página `Inteligencia.jsx` (orquestra cálculos via libs existentes e faz layout) + subcomponentes "burros" em `Inteligencia/`. Toda a lógica de cálculo já existe em `lib/intelligence.js` e `lib/invest-utils.js`; o único código novo de lógica são 3 helpers de glue (escopo, total de assinaturas, mapeamento insight→aba), que ganham testes unitários. Roteamento via `App.jsx` (lazy) + item de menu no `Header.jsx`.

**Tech Stack:** React 18 (lazy/Suspense), Vite, Recharts, lucide-react, vitest. Estilo inline com o tema `T` (padrão do app).

## Global Constraints

- App alvo: **somente** `apps/cars-web` (pessoal). NÃO espelhar em `numvi-financas` (regra do `CLAUDE.md`).
- Sem dependências novas; sem chamadas de rede; tudo client-side.
- Build de validação: `pnpm --filter @repo/cars-web build`.
- Testes unitários: `pnpm --filter @repo/cars-web test:once` (vitest), arquivos em `apps/cars-web/src/lib/__tests__/`.
- Branch de trabalho: `claude/numvi-pessoal-changes-YHaEK`.
- Respeitar `hidden` (modo esconder valores) em todos os números exibidos.
- Estilo: inline styles com tokens do tema importado de `../../lib/theme.js` (`T`).

## File Structure

- Create: `apps/cars-web/src/lib/inteligenciaPainel.js` — 3 helpers puros (escopo Finanças, total de assinaturas, aba-alvo de insight).
- Create: `apps/cars-web/src/lib/__tests__/inteligencia-painel.test.js` — testes dos helpers.
- Create: `apps/cars-web/src/components/pages/Inteligencia.jsx` — página orquestradora.
- Create: `apps/cars-web/src/components/pages/Inteligencia/ScoreCard.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/InsightsList.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/AssinaturasCard.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/CashflowCard.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/IAAnaliseCard.jsx`
- Modify: `apps/cars-web/src/App.jsx` — lazy import + render da aba `inteligencia`.
- Modify: `apps/cars-web/src/components/Header.jsx` — item de menu (Finanças). Dois arrays (linhas ~137 e ~636 — desktop e mobile/sheet).
- Modify: `apps/cars-web/src/components/pages/Dashboard.jsx` — religar `InsightsCard` (Ver todos → aba `inteligencia`).

**Reuso direto (sem novo arquivo):** o bloco de Investimentos renderiza o componente existente `components/pages/Invest/CarteiraSaude.jsx` (`<CarteiraSaude ativos hidden/>`).

**Referência das libs existentes (assinaturas verificadas):**
- `calcularScore(transacoes, contas, ativos, cartoes, parcelamentos, metas)` → `{ total /*0-1000*/, nivel, cor, breakdown: [{label, pts, max}], rendaMensal, despesaMensal }`
- `gerarInsights(transacoes, contas, ativos, cartoes, parcelamentos)` → `[{ tipo: "alerta"|"atencao"|"positivo", titulo, prioridade, ... }]`
- `detectarAssinaturas(transacoes)` → `[{ descricao?, valorMedio, ocorrencias, meses, frequencia, conhecida, valorAnualizado }]`
- `projetarCashflow(transacoes, contas, 3)` → `[{ ano, mes, mesKey, nome, receitas, despesas, fluxo, saldo, fixasPrevistas }]`
- `filtrarPorEscopo(itens, escopoAtivo, getEscopo?)` (de `lib/escopo.js`)
- `CarteiraSaude` default export, props `{ ativos, hidden }`.

---

### Task 1: Helpers de glue (TDD)

**Files:**
- Create: `apps/cars-web/src/lib/inteligenciaPainel.js`
- Test: `apps/cars-web/src/lib/__tests__/inteligencia-painel.test.js`

**Interfaces:**
- Consumes: `filtrarPorEscopo` de `../escopo.js`.
- Produces:
  - `escoparFinancas(transacoesRaw, contasRaw, escopoAtivo) → { transacoes, contas }`
  - `totalAssinaturas(assinaturas) → { mensal: number, anual: number }`
  - `tabAlvoInsight(insight) → string | null`

- [ ] **Step 1: Write the failing test**

Create `apps/cars-web/src/lib/__tests__/inteligencia-painel.test.js`:

```js
import { describe, it, expect } from "vitest";
import { escoparFinancas, totalAssinaturas, tabAlvoInsight } from "../inteligenciaPainel.js";

describe("escoparFinancas", () => {
  const contas = [
    { nome: "CC", escopo: "pessoal" },
    { nome: "Loja", escopo: "negocio" },
  ];
  const txs = [
    { conta: "CC", valor: 10 },
    { conta: "Loja", valor: 20 },
    { conta: null, valor: 30 },
  ];
  it("escopo 'tudo' devolve tudo", () => {
    const r = escoparFinancas(txs, contas, "tudo");
    expect(r.contas).toHaveLength(2);
    expect(r.transacoes).toHaveLength(3);
  });
  it("escopo 'pessoal' filtra contas e transações pelas contas do escopo", () => {
    const r = escoparFinancas(txs, contas, "pessoal");
    expect(r.contas.map(c => c.nome)).toEqual(["CC"]);
    expect(r.transacoes).toEqual([{ conta: "CC", valor: 10 }]);
  });
  it("lida com entradas nulas sem quebrar", () => {
    const r = escoparFinancas(null, null, "pessoal");
    expect(r).toEqual({ transacoes: [], contas: [] });
  });
});

describe("totalAssinaturas", () => {
  it("soma valorAnualizado em anual e divide por 12 no mensal", () => {
    const r = totalAssinaturas([{ valorAnualizado: 120 }, { valorAnualizado: 240 }]);
    expect(r.anual).toBe(360);
    expect(r.mensal).toBe(30);
  });
  it("lista vazia → zeros", () => {
    expect(totalAssinaturas([])).toEqual({ mensal: 0, anual: 0 });
  });
});

describe("tabAlvoInsight", () => {
  it("mapeia por palavra-chave do título", () => {
    expect(tabAlvoInsight({ titulo: "Cartão de crédito acima de 30% da renda" })).toBe("cartoes");
    expect(tabAlvoInsight({ titulo: "Gastos com delivery subiram 40%" })).toBe("transacoes");
    expect(tabAlvoInsight({ titulo: "Reserva de emergência cobre 1 mês" })).toBe("metas");
  });
  it("sem correspondência → null", () => {
    expect(tabAlvoInsight({ titulo: "Tudo sob controle" })).toBeNull();
    expect(tabAlvoInsight(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/cars-web exec vitest run src/lib/__tests__/inteligencia-painel.test.js`
Expected: FAIL (Cannot find module `../inteligenciaPainel.js`).

- [ ] **Step 3: Write minimal implementation**

Create `apps/cars-web/src/lib/inteligenciaPainel.js`:

```js
// Glue do Painel de Inteligência: aplica escopo nos dados de Finanças,
// agrega assinaturas e mapeia um insight para a aba relevante (best-effort).
import { filtrarPorEscopo } from "./escopo.js";

/** Filtra contas pelo escopo e transações pelas contas do escopo (igual ao Dashboard). */
export function escoparFinancas(transacoesRaw, contasRaw, escopoAtivo) {
  const txs = Array.isArray(transacoesRaw) ? transacoesRaw : [];
  const contasAll = Array.isArray(contasRaw) ? contasRaw : [];
  if (escopoAtivo === "tudo" || !escopoAtivo) {
    return { transacoes: txs, contas: contasAll };
  }
  const contas = filtrarPorEscopo(contasAll, escopoAtivo);
  const nomes = new Set(contas.map(c => c.nome));
  const transacoes = txs.filter(t => t.conta && nomes.has(t.conta));
  return { transacoes, contas };
}

/** Soma assinaturas: anual = Σ valorAnualizado; mensal = anual / 12. */
export function totalAssinaturas(assinaturas) {
  const lista = Array.isArray(assinaturas) ? assinaturas : [];
  const anual = lista.reduce((s, a) => s + (Number(a.valorAnualizado) || 0), 0);
  return { anual, mensal: anual / 12 };
}

/** Mapeia um insight para a aba alvo por palavra-chave do título (ou null). */
export function tabAlvoInsight(insight) {
  const t = (insight?.titulo || "").toLowerCase();
  if (!t) return null;
  if (t.includes("cart")) return "cartoes";
  if (t.includes("reserva") || t.includes("meta")) return "metas";
  if (t.includes("receber") || t.includes("devedor")) return "areceber";
  if (t.includes("delivery") || t.includes("gasto") || t.includes("gastos")) return "transacoes";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/cars-web exec vitest run src/lib/__tests__/inteligencia-painel.test.js`
Expected: PASS (3 suites, 8 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/cars-web/src/lib/inteligenciaPainel.js apps/cars-web/src/lib/__tests__/inteligencia-painel.test.js
git commit -m "feat(pessoal): helpers do Painel de Inteligência (escopo, assinaturas, insight→aba)"
```

---

### Task 2: Subcomponentes de apresentação

**Files:**
- Create: `apps/cars-web/src/components/pages/Inteligencia/ScoreCard.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/InsightsList.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/AssinaturasCard.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/CashflowCard.jsx`
- Create: `apps/cars-web/src/components/pages/Inteligencia/IAAnaliseCard.jsx`

**Interfaces:**
- Consumes (Task 1): `totalAssinaturas`, `tabAlvoInsight`.
- Produces (props consumidas pela página na Task 3):
  - `ScoreCard({ score, hidden })` — `score` = retorno de `calcularScore`.
  - `InsightsList({ insights, onIr })` — `onIr(tabId)` navega.
  - `AssinaturasCard({ assinaturas, hidden })`.
  - `CashflowCard({ projecao, hidden })` — `projecao` = retorno de `projetarCashflow`.
  - `IAAnaliseCard({})` — botão desativado.

> Convenção do app: componentes de UI são validados por **build + verificação em runtime** (Task 5), não por testes unitários. Estes 5 arquivos são puramente apresentacionais.

- [ ] **Step 1: Criar `ScoreCard.jsx`**

```jsx
import React from "react";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";

// Score financeiro 0-1000 + faixa (nivel/cor) + fatores do breakdown.
export default function ScoreCard({ score, hidden }) {
  if (!score || !score.breakdown) {
    return <Card><Vazio texto="Registre mais transações para calcular seu score." /></Card>;
  }
  const pct = Math.max(0, Math.min(100, (score.total / 1000) * 100));
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: T.serif, fontSize: 34, fontWeight: 700, color: score.cor }}>
          {hidden ? "•••" : score.total}
        </span>
        <span style={{ fontSize: 13, color: T.muted }}>/ 1000</span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: score.cor,
                       textTransform: "uppercase", letterSpacing: ".06em" }}>{score.nivel}</span>
      </div>
      <div style={{ height: 6, borderRadius: 100, background: `${score.cor}22`, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: score.cor }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {score.breakdown.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, color: T.ink }}>{b.label}</span>
            <span className="num" style={{ color: T.muted }}>{Math.round(b.pts)}/{b.max}</span>
            <div style={{ width: 70, height: 4, borderRadius: 100, background: T.border, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, (b.pts / b.max) * 100))}%`, height: "100%",
                            background: b.pts / b.max >= 0.5 ? T.green : T.gold }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Vazio({ texto }) {
  return <div style={{ fontSize: 12.5, color: T.muted, fontStyle: "italic", padding: "8px 2px" }}>{texto}</div>;
}
export { Vazio };
```

- [ ] **Step 2: Criar `InsightsList.jsx`**

```jsx
import React from "react";
import { ArrowRight } from "lucide-react";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { tabAlvoInsight } from "../../../lib/inteligenciaPainel.js";
import { Vazio } from "./ScoreCard.jsx";

const COR_TIPO = { alerta: "#EF4444", atencao: "#F59E0B", positivo: "#10B981" };
const ICON_TIPO = { alerta: "⚠️", atencao: "🟡", positivo: "✅" };

export default function InsightsList({ insights = [], onIr }) {
  if (!insights.length) {
    return <Card><Vazio texto="Nenhum insight no momento — tudo sob controle." /></Card>;
  }
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {insights.map((ins, i) => {
          const cor = COR_TIPO[ins.tipo] || T.muted;
          const alvo = tabAlvoInsight(ins);
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8,
                                   borderLeft: `3px solid ${cor}`, paddingLeft: 10 }}>
              <span style={{ fontSize: 13 }}>{ICON_TIPO[ins.tipo] || "•"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{ins.titulo}</div>
                {ins.descricao && <div style={{ fontSize: 11, color: T.muted }}>{ins.descricao}</div>}
              </div>
              {alvo && onIr && (
                <button onClick={() => onIr(alvo)} title="Ir para a tela"
                  style={{ background: "transparent", border: "none", color: T.gold, cursor: "pointer",
                           display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                  ir <ArrowRight size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Criar `AssinaturasCard.jsx`**

```jsx
import React from "react";
import { fmt } from "../../../lib/format.js";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { totalAssinaturas } from "../../../lib/inteligenciaPainel.js";
import { Vazio } from "./ScoreCard.jsx";

export default function AssinaturasCard({ assinaturas = [], hidden }) {
  if (!assinaturas.length) {
    return <Card><Vazio texto="Nenhuma assinatura recorrente detectada." /></Card>;
  }
  const { mensal, anual } = totalAssinaturas(assinaturas);
  return (
    <Card>
      <div style={{ fontSize: 12.5, color: T.ink, marginBottom: 10 }}>
        Você compromete <strong style={{ color: T.gold }}>{hidden ? "•••" : fmt(mensal)}/mês</strong>
        {" "}em assinaturas (<span className="num">{hidden ? "•••" : fmt(anual)}</span>/ano).
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {assinaturas.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.conhecida ? "★ " : ""}{a.descricao || "Assinatura"}
            </span>
            <span style={{ fontSize: 10.5, color: T.muted }}>{a.frequencia}</span>
            <span className="num" style={{ color: T.ink, fontWeight: 600 }}>{hidden ? "•••" : fmt(a.valorMedio)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Criar `CashflowCard.jsx`**

```jsx
import React from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt } from "../../../lib/format.js";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { Vazio } from "./ScoreCard.jsx";

export default function CashflowCard({ projecao = [], hidden }) {
  if (!projecao.length) {
    return <Card><Vazio texto="Sem histórico suficiente para projetar." /></Card>;
  }
  const data = projecao.map(p => ({ nome: (p.nome || "").split(" de ")[0], saldo: Math.round(p.saldo) }));
  return (
    <Card>
      <div style={{ width: "100%", height: 120, marginBottom: 8 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="nome" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => hidden ? "•••" : fmt(v)} />
            <Area type="monotone" dataKey="saldo" stroke={T.gold} fill={`${T.gold}33`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {projecao.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, color: T.ink, textTransform: "capitalize" }}>{p.nome}</span>
            <span style={{ fontSize: 10.5, color: p.fluxo >= 0 ? T.green : T.red }}>
              {p.fluxo >= 0 ? "+" : ""}{hidden ? "•••" : fmt(p.fluxo)}
            </span>
            <span className="num" style={{ color: T.ink, fontWeight: 600, width: 90, textAlign: "right" }}>
              {hidden ? "•••" : fmt(p.saldo)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Criar `IAAnaliseCard.jsx`**

```jsx
import React from "react";
import { Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";

// Gancho de IA (fase 2): botão presente, desativado. O ponto de integração
// fica pronto — basta trocar o handler por perguntarAoClaude(buildContext(...)).
export default function IAAnaliseCard() {
  return (
    <Card variant="soft">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Sparkles size={18} style={{ color: T.gold, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Análise com IA</div>
          <div style={{ fontSize: 11, color: T.muted }}>Resumo do mês em linguagem natural — em breve.</div>
        </div>
        <button disabled title="Em breve"
          style={{ background: T.border, color: T.muted, border: "none", borderRadius: 10,
                   padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "not-allowed", opacity: 0.7 }}>
          Em breve
        </button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: Build para validar os subcomponentes**

Run: `pnpm --filter @repo/cars-web build`
Expected: build conclui sem erros (✓ built).

- [ ] **Step 7: Commit**

```bash
git add apps/cars-web/src/components/pages/Inteligencia/
git commit -m "feat(pessoal): subcomponentes do Painel de Inteligência"
```

---

### Task 3: Página `Inteligencia.jsx`

**Files:**
- Create: `apps/cars-web/src/components/pages/Inteligencia.jsx`

**Interfaces:**
- Consumes (Task 1): `escoparFinancas`. (Task 2): `ScoreCard`, `InsightsList`, `AssinaturasCard`, `CashflowCard`, `IAAnaliseCard`. Libs: `calcularScore`, `gerarInsights`, `detectarAssinaturas`, `projetarCashflow` (de `../../lib/intelligence.js`); `CarteiraSaude` (de `./Invest/CarteiraSaude.jsx`); `PageHeader` (de `../ui/PageHeader.jsx`).
- Produces (props consumidas pela Task 4):
  `Inteligencia({ transacoes, contas, ativos, cartoes, parcelamentos, metas, escopoAtivo, hidden, onTabChange })`.

- [ ] **Step 1: Criar a página**

```jsx
import React, { useMemo } from "react";
import { Brain } from "lucide-react";
import { T } from "../../lib/theme.js";
import PageHeader from "../ui/PageHeader.jsx";
import { calcularScore, gerarInsights, detectarAssinaturas, projetarCashflow } from "../../lib/intelligence.js";
import { escoparFinancas } from "../../lib/inteligenciaPainel.js";
import ScoreCard from "./Inteligencia/ScoreCard.jsx";
import InsightsList from "./Inteligencia/InsightsList.jsx";
import AssinaturasCard from "./Inteligencia/AssinaturasCard.jsx";
import CashflowCard from "./Inteligencia/CashflowCard.jsx";
import IAAnaliseCard from "./Inteligencia/IAAnaliseCard.jsx";
import CarteiraSaude from "./Invest/CarteiraSaude.jsx";

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export default function Inteligencia({
  transacoes = [], contas = [], ativos = [], cartoes = [], parcelamentos = [], metas = [],
  escopoAtivo = "tudo", hidden = false, onTabChange,
}) {
  const fin = useMemo(() => escoparFinancas(transacoes, contas, escopoAtivo), [transacoes, contas, escopoAtivo]);
  const score = useMemo(() => safe(() => calcularScore(fin.transacoes, fin.contas, ativos, cartoes, parcelamentos, metas), null), [fin, ativos, cartoes, parcelamentos, metas]);
  const insights = useMemo(() => safe(() => gerarInsights(fin.transacoes, fin.contas, ativos, cartoes, parcelamentos) || [], []), [fin, ativos, cartoes, parcelamentos]);
  const assinaturas = useMemo(() => safe(() => detectarAssinaturas(fin.transacoes) || [], []), [fin]);
  const projecao = useMemo(() => safe(() => projetarCashflow(fin.transacoes, fin.contas, 3) || [], []), [fin]);

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Inteligência"
        title={<>Painel de <em>Inteligência.</em></>}
        sub="Score, insights, assinaturas e projeção — mais a saúde da carteira. Tudo calculado no seu aparelho."
      />

      <Grupo titulo="Finanças">
        <Secao titulo="Score financeiro"><ScoreCard score={score} hidden={hidden} /></Secao>
        <Secao titulo="Insights"><InsightsList insights={insights} onIr={onTabChange} /></Secao>
        <Secao titulo="Assinaturas detectadas"><AssinaturasCard assinaturas={assinaturas} hidden={hidden} /></Secao>
        <Secao titulo="Projeção de caixa (3 meses)"><CashflowCard projecao={projecao} hidden={hidden} /></Secao>
      </Grupo>

      <Grupo titulo="Investimentos">
        <Secao titulo="Saúde da carteira"><CarteiraSaude ativos={ativos} hidden={hidden} /></Secao>
      </Grupo>

      <Grupo titulo="Inteligência artificial">
        <Secao titulo="Análise com IA"><IAAnaliseCard /></Secao>
      </Grupo>
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Brain size={14} style={{ color: T.gold }} />
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.ink }}>{titulo}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Secao({ titulo, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600 }}>{titulo}</div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Build para validar a página**

Run: `pnpm --filter @repo/cars-web build`
Expected: build conclui sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/cars-web/src/components/pages/Inteligencia.jsx
git commit -m "feat(pessoal): página do Painel de Inteligência"
```

---

### Task 4: Roteamento, menu e religar o Dashboard

**Files:**
- Modify: `apps/cars-web/src/App.jsx`
- Modify: `apps/cars-web/src/components/Header.jsx`
- Modify: `apps/cars-web/src/components/pages/Dashboard.jsx`

**Interfaces:**
- Consumes (Task 3): `Inteligencia` (default export).

- [ ] **Step 1: App.jsx — adicionar o lazy import**

Logo após a linha `const RelatoriosFinancas = lz(() => import("./components/pages/RelatoriosFinancas.jsx"));` (≈ linha 94), inserir:

```js
const Inteligencia = lz(() => import("./components/pages/Inteligencia.jsx"));
```

- [ ] **Step 2: App.jsx — renderizar a aba**

Logo após o bloco `{tab === "categorias" && ( ... )}` (≈ linha 830-833), inserir:

```jsx
      {tab === "inteligencia" && (
        <Inteligencia
          transacoes={transacoes} contas={contas} ativos={ativos}
          cartoes={cartoes} parcelamentos={parcelamentos} metas={metas}
          escopoAtivo={escopoAtivo} hidden={hidden} onTabChange={setTab}
        />
      )}
```

- [ ] **Step 3: Header.jsx — adicionar item de menu (desktop, ≈ linha 141 e mobile, ≈ linha 637)**

Importar o ícone `Brain` no bloco de imports do lucide (linha ~9), adicionando `Brain,` à lista.
Em CADA um dos dois arrays de navegação de Finanças, logo após o item
`{ id: "planejamento", label: "Centro de controle", icon: Target },`, inserir:

```js
      { id: "inteligencia", label: "Inteligência", icon: Brain },
```

- [ ] **Step 4: Dashboard.jsx — religar o InsightsCard (Ver todos → aba inteligencia)**

No JSX do Dashboard, logo antes de `<PergunteIACard onClick={() => onTabChange?.("perguntar")} />` (≈ linha 391), inserir o render do card já existente, ligando o "Ver todos" à nova aba:

```jsx
        {principalInsight && <InsightsCard insight={principalInsight} onSeeAll={() => onTabChange?.("inteligencia")} />}
```

- [ ] **Step 5: Build para validar a integração**

Run: `pnpm --filter @repo/cars-web build`
Expected: build conclui sem erros.

- [ ] **Step 6: Rodar os testes unitários (garantia de não-regressão dos helpers)**

Run: `pnpm --filter @repo/cars-web test:once`
Expected: todos os testes passam, incluindo `inteligencia-painel.test.js`.

- [ ] **Step 7: Commit**

```bash
git add apps/cars-web/src/App.jsx apps/cars-web/src/components/Header.jsx apps/cars-web/src/components/pages/Dashboard.jsx
git commit -m "feat(pessoal): rota + menu 'Inteligência' e religa InsightsCard do Dashboard"
```

---

### Task 5: Verificação em runtime (dirigir o app)

**Files:** nenhum (verificação).

- [ ] **Step 1: Subir o app em modo local**

Como o app exige login Supabase (chave embutida), para verificação local force o modo local TEMPORARIAMENTE (reverter depois): em `apps/cars-web/src/lib/supabase.js`, troque `export const supabaseConfigured = !!(URL && KEY);` por `export const supabaseConfigured = false;`. Então:

Run: `cd apps/cars-web && pnpm exec vite --port 4422 --host 127.0.0.1 --strictPort`
Expected: `VITE ... ready`, HTTP 200 em `http://127.0.0.1:4422/`.

- [ ] **Step 2: Dirigir e capturar (navegador headless)**

Com o Chromium pré-instalado (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) e Playwright: semear `localStorage["financas:dados:v1"]` com algumas transações (receitas/despesas em meses diferentes, incluindo uma recorrente tipo "Netflix") + 1-2 contas com saldo + 1-2 ativos; navegar para Finanças → **Inteligência**; tirar screenshots.
Expected (observar nas capturas):
- Score com número 0-1000, faixa e barras de fatores.
- Lista de insights (se houver) com severidade.
- Assinaturas: "você compromete R$X/mês" + item Netflix.
- Projeção: mini-gráfico + 3 meses.
- Saúde da carteira renderizada.
- Card "Análise com IA" com botão **"Em breve" desativado**.
- Com `localStorage` vazio: cada card mostra seu estado vazio amigável (sem quebrar).

- [ ] **Step 3: Reverter o patch de verificação**

Run: `git checkout apps/cars-web/src/lib/supabase.js`
Expected: `supabaseConfigured = !!(URL && KEY)` de volta; `git status` limpo (fora os arquivos da feature já commitados).

- [ ] **Step 4: (sem commit)** — a verificação não altera código de produção.

---

## Notas de execução

- Ao final, fazer push da branch e abrir PR draft (como no fluxo anterior).
- Não espelhar nada em `numvi-financas`.
</content>
