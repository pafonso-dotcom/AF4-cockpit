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

> Próximas fases (quando voltar a desenvolver): **Fase 3** esconde as chaves de
> cotação/IA num proxy no servidor; **Fase 4** adiciona cobrança/assinatura.
