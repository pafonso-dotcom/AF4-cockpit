# Deploy automático de migrações no Supabase

Migrações SQL em `supabase/migrations/*.sql` são aplicadas no banco Supabase **automaticamente** via GitHub Actions sempre que houver push pra main.

## Setup inicial (1x)

### 1. Personal Access Token do Supabase

1. Vai em https://supabase.com/dashboard/account/tokens
2. Clica em **"Generate new token"**
3. Nome: `AF4 Cockpit · GitHub Actions`
4. Copia o token (mostrado uma vez só!)

### 2. Senha do banco Postgres

1. Vai em https://supabase.com/dashboard/project/rffxplwshwfjnedefvqg/settings/database
2. Em **"Database Password"** copia a senha (se não souber, **"Reset database password"** — gera uma nova)

### 3. Adicionar como secrets no GitHub

1. Vai em https://github.com/pafonso-dotcom/AF4-cockpit/settings/secrets/actions
2. Clica em **"New repository secret"** pra cada um:

| Nome | Valor |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token do passo 1 (formato: `sbp_xxxxx...`) |
| `SUPABASE_DB_PASSWORD` | Senha do passo 2 |

Pronto. Toda alteração em `supabase/migrations/*.sql` em main vai aplicar automaticamente.

---

## Como funciona

### Auto-deploy (push pra main)

Quando você faz push de uma alteração em:
- `supabase/migrations/*.sql`
- `supabase/config.toml`
- `.github/workflows/db-migrate.yml`

O workflow **`Supabase DB Migrate`** roda automaticamente:
1. Instala a Supabase CLI
2. Valida secrets
3. Link com o projeto remoto via PAT
4. Mostra diff (sempre)
5. Aplica migrações pendentes via `supabase db push`

### Dry-run manual

Pra testar uma migração sem aplicar:

1. Vai em https://github.com/pafonso-dotcom/AF4-cockpit/actions/workflows/db-migrate.yml
2. Clica em **"Run workflow"** → seleciona branch + marca **"Dry run"**
3. Workflow só mostra o diff, sem aplicar

---

## Como adicionar uma nova migração

1. Cria arquivo em `supabase/migrations/`
   - Formato do nome: `YYYYMMDDHHMMSS_descricao.sql`
   - Ex.: `20260601100000_add_index_transacoes.sql`
2. Escreve SQL idempotente (use `IF NOT EXISTS`, `DROP IF EXISTS`, etc.)
3. Testa local com `supabase db reset` (se rodar o stack local)
4. Commit + push pra main
5. Workflow aplica automaticamente
6. Confere no Supabase dashboard que rodou OK

### Convenções de naming

```
20260525000000_initial_schema.sql        ← criação inicial
20260601100000_add_index_transacoes.sql  ← adicionar índice
20260615120000_rename_column_x.sql       ← rename
20260620090000_data_seed_categorias.sql  ← seed de dados
```

### Princípios pra migração segura

- **Idempotência**: a migração deve poder rodar 2x sem quebrar (use `IF NOT EXISTS`)
- **Forward-only**: não tem rollback automático — sempre crie uma nova migração pra reverter
- **Pequena e focada**: 1 migração = 1 mudança lógica (não junte CREATE TABLE + ALTER + INSERT)
- **Cuidado com `DROP`**: se for dropar coluna/tabela, separa em PR próprio com revisão extra

---

## Troubleshooting

### `SUPABASE_ACCESS_TOKEN não está configurado`
→ Adiciona o secret no GitHub (ver setup acima)

### `Permission denied for relation auth.users`
→ Algumas tabelas do schema `auth` precisam de service role pra acessar. Use SECURITY DEFINER em funções ou ajuste RLS.

### `relation already exists`
→ Sua migração não está idempotente. Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc.

### Workflow não disparou após push
→ Verifica se o arquivo está em `supabase/migrations/` (com S) e termina com `.sql`. O `paths:` no workflow é case-sensitive.

### Quero rollback de uma migração
→ Não tem rollback automático. Crie uma nova migração que reverte (`DROP TABLE X CASCADE`, etc.).

---

## Aplicar a primeira vez (bootstrap)

Como o projeto Supabase já existe (com `aurum_state` legado), a primeira migração `20260525000000_initial_schema.sql`:

- **Não conflita** com `aurum_state` (cria 27 tabelas novas paralelamente)
- **Não destrói nada** existente
- É 100% idempotente (`IF NOT EXISTS` em tudo)

Pra rodar:
1. Setup dos secrets (passos 1-3 acima)
2. Faz push da branch com `supabase/migrations/` pra main
3. Workflow roda, aplica o SQL, mostra "✓ Migração concluída"
4. No app: Configurações → Backup → "Migração de dados" mostra ✓ verde

Depois disso, qualquer mudança de schema vira: novo arquivo em `supabase/migrations/` → push → automático.
