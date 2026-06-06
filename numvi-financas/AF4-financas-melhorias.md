# AF4 finanças — Análise de melhorias para o comercial

> Diagnóstico do estado atual + plano priorizado para transformar o app num
> produto comercial. Baseado em varredura do código (telas de Finanças, Agenda,
> Planejamento e design system). Foco: **alto impacto / baixo esforço primeiro**.

---

## Diagnóstico em uma frase

O produto tem **excelente cobertura de funcionalidades** (contas, cartões,
parcelas, fixas, dívidas, planejamento, relatórios, IA, agenda). O que falta pra
"parecer e vender como produto" são **duas camadas**:
1. **Inteligência** — insights, comparativos, alertas e recomendações (hoje
   mostra dados, mas não interpreta).
2. **Acabamento visual consistente** — cada tela reinventa cards/botões/estados
   vazios; falta um design system aplicado.

Tudo o resto (features) já existe e é diferencial. Não precisa reescrever nada —
precisa **lapidar e dar contexto**.

---

# PARTE 1 — Melhorias de INFORMAÇÃO / valor (o que vende)

Ordenado por **ROI pro comercial** (impacto ÷ esforço).

### 🟢 Quick wins (alto impacto, baixo esforço — fazer primeiro)

1. **Comparativo "vs mês anterior" em todo lugar.**
   KPIs e categorias mostrando ▲/▼ % vs mês passado ("Alimentação subiu 15% =
   +R$ 250"). Já temos os dados; é só calcular e exibir.
2. **Alertas de orçamento em tempo real.**
   "Você já usou 80% de Alimentação e faltam 8 dias." Estende a barra de
   orçamento que já criamos. Nudge comportamental forte.
3. **Sugestão de limite por categoria.**
   "Seus últimos 3 meses: média R$ 550 — sugerimos limite de R$ 600." Tira a
   fricção de configurar orçamento (hoje a barra só aparece com limite manual).
4. **"Maiores gastos da semana/mês" no Dashboard.**
   Card com as 5 maiores saídas — responde "pra onde foi meu dinheiro?".
5. **Índice de Saúde Financeira (0–100).**
   Um número simples (sobra, % comprometido, reserva, dívidas) com selo
   Crítico/Atenção/Saudável. Vira "a cara" do app e é muito vendável.

### 🟡 Médio prazo (alto valor, esforço médio)

6. **Cenários "E se…".** Slider "se eu economizar R$ X/mês" → impacto na
   reserva/patrimônio. Estende a projeção que já existe. Pessoas adoram.
7. **Anomalias automáticas.** "Gasto atípico: R$ 500 em mercado (3× a média)."
8. **Detecção de recorrência.** Sugerir virar "fixa" transações que se repetem.
9. **Reconciliação inteligente na importação de fatura.** Detectar duplicatas e
   transações já lançadas (hoje a IA extrai, mas não cruza com o existente).
10. **Relatório PDF profissional + agendado por e-mail.** Compliance/consultor —
    PMEs pagam por isso.

### 🔴 Estratégico (alto esforço — roadmap, não beta)

11. **Open Finance / importação OFX automática.** "Sync com o banco" é
    expectativa moderna, mas é o item mais caro. Deixar pra depois do beta.
12. **Automação de pagamento de fixas** e **multimoeda (USD/EUR)**. Expandem
    mercado, mas não são pré-requisito pra lançar.

---

# PARTE 2 — Melhorias VISUAIS / Design system

Hoje cada tela reimplementa card/botão/vazio com px soltos. Padronizar eleva a
percepção de qualidade sem redesign.

### 🟢 Quick wins visuais (fazer já)

1. **Componente `Card` único** com variantes (`default / elevated / outlined`).
   Remove ~50+ blocos `T.card + border` duplicados e dá consistência imediata.
2. **Escala de espaçamento semântica** (xs/sm/md/lg/xl = 4/8/12/16/24) em vez de
   px soltos (11, 14, 18, 20, 22…). Padroniza respiro de tudo.
3. **`EmptyState` reutilizável** (ícone + título + CTA). Hoje cada tela tem o seu
   "Nenhum item" diferente. Primeira impressão importa no beta.
4. **Estados de hover/focus em todos os botões** (e `:focus-visible`), com alvos
   de toque ≥44px no mobile. Muitos botões da Agenda não têm hover nenhum.
5. **Centralizar cores semânticas** (prioridades/categorias hardcoded em
   Notas/Calendário → usar `coresUI.js`). Some inconsistência de cor.

### 🟡 Médio prazo visual

6. **Tipografia formal** (h1–h6 + text-sm/base/lg) em vez de tamanhos inline.
7. **Corrigir temas claros** (Papel/Linho/Pérola): o Header fica fixo escuro
   (#2d323b) → em tema claro o contraste quebra. Header deve adaptar ao tema.
8. **Microinterações padrão** (transições 150/300ms, skeleton no carregamento,
   estado "Salvando…" nos botões). Dá sensação de app vivo.
9. **Badges/botões com tamanhos** (sm/md/lg) e elevação (4 níveis de sombra).

### Notas por tela (as mais visíveis)

- **Dashboard:** bom; falta card "maiores gastos" e comparativos MoM.
- **Contas:** lista vem **recolhida** (usuário não vê as contas de cara) → abrir
  por padrão + mini-gráfico de saldo por conta.
- **Cartões:** checkboxes de parcela minúsculos (difícil no toque); mostrar
  **% do limite usado**, não só "restante".
- **Transações:** filtros em linha longa quebram mal no mobile; faltam **ações
  em massa** visíveis para os itens selecionados.
- **A Receber & Dívidas:** abas como toggle pouco óbvias; buckets em 4 colunas
  ficam apertados no mobile.
- **Despesas Fixas:** 12 tabs de mês ocupam muito; status só por cor (add ícone).
- **Relatórios:** export sem confirmação (clica e "some"); sem drill-down.
- **Planejamento/Previsão:** ótima base; falta **faixa de incerteza** e cenários.
- **Auditoria:** mostra JSON cru → diff visual antes/depois.
- **Agenda (Tarefas/Compras/Hábitos/Metas):** sólidas; padronizar vazios e cores.

### Transversal (vale pro produto todo)

- **Acessibilidade:** status só por cor (verde/vermelho/ouro) → add ícone/rótulo
  (daltonismo). Contraste ≥4.5:1.
- **Mobile-first real:** alvos de toque, sem depender de hover.
- **Onboarding/trust:** Login com logo maior + links de privacidade/termos;
  tour de primeiros passos; selo "seus dados são privados".

---

# PARTE 3 — Roadmap sugerido

**Fase 0 — Polimento pré-beta (1–2 semanas, quase tudo quick win)**
- Visual: Card único, escala de espaçamento, EmptyState, hover/focus, cores
  centralizadas.
- Info: comparativo vs mês anterior, alerta de orçamento em tempo real,
  sugestão de limite, card "maiores gastos".
→ Resultado: o app já "parece produto" e dá insights, pronto pra amigos.

**Fase 1 — Diferencial (pós-beta inicial)**
- Índice de Saúde Financeira, cenários "E se…", anomalias, reconciliação na
  importação, relatório PDF profissional, correção dos temas claros + tipografia.

**Fase 2 — Escala (quando houver tração)**
- Open Finance/OFX, automação de pagamentos, multimoeda, notificações
  push/e-mail/WhatsApp, benchmark entre usuários.

---

## Recomendação

Começar pela **Fase 0**: é barata, mexe em fundação reutilizável (Card +
espaçamento + EmptyState) e nos 4 toques de inteligência mais baratos. Isso já
muda a percepção do produto pro beta sem risco de redesign.
