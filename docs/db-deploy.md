# Deploy automático de migrações no Supabase

Migrações SQL em `supabase/migrations/*.sql` são aplicadas no banco Supabase **automaticamente** via GitHub Actions sempre que houver push pra main.

Usa `psql` direto (sem `supabase` CLI) — evita problemas de permissão de PAT.

## Setup inicial (1x, ~2 minutos)

### 1. Pega a Connection String do Supabase

⚠️ **Importante**: o Supabase oferece DUAS connection strings. GitHub Actions só funciona com a **Session pooler** (porque runners não têm IPv6).

1. Vai em https://supabase.com/dashboard/project/maqlnsivmreagpkhbkbn/settings/database
2. Em **"Connection string"** clica na aba **"Session"** (NÃO "Transaction", NÃO "Direct")
3. O formato correto deve ser:
   ```
   postgresql://postgres.maqlnsivmreagpkhbkbn:[YOUR-PASSWORD]@aws-1-us-west-1.pooler.supabase.com:5432/postgres
   ```
   - Host: `aws-0-REGION.pooler.supabase.com` (Session pooler — IPv4 OK)
   - Porta: `5432` (session mode — suporta DDL)
   - User: `postgres.PROJECT_REF` (note o ponto entre `postgres` e o ref)

❌ **NÃO use** "Direct Connection" — host `db.X.supabase.co` — só responde IPv6, runners GitHub Actions são IPv4-only.

❌ **NÃO use** "Transaction pooler" (porta 6543) — não suporta DDL (`CREATE TABLE`).

4. A senha aparece como `[YOUR-PASSWORD]` no template — substitua pela senha real (sem colchetes). Se a senha tem `@`, `:`, `#`, `?`, `/`, faz URL-encode (`@` vira `%40`, etc.)

### 2. Adiciona como secret no GitHub

1. Vai em https://github.com/pafonso-dotcom/AF4-cockpit/settings/secrets/actions
2. Clica em **"New repository secret"**:

| Nome | Valor |
|---|---|
| `SUPABASE_DB_URL` | A connection string completa do passo 1 |

Pronto. Toda alteração em `supabase/migrations/*.sql` em main vai aplicar automaticamente.

---

## Como funciona

### Tracking de migrations aplicadas

Na primeira execução, o workflow cria uma tabela `public._supabase_migrations`:

```sql
CREATE TABLE public._supabase_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Em cada run, o workflow:
1. Lista arquivos `supabase/migrations/*.sql` ordenados por nome
2. Pra cada um, checa se já tem entry na tabela
3. Se NÃO tem: aplica via `psql -f` e insere na tabela
4. Se já tem: pula

Resultado: você pode rodar quantas vezes quiser, só aplica o que falta.

### Auto-deploy (push pra main)

Quando você faz push de alteração em:
- `supabase/migrations/*.sql`
- `.github/workflows/db-migrate.yml`

O workflow **`Supabase DB Migrate`** roda automático e:
1. Instala `psql` (postgresql-client)
2. Valida secret
3. Testa conexão (`SELECT version();`)
4. Cria tabela de tracking (idempotente)
5. Lista migrations pendentes
6. Aplica pendentes em ordem alfabética
7. Registra cada aplicação na tabela

### Dry-run manual

Pra ver o que SERIA aplicado sem aplicar:

1. Vai em https://github.com/pafonso-dotcom/AF4-cockpit/actions/workflows/db-migrate.yml
2. Clica em **"Run workflow"** → seleciona branch → marca **"Dry run"**
3. Workflow lista pendentes sem aplicar

---

## Como adicionar uma nova migração

1. Cria arquivo em `supabase/migrations/`
   - Formato do nome: `YYYYMMDDHHMMSS_descricao.sql`
   - Ex.: `20260601100000_add_index_transacoes.sql`
2. Escreve SQL **idempotente** (use `IF NOT EXISTS`, `DROP IF EXISTS`, etc.)
3. Commit + push pra main
4. Workflow aplica automaticamente
5. Confere no Actions tab que rodou OK + linha apareceu em `_supabase_migrations`

### Convenções de naming

```
20260525000000_initial_schema.sql        ← criação inicial
20260601100000_add_index_transacoes.sql  ← adicionar índice
20260615120000_rename_column_x.sql       ← rename
20260620090000_data_seed_categorias.sql  ← seed de dados
```

### Princípios pra migração segura

- **Idempotência**: a migração deve poder rodar 2x sem quebrar (use `IF NOT EXISTS`, mesmo que o tracking já evite — defesa em profundidade)
- **Forward-only**: não tem rollback automático — sempre crie uma nova migração pra reverter
- **Pequena e focada**: 1 migração = 1 mudança lógica
- **Cuidado com `DROP`**: separa em PR próprio com revisão extra

---

## Troubleshooting

### `SUPABASE_DB_URL não está configurado`
→ Adiciona o secret no GitHub (ver setup acima)

### `connection to server on socket "/var/run/postgresql/..."` ou Network unreachable
→ Você provavelmente copiou a "Direct Connection" (`db.X.supabase.co`) que só responde IPv6. GitHub runners são IPv4-only. **Troca pela Session pooler** (host `aws-0-REGION.pooler.supabase.com:5432`).

### `password authentication failed`
→ Senha errada na URI. Vai em Database settings, reseta a senha do DB, pega a nova URI

### `relation X already exists` (mesmo com IF NOT EXISTS)
→ Algum CREATE TYPE pode não ser idempotente. Usa o pattern:
```sql
DO $$ BEGIN
  CREATE TYPE meu_enum AS ENUM (...);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### Quero re-aplicar uma migration (forçar)
→ Deleta a entry da tabela: `DELETE FROM public._supabase_migrations WHERE name='YYYY...';`

### Quero rollback
→ Não tem automático. Cria nova migration `YYYY..._rollback_X.sql` com os DROP/ALTER reverso, deixa rodar pelo workflow.

---

## Status atual da migração inicial

`20260525000000_initial_schema.sql` cria 27 tabelas + ENUMs + RLS + triggers + seed dos modelos IdV. Convive com `aurum_state` legado sem conflito.

Pra rodar:
1. Setup do secret (passos acima)
2. Faz push da branch com `supabase/migrations/` pra main (ou re-roda manualmente em Actions tab)
3. Workflow aplica automaticamente
4. No app: Configurações → Backup → "Migração de dados" mostra ✓ verde + contagens zeradas
5. Pronto pra rodar dry-run + migração real dos dados

Depois disso, qualquer mudança de schema vira: novo arquivo em `supabase/migrations/` → push → automático.
