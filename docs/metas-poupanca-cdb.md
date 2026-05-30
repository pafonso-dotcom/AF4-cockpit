# 🐷 Metas como Poupança (com rendimento CDB/CDI) — IDEIA (PRÓXIMA)

> **Status:** 🔖 Ideia marcada para depois — ainda não implementado.
> **Princípio-chave (definido pelo Paulo):**
> **A meta é só uma POUPANÇA, não uma compra realizada.**
> Separar dinheiro pra uma meta **não é gastar** — é realocar. Vira despesa
> de verdade só quando o dinheiro for **usado** (ex.: comprar a viagem).

## O problema de hoje

Na tela **A Receber & Dívidas**, "Pagar para Meta: Viagem a Portugal" hoje:
- cria uma **despesa** ("Pagamento de Meta…")
- **diminui o saldo** da conta
- o dinheiro **some do patrimônio**

Isso está errado conceitualmente: guardar pra uma meta não destrói patrimônio.
O dinheiro continua sendo do usuário, só está **reservado**.

## O modelo certo

```
Aportar na meta "Viagem a Portugal"  (R$ 4.167)
   ├─ NÃO é despesa
   ├─ sai da conta ITAÚ  (saldo −4.167)
   ├─ entra na POUPANÇA DA META (atual += 4.167)   ← continua patrimônio
   └─ opcional: rende a CDI (projeção) — como se estivesse num CDB Pós-CDI

   Patrimônio total NÃO muda no aporte.

Quando a meta é USADA (compra realizada):
   └─ aí sim vira DESPESA real (ex.: "Viagem a Portugal") e sai do patrimônio.
```

## O que o app já tem (reaproveitar)

- **Metas** já têm o campo `atual` (quanto já juntou) + "poupança automática".
- **Módulo Investimentos** já suporta tipo **CDB** e indexador **Pós-fixado (CDI)**.
- **EvolucaoPatrimonio** já calcula benchmark **CDI** (taxa anual editável).
- **TransferenciaModal** já move dinheiro entre contas **sem virar despesa**
  (cria par receita/despesa marcado com `transferenciaId`) — é o padrão a seguir.

## Decisões de design

1. **Aporte na meta = transferência, não despesa.**
   Debita a conta de origem e credita a "poupança da meta" (`meta.atual`).
   Marca a transação como transferência/aporte (não conta como gasto nos relatórios).

2. **Rendimento = projeção CDI (não ativo real).**
   A poupança da meta mostra "aportado R$ X · rendimento estimado R$ Y (a CDI) ·
   falta R$ Z". Usa a taxa CDI já existente. **Não** cria um ativo/compra no
   módulo Invest — é só projeção, porque a "compra" (a viagem) ainda não aconteceu.

3. **Baixa real só no uso.**
   Botão "Usar/Resgatar meta" → aí sim gera a despesa real e baixa o patrimônio.
   (Ou resgate parcial.)

## Fases (rascunho)

### Fase 1 — Aporte sem virar despesa · ~1 sessão
- [ ] Trocar a baixa de "Pagar para Meta" → **aporte** (transferência interna)
- [ ] `meta.atual += valor`; transação marcada como aporte (fora de "despesas")
- [ ] Garantir que relatórios/gráficos não contem aporte como gasto

### Fase 2 — Rendimento projetado (CDI) · ~1 sessão
- [ ] Campo de rendimento na meta (projeção a CDI, taxa reaproveitada do Invest)
- [ ] Card da meta: aportado · rendimento estimado · falta pro alvo
- [ ] Histórico de aportes na meta

### Fase 3 — Resgate / uso · ~0,5 sessão
- [ ] Botão "Usar meta" → gera a **despesa real** (a compra) e baixa patrimônio
- [ ] Resgate parcial (tira parte da poupança de volta pra conta)

## Pontos em aberto (decidir depois)
- A poupança da meta é uma **conta-cofrinho real** (aparece em Contas) ou um
  **saldo virtual** dentro da meta? (Conta real = saldo separado e visível;
  virtual = mais simples, mas não aparece como conta.)
- Rendimento só projetado, ou um dia virar aplicação CDB de verdade no Invest?
- Várias metas = várias poupanças, ou uma reserva compartilhada?

## Relação com o desbloqueio já feito
Já foi liberado editar/excluir os itens (fixas/avulsas) direto na tela
A Pagar — isso resolve o "preciso apagar esse pagamento de meta agora".
Esta ideia é a evolução: pagar meta deixa de ser despesa e passa a ser poupança.
