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

## Como pedir gastando menos tokens

O que mais economiza não é a arquitetura, e sim o escopo de cada pedido:

1. **Dizer qual app + qual tela/arquivo.** Ex.: "no comercial, no campo de valor
   da Nova Transação". Evita o agente varrer/ler o projeto procurando — essa
   busca é o que mais consome.
2. **Um pedido por vez, focado.** Mudanças pequenas e fechadas geram menos
   leitura de arquivos e menos builds.
3. **Não espelhar sem necessidade.** Mexer em um app só (ver regra acima) já
   corta pela metade as operações de arquivo por mudança.

## Build / deploy

- Build pessoal: `pnpm --filter @repo/cars-web build`
- Build comercial: `pnpm --filter numvi-financas build`
- O worker raiz `af4cockpit` (em `wrangler.jsonc`) serve `apps/cars-web/dist` —
  **não renomear** (já quebrou deploy antes).

## Branch de desenvolvimento

- Trabalhar em `claude/numvi-pessoal-changes-YHaEK` salvo instrução em contrário.

## Merge de PRs

- **Merge automático liberado** (decisão de 2026-07-02): ao terminar um PR
  (testes passando + build OK + verificação feita), o agente pode marcar como
  pronto (`draft: false`) e dar squash merge direto no `main`, **sem esperar
  confirmação do usuário**. Não é mais necessário dizer "pode merge".
- Isso não dispensa as outras verificações de segurança de git (nunca dar
  force-push destrutivo sem necessidade, nunca pular hooks, etc.) — só remove
  a espera por aprovação explícita antes do merge em si.

## Histórico de decisões

- `docs/superpowers/specs/2026-06-09-apps-independentes-decisao.md` — decisão de
  manter os dois apps independentes (substitui a ideia de `packages/core`).
