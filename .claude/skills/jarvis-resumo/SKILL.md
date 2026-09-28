---
name: jarvis-resumo
description: Resumo da manhã do JARVIS — lê o vault (tarefas, top 3 de hoje, métricas, diário de ontem) e entrega um briefing falado curto. Use quando o usuário pedir "resumo da manhã", "bom dia", "como está meu dia" ou o briefing diário.
---

# JARVIS · Resumo da manhã

Monte um briefing curto (máximo ~6 frases) em pt-BR, em tom falado — ele será lido em voz alta.

1. Leia `jarvis/vault/Hoje.md` (top 3 prioridades), `jarvis/vault/Tarefas.md` (pendentes),
   `jarvis/vault/Metricas.md` (seção "Atuais") e, se existir, o diário de ontem em `jarvis/vault/Diario/`.
2. Estruture: saudação com a data → top 3 de hoje (se vazio, sugira definir com a skill jarvis-plano) →
   nº de tarefas pendentes e as 2 mais importantes → 1 destaque das métricas → o item "Amanhã" do diário de ontem, se houver.
3. Não invente dados: se um arquivo estiver vazio, diga isso em meia frase e siga em frente.
4. Nada de markdown, listas numeradas ou cabeçalhos na resposta — só frases corridas e naturais.
