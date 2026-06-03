# NUMVI · dois ambientes: Pessoal vs Comercial

O mesmo código-fonte (`numvi-financas/`) gera **dois deploys independentes**,
controlados pela variável de build `VITE_NUMVI_VARIANT`.

Por agora, **pessoal e comercial partilham o mesmo projeto Supabase**
(o plano grátis limita a 2 projetos por conta). A separação dos dados é feita
por **tabelas distintas + RLS por usuário** — o app comercial só lê/grava nas
tabelas `numvi_com_*`, nunca enxerga os dados pessoais (`numvi_*`).

| Ambiente   | `VITE_NUMVI_VARIANT` | Branding        | Tabelas                         |
|------------|----------------------|-----------------|---------------------------------|
| Pessoal    | `pessoal` (default)  | `Numvi·pessoal` | `numvi_state` / `numvi_keys`     |
| Comercial  | `comercial`          | `Numvi·finanças`| `numvi_com_state` / `numvi_com_keys` |

---

## Ambiente PESSOAL (já existe)
Nada a fazer. Deploy atual continua: variante `pessoal`, tabelas `numvi_state`.

## Ambiente COMERCIAL — passos

### 1. Criar as tabelas comerciais (1x, no projeto pessoal atual)
No Supabase do projeto pessoal (`maqln…`): **SQL Editor → New query** → cola o
conteúdo de `numvi-financas/sql/numvi_com_state.sql` → **Run**. Cria
`numvi_com_state` / `numvi_com_keys` com RLS por usuário.

### 2. Criar o Worker comercial no Cloudflare
1. **Workers & Pages → Create → Workers** → conecta o **mesmo repositório**
   (`pafonso-dotcom/AF4-cockpit`), root dir `numvi-financas/`.
2. Nome próprio (ex.: `numvi-financas-comercial`) + domínio comercial.
3. Build command: `pnpm install && pnpm build`.
4. Em **Settings → Variables (build)**, define só:
   ```
   VITE_NUMVI_VARIANT = comercial
   ```
   (Não precisa de `VITE_SUPABASE_*` — partilha o projeto pessoal por agora.)
5. Deploy → o app mostra `Numvi·finanças` e usa as tabelas `numvi_com_*`.

---

## Migrar para projeto dedicado (quando tiver clientes → upgrade Pro)
1. Criar projeto Supabase novo e correr `numvi-financas/sql/numvi_com_state.sql`
   (ou `numvi_state.sql`) nele.
2. No Worker comercial, definir `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
   do projeto novo. Redeploy. Os nomes de tabela continuam iguais.
3. (Opcional) Migrar os dados dos clientes do projeto partilhado para o novo.

---

## Notas
- **Auth/login**: como partilham o projeto, uma conta criada no comercial
  também existe no pessoal (mesmo Auth). Os DADOS é que ficam separados por
  tabela. Ao migrar para projeto dedicado, o Auth passa a ser independente.
- **Backups** (`af4_backups`) ficam partilhados, mas isolados por usuário (RLS).
