# Guia de ativação — Investimentos (login + nuvem + publicação)

Siga **na ordem**. Ao final, você terá o app no ar, com login, cada cliente
vendo só os dados dele. Tempo total: ~15 min. Não precisa programar.

---

## Parte 1 · Criar o backend no Supabase (grátis)

1. Acesse **https://supabase.com** → entre/crie conta → **New project**.
   - Dê um nome (ex.: `investimentos-prod`), defina uma senha de banco e a região
     (escolha **São Paulo** se disponível). Clique **Create new project** e aguarde ~2 min.
2. No menu lateral, abra **SQL Editor** → **New query**.
3. Abra o arquivo [`sql/001_init.sql`](./sql/001_init.sql) deste projeto, **copie todo o conteúdo**,
   cole no editor e clique **Run**. Deve aparecer "Success". (Isso cria a tabela dos dados
   com o isolamento por cliente.)
4. No menu, vá em **Project Settings → API** e anote:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **Project API keys → anon public** (uma chave longa)

> Opcional: em **Authentication → Providers → Email**, você decide se exige
> confirmação de e-mail no cadastro. Pra testar rápido, pode desligar a confirmação.

---

## Parte 2 · Publicar o app no Cloudflare Pages

1. Cloudflare → **Workers & Pages** → **Create** → aba **Pages** → **Connect to Git**.
2. Selecione o repositório **AF4-cockpit** e a branch **main**.
3. Em **Build settings**:
   - **Framework preset:** None
   - **Build command:** `pnpm install && pnpm --filter @repo/invest-app build`
   - **Build output directory:** `apps/invest-app/dist`
4. Em **Environment variables (Production)**, adicione as duas chaves da Parte 1:
   - `VITE_SUPABASE_URL` = a Project URL
   - `VITE_SUPABASE_ANON_KEY` = a chave anon public
5. **Save and Deploy**. Em ~2 min você recebe uma URL (ex.: `investimentos.pages.dev`).

A partir daí, **toda mudança que subir na `main` republica sozinho** — é só abrir a
URL e dar refresh pra acompanhar a evolução.

---

## Parte 3 · Testar

1. Abra a URL do Pages → deve aparecer a **tela de login**.
2. Clique **Criar conta**, cadastre um e-mail/senha (confirme por e-mail se exigido).
3. Entre → você verá a carteira vazia (dados isolados da sua conta).
4. Crie uma 2ª conta com outro e-mail → confirme que **não enxerga** os dados da 1ª.

Se a tela de login **não** aparecer (entrar direto em "modo local"), as variáveis
de ambiente não foram lidas — revise a Parte 2, passo 4, e refaça o deploy.

---

## Dúvidas comuns
- **"Esqueci de pôr as variáveis"** → adicione em Settings → Environment variables e
  clique em **Retry deployment**.
- **Domínio próprio** (ex.: `app.suamarca.com`) → Cloudflare Pages → Custom domains.
- **Preview antes de publicar** → o Pages cria uma URL de preview por branch
  automaticamente; dá pra revisar antes de mesclar na `main`.

---

## Parte 4 · Chaves de cotação/IA no servidor (Fase 3)

O app tem um **proxy** (`/api/...`) que guarda as chaves no Cloudflare, pra
cotações e IA funcionarem pra todos os clientes **sem expor chave nenhuma**.

No Cloudflare Pages → projeto → **Settings → Environment variables (Production)**,
adicione as que quiser usar (todas opcionais):

| Variável | Pra quê | Onde pegar |
|---|---|---|
| `BRAPI_TOKEN` | Cotações de ações/FIIs **BR** (recomendado) | brapi.dev (cadastro grátis, 1.000 req/mês) |
| `ANTHROPIC_KEY` | IA — "Monte sua carteira" e análises | console.anthropic.com (pago por uso) |
| `ALPHAVANTAGE_KEY` | Ações dos **EUA** | alphavantage.co (chave grátis) |

Depois de adicionar, clique em **Retry deployment** (ou faça um novo push) pra
o proxy passar a usar as chaves. Sem `BRAPI_TOKEN`, as cotações BR caem no modo
simulado; sem `ANTHROPIC_KEY`, os recursos de IA ficam indisponíveis (o resto
do app funciona normalmente).

---

## Parte 5 · Assinatura/cobrança (Fase 4 — estrutura)

A base já está pronta: tabela `subscriptions` (rode `sql/002_subscriptions.sql`
no Supabase), tela de planos (Paywall) e a "trava" de acesso.

A trava começa **desligada** — todo mundo que loga usa o app normalmente.
Pra ativar a cobrança (quando o Mercado Pago estiver configurado):

1. Crie a tabela: SQL Editor → cole `sql/002_subscriptions.sql` → Run.
2. Quando quiser **ligar a trava**, adicione a env var no Cloudflare Pages:
   `VITE_BILLING_ENABLED = true` → aí quem não tiver assinatura ativa vê a tela
   de planos em vez do app.

> Falta ligar (próximo passo, com sua conta Mercado Pago): o **checkout** (criar
> assinatura) e o **webhook** que atualiza o status no `subscriptions`. Eu te
> guio quando você tiver as credenciais do Mercado Pago.
