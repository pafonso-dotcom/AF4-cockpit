# Cronograma — Investimentos como produto (SaaS multi-cliente)

> Objetivo: transformar o **módulo de Investimentos** do AF4 Cockpit num produto
> independente, vendável por assinatura, onde **cada cliente faz login e vê só os
> dados dele**.
> Modelo escolhido: **SaaS multi-cliente** (um app único na nuvem).

---

## Ponto de partida (o que já existe hoje)

✅ **A favor (acelera):**
- Módulo de Investimentos já maduro: ~15 telas (painel, carteira, análises, projeção,
  calculadora, monte sua carteira, proventos, objetivos, mercado, relatórios).
- Já existe **login (Supabase)** com sistema de **permissões por módulo** e sync na nuvem opcional.
- Já roda em infra moderna e barata (Vite + Cloudflare + Supabase).
- Integrações de cotação já prontas (Brapi, CoinGecko, Binance, AlphaVantage) + IA (Claude/Gemini).

⚠️ **Precisa mudar pra poder vender:**
- Hoje os dados ficam **no navegador** (localStorage) → precisa virar **dados na nuvem por cliente**.
- As **chaves de API ficam expostas no navegador** → precisa de um **backend (proxy)** que esconde a sua chave.
- Não há **cobrança/assinatura** nem controle de acesso por plano.
- Investimentos está **acoplado ao módulo Finanças** em alguns pontos (proventos) → precisa desacoplar.
- Falta camada **legal/LGPD** (dado financeiro exige cuidado + disclaimer de "não é recomendação").

---

## Fases do projeto

### Fase 0 — Decisões e fundação · ~1 semana
- Nome do produto, marca, domínio próprio, identidade visual.
- Definir planos e preços (ex.: Grátis/Trial, Pro mensal, Pro anual).
- Criar o projeto separado (novo app/repositório só do Investimentos).
- **Entregável:** documento de decisões + projeto base criado.

### Fase 1 — Extrair o módulo · ~1–2 semanas
- Copiar as telas de Investimentos + bibliotecas (métricas, indicadores, cotações, score) +
  componentes compartilhados (modais, gráficos, tema, formatação).
- **Desacoplar do Finanças** (proventos hoje dependem de contas/transações) → versão autônoma.
- **Entregável:** app de Investimentos rodando sozinho (ainda com dados locais).

### Fase 2 — Login + dados na nuvem por cliente (multi-tenant) · ~2–3 semanas  ⭐ núcleo
- Cadastro self-service (cliente cria a própria conta).
- Modelar o banco (Supabase/Postgres): carteira, ativos, proventos, objetivos, configs.
- **Isolamento de dados por cliente** via RLS (cada um só enxerga o que é dele).
- Migrar persistência: navegador → nuvem (com cache offline).
- **Entregável:** cada cliente loga e vê só os dados dele, salvos na nuvem.

### Fase 3 — Proteger as APIs de mercado/IA · ~1 semana
- Criar **proxy no servidor (Cloudflare Worker)**: o cliente chama o seu backend, que chama
  Brapi/AlphaVantage/Claude com a **sua** chave (escondida), com limite de uso por cliente.
- **Entregável:** cotações e IA funcionando sem o cliente precisar de chave; sua chave protegida.

### Fase 4 — Cobrança e assinatura · ~1–2 semanas
- Integrar gateway de pagamento (Stripe, ou no Brasil Asaas/Pagar.me/Iugu).
- Assinatura recorrente, período de teste, e **liberar/bloquear acesso** conforme pagamento (webhook).
- Tela de planos + checkout.
- **Entregável:** cliente assina, paga e o acesso é controlado pela assinatura.

### Fase 5 — Onboarding, marca e painel de gestão · ~1–2 semanas
- Primeiro acesso guiado (importar carteira, tutorial rápido).
- Marca do produto nas telas e nos relatórios/PDF.
- **Painel admin (pra você):** lista de clientes, status de assinatura, suporte.
- **Entregável:** experiência de cliente novo redonda + painel de controle.

### Fase 6 — Segurança e legal (LGPD) · ~1 semana (em paralelo)
- Política de privacidade, termos de uso, consentimento, exclusão de conta/dados.
- **Disclaimer** "isto não é recomendação de investimento" (evita problema com a CVM).
- Backups, logs e monitoramento de erros.
- **Entregável:** produto em conformidade pra comercializar.

### Fase 7 — Beta, testes e lançamento · ~1–2 semanas
- Beta com 3–5 clientes reais; ajustes de performance e correções.
- Go-live + rotina de suporte.
- **Entregável:** produto no ar, vendendo.

---

## Linha do tempo (resumo)

| Fase | Tema | Duração |
|---|---|---|
| 0 | Decisões e fundação | 1 sem |
| 1 | Extrair o módulo | 1–2 sem |
| 2 | Login + dados na nuvem (multi-tenant) ⭐ | 2–3 sem |
| 3 | Proteger APIs (proxy) | 1 sem |
| 4 | Cobrança/assinatura | 1–2 sem |
| 5 | Onboarding + marca + admin | 1–2 sem |
| 6 | Segurança/LGPD (paralelo) | 1 sem |
| 7 | Beta + lançamento | 1–2 sem |

- **Produto completo (v1):** ~**2,5 a 3,5 meses**.
- **MVP vendável mais cedo:** dá pra lançar uma versão enxuta após a **Fase 4** (~6–8 semanas)
  — login + dados na nuvem + APIs protegidas + cobrança — e ir evoluindo o resto.

---

## Caminho rápido (MVP) — pra vender o quanto antes
Fases **1 → 2 → 3 → 4** (corta onboarding sofisticado, admin e branding pro depois).
Resultado: cliente cria conta, usa o Investimentos com os dados dele na nuvem, paga assinatura.

---

## Custos recorrentes a considerar (estimativa)
- **Supabase** (banco + login): plano gratuito serve pra começar; ~US$25/mês ao crescer.
- **Cloudflare** (hospedagem + proxy): plano gratuito atende bem no início.
- **APIs de mercado:** Brapi/CoinGecko/Binance têm tier grátis; AlphaVantage e IA (Claude)
  **custam por uso e escalam com o nº de clientes** → o proxy com limite por cliente controla isso.
- **Gateway de pagamento:** taxa por transação (~1% + tarifas, varia por gateway).
- **Domínio:** ~R$40/ano.

---

## Riscos / pontos de atenção
- **Custo de IA e cotações** cresce com a base de clientes → planos precisam cobrir isso.
- **Regulatório (CVM):** vender ferramenta de análise é ok; **dar recomendação** não é —
  manter disclaimer e linguagem de "ferramenta/educacional".
- **Suporte:** com vários clientes, reserve tempo pra dúvidas e bugs.
- **Migração de dados:** clientes vão querer importar carteira fácil (já existe importação — reaproveitar).

---

*Documento gerado como planejamento. Nenhum código foi alterado nesta etapa.*
