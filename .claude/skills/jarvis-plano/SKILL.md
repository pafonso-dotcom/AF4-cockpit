---
name: jarvis-plano
description: Planejar o dia — define as 3 prioridades principais e grava em Hoje.md no vault do JARVIS. Use quando o usuário disser "planeje o dia", "minhas prioridades são…", "top 3 de hoje" ou pedir para organizar o dia.
---

# JARVIS · Plano do dia

Grave as 3 prioridades do dia em `jarvis/vault/Hoje.md`.

1. Se o usuário já disse as prioridades, use-as (máximo 3, frases curtas começando com verbo).
   Se ele pediu para você propor, derive dos pendentes de `jarvis/vault/Tarefas.md` e do item
   "Amanhã" do diário mais recente em `jarvis/vault/Diario/` — e diga que são uma proposta.
2. Reescreva `jarvis/vault/Hoje.md` mantendo o formato existente: título `# Hoje`, seção
   `## Top 3 prioridades` com itens `- [ ] …`, e preserve a seção `## Notas do dia` e seu conteúdo.
3. Prioridade concluída no decorrer do dia: marque `- [x]` em vez de apagar.
4. Responda em 1–2 frases faladas confirmando as 3 prioridades gravadas. Sem markdown na resposta.
