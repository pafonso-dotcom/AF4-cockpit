# Decisão · Manter os dois apps independentes

**Data:** 2026-06-09
**Status:** Decidido
**Substitui:** `2026-06-09-lib-compartilhada-design.md` (abordagem de `packages/core`
descartada)

## Contexto

O monorepo tem dois apps quase idênticos no código comum:

- `apps/cars-web` — pessoal (worker `af4cockpit`)
- `numvi-financas` — comercial (worker `numvi-financas`), destinado a venda

Cogitou-se extrair a lógica comum (`lib/`) para um pacote compartilhado
(`packages/core`) para corrigir bugs uma vez só. Ver o design original (agora
superado) em `2026-06-09-lib-compartilhada-design.md`.

## Decisão

**Tratar os dois apps como projetos totalmente independentes.** Sem código
compartilhado. Cada app permanece autossuficiente (já é o caso hoje — são duas
pastas com cópias completas).

Motivo: o comercial será vendido e mantido para clientes; a prioridade é poder
mexer em um app **sem nunca arriscar quebrar o outro**, mesmo aceitando corrigir
bugs comuns duas vezes.

Estrutura: **mesmo repositório**, dois apps separados. Sem migração, sem split de
repo (split traria risco de deploy, que já ocorreu antes com renomeação).

## Consequências práticas (regra de trabalho)

1. Toda alteração mira **um app por vez**; na dúvida, perguntar qual.
2. **Nunca espelhar** automaticamente uma mudança no outro app — só com pedido
   explícito do usuário.
3. A regra está registrada em `CLAUDE.md` na raiz para valer em sessões futuras.

## Não fazer

- Não criar `packages/core` nem alias `@core`.
- Não renomear o worker `af4cockpit`.
