# Investimentos — app standalone (SaaS multi-cliente)

App de Investimentos extraído do AF4 Cockpit, em preparação para comercialização.

## Rodar local (modo dev, sem login)
Sem credenciais Supabase, o app roda 100% local (dados no navegador):

```bash
pnpm install
pnpm --filter @repo/invest-app dev
```

## Ativar multi-cliente (login + nuvem) — Fase 2

1. **Crie um projeto no Supabase** (gratuito): https://supabase.com → New project.
2. **Rode o SQL** do esquema: no painel do Supabase → *SQL Editor* → cole o conteúdo de
   [`sql/001_init.sql`](./sql/001_init.sql) → *Run*. Isso cria a tabela `invest_state`
   com **RLS** (cada cliente só acessa os próprios dados).
3. **Pegue as credenciais**: Supabase → *Project Settings → API*:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
4. **Configure**: copie `.env.example` para `.env` e preencha as duas variáveis
   (ou defina-as nas *Build variables* do seu provedor de deploy).
5. (Opcional) Em *Authentication → Providers → Email*, ajuste se quer exigir
   confirmação de e-mail no cadastro.

Com isso, ao abrir o app aparece a **tela de login/cadastro**; cada cliente cria a
conta e vê só a carteira dele, salva na nuvem (com cache local offline).

## Próximas fases
- **Fase 3:** proxy de cotações/IA no servidor (esconder chaves de API).
- **Fase 4:** cobrança/assinatura.

> Build: `pnpm --filter @repo/invest-app build` · Testes: `pnpm --filter @repo/invest-app test:once`
