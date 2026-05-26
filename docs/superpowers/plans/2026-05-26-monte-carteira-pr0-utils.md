# Monte sua Carteira — PR 0: Utils compartilhados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated constants, utility functions, and UI components from 5 Invest screens into shared modules. No visual change — purely refactor to prepare for PR 1.

**Architecture:** Two new lib files (`invest-constants.js`, `invest-utils.js`) with vitest tests; two new UI components (`KpiCard.jsx`, `AlocacaoPieChart.jsx`) validated by build. Migrate `InvestPainel.jsx`, `CarteiraSaude.jsx`, `AnaliseCarteira.jsx`, `Projecao.jsx`, `Proventos.jsx` to use the shared modules.

**Tech Stack:** React 18, vitest, Recharts, Vite, lucide-react.

**Branch:** `claude/monte-carteira-pr0-utils` (from `main`)

**Reference spec:** `docs/superpowers/specs/2026-05-26-monte-sua-carteira-design.md`

---

## File Structure

**Create:**
- `apps/cars-web/src/lib/invest-constants.js` — `ASSET_CLASS_LABELS`, `ASSET_CLASS_COLORS`, `PROVENTO_REGEX`
- `apps/cars-web/src/lib/__tests__/invest-constants.test.js`
- `apps/cars-web/src/lib/invest-utils.js` — `calcAlocacaoPorClasse`, `calcRentabilidadeAtivo`, `calcCarteiraSaude`
- `apps/cars-web/src/lib/__tests__/invest-utils.test.js`
- `apps/cars-web/src/components/ui/KpiCard.jsx`
- `apps/cars-web/src/components/ui/AlocacaoPieChart.jsx`

**Modify (delete inline copies, import from new modules):**
- `apps/cars-web/src/components/pages/Invest/InvestPainel.jsx`
- `apps/cars-web/src/components/pages/Invest/CarteiraSaude.jsx`
- `apps/cars-web/src/components/pages/Invest/AnaliseCarteira.jsx`
- `apps/cars-web/src/components/pages/Invest/Projecao.jsx`
- `apps/cars-web/src/components/pages/Invest/Proventos.jsx`

---

## Task 1: Branch setup

- [ ] **Step 1: Create branch**

```bash
git fetch origin main
git checkout -b claude/monte-carteira-pr0-utils origin/main
```

Expected: `Switched to a new branch 'claude/monte-carteira-pr0-utils'`

---

## Task 2: invest-constants.js (with TDD)

**Files:**
- Create: `apps/cars-web/src/lib/invest-constants.js`
- Test: `apps/cars-web/src/lib/__tests__/invest-constants.test.js`

- [ ] **Step 1: Write the failing test**

Create file `apps/cars-web/src/lib/__tests__/invest-constants.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASS_COLORS,
  PROVENTO_REGEX,
} from "../invest-constants.js";

describe("ASSET_CLASS_LABELS", () => {
  it("has all known classes", () => {
    expect(ASSET_CLASS_LABELS.acao).toBe("Ações BR");
    expect(ASSET_CLASS_LABELS.fii).toBe("FIIs");
    expect(ASSET_CLASS_LABELS.stock).toBe("Stocks US");
    expect(ASSET_CLASS_LABELS.reit).toBe("REITs");
    expect(ASSET_CLASS_LABELS.etf).toBe("ETFs");
    expect(ASSET_CLASS_LABELS.cripto).toBe("Cripto");
    expect(ASSET_CLASS_LABELS.tesouro).toBe("Tesouro");
    expect(ASSET_CLASS_LABELS.cdb).toBe("CDB");
    expect(ASSET_CLASS_LABELS.outro).toBe("Outros");
  });
});

describe("ASSET_CLASS_COLORS", () => {
  it("has a color for each known class", () => {
    for (const k of Object.keys(ASSET_CLASS_LABELS)) {
      expect(ASSET_CLASS_COLORS[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("PROVENTO_REGEX", () => {
  it("matches common provento descriptions", () => {
    expect(PROVENTO_REGEX.test("Provento KNRI11")).toBe(true);
    expect(PROVENTO_REGEX.test("Dividendo ITSA4")).toBe(true);
    expect(PROVENTO_REGEX.test("Rendimento MXRF11")).toBe(true);
    expect(PROVENTO_REGEX.test("JCP Banco do Brasil")).toBe(true);
    expect(PROVENTO_REGEX.test("Juros sobre capital próprio")).toBe(true);
  });
  it("does not match unrelated descriptions", () => {
    expect(PROVENTO_REGEX.test("Compra de ações")).toBe(false);
    expect(PROVENTO_REGEX.test("Pagamento boleto")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/cars-web && npm run test:once -- invest-constants
```

