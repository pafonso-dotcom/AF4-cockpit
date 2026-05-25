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

## Próximos passos

- [ ] Importar histórico oficial da Lotofácil (Caixa / API pública)
- [ ] Tela de fechamentos com matriz de garantia (14 em 16, 13 em 17, etc.)
- [ ] Histórico + conferência de bilhetes
- [ ] Autenticação Supabase (gate na entrada)
- [ ] Notificações push para novos sorteios
