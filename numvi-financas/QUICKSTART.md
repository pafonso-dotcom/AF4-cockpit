# Aurum Finanças · Quick Start

> App multi-módulo (Finanças · Investimentos · Loja AF4) com tema Poppins · 7 paletas selecionáveis.

## Como abrir no VSCode

1. **Descompactar o zip** numa pasta da sua máquina.
2. **Abrir a pasta no VSCode**: `File → Open Folder → escolher af4-cockpit/`
3. No terminal integrado do VSCode (`` Ctrl+` ``), rodar:

```bash
npm install
npm run dev
```

4. Abrir no navegador: **http://localhost:5173**

Pronto. Sem backend, sem banco — tudo roda no navegador com `localStorage`.

## Estrutura

```
af4-cockpit/
├── src/
│   ├── App.jsx                     # Rota central por módulo
│   ├── lib/
│   │   ├── theme.js                # 7 paletas + applyTheme()
│   │   ├── invest-metrics.js       # Sharpe, drawdown, VaR, beta, alpha
│   │   ├── loja-types.js           # Status de cheques e leads
│   │   ├── lojaCarros.js           # KPIs e mix da loja
│   │   ├── storage.js              # localStorage
│   │   └── ...
│   └── components/
│       ├── Header.jsx              # Nav · 3 módulos + ⚙ Configurações
│       └── pages/
│           ├── Configuracoes.jsx   # 4 abas (Aparência/APIs/Módulos/Backup)
│           ├── Dashboard.jsx       # Finanças · Painel
│           ├── Contas.jsx · Cartoes.jsx · Transacoes.jsx · ...
│           ├── Invest/
│           │   ├── InvestPainel.jsx   # Métricas pro
│           │   ├── Performance.jsx    # vs CDI/IBOV + stress test
│           │   └── Proventos.jsx      # Calendário
│           └── Loja/
│               ├── LojaPainel.jsx     # KPIs comerciais
│               └── NovoVeiculo.jsx    # Cascata Marca→Modelo→Cor
└── package.json
```

## Trocar paleta

No header (canto superior), clique em uma das **7 bolinhas coloridas**:
- 🟡 Gold (padrão) · 🟢 Emerald · 🟣 Violet · 🔵 Cyan · 🌹 Rose · 🟠 Amber · ⚪ Ice

Ou vá em **⚙ Configurações → Aparência** pra ver os cards.

## Os 3 Módulos

| Módulo | Subtabs |
|---|---|
| **Finanças** | Painel · Contas · Cartões · Transações · Calendário · Categorias · Análise IA · Cofre |
| **Investimentos** | Painel · Carteira · Performance · Proventos · Mercado · Simulador |
| **Loja AF4** | Painel · Estoque · Novo Veículo · Vendas · Funil · Cheques · Clientes |

Cada módulo é **isolado** — desligar um (em Configurações → Módulos) não quebra os outros.

## Backup

**⚙ Configurações → Backup → Baixar JSON**: exporta tudo (contas, transações, ativos, veículos, vendas, clientes, cheques, configurações).
Para restaurar: importe o mesmo arquivo no mesmo lugar.

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/` pronta pra publicar em qualquer servidor estático (Vercel, Netlify, GitHub Pages).
