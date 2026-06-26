# Contas como cards de pasta · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps usam checkbox (`- [ ]`).

**Goal:** Substituir as linhas da seção "Minhas contas" (Contas.jsx, pessoal) por uma grade de cards em forma de pasta (roxo uniforme, ícone na cor da conta), preservando clique e ações.

**Architecture:** Trocar a função `renderConta` (linha) por `renderPasta` (card de pasta) e o container do map por uma grade CSS. Reusa handlers existentes (`onContaClick`, `moverConta`, `toggleExpanded`/`expandedConta`, `appUrl`, `iniciais`, `ehBRL`, `saldoContaBRL`, `bandeira`, selos).

**Tech Stack:** React, estilos inline com tokens `T`, lucide-react, vite. Verificação: build + screenshot headless.

## Global Constraints

- App pessoal apenas (`apps/cars-web`). NÃO tocar no comercial.
- Só apresentação — não mexer em saldo/escopo/ordenação.
- Roxo uniforme no corpo; cor da conta só no ícone.
- Verificação runtime exige patch TEMPORÁRIO `supabaseConfigured = false` (reverter antes do commit).
- Build: `pnpm --filter @repo/cars-web build`.

---

### Task 1: Card de pasta (renderPasta) + grade

**Files:**
- Modify: `apps/cars-web/src/components/pages/Contas.jsx` (bloco `renderConta`/lista dentro de `SecaoColapsavel idKey="contas-lista"`).

**Interfaces:**
- Consumes: `onContaClick(c)`, `moverConta(c, dir)`, `toggleExpanded(c.id)`, `expandedConta` (Set), `contaAtiva`, `contasVisiveis`, `iniciais(nome)`, `ehBRL(c)`, `saldoContaBRL(c)`, `ehNegocio(c)`, `bandeira(m)`, `fmt`, `T`, `hidden`.

- [ ] **Step 1:** Definir tokens de cor da pasta no topo do IIFE da lista (junto de `iniciais`/`bandeira`):
```js
const PASTA_BG = "linear-gradient(155deg, #3a2d63 0%, #271f4a 100%)";
const PASTA_TAB = "#5a4a93";
const PASTA_INK = "#f3f0fb";
const PASTA_MUTED = "rgba(243,240,251,.62)";
```

