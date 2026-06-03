# NUMVI · dois ambientes: Pessoal vs Comercial

O mesmo código-fonte (`numvi-financas/`) gera **dois deploys independentes**,
controlados pela variável de build `VITE_NUMVI_VARIANT`:

| Ambiente   | `VITE_NUMVI_VARIANT` | Branding        | Supabase                                   |
|------------|----------------------|-----------------|--------------------------------------------|
| Pessoal    | `pessoal` (default)  | `Numvi·pessoal` | Projeto atual `maqlnsivmreagpkhbkbn` (teus dados) |
| Comercial  | `comercial`          | `Numvi·finanças`| **Projeto novo e separado** (clientes)     |

Segurança: na variante `comercial`, o app **exige** `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` próprios. Sem eles, fica "não configurado"
(fail-closed) — **nunca** cai no banco pessoal por engano.

---

## Ambiente PESSOAL (já existe)

Nada a fazer no código. O deploy atual continua a funcionar como pessoal:
- `VITE_NUMVI_VARIANT` ausente ou `pessoal`.
- Sem `VITE_SUPABASE_*` → usa o Supabase pessoal (`maqln…`) com os teus dados.
- Mostra `Numvi·pessoal`.

> Opcional: para deixar explícito, define `VITE_NUMVI_VARIANT=pessoal` nas
> variáveis de build deste Worker.

---

## Ambiente COMERCIAL (novo) — passos nos painéis

Estes passos são feitos por ti nos dashboards (não dá para automatizar pelo repo):

### 1. Criar o Supabase comercial (banco limpo)
1. Cria um **novo projeto** em https://supabase.com/dashboard (separado do pessoal).
2. Em **SQL Editor**, corre o schema: conteúdo de
   `numvi-financas/sql/numvi_state.sql` (cria as tabelas + RLS por utilizador).
3. Em **Settings → API**, copia o **Project URL** e a **anon key**.
4. (Opcional) Configura o **e-mail/SMTP** e o **Site URL** do Auth para o
   domínio comercial (links de confirmação/reset).

### 2. Criar o Worker comercial no Cloudflare
1. **Workers & Pages → Create → Workers** → conecta o **mesmo repositório**
   (`pafonso-dotcom/AF4-cockpit`), root dir `numvi-financas/`.
2. Dá um nome próprio (ex.: `numvi-financas-comercial`) e o domínio comercial.
3. Build command: `pnpm install && pnpm build` (mesma do pessoal).
4. Em **Settings → Variables (build)**, define:
   ```
   VITE_NUMVI_VARIANT   = comercial
   VITE_SUPABASE_URL     = https://<novo-projeto>.supabase.co
   VITE_SUPABASE_ANON_KEY = <anon key do novo projeto>
   ```
5. Deploy. O app vai mostrar `Numvi·finanças` e apontar para o banco novo.

### 3. (Opcional) Secrets do Worker comercial
Se usares o scanner de recibo / IA via Worker, define os mesmos secrets do
Worker pessoal (ex.: chave da Claude/Gemini) no Worker comercial também.

---

## Resumo

- **Código:** um só, já preparado (branding e Supabase por variável de build).
- **Pessoal:** continua como está, com os teus dados.
- **Comercial:** banco Supabase novo + Worker novo com as 3 variáveis acima.
- Trocar de ambiente é só mudar as variáveis de build — sem fork de código.