Expected: FAIL — `Cannot find module '../invest-constants.js'`

- [ ] **Step 3: Implement invest-constants.js**

Create file `apps/cars-web/src/lib/invest-constants.js`:

```js
/**
 * Constantes compartilhadas do módulo Invest.
 *
 * Deduplica:
 * - CLASS_LABEL / CLASS_COR antes inline em InvestPainel, CarteiraSaude,
 *   AnaliseCarteira, Projecao e Proventos.
 * - PROV_RE antes inline em InvestPainel e Proventos.
 */

export const ASSET_CLASS_LABELS = {
  acao: "Ações BR",
  fii: "FIIs",
  stock: "Stocks US",
  reit: "REITs",
  etf: "ETFs",
  cripto: "Cripto",
  rf: "Renda Fixa",
  tesouro: "Tesouro",
  cdb: "CDB",
  outro: "Outros",
};

export const ASSET_CLASS_COLORS = {
  acao: "#f5a524",
  fii: "#10b981",
  stock: "#3b82f6",
  reit: "#0ea5e9",
  cripto: "#8b5cf6",
  etf: "#fbbf24",
  rf: "#22c55e",
  tesouro: "#22c55e",
  cdb: "#14b8a6",
  outro: "#9ca3af",
};

export const PROVENTO_REGEX = /provent|dividend|rendiment|juros|jcp/i;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/cars-web && npm run test:once -- invest-constants
```

Expected: PASS (3 describe blocks)

- [ ] **Step 5: Commit**

```bash
git add apps/cars-web/src/lib/invest-constants.js apps/cars-web/src/lib/__tests__/invest-constants.test.js
git commit -m "feat(invest): extract ASSET_CLASS_LABELS/COLORS + PROVENTO_REGEX

Deduplica constantes que estavam inline em 5 telas (InvestPainel,
CarteiraSaude, AnaliseCarteira, Projecao, Proventos).

PR 0 do refactor 'Monte sua Carteira'.

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 3: calcAlocacaoPorClasse (TDD)

**Files:**
- Create: `apps/cars-web/src/lib/invest-utils.js`
- Test: `apps/cars-web/src/lib/__tests__/invest-utils.test.js`

- [ ] **Step 1: Write the failing test**

Create file `apps/cars-web/src/lib/__tests__/invest-utils.test.js`:

```js
import { describe, it, expect } from "vitest";
import { calcAlocacaoPorClasse } from "../invest-utils.js";

