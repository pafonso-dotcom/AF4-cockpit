# LOTOAI APP PRO · Mobile

App mobile premium para Lotofácil com IA, fechamentos inteligentes, simulações
e geração automática de jogos. Stack: **Vite + React + Tailwind + Capacitor**,
backend **Supabase**.

## Estrutura

```
apps/lotoai-mobile/
├── capacitor.config.js     · empacotamento iOS/Android
├── index.html
├── public/                 · manifest + ícone PWA
├── sql/                    · schema Supabase (Lotofácil + jogos + simulações)
├── src/
│   ├── App.jsx             · shell + tab navigation
│   ├── main.jsx
│   ├── index.css           · Tailwind + tokens (ink/panel/gold/accent)
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── BottomTabBar.jsx
│   │   ├── ui/
│   │   │   ├── Ball.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx     · último sorteio + frequência + quentes/frias
│   │       ├── GerarJogos.jsx    · gerador c/ estratégias, fixos e excluídos
│   │       └── Simulacoes.jsx    · backtest sobre histórico
│   └── lib/
│       ├── lotofacil.js          · regras, custos, validação, análise de jogo
│       ├── stats.js              · frequência, atrasos, quentes/frias, scores
│       ├── generator.js          · estratégias (aleatório, ponderado, balanceado)
│       ├── backtest.js           · simulação de ROI sobre histórico
│       └── supabase.js           · client + fallback localStorage
```

## Como rodar

```bash
# da raiz do monorepo
pnpm install
pnpm --filter @repo/lotoai-mobile dev      # http://localhost:5173
pnpm --filter @repo/lotoai-mobile build
pnpm --filter @repo/lotoai-mobile start    # serve em PORT (default 3010)
```

### Variáveis de ambiente

Crie `apps/lotoai-mobile/.env.local`:

```
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Sem env vars, o app sobe em **modo local** (concursos mock + persistência em
`localStorage`).

### Empacotar como app nativo (Capacitor)

```bash
pnpm --filter @repo/lotoai-mobile add -D @capacitor/core @capacitor/cli
pnpm --filter @repo/lotoai-mobile add @capacitor/ios @capacitor/android

pnpm --filter @repo/lotoai-mobile build
cd apps/lotoai-mobile
npx cap add ios && npx cap add android
npx cap sync
npx cap open ios       # Xcode
npx cap open android   # Android Studio
```

## Banco de dados

Rode `sql/0001_lotoai_schema.sql` no SQL editor do Supabase para criar:

- `lf_concursos` · histórico oficial (público / read-only)
- `lf_jogos` · jogos gerados pelo usuário (RLS por `user_id`)
- `lf_simulacoes` · snapshots de backtests (RLS por `user_id`)

## Deploy (Cloudflare Workers)

Worker dedicado, configurado em `wrangler.lotoai.jsonc` na raiz do repo.
Reutiliza `worker/index.js` (mesmo binário do af4cockpit) — só muda o
`assets.directory` para `apps/lotoai-mobile/dist`.

```bash
# da raiz do monorepo (precisa estar logado: pnpm dlx wrangler login)
pnpm deploy:lotoai          # build + deploy
pnpm deploy:lotoai:dry      # build + dry-run (mostra o bundle sem publicar)

# atalho a partir do app
pnpm --filter @repo/lotoai-mobile deploy
```

Primeiro deploy fica em `https://lotoai-pro.<seu-subdomínio>.workers.dev`.
Para domínio próprio: painel Cloudflare → Workers → lotoai-pro → Settings
→ Triggers → Routes.

Endpoints servidos pelo worker no mesmo domínio do app:
- `GET /api/ping` — health check
- `GET /api/lotofacil/latest` — último concurso (cache 10min)
- `GET /api/lotofacil/{numero}` — concurso específico (cache 24h)
- `GET /*` — SPA estática com fallback para `index.html`

## Importar concursos novos

### Em produção (browser/app)

Botão "🔄 Atualizar" no Header chama `/api/lotofacil/latest` no worker
(`worker/index.js`), que faz proxy pra Caixa com cache na edge (10min) e
CORS. Salva incremental em `localStorage` + upsert em Supabase (se
configurado).

### Backfill local (atualizar `data/concursos.json` no repo)

```bash
cd apps/lotoai-mobile
node scripts/import-from-caixa.mjs --dry-run        # ver o que faria
node scripts/import-from-caixa.mjs --max=50         # importa até 50 novos
```

Fontes tentadas em ordem: Caixa oficial → mirror público. Idempotente
(dedupe por número). Atualiza tanto `data/concursos.json` quanto
`public/concursos.json` (que vai no bundle do app).

## Próximos passos

- [ ] Tela de fechamentos com matriz de garantia 14-em-16 publicada (já temos 12-14 via greedy)
- [ ] Autenticação Supabase (gate na entrada)
- [ ] Notificações push para novos sorteios
- [ ] Cron no worker para importar automaticamente todas as segundas/quartas/sextas
