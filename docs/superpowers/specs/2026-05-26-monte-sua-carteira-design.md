# Monte sua Carteira — Design Spec

**Data**: 2026-05-26
**Módulo**: Investimentos (`apps/cars-web/src/components/pages/Invest/`)
**Status**: Aprovado, aguardando implementação faseada

## Problema

O app hoje tem 3 ferramentas relacionadas, mas separadas no menu:

1. **Modelo** (`CarteiraModelo.jsx`) — templates manuais de carteira (Iniciante, Completo, Custom) com % alvo por classe, comparação com a carteira atual e distribuição de aporte mensal.
2. **Sugestão de Aporte** (`SugestaoAporte.jsx`) — usada hoje só como modal dentro de outras telas. IA (Gemini → Claude fallback) recebe valor + perfil + objetivo e devolve recomendações estruturadas por classe, com preços via Brapi.
3. **Renda Mensal** (`CalculadoraRenda.jsx`) — simulador de renda fixa: valor + taxa + IR + inflação → projeção de renda mensal nos 3 cenários (bruto/líquido/preserva), com snowball e reserva acumulada.

O usuário precisa pular entre 3 telas pra fazer uma tarefa que deveria ser uma só: **"tenho R$ X, onde aplico pra atingir meu objetivo?"**.

## Solução

Unificar em **"Monte sua Carteira"** — uma única aba reativa (estilo Calculadora) com 4 seções verticais que se atualizam ao vivo conforme o usuário ajusta valor e mix de objetivos.

### Estrutura visual

```
┌─ 1. Quanto investir ─────────────────────────────────┐
│  Slider: R$ 100k —————•———— R$ 10M    R$ 1.000.000   │
└──────────────────────────────────────────────────────┘

┌─ 2. Mix de objetivos (soma 100%) ────────────────────┐
│  Renda mensal   ████████░░░░░░  50%                  │
│  Crescimento    ██████░░░░░░░░  30%                  │
│  Reserva        ████░░░░░░░░░░  20%                  │
│                                                       │
│  → 35% FIIs · 20% Ações BR · 18% Tesouro/CDB · ...   │
│    (pie chart com alocação resultante)               │
└──────────────────────────────────────────────────────┘

┌─ 3. Como preencher? ─────────────────────────────────┐
│  [ Manual ]  [ Com ajuda da IA ]                     │
│                                                       │
│  • Manual: você escolhe tickers por classe           │
│  • IA: Gemini/Claude sugere tickers + valida         │
└──────────────────────────────────────────────────────┘

┌─ 4. Resultado + renda estimada ──────────────────────┐
│  Carteira proposta:                                  │
│  · R$ 350k FIIs   (KNRI11, MXRF11, ...)              │
│  · R$ 200k Ações  (PETR4, ITSA4, ...)                │
│  · R$ 250k Tesouro IPCA+ 2035                        │
│                                                       │
│  💰 Renda mensal estimada: R$ 6.200/mês              │
│      (líquida, após IR, baseada em yields atuais)    │
└──────────────────────────────────────────────────────┘
```

## Lógica de alocação

### Perfis-base por objetivo

Cada objetivo tem uma alocação-alvo padrão por classe de ativo (em %):

| Classe | Renda mensal | Crescimento | Reserva |
|---|---:|---:|---:|
| FIIs (renda) | 45 | 15 | 5 |
| Ações BR | 15 | 30 | 0 |
| Stocks/ETFs US | 10 | 30 | 0 |
| REITs US | 10 | 5 | 0 |
| Tesouro IPCA+ / CDB longo | 15 | 10 | 80 |
| Reserva (Selic / CDB liquidez) | 5 | 10 | 15 |
| **Total** | **100** | **100** | **100** |

### Cálculo da carteira final

Para um mix de objetivos `m = {renda, crescimento, reserva}` que soma 100%:

```
% por classe = m.renda × perfil_renda[classe]
             + m.crescimento × perfil_crescimento[classe]
             + m.reserva × perfil_reserva[classe]
```

Exemplo (mix 50/30/20):
- FIIs = 0.5 × 45 + 0.3 × 15 + 0.2 × 5 = **28.0%**
- Ações BR = 0.5 × 15 + 0.3 × 30 + 0.2 × 0 = **16.5%**
- Stocks/ETFs US = 0.5 × 10 + 0.3 × 30 + 0.2 × 0 = **14.0%**
- REITs US = 0.5 × 10 + 0.3 × 5 + 0.2 × 0 = **6.5%**
- Tesouro/CDB longo = 0.5 × 15 + 0.3 × 10 + 0.2 × 80 = **26.5%**
- Reserva (Selic) = 0.5 × 5 + 0.3 × 10 + 0.2 × 15 = **8.5%**
- (Total: 100%)

Os valores em R$ saem da multiplicação pelo total investido.

### Cálculo da renda mensal estimada

Para cada classe na carteira, usa um yield-base estático (constantes no arquivo, ajustáveis em config futura):

| Classe | Yield mensal estimado | Fonte |
|---|---|---|
| FIIs (renda) | 0.7-0.9% nominal | dividend yield médio histórico |
| Ações BR (dividendos) | 0.4-0.5% | DY médio de blue chips |
| Stocks US (ETFs) | 0.15-0.25% | DY médio S&P500 |
| REITs US | 0.5-0.7% | DY médio REITs |
| Tesouro IPCA+ longo | 0.85% líquido | taxa atual + inflação |
| Reserva (Selic) | 0.95% bruto, ~0.80% líq | Selic / 12 |

