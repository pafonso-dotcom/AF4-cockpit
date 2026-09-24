# Integração bancária — Pluggy (Meu Pluggy · Open Finance)

## Decisão (2026-09-24)
Usar **Meu Pluggy** (gratuito, uso pessoal) via **Conector 200**.
Sem licença BCB, sem contrato, sem mensalidade. Pluggy é regulada pelo
Banco Central. Acesso **somente leitura** (não move dinheiro), consentimento
revogável a qualquer momento no app do banco.

## Setup (fluxo VALIDADO em 2026-09-24)
1. Criar conta no **Meu Pluggy** (meu.pluggy.ai) e conectar os bancos
   (concluir a autorização no app do banco até voltar);
2. Criar conta em **dashboard.pluggy.ai** (mesmo e-mail) — ignorar o aviso
   de trial de 15 dias (não afeta uso pessoal);
3. Criar 1 aplicação → `client_id` / `client_secret`;
4. Secrets no Worker — pelo painel da Cloudflare (worker `af4cockpit` →
   Configurações → **Variáveis e segredos de RUNTIME**, tipo **Segredo** —
   NÃO a "Variáveis e segredos" dentro da caixa Compilação, que é só do
   build) + Implantar; ou por terminal:
   ```bash
   wrangler secret put PLUGGY_CLIENT_ID
   wrangler secret put PLUGGY_CLIENT_SECRET
   wrangler secret put PLUGGY_PIN      # PIN que você escolhe; vai também em Configurações → APIs
   ```
   (`keep_vars: true` no wrangler.jsonc impede os deploys automáticos de
   apagarem variáveis criadas no painel — já aconteceu.)
5. No app: Configurações → APIs → "🏦 Conexão bancária" → colar o PIN → 🧪 Testar;
6. **Conectar o item pelo WIDGET do dashboard** (caminho oficial do
   meu.pluggy.ai/api-guide): dashboard.pluggy.ai → "Conecte um item demo" →
   autorizar **um banco por vez** (cada banco vira um ITEM com ID próprio).
   Copiar o **item ID COMPLETO** (uuid de 36 caracteres — em Dados
   Financeiros → Execuções, clicando na conexão; o código de 8 caracteres
   do widget dá "item not found");
   ⚠️ conectar via `POST /items` direto NÃO funciona: o conector é OAuth e
   o item fica preso em WAITING_USER_INPUT com /accounts vazio.
7. Contas → **🏦 Sincronizar banco** → colar o item ID → **Usar esse item**;
   repetir pra cada banco ("＋ Adicionar conexão"). As conexões ficam salvas
   em `pluggy.itens` (sincronizado). Vincular contas → puxar extrato.
   O Meu Pluggy re-sincroniza com os bancos ~1x/dia (PATCH não força).
   Transações: `GET /v2/transactions` (cursor `next` colado como veio).

## Arquitetura
- `worker/pluggy.js` — proxy server-side (rotas `/api/pluggy/*` em
  `worker/index.js`): o `client_secret` NUNCA vai pro front (PWA/Vite expõe o
  bundle). PIN **obrigatório** no header `x-pluggy-pin`. apiKey da Pluggy
  cacheada ~2h. Credenciais do Meu Pluggy só transitam no conectar (não são
  salvas nem logadas).
- `apps/cars-web/src/lib/pluggy.js` — chamadas + `prepararImportPluggy`
  (**dedup idempotente**: transação já importada é pulada pelo `pluggyId`;
  igual a lançamento manual vira "possível duplicada" desmarcada na prévia).
- `components/modals/SincronizarBancoModal.jsx` — conectar → vincular contas
  (`pluggy.vinculos`) → prévia (CategoriaSelect + categoriaAuto) → confirmar
  (grava `origem:"pluggy"` + ajusta `saldoInicial` pro saldo do banco em BRL).
- Estado sincronizado: `pluggy: { itemId, vinculos, ultimaSync }`.
- **Fonte OPCIONAL**: o app funciona 100% com lançamento manual / CSV-OFX.

## Regras
- Só conectores **Open Finance** (diretos PF estão sendo descontinuados:
  Bradesco PF e Itaú já saíram; XP em seguida) — o conector 200 agrega tudo.
- **Investimentos ficam na fonte atual do Cockpit** (posição via Open Finance
  é mais pobre: sem preço médio/proventos decentes).
- Consentimento expira → o modal detecta (LOGIN_ERROR/OUTDATED) e orienta a
  reconectar no app Meu Pluggy.

## Riscos
- Tier gratuito pode acabar sem aviso → por ser opcional, nada quebra;
- Lote grande: worker corta em 500 transações por sync (o resto vem na próxima).

## Fase 2 (futuro)
- Cartões de crédito (accounts type CREDIT → lançamentos de fatura);
- Sincronização automática ao abrir o app;
- Referência de UX (Optio): detecção de recorrentes/assinaturas, gestão de
  parcelas, projeção 3/6/12m, regras de categorização — o app já tem fixas,
  parcelamentos, projeção 6m e categoriaAuto; ligar isso aos dados Pluggy.
