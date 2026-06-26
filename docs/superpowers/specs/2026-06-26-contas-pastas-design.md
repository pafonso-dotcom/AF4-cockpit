# Contas como cards de "pasta" (folder cards)

Data: 2026-06-26 · App: **pessoal** (`apps/cars-web`) apenas.

## Contexto

A tela de Contas (`src/components/pages/Contas.jsx`) lista cada conta como uma
**linha** dentro da seção "Minhas contas" (`SecaoColapsavel`), com avatar de
iniciais, nome, selos (Negócio/Fora), saldo (com moeda/≈BRL) e um chevron que
expande ações (reordenar ↑↓, abrir app do banco). Clique na linha → `onContaClick(c)`.

O usuário quer trocar essas linhas por **cards em forma de pasta** (inspirado num
print "Shared Folders": pasta roxa com aba/papéis no topo, ícone, título e um stat).

## Decisões (aprovadas)

- **Cada conta = 1 card de pasta** (substitui as linhas; grade responsiva).
- **Roxo uniforme** no corpo da pasta (igual o print); a **cor da conta** aparece
  só no **ícone** (quadrado arredondado com iniciais).
- Só no app **pessoal**.

## Desenho do card (pasta)

- **Forma de pasta:** corpo arredondado roxo (gradiente escuro) + 1–2 retângulos
  roxos mais claros "espiando" atrás do topo (efeito papéis/aba), como no print.
- **Ícone:** quadrado arredondado (~40px) com a **cor da conta** e as **iniciais**
  (reusa o helper `iniciais(nome)`).
- **Título:** nome da conta (branco, semibold, 1 linha com ellipsis).
- **Stat (lugar do "62 files"):** o **saldo** (branco, serif). Para moeda
  estrangeira, mostra bandeira + `≈ BRL` (reusa `saldoContaBRL`, `ehBRL`).
- **Selo:** Negócio / Fora do patrimônio / "sem cotação" quando aplicável.
- **Clique no card:** `onContaClick(c)` (igual hoje).
- **Ações secundárias:** um botão "⋯" no canto superior direito do card abre um
  rodapé com as ações atuais (mover ↑/↓ via `moverConta`, abrir `appUrl`). Não
  perder função.
- **Grade:** `display:grid; gridTemplateColumns: repeat(auto-fill, minmax(180px,1fr)); gap`.
  No celular cai pra 1–2 colunas naturalmente.

## Arquivos afetados

- `apps/cars-web/src/components/pages/Contas.jsx` — substituir `renderConta`
  (linha) por `renderPasta` (card de pasta) e o container da lista por uma grade.
  Manter todos os handlers existentes (`onContaClick`, `moverConta`, `toggleExpanded`,
  `expandedConta`, `appUrl`, selos, moeda).

## Não-objetivos

- Não mexer no comercial.
- Não alterar a lógica de saldo/escopo/ordenação — só a apresentação.
- Não remover ações (reordenar / app do banco) — migram pro "⋯".

## Verificação

- Build `pnpm --filter @repo/cars-web build`.
- Runtime headless (seed contas com cores diferentes, incl. uma de Negócio e uma
  em USD): grade de pastas roxas com ícone colorido, nome, saldo; "⋯" revela
  reordenar/app; clique chama `onContaClick`.
