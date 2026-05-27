# LOTOAI APP PRO · Mobile

App mobile premium para Lotofácil com IA, fechamentos inteligentes, simulações,
modo bolão (com link de compartilhamento) e conferência de bilhetes. Stack:
**Vite + React + Tailwind + Capacitor**, backend **Supabase**, deploy
**Cloudflare Workers**.

## Módulos (6 tabs mobile)

- **Painel** — último sorteio, mapa de frequência, dezenas quentes/frias
- **Gerar** — 3 estratégias (Aleatória / IA Ponderada / Balanceada) + dezenas fixas/excluídas
- **Fechar** — fechamento completo OU matriz reduzida com garantia matemática verificada
- **Bolão** — grupos dividindo apostas e prêmios, com link `#b/<token>` pra compartilhar
- **Conferir** — parser permissivo de bilhetes, lista persistente, score automático
- **Simular** — backtest sobre histórico real (3197 concursos)

## Estrutura

```
apps/lotoai-mobile/
├── capacitor.config.js     · empacotamento iOS/Android
├── index.html
├── data/                   · histórico XLSX + relatórios de análise + matrizes
├── public/                 · manifest + ícone + concursos.json + coverings.json
├── scripts/
│   ├── import-from-caixa.mjs    · backfill incremental do histórico
│   └── analise/                 · pipeline de 6 scripts (padrões, ML, grid, coverings)
├── sql/                    · schema Supabase com RLS
├── src/
│   ├── App.jsx, main.jsx, index.css
│   ├── components/
│   │   ├── Header.jsx          · refresh + branding
│   │   ├── BottomTabBar.jsx    · 6 tabs
│   │   ├── ui/                 · Ball, ErrorBoundary, Splash
│   │   └── pages/              · Dashboard, GerarJogos, Fechamentos, Bolao, Conferencia, Simulacoes
│   └── lib/
│       ├── lotofacil.js        · regras, custos, conferir, faixas estatísticas
│       ├── stats.js            · frequência, atrasos, scores (defaults do grid)
│       ├── generator.js        · estratégias do gerador
│       ├── backtest.js         · simulação de ROI
│       ├── fechamentos.js      · fechamento completo + carregamento de matrizes
│       ├── coverings.js        · greedy set-cover + verificação por enumeração
│       ├── bolao.js            · modelo + CRUD + cálculo de distribuição
│       ├── share.js            · encode/decode base64-url pro link de bolão
│       ├── import.js           · busca incremental no worker proxy
│       └── supabase.js         · client + fallback localStorage
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
- `lf_jogos` · bilhetes do usuário (RLS por `user_id`)
- `lf_simulacoes` · snapshots de backtests (RLS por `user_id`)
- `lf_bolao` · bolões (jogos + participantes + resultado em JSONB; RLS por `user_id`)

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

## Cron · aquecer cache da Caixa

Configurado em `wrangler.lotoai.jsonc`:

```jsonc
"triggers": {
  "crons": ["30 23 * * 1-6"]  // 20:30 BRT seg-sáb, 30min após o sorteio
}
```

O worker invalida e re-aquece `/api/lotofacil/latest` após cada sorteio,
de forma que o primeiro usuário a abrir o app já recebe o resultado novo
sem esperar o roundtrip à Caixa.

## Compartilhar bolão por link

Cada bolão pode ser compartilhado por uma URL do tipo
`https://lotoai-pro.../#b/<base64>`. O bolão inteiro (nome, jogos, participantes,
cotas) é codificado na própria URL — não passa por servidor, funciona offline e
quem recebe não precisa de cadastro. Use o botão Share2 no detalhe do bolão pra
copiar/enviar via WhatsApp/AirDrop. Quem abre o link cai num modo somente-leitura
com botões "Salvar no meu app" ou "Dispensar".

Tamanho do link: ~350 chars pra bolão pequeno, ~6KB pra fechamento de 100 apostas
× 5 pessoas — ambos cabem confortavelmente em URL.

## Próximos passos

- [ ] Autenticação Supabase (gate na entrada)
- [ ] Notificações push para novos sorteios
- [ ] QR code no sheet de compartilhar (passar bolão pessoalmente)
- [ ] Matrizes 14-em-16 publicadas (hoje só temos 12-14 via greedy)
