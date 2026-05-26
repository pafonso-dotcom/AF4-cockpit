# LOTOAI · Relatório de análise · concursos 1–3197

Análise estatística e tunning algorítmico sobre **3.197 concursos** da Lotofácil
(setembro/2003 → setembro/2024). Quatro experimentos rodados.

## TL;DR honesto

> **A Lotofácil é praticamente aleatória.** Não há correlações fortes entre
> dezenas (todas as duplas têm lift entre 0.94 e 1.00 — virtualmente
> independentes). Modelos preditivos ganham apenas **+0.04 dezenas/concurso**
> sobre escolha aleatória. **Todas as 150 configurações testadas no backtest
> grid deram prejuízo** (ROI médio -75%). A melhor config gerou ROI de **-30%**.
>
> **MAS** há padrões reais úteis para *filtrar* jogos absurdos e melhorar a
> distribuição estatística das apostas:
>
> - **7 ou 8 pares** sai em 56% dos sorteios (descarta jogos com 3–4 ou 10+)
> - **Soma entre 170–210** acontece em 70% dos sorteios
> - **9 dezenas se repetem** do concurso anterior em 32% das vezes (8–10 cobre 79%)
> - **10 dezenas da moldura** é a moda (32%, 9–10 cobre 61%)
> - **5–6 primos** representa 60% dos sorteios

## 1 · Padrões clássicos (`01-padroes.mjs`)

### Frequência (3197 concursos)
| Dezenas mais quentes | Dezenas mais frias |
|----------------------|--------------------|
| 20 (61.5%) · 10 (61.3%) · 25 (60.6%) · 11 (60.5%) · 13 (60.2%) | 16 (56.9%) · 8 (58.0%) · 6 (58.3%) · 23 (58.6%) · 7 (59.0%) |

**Spread total: 4.6 pontos percentuais** entre a mais e menos frequente — diferença pequena, dentro do esperado para amostra finita.

### Distribuições-chave
- **Pares**: moda em 7 (31%) e 8 (25%); somados, 56% dos sorteios
- **Soma das 15**: média 195.2, min 133, max 249; faixa 170–210 cobre 70%
- **Primos**: 5–6 primos sai em 60% dos sorteios
- **Moldura (16 dezenas externas)**: 9–10 saem em 61% das vezes
- **Repetições do concurso anterior**: moda em 9 (32%), faixa 8–10 cobre 79%
- **Sequências consecutivas no mesmo sorteio**: run de 4 (32%) e 5 (28%) dominam

### Maior atraso atual (até concurso #3197)
- Dezena 14: 6 concursos sem sair

## 2 · Correlações (`02-correlacoes.mjs`)

Construímos matriz 25×25 de co-ocorrência e calculamos **lift** (P(A∩B) / P(A)·P(B)) e **Jaccard**.

**Top 5 duplas com maior lift** (mais "grudadas" do que o esperado):
- 04-19 (lift 0.995) · 06-09 (0.994) · 09-10 (0.994) · 11-20 (0.994) · 06-24 (0.994)

**Top 5 menos grudadas**:
- 04-07 (0.938) · 03-12 (0.939) · 09-24 (0.941) · 06-11 (0.944) · 10-22 (0.945)

> **Conclusão**: todos os lifts estão entre 0.94 e 1.00. Praticamente todas as
> duplas se comportam como **independentes**. Não há "núcleos" reais de
> co-ocorrência além do que a aleatoriedade já produz.

## 3 · Modelo preditivo (`03-modelo-preditivo.mjs`)

Regressão logística por dezena com 7 features (freq janela 10/30/100, atraso, aparição no último, paridade, valor normalizado). 80/20 train/val.

**Resultado**: 9.037 acertos médios no top-15 ranqueado vs **9.000 aleatório**.
- **Ganho: +0.037 dezenas/concurso** (estatisticamente irrelevante)
- Top-18 (fechamento): 10.77 / 15 acertos — útil para fechamentos

**Pesos finais** (todas as features pequenas e parecidas):
```
bias       = 0.13
freq10     = 0.08
freq30     = 0.08
freq100    = 0.08
atraso     = 0.01
ultimoConc = 0.06
par        = 0.05
valor      = 0.07
```

## 4 · Backtest grid (`04-backtest-grid.mjs`)

150 combinações de pesos testadas em 500 concursos × 5 jogos/concurso = 2500 apostas por config.

| ROI médio do grid | -75.71% |
|---|---|
| Desvio padrão | 6.92% |
| Melhor config | -29.67% |
| Pior config | -81.28% |

**Melhor configuração encontrada**:
```js
{ wFreq: 0.7, wAtraso: 0.0, janela: 100, paresAlvo: [7, 8] }
```
- 251 acertos de 11, 39 de 12, 6 de 13, 2 de 14, **zero de 15** em 2500 apostas
- ROI -29.67% (vs -75% aleatório — significativo, mas ainda prejuízo)

## O que dá pra fazer com isso

1. **Filtrar jogos inválidos estatisticamente**: descartar candidatos com
   pares fora de 6–9, soma fora de 160–220, moldura fora de 8–11 — isso *não*
   aumenta probabilidade de ganhar, mas alinha apostas ao perfil histórico.

2. **Fechamentos**: o top-18 do modelo acerta em média 10.77 das 15 dezenas
   sorteadas. Combinado com matriz de garantia (ex: 14 em 18), pode garantir
   prêmios menores com regularidade.

3. **Default tuning do gerador**: usar `wFreq=0.7, wAtraso=0, janela=100,
   paresAlvo=[7,8]` reduz prejuízo médio de 75% para 30% no backtest.

4. **Não prometer o que a estatística não entrega**: nenhuma configuração
   produziu lucro positivo no backtest. Honestidade é diferencial.

## Arquivos gerados em `data/`

- `concursos.json` — 3197 concursos normalizados (272 KB)
- `relatorio-01-padroes.txt`, `relatorio-02-correlacoes.txt`, `relatorio-03-modelo.txt`, `relatorio-04-backtest.txt`
- `co-matriz.json` — matriz 25×25 de co-ocorrência
- `modelo-pesos.json` — pesos da regressão logística
- `grid-top.json` — top-5 configurações do backtest
- `RELATORIO-EXECUTIVO.md` — este documento

## Reproduzir

```bash
pnpm --filter @repo/lotoai-mobile install
cd apps/lotoai-mobile
node scripts/analise/parse-xlsx.mjs       # gera concursos.json
node scripts/analise/01-padroes.mjs       # frequência, pares, soma, primos…
node scripts/analise/02-correlacoes.mjs   # duplas e trios
node scripts/analise/03-modelo-preditivo.mjs  # logistic regression
node scripts/analise/04-backtest-grid.mjs # grid search · ~3 minutos
```
