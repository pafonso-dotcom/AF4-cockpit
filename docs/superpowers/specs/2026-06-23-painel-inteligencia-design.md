# Painel de Inteligência (Finanças + Investimentos) — design

- **Data:** 2026-06-23
- **App:** pessoal (`apps/cars-web`) — worker `af4cockpit`
- **Branch:** `claude/numvi-pessoal-changes-YHaEK`

## Objetivo

Criar uma tela **"Inteligência"** no app pessoal que reúne, num só lugar, a
inteligência que o app **já calcula mas hoje quase não exibe**: score
financeiro comportamental, insights automáticos, assinaturas recorrentes e
projeção de caixa (Finanças), mais um bloco resumido de **saúde da carteira**
(Investimentos). Tudo **client-side, sem rede e sem custo**. Deixa um **gancho
para análise com IA (Claude)** pronto, porém desativado (fase 2).

## Contexto / motivação

- `apps/cars-web/src/lib/intelligence.js` já expõe (puro, sem API):
  `calcularScore`, `gerarInsights`, `detectarAssinaturas`, `projetarCashflow`.
- O `Dashboard.jsx` chama `gerarInsights` e até define um `InsightsCard`, mas
  **não renderiza** o resultado — a inteligência fica subutilizada.
- Investimentos já tem `lib/invest-utils.js#calcCarteiraSaude` e o componente
  `components/pages/Invest/CarteiraSaude.jsx` (score 0-100 de diversificação +
  % no lucro + nº de ativos, alocação e insight de concentração).
- O caminho de IA já existe (`lib/aiChat.js#perguntarAoClaude`,
  `apiKeys.anthropic`), mas **não** será ativado nesta versão.

## Escopo

**Inclui (v1):**
- Tela nova "Inteligência" no menu de **Finanças**.
- Bloco **Finanças**: Score, Insights, Assinaturas, Projeção de caixa
  (respeitando o filtro de escopo Pessoal/Negócio, como o Dashboard).
- Bloco **Investimentos**: saúde da carteira (reaproveitando o que existe).
- **Gancho de IA**: botão "Analisar com IA" visível e **desativado** ("em breve").

**Fora de escopo (v1):**
- Chamada real ao Claude (fica como fase 2, mas com o ponto de integração pronto).
- Bloco de Negócio.
- Novas regras/algoritmos de inteligência (usa-se o que já existe; regras novas
  só se uma lacuna aparecer durante a implementação).

## Arquitetura

Página + subcomponentes focados (cada um com uma responsabilidade clara):

```
components/pages/Inteligencia.jsx            (orquestra; calcula via libs; layout)
components/pages/Inteligencia/
  ScoreCard.jsx           (score financeiro + fatores)         ← calcularScore
  InsightsList.jsx        (lista de insights acionáveis)        ← gerarInsights
  AssinaturasCard.jsx     (recorrências + total mês/ano)        ← detectarAssinaturas
  CashflowCard.jsx        (projeção 3 meses + mini-gráfico)     ← projetarCashflow
  CarteiraSaudeResumo.jsx (saúde da carteira, compacto)         ← calcCarteiraSaude
  IAAnaliseCard.jsx       (gancho de IA, desativado)
```

- A página recebe os dados do `App.jsx` como props (mesmo padrão das outras
  páginas): `transacoes, contas, ativos, cartoes, parcelamentos, metas,
  escopoAtivo, apiKeys, hidden, onTabChange`.
- **Finanças**: antes de chamar as funções de `intelligence.js`, filtra por
  escopo com `filtrarPorEscopo` (igual ao `Dashboard.jsx`).
- **Investimentos**: usa `ativos` (carteira global), como nas telas de Invest.
- Subcomponentes são "burros": recebem dados já calculados e só renderizam.

### Navegação / integração

- Novo item no menu de Finanças do `Header.jsx`:
  `{ id: "inteligencia", label: "Inteligência", icon: Sparkles }`
  (posicionado após "Centro de controle").
- Nova rota no `App.jsx` que renderiza `<Inteligencia .../>` quando
  `tab === "inteligencia"`.