- [ ] **Step 2:** Escrever `renderPasta(c)` substituindo `renderConta`. Card com aba (papéis atrás), ícone na cor da conta, nome, saldo, selo, "⋯" que expande ações:
```jsx
const renderPasta = (c) => {
  const ativa = contaAtiva?.id === c.id;
  const exp = expandedConta.has(c.id);
  const neg = ehNegocio(c), fora = !!c.foraPatrimonio;
  const selo = neg && fora ? "Negócio · fora" : neg ? "Negócio" : fora ? "Fora" : null;
  return (
    <div key={c.id} style={{ position: "relative", paddingTop: 10 }}>
      {/* aba/papéis espiando atrás do topo */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: "34%", right: "10%", height: 16, borderRadius: "10px 10px 0 0", background: PASTA_TAB, opacity: .9, zIndex: 0 }} />
      <div aria-hidden style={{ position: "absolute", top: 3, left: "20%", right: "22%", height: 14, borderRadius: "10px 10px 0 0", background: PASTA_TAB, opacity: .5, zIndex: 0 }} />
      {/* corpo da pasta */}
      <div onClick={() => onContaClick && onContaClick(c)}
           role={onContaClick ? "button" : undefined} tabIndex={onContaClick ? 0 : undefined}
           onKeyDown={(e) => { if (onContaClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onContaClick(c); } }}
           style={{ position: "relative", zIndex: 1, background: PASTA_BG, color: PASTA_INK,
                    border: ativa ? `1px solid ${T.gold}` : "1px solid rgba(255,255,255,.08)",
                    borderRadius: 18, padding: 14, minHeight: 128, cursor: onContaClick ? "pointer" : "default",
                    display: "flex", flexDirection: "column", boxShadow: "0 8px 22px rgba(20,12,40,.22)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: c.cor || T.gold, color: "#fff",
                        display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>{iniciais(c.nome)}</div>
          <button onClick={(e) => { e.stopPropagation(); toggleExpanded(c.id); }} aria-label={exp ? "Recolher" : "Mais ações"}
                  style={{ background: "rgba(255,255,255,.1)", border: "none", color: PASTA_INK, borderRadius: 8,
                           width: 26, height: 26, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <MoreHorizontal size={15} />
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
        <div className="num" style={{ fontFamily: T.serif, fontSize: 16, marginTop: 2, color: c.saldo < 0 ? "#ff9d9d" : PASTA_INK, whiteSpace: "nowrap" }}>
          {!ehBRL(c) && <span style={{ fontSize: 12, marginRight: 3 }}>{bandeira(c.moeda)}</span>}
          {hidden ? "•••" : fmt(c.saldo, c.moeda || "BRL")}
        </div>
        {(selo || (!ehBRL(c))) && (
          <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
            {selo && <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 100, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", background: "rgba(255,255,255,.14)", color: PASTA_INK }}>{selo}</span>}
            {!ehBRL(c) && <span style={{ fontSize: 9, color: PASTA_MUTED }}>{Number(c.cotacao) > 0 ? `≈ ${hidden ? "•••" : fmt(saldoContaBRL(c))}` : "sem cotação"}</span>}
          </div>
        )}
        {exp && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,.18)" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => moverConta(c, -1)} title="Mover para cima" style={pastaAcaoBtn}><ChevronUp size={13} /></button>
            <button onClick={() => moverConta(c, 1)} title="Mover para baixo" style={pastaAcaoBtn}><ChevronDown size={13} /></button>
            {c.appUrl && <button onClick={() => window.open(c.appUrl, "_blank", "noopener")} title="Abrir app do banco" style={{ ...pastaAcaoBtn, flex: 1, color: T.gold }}>App ↗</button>}
          </div>
        )}
      </div>
    </div>
  );
};
const pastaAcaoBtn = { background: "rgba(255,255,255,.1)", border: "none", color: PASTA_INK, borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10, fontWeight: 600 };
```

- [ ] **Step 3:** Trocar o container da lista (onde `contasVisiveis.map(renderConta)` é usado) por grade chamando `renderPasta`:
```jsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
  {contasVisiveis.map(renderPasta)}
</div>
```
(Conferir o nome exato do wrapper/map atual e substituir; remover `renderConta` antigo.)

- [ ] **Step 4:** Garantir imports lucide: `MoreHorizontal, ChevronUp, ChevronDown` já usados no arquivo (conferir; `ChevronRight` pode ficar sem uso — remover se sobrar).

- [ ] **Step 5:** Build `pnpm --filter @repo/cars-web build` → sucesso.

- [ ] **Step 6:** Runtime (patch supabase=false; seed contas com cores diferentes + 1 Negócio + 1 USD sem cotação): grade de pastas roxas, ícone colorido, nome+saldo, selo, "⋯" revela ações; clique abre a conta.

- [ ] **Step 7:** Reverter patch supabase; build limpo; `git diff --stat` só em Contas.jsx; commit `feat(pessoal): Contas como cards de pasta`.

---

### Task 2: PR

- [ ] Push `--force-with-lease`; PR draft; merge squash.

## Self-Review

- **Cobertura:** folder card + grade + ícone cor da conta + saldo + selo + ações "⋯" + clique → Task 1. OK.
- **Placeholders:** Steps 3/4 pedem "conferir nome exato do wrapper" e imports — ação explícita, não placeholder (o código do card está completo).
- **Consistência:** `renderPasta`, `pastaAcaoBtn`, tokens `PASTA_*` usados de forma consistente.
