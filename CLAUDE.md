# AF4-cockpit — orientação para o agente

## Dois apps INDEPENDENTES (regra principal)

Este monorepo tem dois apps que são tratados como **projetos separados**. Eles
**não compartilham código** e evoluem de forma independente.

- `apps/cars-web` — **versão pessoal** (worker Cloudflare `af4cockpit`).
- `numvi-financas` — **versão comercial** (worker Cloudflare `numvi-financas`),
  destinada a venda; usa Supabase (auth/multiusuário).

**Regras ao alterar código:**

1. **Toda alteração mira UM app por vez** — o que o usuário estiver falando.
   Se não estiver claro qual, **pergunte** antes de editar.
2. **NÃO espelhe automaticamente** mudanças de um app no outro. Só mexa nos dois
   se o usuário pedir explicitamente (ex.: "leva pro comercial também" /
   "replica nos dois").
3. Aceita-se que correções de bugs comuns sejam feitas duas vezes — essa é a
   troca consciente por independência (decisão de 2026-06-09).

## Build / deploy

- Build pessoal: `pnpm --filter @repo/cars-web build`
- Build comercial: `pnpm --filter numvi-financas build`
- O worker raiz `af4cockpit` (em `wrangler.jsonc`) serve `apps/cars-web/dist` —
  **não renomear** (já quebrou deploy antes).

## Branch de desenvolvimento

- Trabalhar em `claude/numvi-pessoal-changes-YHaEK` salvo instrução em contrário.

## Histórico de decisões

- `docs/superpowers/specs/2026-06-09-apps-independentes-decisao.md` — decisão de
  manter os dois apps independentes (substitui a ideia de `packages/core`).