Soma ponderada pelo valor R$ em cada classe = renda mensal estimada **líquida**.

## Reaproveitamento de código

### CarteiraModelo.jsx → motor do modo Manual

- **Hoje**: recebe um template fixo (`MODELOS_BUILTIN["iniciante" | "completo" | "custom"]`) com % por classe + tickers sugeridos.
- **Refator**: aceita uma alocação dinâmica `{classes: {fiis: {pct: 27.5, tickers: [...]}, ...}}` calculada a partir do mix de objetivos. Mantém toda lógica de comparação com carteira atual, déficits, edição custom, regras de boa prática.
- Vira sub-componente da nova tela (sem PageHeader próprio).

### SugestaoAporte.jsx → motor do modo IA

- **Hoje**: usado como modal a partir de 3 telas (CarteiraModelo, ObjetivosCarteira, Projecao). Tem catálogo curado, contexto IA, parsing de JSON.
- **Refator**: aceita ser renderizado inline (sem `<Modal>`). Recebe a alocação-alvo do mix de objetivos como input principal em vez do perfil/objetivo livre. Os 3 callsites antigos continuam funcionando.
- Vira sub-componente da nova tela.

### CalculadoraRenda.jsx → função de cálculo + tela legacy

- Extrair função pura `calcularRendaMensal(carteira, yields)` pra reuso na seção 4.
- A tela atual continua acessível pra simulações livres de renda fixa (sem carteira) **enquanto a fase 3 não remove a aba do menu**.

## Decomposição em fases (3 PRs)

### PR 1 — Esqueleto da tela
- Nova aba **"Monte sua Carteira"** no menu Invest (substitui temporariamente "Modelo"; "Renda Mensal" segue separada).
- Novo arquivo `MonteSuaCarteira.jsx` com:
  - Seção 1 (slider de valor: R$ 100k → R$ 10M, step 50k)
  - Seção 2 (3 sliders de objetivos somando 100%)
    - **Comportamento do constraint**: quando o usuário mexe em um slider, os outros 2 são redistribuídos proporcionalmente para manter a soma em 100%. Se ambos estão em 0, o "excesso" vai pro slider que estava mais ativo por último.
    - 3 atalhos: "Só renda" (100/0/0), "Só crescimento" (0/100/0), "Balanceado" (40/40/20).
  - Cálculo da alocação resultante por classe (média ponderada dos perfis-base)
  - Pie chart da alocação (Recharts, padrão do app)
- Seções 3 e 4 ficam com placeholder "em breve".
- **Sem refator** das telas antigas (Modelo continua acessível por rota direta caso precise).

### PR 2 — Modo Manual
- Refator de `CarteiraModelo.jsx` pra extrair o motor (cálculo de déficits, comparação carteira atual) em um componente reutilizável.
- Integra como conteúdo da seção 3 quando "Manual" está selecionado.
- A aba antiga "Modelo" passa a redirecionar pra "Monte sua Carteira" (ou some).

### PR 3 — Modo IA + renda estimada + cleanup
- Refator de `SugestaoAporte.jsx` pra aceitar modo inline + alocação-alvo como input.
- Integra na seção 3 quando "Com IA" está selecionado.
- Seção 4: extrai cálculo de renda mensal pra função pura; renderiza card de renda estimada.
- Remove abas **"Modelo"** e **"Renda Mensal"** do menu (`apps/cars-web/src/components/Header.jsx`).
- Mantém arquivos antigos por 1 ciclo caso precise rollback; remove em PR de cleanup separada.

## Decisões / Trade-offs

- **Mix de 3 sliders vs. 1 objetivo único**: usuário escolheu mix com %. Mais flexível, mais decisão. Constraint: sliders devem somar 100% (ajustar os outros 2 quando 1 muda).
- **3 objetivos viram os templates**: substituem Iniciante/Completo/Custom em vez de adicionar uma camada. Reduz fricção, mantém o mental model "qual seu objetivo?".
- **Renda mensal estimada usa yields-base estáticos**: pra MVP. Refinamento futuro: buscar DY/yield em tempo real via Brapi pra ações/FIIs específicos.
- **Templates "Iniciante/Completo/Custom" removidos**: o mix de objetivos já cobre o range (Iniciante ≈ 30/40/30, Completo ≈ 40/40/20). Custom vira o próprio mix livre.
- **Calculadora de Renda Mensal removida do menu na fase 3**: a renda fica embutida na nova tela. Função de cálculo extraída pode ser reusada em outros lugares (Projecao, Objetivos).

## Critérios de sucesso

- [ ] Usuário consegue, em 1 tela só, definir valor + objetivos e ver a carteira proposta + renda mensal estimada
- [ ] Pode escolher entre montar manual ou com IA sem trocar de aba
- [ ] Carteira proposta é coerente com o mix de objetivos (validar visualmente com 3 mixes-tipo: 100/0/0, 0/100/0, 50/30/20)
- [ ] Build verde, sem regressões nos callsites atuais de SugestaoAporte (CarteiraModelo modal-mode, Objetivos, Projecao)

## Itens fora de escopo (pra próximas iterações)

- Yields em tempo real via Brapi/cotações
- Backtesting da alocação proposta
- Rebalanceamento periódico (sugestão de aporte que aproxima alvo)
- Salvar carteiras propostas como template do usuário
- Comparar 2 mixes lado a lado
- Exportar PDF da carteira proposta
