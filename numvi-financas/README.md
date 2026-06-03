# NUMVI Finanças

Produto **standalone** com o módulo financeiro do NUMVI, pensado para
comercialização. Inclui:

- **Finanças**: Painel, Contas, Cartões, Transações, A Receber & Dívidas,
  Despesas Fixas, Planejamento, Categorias, Relatórios, Histórico.
- **IA**: Análise por IA + "Pergunte ao Claude" (usa a chave de API do
  próprio cliente, configurada em Configurações).
- **Agenda**: Calendário, Compromissos, Tarefas, Metas, Compras, Hábitos,
  Diário, Ideias, Sugestões.

Os módulos **Investimentos** e **Negócio** foram removidos da navegação.

## Login / multiusuário

Autenticação e dados por usuário usam **Supabase** (login obrigatório —
fail-closed em produção). Cada usuário tem seu estado isolado por RLS
(tabelas `aurum_state` / `aurum_keys`). Configure no build:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Veja `.env.example`. As migrations do banco estão em `supabase/migrations`
(na raiz do monorepo enquanto este projeto vive aqui).

## Rodar localmente

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # gera dist/
pnpm preview
```

## Extrair para um repositório próprio

Este projeto foi montado dentro do monorepo `af4-cockpit` para reaproveitar
o código e a infra. Quando quiser movê-lo para um repositório próprio,
**preservando o histórico** desta pasta:

```bash
# 1. No monorepo, gere um branch só com o histórico desta pasta:
git subtree split --prefix=numvi-financas -b numvi-financas-export

# 2. Crie o repositório novo vazio no GitHub (ex.: numvi-financas) e:
cd /tmp && git clone <URL_DO_REPO_NOVO> numvi-financas && cd numvi-financas
git pull /caminho/para/af4-cockpit numvi-financas-export
git push origin main

# 3. No repo novo, ajuste o que estava no nível do monorepo:
#    - copie supabase/ (migrations) para a raiz do novo repo
#    - rode `npm install` (as deps já estão listadas no package.json)
```

> Observação: ainda restam arquivos de Investimentos/Negócio no código-fonte
> (em `src/components/pages/Invest`, `Trade`, `Negocio`) que não aparecem na
> navegação, mas continuam no bundle. A limpeza definitiva desses arquivos é
> a próxima etapa antes do lançamento comercial.