describe("calcAlocacaoPorClasse", () => {
  it("returns empty array when no assets", () => {
    expect(calcAlocacaoPorClasse([])).toEqual([]);
  });

  it("groups by tipo, sums valor, computes pct", () => {
    const ativos = [
      { tipo: "fii",  qtd: 100, preco: 10 },   // 1000
      { tipo: "fii",  qtd: 50,  preco: 20 },   // 1000
      { tipo: "acao", qtd: 100, preco: 30 },   // 3000
    ];
    const r = calcAlocacaoPorClasse(ativos);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ tipo: "acao", valor: 3000, pct: 60 });
    expect(r[1]).toMatchObject({ tipo: "fii",  valor: 2000, pct: 40 });
  });

  it("ignores assets with qtd or preco missing/zero/negative", () => {
    const r = calcAlocacaoPorClasse([
      { tipo: "fii", qtd: 100, preco: 10 },
      { tipo: "fii", qtd: 0,   preco: 10 },
      { tipo: "fii", qtd: 10,  preco: null },
      { tipo: "fii", qtd: -5,  preco: 10 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].valor).toBe(1000);
  });

  it("falls back to 'outro' for missing tipo", () => {
    const r = calcAlocacaoPorClasse([{ qtd: 1, preco: 100 }]);
    expect(r[0].tipo).toBe("outro");
    expect(r[0].label).toBe("Outros");
  });

  it("attaches label and cor from constants", () => {
    const r = calcAlocacaoPorClasse([{ tipo: "fii", qtd: 1, preco: 100 }]);
    expect(r[0].label).toBe("FIIs");
    expect(r[0].cor).toBe("#10b981");
  });

  it("sorted by valor desc", () => {
    const r = calcAlocacaoPorClasse([
      { tipo: "fii", qtd: 1, preco: 100 },
      { tipo: "acao", qtd: 1, preco: 300 },
      { tipo: "tesouro", qtd: 1, preco: 200 },
    ]);
    expect(r.map(x => x.tipo)).toEqual(["acao", "tesouro", "fii"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/cars-web && npm run test:once -- invest-utils
```

Expected: FAIL — `Cannot find module '../invest-utils.js'`

- [ ] **Step 3: Implement calcAlocacaoPorClasse**

Create file `apps/cars-web/src/lib/invest-utils.js`:

```js
/**
 * Utils do módulo Invest. Tudo aqui é função pura — sem dependências
 * de React. Compartilhado entre InvestPainel, CarteiraSaude,
 * AnaliseCarteira, Projecao, Proventos e a futura tela Monte sua Carteira.
 */
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "./invest-constants.js";

/**
 * Agrupa ativos por classe (tipo), somando o valor (qtd × preço) e
 * calculando o % do total. Retorna array ordenado por valor desc.
 *
 * @param {Array} ativos
 * @returns {Array<{ tipo, label, valor, pct, cor }>}
 */
export function calcAlocacaoPorClasse(ativos) {
  const m = {};
  for (const a of ativos || []) {
    const qtd = Number(a.qtd || 0);
    const preco = Number(a.preco || 0);
    const v = qtd * preco;
    if (v <= 0) continue;
    const k = a.tipo || "outro";
    m[k] = (m[k] || 0) + v;
  }
  const tot = Object.values(m).reduce((s, v) => s + v, 0);
  if (tot === 0) return [];
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      tipo: k,
      label: ASSET_CLASS_LABELS[k] || k,
      valor: v,
      pct: (v / tot) * 100,
      cor: ASSET_CLASS_COLORS[k] || "#9ca3af",
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/cars-web && npm run test:once -- invest-utils
```

Expected: PASS (6 it blocks in calcAlocacaoPorClasse)

- [ ] **Step 5: Commit**

```bash
git add apps/cars-web/src/lib/invest-utils.js apps/cars-web/src/lib/__tests__/invest-utils.test.js
git commit -m "feat(invest): calcAlocacaoPorClasse util

Função pura que substitui useMemo idêntico em InvestPainel e
CarteiraSaude. Migração dos callsites em tasks subsequentes.

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 4: calcRentabilidadeAtivo (TDD)

**Files:**
- Modify: `apps/cars-web/src/lib/invest-utils.js`
- Modify: `apps/cars-web/src/lib/__tests__/invest-utils.test.js`

- [ ] **Step 1: Add failing test**

Append to `apps/cars-web/src/lib/__tests__/invest-utils.test.js`:

```js
import { calcRentabilidadeAtivo } from "../invest-utils.js";

describe("calcRentabilidadeAtivo", () => {
  it("returns zeros when qtd or preco missing", () => {
    expect(calcRentabilidadeAtivo({})).toMatchObject({ custo: 0, valor: 0, ganho: 0, pctGanho: 0 });
  });

  it("computes custo/valor/ganho/pctGanho", () => {
    const r = calcRentabilidadeAtivo({ qtd: 10, pm: 5, preco: 8 });
    expect(r.custo).toBe(50);
    expect(r.valor).toBe(80);
    expect(r.ganho).toBe(30);
    expect(r.pctGanho).toBe(60);
  });

  it("accepts precoMedio as alias for pm", () => {
    const r = calcRentabilidadeAtivo({ qtd: 10, precoMedio: 5, preco: 8 });
    expect(r.custo).toBe(50);
  });

  it("handles loss correctly", () => {
    const r = calcRentabilidadeAtivo({ qtd: 10, pm: 10, preco: 8 });
    expect(r.ganho).toBe(-20);
    expect(r.pctGanho).toBe(-20);
  });

  it("pctGanho is 0 when custo is 0", () => {
    expect(calcRentabilidadeAtivo({ qtd: 10, pm: 0, preco: 8 }).pctGanho).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/cars-web && npm run test:once -- invest-utils
```

Expected: FAIL — `calcRentabilidadeAtivo is not exported`

- [ ] **Step 3: Implement calcRentabilidadeAtivo**

Append to `apps/cars-web/src/lib/invest-utils.js`:

```js

/**
 * Calcula valor de mercado, custo, ganho e % de ganho de um ativo.
 * Aceita `pm` ou `precoMedio` como nome do preço médio.
 *
 * @param {{ qtd, preco, pm?, precoMedio? }} ativo
 * @returns {{ custo, valor, ganho, pctGanho }}
 */
export function calcRentabilidadeAtivo(ativo) {
  const qtd = Number(ativo?.qtd || 0);
  const pm = Number(ativo?.pm ?? ativo?.precoMedio ?? 0);
  const preco = Number(ativo?.preco || 0);
  const valor = qtd * preco;
  const custo = qtd * pm;
  const ganho = valor - custo;
  const pctGanho = custo > 0 ? (ganho / custo) * 100 : 0;
  return { custo, valor, ganho, pctGanho };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/cars-web && npm run test:once -- invest-utils
```

Expected: PASS (calcAlocacaoPorClasse 6 + calcRentabilidadeAtivo 5)

- [ ] **Step 5: Commit**

```bash
git add apps/cars-web/src/lib/invest-utils.js apps/cars-web/src/lib/__tests__/invest-utils.test.js
git commit -m "feat(invest): calcRentabilidadeAtivo util

Função pura pra valor/custo/ganho/% — substitui o mesmo padrão
inline em InvestPainel (topAtivos, variacoes).

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 5: calcCarteiraSaude (TDD)

**Files:**
- Modify: `apps/cars-web/src/lib/invest-utils.js`
- Modify: `apps/cars-web/src/lib/__tests__/invest-utils.test.js`

- [ ] **Step 1: Add failing test**

Append to `apps/cars-web/src/lib/__tests__/invest-utils.test.js`:

```js
import { calcCarteiraSaude } from "../invest-utils.js";

describe("calcCarteiraSaude", () => {
  it("returns score 0 + empty stats when no assets", () => {
    const r = calcCarteiraSaude([]);
    expect(r.score).toBe(0);
    expect(r.herfindahl).toBe(0);
    expect(r.totalAtivos).toBe(0);
    expect(r.noLucro).toBe(0);
    expect(r.pctLucro).toBe(0);
    expect(r.total).toBe(0);
  });

  it("calcula herfindahl, noLucro, pctLucro e score", () => {
    const ativos = [
      { tipo: "fii", qtd: 10, preco: 100, pm: 80 },  // valor 1000, no lucro
      { tipo: "fii", qtd: 10, preco: 100, pm: 90 },  // valor 1000, no lucro
      { tipo: "acao", qtd: 10, preco: 100, pm: 110 }, // valor 1000, no prejuízo
    ];
    const r = calcCarteiraSaude(ativos);
    expect(r.totalAtivos).toBe(3);
    expect(r.total).toBe(3000);
    expect(r.noLucro).toBe(2);
    expect(r.pctLucro).toBeCloseTo(66.67, 1);
    // 2 classes (fii=2000=66.7%, acao=1000=33.3%) → H = 0.667² + 0.333² = 0.555
    expect(r.herfindahl).toBeCloseTo(0.555, 2);
    expect(r.score).toBeGreaterThan(30);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("score is 100 cap", () => {
    const ativos = Array.from({ length: 20 }, (_, i) => ({
      tipo: ["fii", "acao", "stock", "reit", "tesouro"][i % 5],
      qtd: 10, preco: 100, pm: 80, // sempre no lucro
    }));
    const r = calcCarteiraSaude(ativos);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("ignores assets with no valor", () => {
    const r = calcCarteiraSaude([
      { tipo: "fii", qtd: 10, preco: 100, pm: 80 },
      { tipo: "acao", qtd: 0, preco: 100, pm: 80 },
    ]);
    expect(r.totalAtivos).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/cars-web && npm run test:once -- invest-utils
```

Expected: FAIL — `calcCarteiraSaude is not exported`

- [ ] **Step 3: Implement calcCarteiraSaude**

Append to `apps/cars-web/src/lib/invest-utils.js`:

```js

/**
 * Calcula score de saúde da carteira (0-100) com base em:
 * - Diversificação (Herfindahl Index, até 30 pts)
 * - % de ativos no lucro (até 25 pts)
 * - Quantidade de ativos (até 15 pts)
 * - Base de 30 pts
 *
 * @param {Array} ativos
 * @returns {{ score, herfindahl, totalAtivos, noLucro, pctLucro, total }}
 */
export function calcCarteiraSaude(ativos) {
  const validos = (ativos || []).filter(a => {
    const v = Number(a.qtd || 0) * Number(a.preco || 0);
    return v > 0;
  });
  if (validos.length === 0) {
    return { score: 0, herfindahl: 0, totalAtivos: 0, noLucro: 0, pctLucro: 0, total: 0 };
  }
  const total = validos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);

  // Alocação por classe (em fração, não %)
  const porClasse = {};
  for (const a of validos) {
    const k = a.tipo || "outro";
    const v = Number(a.qtd || 0) * Number(a.preco || 0);
    porClasse[k] = (porClasse[k] || 0) + v;
  }
  const fracoes = Object.values(porClasse).map(v => v / total);
  const herfindahl = fracoes.reduce((s, f) => s + f * f, 0);

  // % no lucro
  const noLucro = validos.filter(a => Number(a.preco || 0) > Number(a.pm || 0)).length;
  const pctLucro = (noLucro / validos.length) * 100;

  // Score
  const scoreDiversidade = Math.max(0, Math.min(30, 30 * (1 - (herfindahl - 0.10) / 0.30)));
  const scoreLucro = (pctLucro / 100) * 25;
  const scoreQtd = Math.min(15, validos.length * 1.5);
  const score = Math.min(100, Math.round(30 + scoreDiversidade + scoreLucro + scoreQtd));

  return {
    score,
    herfindahl,
    totalAtivos: validos.length,
    noLucro,
    pctLucro,
    total,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/cars-web && npm run test:once -- invest-utils
```

Expected: PASS (all 15 it blocks)

- [ ] **Step 5: Commit**

```bash
git add apps/cars-web/src/lib/invest-utils.js apps/cars-web/src/lib/__tests__/invest-utils.test.js
git commit -m "feat(invest): calcCarteiraSaude util

Score 0-100 com Herfindahl + % lucro + qtd ativos. Substitui
useMemo grande em CarteiraSaude.jsx (decisões de cor/label do
score ficam na tela; só a matemática vem pra cá).

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 6: KpiCard component

**Files:**
- Create: `apps/cars-web/src/components/ui/KpiCard.jsx`

Sem teste unitário — UI component validado por build.

- [ ] **Step 1: Implement KpiCard**

Create file `apps/cars-web/src/components/ui/KpiCard.jsx`:

```jsx
import React from "react";
import { T } from "../../lib/theme.js";

/**
 * KpiCard padrão. Substitui implementações inline em InvestPainel,
 * Projecao, AnaliseCarteira, CarteiraSaude e Proventos.
 *
 * Variantes:
 * - "standard" (default): card com border, padding 14, valor médio
 * - "cell": versão compacta com borderLeft colorido (estilo AnaliseCarteira)
 *
 * Props:
 * - label (string): rótulo curto, uppercase
 * - value (string|number): valor principal (formatado pelo caller)
 * - sub (string, opcional): subtítulo
 * - cor (string, opcional): cor de destaque (default T.gold)
 * - icon (lucide-react component, opcional): ícone do canto direito
 * - variation (number, opcional): % de variação, mostra ↗/↘ + valor
 * - negativeGood (bool, opcional): inverte cor de variação (despesas)
 * - variant ("standard" | "cell"): default "standard"
 */
export default function KpiCard({
  label, value, sub, cor, icon: Icon, variation, negativeGood,
  variant = "standard",
}) {
  const corFinal = cor || T.gold;
  const variationNum = typeof variation === "number" ? variation : null;
  const variationStr = variationNum != null
    ? (variationNum >= 0 ? "↗ +" : "↘ ") + variationNum.toFixed(2) + "%"
    : null;
  const positive = negativeGood
    ? (variationNum != null && variationNum <= 0)
    : (variationNum != null && variationNum >= 0);

  if (variant === "cell") {
    return (
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${corFinal}`, borderRadius: 8, padding: 12,
      }}>
        <div style={{
          fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
          color: T.muted, fontWeight: 600,
        }}>{label}</div>
        <div className="num" style={{
          fontFamily: T.serif, fontSize: 22, color: corFinal,
          fontWeight: 600, marginTop: 5, lineHeight: 1.1,
        }}>{value}</div>
      </div>
    );
  }

  // standard
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: 14, position: "relative", minHeight: 110,
    }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 20, fontWeight: 600,
        marginTop: 6, color: T.ink,
      }}>{value}</div>
      {variationStr && (
        <div style={{
          fontSize: 11,
          color: positive ? T.green : T.red, marginTop: 4,
        }}>{variationStr}</div>
      )}
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sub}</div>}
      {Icon && (
        <div style={{
          position: "absolute", top: 14, right: 14, width: 32, height: 32,
          borderRadius: "50%", background: `${corFinal}1f`,
          display: "grid", placeItems: "center",
        }}>
          <Icon size={16} style={{ color: corFinal }} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build still passes**

```bash
cd apps/cars-web && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cars-web/src/components/ui/KpiCard.jsx
git commit -m "feat(ui): KpiCard component (standard + cell variants)

Substitui 5 implementações inline. Migração dos callsites em
tasks subsequentes.

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 7: AlocacaoPieChart component

**Files:**
- Create: `apps/cars-web/src/components/ui/AlocacaoPieChart.jsx`

- [ ] **Step 1: Implement AlocacaoPieChart**

Create file `apps/cars-web/src/components/ui/AlocacaoPieChart.jsx`:

```jsx
import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";

/**
 * Pie chart de alocação. Substitui copies inline em InvestPainel e
 * CarteiraSaude.
 *
 * Props:
 * - data: array de { nome, valor, pct, cor }
 * - hidden (bool): mascara valores em R$
 * - innerRadius / outerRadius: customizáveis (default 32 / 56)
 * - height: altura do container (default 120)
 */
export default function AlocacaoPieChart({
  data, hidden,
  innerRadius = 32, outerRadius = 56, height = 120,
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="valor"
            nameKey="nome"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
          >
            {(data || []).map((p, i) => (
              <Cell key={i} fill={p.cor} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }}
            formatter={(v, _n, ctx) => [
              hidden ? "•••••" : fmt(v),
              `${ctx.payload.nome} (${ctx.payload.pct.toFixed(1)}%)`,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/cars-web && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 3: Commit**

```bash
git add apps/cars-web/src/components/ui/AlocacaoPieChart.jsx
git commit -m "feat(ui): AlocacaoPieChart component

Substitui PieChart duplicado em InvestPainel e CarteiraSaude.

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 8: Migrate InvestPainel.jsx

**Files:**
- Modify: `apps/cars-web/src/components/pages/Invest/InvestPainel.jsx`

- [ ] **Step 1: Read current state of InvestPainel.jsx**

```bash
head -80 apps/cars-web/src/components/pages/Invest/InvestPainel.jsx
```

Identify:
- Inline `CLASS_LABEL`, `CLASS_COR`, `PROV_RE` declarations (delete them)
- The `alocacao = useMemo(...)` block (replace with `calcAlocacaoPorClasse`)
- The `topAtivos = useMemo(...)` block (use `calcRentabilidadeAtivo` inside the map)

- [ ] **Step 2: Apply edits**

In `apps/cars-web/src/components/pages/Invest/InvestPainel.jsx`:

a) Add imports near the top, after existing `lucide-react` import:

```jsx
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS, PROVENTO_REGEX } from "../../../lib/invest-constants.js";
import { calcAlocacaoPorClasse, calcRentabilidadeAtivo } from "../../../lib/invest-utils.js";
import KpiCard from "../../ui/KpiCard.jsx";
import AlocacaoPieChart from "../../ui/AlocacaoPieChart.jsx";
```

b) Delete the inline `const CLASS_LABEL = {...}`, `const CLASS_COR = {...}`, `const PROV_RE = ...` declarations.

c) Replace the entire `alocacao = useMemo(...)` block with:

```jsx
const alocacao = useMemo(
  () => calcAlocacaoPorClasse(ativos).map(x => ({
    tipo: x.tipo, label: x.label, valor: x.valor, pct: x.pct, cor: x.cor,
  })),
  [ativos]
);
```

(Same shape as before — just delegated to the util.)

d) Inside `topAtivos = useMemo(...)`, replace the inline math with `calcRentabilidadeAtivo`:

```jsx
const topAtivos = useMemo(() => {
  return ativos
    .map(a => {
      const r = calcRentabilidadeAtivo(a);
      return { ativo: a, valor: r.valor, custo: r.custo, rentab: r.pctGanho };
    })
    .filter(x => x.valor > 0)
    .sort((a,b) => b.valor - a.valor)
    .slice(0, 5);
}, [ativos]);
```

e) Find references to `CLASS_LABEL[k]` and `CLASS_COR[k]` throughout the JSX and replace with `ASSET_CLASS_LABELS[k]` and `ASSET_CLASS_COLORS[k]`. Use grep to find them all:

```bash
grep -n "CLASS_LABEL\|CLASS_COR\|PROV_RE" apps/cars-web/src/components/pages/Invest/InvestPainel.jsx
```

Replace each match (verify there are no remaining references after).

f) Find local `function Kpi({...})` (or similar) definitions and the JSX usage. **Don't replace usage yet in this task** — that's high risk; verify build then do it incrementally OR keep local Kpi (since this is refactor PR, just removing the duplicated math is enough). If you find time, replace ONE JSX site as a smoke test:

Find the section that renders KPIs (search for "<Kpi label" or similar) and replace ONE call with `<KpiCard label=... value=... cor=... />` to verify visual parity. If it looks identical, do the rest; else revert and leave local Kpi for a later PR.

- [ ] **Step 3: Run build**

```bash
cd apps/cars-web && npm run build 2>&1 | tail -8
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 4: Visual smoke test**

```bash
cd apps/cars-web && npm run dev &
sleep 3
# Open http://localhost:5173 → Invest → Painel
# Verify: alocação por classe percentuais are visually identical to main branch
# Top 5 ativos values identical
# Kill server with Ctrl+C
```

- [ ] **Step 5: Commit**

```bash
git add apps/cars-web/src/components/pages/Invest/InvestPainel.jsx
git commit -m "refactor(invest): InvestPainel usa invest-constants + invest-utils

Substitui CLASS_LABEL/CLASS_COR/PROV_RE inline + useMemos de
alocação e rentabilidade pelos novos utils compartilhados.
Sem mudança visual.

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 9: Migrate CarteiraSaude.jsx

**Files:**
- Modify: `apps/cars-web/src/components/pages/Invest/CarteiraSaude.jsx`

- [ ] **Step 1: Apply edits**

In `apps/cars-web/src/components/pages/Invest/CarteiraSaude.jsx`:

a) Add imports:

```jsx
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "../../../lib/invest-constants.js";
import { calcCarteiraSaude } from "../../../lib/invest-utils.js";
import AlocacaoPieChart from "../../ui/AlocacaoPieChart.jsx";
```

b) Delete inline `CLASS_LABEL` / `CLASS_COR` constants (they're at the top of the file).

c) Find the big `stats = useMemo(() => {...})` block. Replace its computation of `score`, `herfindahl`, `noLucro`, `pctLucro`, `totalAtivos`, `total` with a call to `calcCarteiraSaude`. **Keep** the parts that compute `pieData`, `maiorPosicao`, `comQueda`, `insight`, `scoreLabel`, `scoreCor` — those have presentation logic.

Resulting shape (rough):

```jsx
const stats = useMemo(() => {
  const ativosValidos = (ativos || []).filter(a => {
    const v = Number(a.qtd || 0) * Number(a.preco || 0);
    return v > 0;
  });
  if (ativosValidos.length === 0) {
    return { score: 0, herfindahl: 0, totalAtivos: 0, noLucro: 0, pctLucro: 0, total: 0, pieData: [], maiorPosicao: { nome: "—", pct: 0 }, insight: null };
  }
  const base = calcCarteiraSaude(ativosValidos);

  // pieData (mantém a lógica de agrupamento por classe OU segmento)
  const porChave = {};
  ativosValidos.forEach(a => {
    const valor = Number(a.qtd || 0) * Number(a.preco || 0);
    const k = agruparPor === "classe"
      ? (a.tipo || "outro")
      : ((a.segmento && String(a.segmento).trim()) || "Sem segmento");
    porChave[k] = (porChave[k] || 0) + valor;
  });
  const pieData = Object.entries(porChave)
    .map(([k, v]) => ({
      nome: agruparPor === "classe" ? (ASSET_CLASS_LABELS[k] || k) : k,
      valor: v,
      pct: (v / base.total) * 100,
      cor: agruparPor === "classe" ? (ASSET_CLASS_COLORS[k] || "#9ca3af") : "#9ca3af",
    }))
    .sort((a, b) => b.valor - a.valor);

  const maiorPosicao = pieData[0] || { nome: "—", pct: 0 };

  // Insights (mantém lógica original)
  const comQueda = ativosValidos
    .filter(a => Number.isFinite(Number(a.variacao24h)) && Number(a.variacao24h) < -5)
    .sort((a, b) => Number(a.variacao24h) - Number(b.variacao24h));

  let insight = null;
  if (comQueda.length > 0) {
    const top = comQueda.slice(0, 3);
    insight = {
      tipo: "queda",
      titulo: `${comQueda.length} ativo(s) caindo > 5% hoje`,
      detalhe: top.map(a => `${a.ticker} ${Number(a.variacao24h).toFixed(1)}%`).join(" · "),
      cor: T.red,
    };
  } else if (base.herfindahl > 0.30) {
    insight = {
      tipo: "concentracao",
      titulo: `Carteira concentrada`,
      detalhe: `${maiorPosicao.nome} representa ${maiorPosicao.pct.toFixed(1)}% do patrimônio. Considere diversificar.`,
      cor: T.gold,
    };
  }

  return { ...base, pieData, maiorPosicao, insight };
}, [ativos, agruparPor]);
```

d) Replace the inline `<PieChart>` block (around line 200) with:

```jsx
<AlocacaoPieChart data={stats.pieData} hidden={hidden} innerRadius={32} outerRadius={56} height={120} />
```

e) Find any remaining `CLASS_LABEL[k]` / `CLASS_COR[k]` refs → `ASSET_CLASS_LABELS[k]` / `ASSET_CLASS_COLORS[k]`:

```bash
grep -n "CLASS_LABEL\|CLASS_COR" apps/cars-web/src/components/pages/Invest/CarteiraSaude.jsx
```

- [ ] **Step 2: Build**

```bash
cd apps/cars-web && npm run build 2>&1 | tail -5
```

Expected: success.

- [ ] **Step 3: Run util tests (regression check)**

```bash
cd apps/cars-web && npm run test:once -- invest
```

Expected: PASS — all invest-* tests still green.

- [ ] **Step 4: Commit**

```bash
git add apps/cars-web/src/components/pages/Invest/CarteiraSaude.jsx
git commit -m "refactor(invest): CarteiraSaude usa calcCarteiraSaude + AlocacaoPieChart

Score/Herfindahl/lucro pra util compartilhada. Pie chart vira
componente reusável. Lógica de pieData (classe vs segmento),
maiorPosicao, comQueda e insights ficam na tela.

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 10: Migrate AnaliseCarteira.jsx + Projecao.jsx + Proventos.jsx

**Files:**
- Modify: `apps/cars-web/src/components/pages/Invest/AnaliseCarteira.jsx`
- Modify: `apps/cars-web/src/components/pages/Invest/Projecao.jsx`
- Modify: `apps/cars-web/src/components/pages/Invest/Proventos.jsx`

Para cada arquivo, o objetivo é: deletar inline `CLASS_LABEL` / `CLASS_COR` / `PROV_RE` e importar de `invest-constants.js`.

- [ ] **Step 1: AnaliseCarteira**

```bash
grep -n "CLASS_LABEL\|CLASS_COR" apps/cars-web/src/components/pages/Invest/AnaliseCarteira.jsx
```

a) Add import at top (next to other imports):

```jsx
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "../../../lib/invest-constants.js";
```

b) Delete inline `const CLASS_LABEL = {...}` and `const CLASS_COR = {...}`.

c) Replace `CLASS_LABEL[...]` → `ASSET_CLASS_LABELS[...]` and `CLASS_COR[...]` → `ASSET_CLASS_COLORS[...]` throughout the file.

- [ ] **Step 2: Projecao**

```bash
grep -n "CLASS_LABEL\|CLASS_COR\|PROV_RE" apps/cars-web/src/components/pages/Invest/Projecao.jsx
```

Apply same pattern: add import, delete inline, replace references.

- [ ] **Step 3: Proventos**

```bash
grep -n "CLASS_LABEL\|CLASS_COR\|PROV_RE" apps/cars-web/src/components/pages/Invest/Proventos.jsx
```

Apply same pattern. **Especially**: replace inline provento regex with `PROVENTO_REGEX` from `invest-constants.js`.

- [ ] **Step 4: Full build + test**

```bash
cd apps/cars-web && npm run test:once && npm run build 2>&1 | tail -10
```

Expected: tests PASS, build success.

- [ ] **Step 5: Visual smoke test**

```bash
cd apps/cars-web && npm run dev &
sleep 3
# Open browser:
# - Invest → Análises → Análise da Carteira (filter cards still color-coded by class)
# - Invest → Projeção (allocation labels still show correctly)
# - Invest → Proventos (provento detection still works on transactions)
# Kill dev server
```

- [ ] **Step 6: Commit**

```bash
git add apps/cars-web/src/components/pages/Invest/AnaliseCarteira.jsx apps/cars-web/src/components/pages/Invest/Projecao.jsx apps/cars-web/src/components/pages/Invest/Proventos.jsx
git commit -m "refactor(invest): 3 telas usam invest-constants

AnaliseCarteira, Projecao e Proventos agora importam
ASSET_CLASS_LABELS/COLORS e PROVENTO_REGEX em vez de copiar inline.

https://claude.ai/code/session_019d87K3S2WMoLc5ojzQCWq5"
```

---

## Task 11: Final verification + PR

- [ ] **Step 1: Run all tests one more time**

```bash
cd apps/cars-web && npm run test:once 2>&1 | tail -10
```

Expected: all PASS, including pre-existing format/validation/importExport tests.

- [ ] **Step 2: Final build**

```bash
cd apps/cars-web && npm run build 2>&1 | tail -8
```

Expected: success.

- [ ] **Step 3: Verify no stale duplications**

```bash
grep -rn "const CLASS_LABEL\|const CLASS_COR\|const PROV_RE\s*=" apps/cars-web/src/components/pages/Invest/
```

Expected: no matches (or only in CarteiraModelo.jsx, which is the next PR's target).

- [ ] **Step 4: Push branch**

```bash
git push -u origin claude/monte-carteira-pr0-utils
```

Expected: `[new branch]` line in output. If network failure, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

- [ ] **Step 5: Create draft PR**

Use `mcp__github__create_pull_request` with:
- owner: `pafonso-dotcom`
- repo: `AF4-cockpit`
- base: `main`
- head: `claude/monte-carteira-pr0-utils`
- title: `refactor(invest): PR 0 — utils + componentes compartilhados`
- draft: `true`
- body: include test plan checklist (run tests, smoke test 5 telas migradas) and reference to the design spec at `docs/superpowers/specs/2026-05-26-monte-sua-carteira-design.md`.

---

## Self-Review Checklist (do this AFTER finishing all tasks)

- [ ] All inline `CLASS_LABEL` / `CLASS_COR` / `PROV_RE` declarations removed from Invest screens (except CarteiraModelo — that's PR 1's job)
- [ ] All callsites use the new constants / utils / components
- [ ] vitest green
- [ ] Vite build green
- [ ] Visual smoke test green on InvestPainel, CarteiraSaude, AnaliseCarteira, Projecao, Proventos
- [ ] No regressions in existing tests (format, validation, importExport)
