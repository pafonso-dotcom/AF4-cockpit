# Extrato da conta no estilo do banco (Itaú) — Design

**Data:** 2026-06-05
**App alvo:** pessoal (AF4 / `apps/cars-web`). Replicar no comercial depois.
**Arquivo principal:** `apps/cars-web/src/components/pages/ContaExtrato.jsx`

## Problema

1. **Não bate com o banco.** O extrato do Itaú mostra *saldo em conta* R$ 50.405,57;
   o app mostra R$ 48.229,13 (diferença de R$ 2.176,44). O usuário não consegue
   localizar de onde vem a diferença nem corrigir.
2. **Tela diferente do banco.** O usuário quer a tela parecida com o extrato do
   Itaú: tabela `data · lançamento · valor · saldo` com uma linha **SALDO DO DIA**
   por dia. Hoje a tela usa cards com ícone e um "saldo R$..." embaixo de cada
   lançamento, o que polui e não lembra o banco.

## Decisões (validadas com o usuário)

- **Modelo de saldo:** saldo inicial + soma dos lançamentos compensados.
- **Investigação da diferença:** linha SALDO DO DIA por dia (compara visualmente
  com o PDF do banco) + botão "Conferir com o banco".
- **Layout:** tabela estilo banco (data · lançamento · valor · saldo) + SALDO DO DIA.
- **Coluna saldo:** SALDO DO DIA **e** saldo por lançamento (mantém os dois).
- **Cabeçalho:** só *saldo em conta* em destaque por agora (sem caixas de limite).
- **Categoria:** mantém o chip de categoria editável dentro do lançamento.
- **Escopo:** só o app pessoal (AF4) nesta etapa.

## Modelo de saldo (reconciliação)

```
SALDO DO DIA[d] = saldoInicial + Σ(lançamentos compensados com data ≤ fim do dia d)
saldoApós(tx)   = saldoInicial + Σ(compensados até tx, na ordem cronológica estável)
```

- Ordenação estável por `data::id` (já existe no componente).
- **Pendentes** (não compensados) **não** entram no SALDO DO DIA nem no saldo por
  lançamento — igual ao banco (só mostra o que caiu). Continuam visíveis com selo
  "Pendente" e contam só no "saldo previsto fim do mês".
- O `saldoInicial` da conta é a âncora. Se a conta não tiver `saldoInicial`,
  derivamos um a partir do `conta.saldo` atual menos a soma dos compensados (assim
  o último SALDO DO DIA bate com o saldo atual).

### Botão "Conferir com o banco"

1. Usuário digita o *saldo em conta* que o banco mostra (ex.: 50.405,57) e,
   opcionalmente, a data de referência (padrão: hoje).
2. App calcula o saldo na mesma data e mostra a **diferença** (ex.: −2.176,44).
3. Oferece **ajustar o saldo inicial** somando essa diferença, de forma que o
   SALDO DO DIA da data de referência passe a bater com o banco. Com isso todos os
   dias anteriores e o saldo atual ficam coerentes. Ação com toast "Desfazer".

Isso resolve o "não está batendo" e dá ao usuário a ferramenta de investigação:
ao ver os SALDO DO DIA lado a lado com o PDF, ele identifica o dia exato onde
diverge (lançamento faltando/sobrando) e/ou ancora pelo saldo do banco.

## Layout (estilo Itaú)

### Cabeçalho
- Banner com gradiente do banco (mantém identidade atual) com **saldo em conta**
  em destaque.
- Linha de KPIs: Entradas (mês) · Saídas (mês) · Saldo previsto fim do mês.
- Sub-título: `extrato conta / lançamentos · período de visualização: DD/MM/AAAA até DD/MM/AAAA`.
- Botões: Nova transação · Transferir · PDF.
- Botão novo: **Conferir com o banco**.

### Tabela
Colunas: **data · lançamento · valor (R$) · saldo (R$)**, mais recente primeiro.

- `data`: dia/mês (cabeçalho de dia colapsável continua existindo).
- `lançamento`: descrição em destaque + chip de categoria editável + obs + selos
  (Pendente / Fixa).
- `valor`: vermelho para saída (−), verde/azul para entrada (+).
- `saldo`: saldo após o lançamento (faint) e, no fim de cada dia, uma linha
  **SALDO DO DIA** com o saldo do dia em negrito (só na coluna saldo), igual ao banco.
- Ações (editar/excluir) discretas no hover.

### Filtros (mantidos)
Período (mês / 3 meses / tudo) · Tipo (todos/receita/despesa) · Busca · Status
(todas/compensadas/pendentes) · ordenação · recolher/expandir dias.

## Não-objetivos (YAGNI por agora)
- Caixas de limite (cheque especial) no cabeçalho.
- Replicar no comercial (fica para uma etapa seguinte).
- Importação/parse automático do PDF do banco (fora de escopo).

## Componentes afetados
- `apps/cars-web/src/components/pages/ContaExtrato.jsx` (principal).
- Possível: `apps/cars-web/src/lib/saldoConta.js` (helper de reconciliação),
  e o editor de conta (`Contas.jsx`/modal) para gravar `saldoInicial` ajustado.
