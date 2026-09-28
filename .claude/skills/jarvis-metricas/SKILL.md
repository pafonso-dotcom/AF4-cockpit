---
name: jarvis-metricas
description: Registrar ou consultar métricas no vault do JARVIS (Metricas.md) — patrimônio, aportes, seguidores, o que o usuário acompanhar. Use quando ele disser "registre a métrica…", "puxe as métricas", "como estão meus números".
---

# JARVIS · Métricas

Arquivo: `jarvis/vault/Metricas.md` — seção `## Atuais` (linhas `- Nome: valor`, que o HUD exibe)
e seção `## Histórico` (tabela `| Data | Métrica | Valor |`).

**Registrar** ("registre X = Y"):
1. Atualize (ou crie) a linha correspondente em `## Atuais`. Nomes em português, valores como o usuário disse
   (com R$, %, etc. quando fizer sentido).
2. Acrescente uma linha na tabela `## Histórico` com a data de hoje (AAAA-MM-DD).
3. Confirme em 1 frase falada.

**Consultar** ("como estão meus números"):
1. Leia `## Atuais` e responda em frases corridas (máximo 5), destacando variações relevantes
   comparando com o `## Histórico` quando existir registro anterior.

Nunca invente valores; se a métrica não existe, diga isso e pergunte se deve criá-la. Sem markdown na resposta.
