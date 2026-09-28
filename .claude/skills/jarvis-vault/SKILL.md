---
name: jarvis-vault
description: Ler e gravar a memória de longo prazo do JARVIS (vault markdown) — fatos, decisões, reflexões do diário, tarefas. Use quando o usuário disser "lembre que…", "anote…", "o que você sabe sobre…", "registre a reflexão do dia", "adicione a tarefa…".
---

# JARVIS · Vault (memória)

O cofre é a pasta `jarvis/vault/`:

- `Memoria.md` — fatos e decisões de longo prazo, por seção temática (uma linha por fato).
- `Tarefas.md` — `## Pendentes` e `## Concluídas` (itens `- [ ]` / `- [x]`).
- `Diario/AAAA-MM-DD.md` — um por dia, seções `## Reflexão` e `## Amanhã`.
- `Hoje.md` e `Metricas.md` têm skills próprias (jarvis-plano, jarvis-metricas).

**Gravar** ("lembre que…", "anote…"): acrescente uma linha curta na seção certa de `Memoria.md`
(crie a seção se precisar). Decisões vão em `## Decisões` com a data.

**Tarefa** ("adicione a tarefa…", "conclui X"): edite `Tarefas.md`; concluir = mover para
`## Concluídas` com `- [x]` e a data.

**Reflexão do dia** ("encerre o dia", "registre a reflexão"): crie/edite o arquivo de hoje em
`Diario/` com o que o usuário contou; pergunte (ou infira do contexto) 1 item para `## Amanhã`.

**Consultar** ("o que você sabe sobre…"): procure no vault inteiro (grep) e responda em frases corridas.

Sempre confirme o que gravou em 1 frase falada, sem markdown.
