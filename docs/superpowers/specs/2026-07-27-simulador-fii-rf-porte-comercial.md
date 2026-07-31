# Nota de porte — Simulador FIIs × Renda Fixa (pessoal → comercial)

**Data:** 2026-07-27
**Status:** feito no PESSOAL (`apps/cars-web`). Porte pro comercial (`numvi-financas`)
**pendente** — decisão do usuário: "faz uma nota dessa atualização que depois
levamos pra lá, vamos testar primeiro".

## O que foi construído (no pessoal)

Aba **Simuladores** no módulo Investimentos, reunindo dois simuladores
complementares num hub em acordeão:

1. **FIIs × Renda Fixa · aporte mensal** (NOVO) — fase de *acumular*: aporte
   mensal por N meses, compara o patrimônio formado em FIIs vs Renda Fixa por
   rentabilidade anual, a renda mensal (dividendos / rendimento) no fim do
   prazo e o efeito da inflação (valores "em R$ de hoje"). O gráfico mostra o
   patrimônio (linhas cheias, eixo esq.) e a **renda mensal durante a
   acumulação** (linhas tracejadas, eixo dir.).
2. **Calculadora de Renda · capital pronto** — fase de *viver da renda*: parte
   de um capital já formado e mostra quanto rende por mês. Movida pra este hub,
   saiu do hub "Renda & Dividendos".

## Arquivos (pessoal) — referência pro porte

- `apps/cars-web/src/lib/simuladorFiiRf.js` — motor puro (juros compostos com
  aporte mensal, comparação FII×RF, renda e correção pela inflação). A série
  devolve, por marco: `{ mes, fii, rf, rendaFii, rendaRf }`.
- `apps/cars-web/src/lib/__tests__/simuladorFiiRf.test.js` — 7 testes.
- `apps/cars-web/src/components/pages/Invest/SimuladorFiiRf.jsx` — a tela.
- `apps/cars-web/src/components/pages/Invest/Simuladores.jsx` — hub em acordeão
  (FIIs × RF + Calculadora de Renda).
- Fiação: `App.jsx` (lazy import + render em `tab === "simulador" || "calc-renda"`),
  `components/Header.jsx` (item `{ id: "simulador", label: "Simuladores" }` em
  SUBTABS.invest horizontal + vertical), `lib/navItems.js`.
- `RendaDividendos.jsx` perdeu a seção "Calculadora de Renda" (foi pro hub).

PRs pessoais: **#618** (aba Simuladores) e **#619** (linha de renda mensal).

## Estado do comercial (`numvi-financas`) — o obstáculo

O módulo Investimentos do comercial está **esboçado**: o menu tem os itens
(`Header.jsx` SUBTABS.invest: investimentos, carteira, objetivos,
monte-carteira, calc-renda, projecao, analises, proventos, mercado,
relatorios-i), mas o `App.jsx` do comercial **não liga nenhuma dessas telas** —
não há bloco `tab === "investimentos"`, `"calc-renda"`, etc. A pasta
`components/pages/Invest/` só tem `EvolucaoPatrimonio.jsx`. Não existe
`CalculadoraRenda` nem `lib/simulador*` no comercial.

## Checklist pro porte (quando for a hora)

1. Copiar `lib/simuladorFiiRf.js` + teste pra `numvi-financas/src/lib/`
   (o motor é puro, sem dependência de React/tema — porte limpo).
2. Copiar `Invest/SimuladorFiiRf.jsx`. Conferir imports do tema `T`
   (`lib/theme.js`) e `PageHeader` — caminhos/tokens podem diferir no comercial.
3. Decidir o container: hub `Simuladores.jsx` (precisa também de uma
   `CalculadoraRenda`, que o comercial NÃO tem) **ou** só a aba FIIs × RF
   sozinha (mais simples, não depende do resto).
4. Ligar a aba no `App.jsx` do comercial (falta o bloco de render dos tabs
   invest — pode ser preciso criar o render, não só o item de menu).
5. Item de menu já existe pra `calc-renda`; adicionar `simulador` se for aba
   própria. Atualizar `navItems`/atalhos do comercial se houver.
6. `pnpm --filter numvi-financas build` + testes antes de mergear.

> Regra do repo: apps independentes; este porte só acontece por pedido
> explícito. Esta nota é o registro pra retomar sem re-investigar.

