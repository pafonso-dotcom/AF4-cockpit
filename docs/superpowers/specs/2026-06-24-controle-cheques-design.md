# Controle de Cheques — design

- **Data:** 2026-06-24
- **App:** pessoal (`apps/cars-web`) — Finanças
- **Branch:** `claude/numvi-pessoal-changes-YHaEK`

## Objetivo

Criar um **controle de cheques a receber** como nova fonte de recebíveis: cada
cheque tem emitente, valor, vencimento (data prevista de compensação), banco,
número e status (**Aguardando · Compensado · Devolvido**). Ao **compensar**, o
dinheiro entra numa conta e vira receita (igual à baixa de um devedor). O total
a receber e o relatório passam a refletir os cheques aguardando. Reaproveita os
ganchos já existentes (notificações, WhatsApp, Pergunte ao Claude) que esperam
um array `cheques`.

## Escopo

**Inclui:**
- Estado `cheques` + persistência (default `[]`, sem migração).
- Aba própria **"Cheques"** no menu de Finanças (CRUD + ações).
- Ações: **Compensar** (credita conta + cria receita), **Devolver** (status,
  sem movimento) e **Estornar compensação** (desfaz: remove a transação,
  devolve da conta, volta a aguardando).
- Agregador: cheque **aguardando** conta como recebível **pendente** no mês do
  vencimento (Controle Anual / Planejamento).
- Ligar `cheques` em `checkAndNotify` (App) e `buildContext` (Pergunte ao Claude).

**Fora de escopo:** parcelamento de cheques, conciliação bancária automática,
anexos/imagem do cheque.

## Modelo de dados

`cheques: [{`
- `id`
- `de` — quem emitiu / de quem você recebeu
- `valor` — number
- `vencimento` — "YYYY-MM-DD" (data prevista de compensação)
- `banco` — string (opcional)
- `numero` — string (opcional, nº do cheque)
- `status` — `"aguardando" | "compensado" | "devolvido"`
- `escopo` — `"pessoal" | "negocio"` (default "pessoal")
- `obs` — string (opcional)
- `contaCompensacao`, `dataCompensacao`, `txId` — preenchidos ao compensar
`}]`

## Componentes / arquitetura

- **`Cheques.jsx` (página, nova)** — `components/pages/Cheques.jsx`.
  Props: `{ cheques, setCheques, contas, setContas, transacoes, setTransacoes, escopoAtivo, hidden }`.
  - KPIs no topo: **Total aguardando**, **Vencidos** (aguardando com vencimento
    < hoje), **Compensado no mês**.
  - Lista ordenada por vencimento, com filtro por status. Cada item mostra
    `de`, valor, vencimento, banco/nº, badge de status; ações conforme status.
  - **Novo/Editar** (modal): de, valor, vencimento, banco, número, escopo, obs.
  - **Compensar** (modal): escolhe **conta de destino** + data → credita a conta,
    cria transação `{ tipo: "receita", valor, descricao: "Cheque de {de}",
    categoria: "Cheques", conta, data, compensado: true, chequeId }`, e marca o
    cheque `compensado` (guardando `contaCompensacao`, `dataCompensacao`, `txId`).
  - **Devolver**: marca `devolvido` (sem mexer em conta/transação). Reversível
    (volta a aguardando).
  - **Estornar compensação**: remove a transação (`txId`), debita o valor de
    volta da conta, volta status a `aguardando` e limpa os campos de compensação.

- **`lib/agregador.js`** — em `getGanhosDoMes`, nova seção: para cada cheque
  `status === "aguardando"` com `vencimento` no mês, emite um ganho pendente
  `{ descricao: "Cheque de {de}", valor, status: "pendente", categoria: "Cheques" }`.
  (Compensado já entra pela transação tipo receita; devolvido não conta.)
  **Como `getGanhosDoMes` alimenta `getProjecaoSaldo` e o Controle Anual, os
  cheques aguardando passam a APARECER NO RELATÓRIO** (Controle Anual + projeção
  da tela de Relatórios) como recebível previsto — requisito explícito.

- **`App.jsx`** — estado `cheques/setCheques`; SETTERS; persistência (saveAll +
  deps); rota `tab === "cheques"`; passa `cheques` para `checkAndNotify`
  (`App.jsx:469`). **`appPersistencia.js`** — hidrata `cheques` (`data.cheques || []`).

- **`Header.jsx`** — subtab `{ id: "cheques", label: "Cheques", icon: FileText }`
  no menu de Finanças (ambos os arrays).

- **`PergunteAoClaude.jsx`** — passar `cheques` ao `buildContext`.

## Fluxo de dados

```
App.jsx (cheques) ──> Cheques.jsx (CRUD + compensar/devolver/estornar)
   compensar: setContas(+valor) + setTransacoes(+receita chequeId) + setCheques(status=compensado)
App.jsx ──> getGanhosDoMes (cheque aguardando = pendente no vencimento)
App.jsx ──> checkAndNotify({ devedores, dividas, cheques })  // sininho
PergunteAoClaude ──> buildContext({ ..., cheques })
```

## Tratamento de erro / bordas

- Compensar exige conta selecionada; credita só ao confirmar. Sem saldo mínimo
  exigido (é entrada de dinheiro).
- Estornar compensação debita a conta de volta (pode ficar negativa — é o
  espelho exato da compensação). Desfaz disponível via toast.
- Excluir um cheque compensado: avisa que a transação correspondente, se
  desejado, deve ser estornada antes (ou ao excluir, remove também a transação
  ligada). **Decisão:** ao excluir um cheque compensado, **estorna junto**
  (remove a transação e devolve da conta), com desfazer.
- Aggregador conta apenas `aguardando` como pendente (evita dupla contagem com
  a transação do compensado).

## Verificação

- `pnpm --filter @repo/cars-web build` ✓.
- Runtime (dirigir o app): criar cheque (aguardando) → aparece na lista e como
  **pendente no Controle Anual** no mês do vencimento; **compensar** →
  conta credita + transação de receita + status compensado + sai do pendente;
  **estornar** → conta volta, transação some, volta a aguardando; **devolver**
  → status devolvido, sem movimento; sininho lista cheque vencendo.

## Decisões

- Aba própria "Cheques" (não dentro de "A Receber").
- Compensar = credita conta + vira receita (espelha a baixa de devedor).
- Status: Aguardando / Compensado / Devolvido.
- Só financeiro pessoal/negócio via `escopo` (consistente com o resto).
- Mudança só em `apps/cars-web`; não espelhar no comercial.