- O `InsightsCard` morto do `Dashboard.jsx` é religado: seu "Ver todos" passa a
  navegar para a aba `inteligencia` (`onTabChange("inteligencia")`).

## Seções (detalhe e ordem)

**▸ Grupo Finanças**

1. **Score financeiro** — número grande (0-1000) + faixa textual (`nivel`:
   Crítico/Atenção/Regular/Bom/Excelente, com `cor`) e os fatores do `breakdown`
   (`{label, pts, max}`: fluxo de caixa, controle de cartão, diversificação,
   capacidade de investimento, reserva, disciplina) — o que puxa pra cima/baixo.
   Saída de `calcularScore`. Vazio: "registre mais transações para calcular seu
   score".
2. **Insights acionáveis** — lista completa de `gerarInsights` (cada item:
   `{tipo: "alerta"|"atencao"|"positivo", titulo, prioridade, ...}`), com
   severidade derivada de `tipo`/`prioridade` (cor/ícone). Quando o `tipo`/tema
   mapear para uma tela, mostra um botão "ir para" (best-effort, por
   palavra-chave; ex.: assinaturas → seção de Assinaturas; recebíveis → A Receber
   via `onTabChange`). Vazio: "nenhum insight no momento — tudo sob controle".
3. **Assinaturas detectadas** — itens recorrentes com valor médio, frequência e
   **total mensal e anual** estimado ("você compromete R$X/mês em assinaturas").
   Vazio: "nenhuma assinatura recorrente detectada".
4. **Projeção de caixa** — próximos 3 meses (entradas, saídas, saldo projetado)
   + mini-gráfico (recharts, já usado no app). Vazio: "sem histórico suficiente
   para projetar".

**▸ Grupo Investimentos**

5. **Saúde da carteira** — score 0-100 + alocação + insight de concentração,
   reaproveitando `calcCarteiraSaude` (e/ou o componente `CarteiraSaude`) num
   formato compacto. Vazio: "sem ativos na carteira".

**▸ IA (gancho)**

6. **Analisar com IA (Claude)** — card com botão **desativado** e selo
   "em breve". Handler `onAnalisarIA` é um stub (no-op/toast informativo). O
   componente já recebe `apiKeys` e o contexto necessário, de modo que a fase 2
   só precise trocar o stub por `perguntarAoClaude(buildContext(...))`.

## Fluxo de dados

```
App.jsx (estado) ──props──> Inteligencia.jsx
   Inteligencia.jsx:
     stFin = filtrarPorEscopo({transacoes,contas,...}, escopoAtivo)
     score      = calcularScore(stFin...)        -> ScoreCard
     insights   = gerarInsights(stFin...)         -> InsightsList
     assinaturas= detectarAssinaturas(stFin.tx)   -> AssinaturasCard
     cashflow   = projetarCashflow(stFin..., 3)   -> CashflowCard
     saude      = calcCarteiraSaude(ativos)        -> CarteiraSaudeResumo
   (cada cálculo em useMemo + try/catch)
```

## Tratamento de erro / bordas

- Cada cálculo isolado em `try/catch`; falha → o card específico mostra estado
  vazio, a página nunca quebra.
- Estados vazios amigáveis por card (mensagens acima).
- `hidden` (modo "esconder valores") respeitado em todos os números, como no
  resto do app.

## Verificação (como vamos provar que funciona)

- `pnpm --filter @repo/cars-web build` sem erros.
- Dirigir a aba no app (vite dev + navegador headless, como na verificação do
  empréstimo): semear transações + ativos e conferir que **cada card renderiza**
  com os números corretos, que os estados vazios aparecem sem dados, e que o
  **card de IA aparece desativado** ("em breve").

## Decisões

- **Reuso, não reescrita:** v1 não cria algoritmo novo; expõe o que já existe.
- **IA como gancho:** ponto de integração pronto, sem custo/latência na v1.
- **Independência de apps:** mudança só no app pessoal (`apps/cars-web`);
  não espelhar no comercial (regra do `CLAUDE.md`).
