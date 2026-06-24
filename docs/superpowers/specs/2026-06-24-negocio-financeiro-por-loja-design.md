# Financeiro por loja no Negócio — design

- **Data:** 2026-06-24
- **App:** pessoal (`apps/cars-web`) — módulo Negócio
- **Branch:** `claude/numvi-pessoal-changes-YHaEK`

## Objetivo

Permitir **múltiplas lojas (de motos)** no módulo Negócio, cada uma com seu
**financeiro independente**: Banco/contas, Despesas (fixas e variáveis) e
**Recebimentos** (nova lista de entradas). O usuário cria "Loja 1", "Loja 2"…
(nome editável), troca a loja ativa e vê/lança dados isolados por loja. O
**Painel do Negócio** tem visão por loja e uma visão **"Todas as lojas"**
(consolidada).

## Escopo

**Incluído (v1) — por loja:**
- Lojas: criar, **renomear**, excluir (com guarda se houver dados).
- Banco/contas (`negocioFinContas`).
- Despesas fixas (`negocioFinDespesasFixas`).
- Despesas variáveis (`negocioFinDespesasVar`).
- **Recebimentos** (nova lista `negocioRecebimentos`).
- Painel financeiro do Negócio: por loja **e** "Todas as lojas".

**Fora de escopo (v1) — permanecem compartilhados:**
- Estoque de motos/veículos, vendas, serviços, clientes.
- Categorias do Negócio (`negocioFinCategorias`) — são só rótulos, ficam
  compartilhadas entre lojas.

## Modelo de dados

Novos campos/estados em `App.jsx` (e persistidos em `appPersistencia.js` /
`saveAll`):

- `negocioLojas: [{ id, nome }]` — lista de lojas. Seed/migração: se vazio,
  cria `{ id, nome: "Loja 1" }`.
- `negocioLojaAtiva: string` — id da loja ativa (ou `"todas"` para a visão
  consolidada). Persistido.
- `negocioRecebimentos: [{ id, descricao, valor, categoria, data, conta, lojaId }]`
  — nova lista de entradas.
- Campo `lojaId` adicionado aos itens de: `negocioFinContas`,
  `negocioFinDespesasFixas`, `negocioFinDespesasVar`.

**Migração (em `aplicarDadosCarregados`):** ao carregar, se não houver
`negocioLojas`, cria `[{ id: <novo>, nome: "Loja 1" }]`; todo item financeiro
sem `lojaId` recebe o id dessa Loja 1. Idempotente (só migra o que falta).

## Componentes / arquitetura

- **`negocioLojas.js` (lib, nova)** — helpers puros:
  - `migrarLojas(state) → { negocioLojas, patches }` (gera Loja 1 + atribui lojaId).
  - `filtrarPorLoja(itens, lojaAtiva)` — devolve itens da loja (ou todos se `"todas"`).
  - `resumoLoja(state, lojaId)` — totais (saldo banco, despesas fixas/var,
    recebimentos, resultado) de uma loja; aceita `"todas"` (consolida).
  - Testes unitários em `src/lib/__tests__/negocio-lojas.test.js`.

- **`LojaSelector.jsx` (componente, novo)** — barra no topo das telas financeiras
  do Negócio: dropdown `Todas as lojas | Loja 1 | Loja 2…` + botão ⚙ "Gerenciar".
  Props: `{ lojas, lojaAtiva, setLojaAtiva, onGerenciar }`.

- **`GerenciarLojasModal.jsx` (componente, novo)** — criar "Loja N", renomear
  (input inline) e excluir (confirm + aviso se a loja tiver itens financeiros).
  Props: `{ lojas, setLojas, contas, despesasFixas, despesasVar, recebimentos, lojaAtiva, setLojaAtiva }`.

- **`NegocioRecebimentos.jsx` (página, nova)** — espelho de
  `NegocioDespesasVar.jsx` para entradas. CRUD com `lojaId` da loja ativa.

- **Páginas existentes ajustadas** (filtram por loja ativa; novos itens recebem
  `lojaId`): `NegocioBanco`, `NegocioDespesasFixas`, `NegocioDespesasVar`,
  `NegocioPainel`. Cada uma recebe `lojaAtiva` (+ `lojas` p/ rótulo no modo
  "todas") via props do `App.jsx`. Quando `lojaAtiva === "todas"`, as listas
  mostram itens de todas as lojas com uma etiqueta da loja; ao criar um item
  nesse modo, o formulário pede a loja (default: primeira loja).

- **Navegação:** novo subtab `negocio-recebimentos` no `Header.jsx` (em ambos os
  arrays de nav do Negócio) e rota em `App.jsx`. O `LojaSelector` aparece no topo
  das telas financeiras (Painel, Banco, Despesas fixas/var, Recebimentos).

## Fluxo de dados

```
App.jsx (negocioLojas, negocioLojaAtiva, negocioFin*, negocioRecebimentos)
  ├─ LojaSelector → setNegocioLojaAtiva
  ├─ GerenciarLojasModal → setNegocioLojas (+ realoca/della itens)
  ├─ NegocioBanco/DespesasFixas/DespesasVar/Recebimentos
  │     listas = filtrarPorLoja(itens, lojaAtiva); novo item → lojaId = lojaAtiva
  └─ NegocioPainel → resumoLoja(state, lojaAtiva)  // "todas" consolida
```

## Tratamento de erro / bordas

- Excluir loja com itens financeiros: **bloqueado**, com mensagem clara
  orientando a mover/excluir os itens antes (evita perda acidental de dados).
- `lojaAtiva === "todas"` + criar item: form exige escolher a loja (default
  primeira). Nunca cria item com `lojaId` vazio.
- Sempre ao menos 1 loja: não permite excluir a última loja.
- Migração roda só quando `negocioLojas` ausente/vazio (idempotente).

## Verificação

- `pnpm --filter @repo/cars-web build` ✓ e `test:once` (inclui
  `negocio-lojas.test.js`).
- Runtime (dirigir o app): criar Loja 1 + Loja 2; renomear Loja 1; lançar uma
  conta de banco, uma despesa e um recebimento em cada loja; alternar o seletor
  e confirmar **isolamento** (cada loja só vê o seu); abrir "Todas as lojas" e
  ver o **consolidado** no Painel; confirmar que dados antigos do Negócio caíram
  na Loja 1.

## Decisões

- v1 isola **só o financeiro**; estoque/serviços/clientes continuam compartilhados.
- "Todas as lojas" é uma opção do seletor: consolida no Painel e lista tudo
  (com etiqueta) nas telas; criação de item nesse modo pede a loja.
- Exclusão de loja **bloqueada** enquanto houver itens financeiros nela.
- Independência de apps: mudança só em `apps/cars-web`; não espelhar no comercial.
