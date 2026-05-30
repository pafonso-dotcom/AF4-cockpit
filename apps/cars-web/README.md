# Aurum Finanças

Sistema completo de finanças pessoais + gestão da Loja AF4.
Construído em React + Vite + Tailwind. 100% local (localStorage), sem servidor, sem custo recorrente.

## Como rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:5173

## Build de produção

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
  App.jsx              ← orquestrador, estado global, persistência
  main.jsx             ← entry point com ErrorBoundary
  lib/
    theme.js           ← objeto T mutável + 6 temas
    storage.js         ← localStorage wrapper
    format.js          ← fmt(), uid(), simulateTick()
    api.js             ← Brapi, CoinGecko, Anthropic
    importExport.js    ← OFX, CSV, XLSX, PDF
    backup.js          ← exportBackup, importBackup (JSON)
    recorrencia.js     ← gera fixas pendentes automaticamente
    toast.js           ← toast com Desfazer
    confirm.js         ← diálogo de confirmação
    validation.js      ← schemas de form
    lojaCarros.js      ← KPIs, status, mix ideal
    intelligence.js    ← score, cashflow, assinaturas, insights
  components/
    Header.jsx                   ← nav, toggle PF/Loja
    ui/                          ← Modal, Field, StatCard, Toast, Confirm...
    modals/                      ← Settings, ImportExport, ThemePicker
    pages/
      Dashboard.jsx              ← Visão Geral + Score + Cashflow + Insights
      Contas.jsx
      Cartoes.jsx                ← com Pagar Fatura
      Transacoes.jsx             ← com Anexo de comprovante
      Calendario.jsx             ← projeções de fixas
      Categorias.jsx
      AnaliseFatura.jsx          ← IA da fatura (Anthropic)
      Investimentos.jsx          ← responsivo
      Analise.jsx
      Mercado.jsx
      Simulador.jsx
      Cofre.jsx                  ← Metas + Cofrinho + Devedores + Dívidas
      Loja.jsx                   ← Estoque + Vendas + Clientes + KPIs
```

## Funcionalidades

### Finanças pessoais
- Contas, Cartões, Transações, Categorias, Metas
- Recorrência automática de despesas fixas
- Pagamento de fatura em 1 clique (debita conta + marca parcelas)
- Anexo de comprovante (foto/PDF até 500 KB) em transações
- Análise de fatura com IA (Claude)
- Investimentos com cotação real (Brapi/CoinGecko)
- Backup/Restore JSON, importação OFX/CSV, exportação XLSX/PDF

### Inteligência (Dashboard)
- **Score Financeiro Comportamental** (0-1000) com 6 componentes
- **Cashflow Preditivo** projeção 3 meses
- **Insights Automáticos** (gastos elevados, reserva insuficiente, etc)
- **Detecção de Assinaturas** recorrentes com valor anualizado

### Loja AF4
- **Painel** com KPIs (estoque, vendas, margem, giro) + alertas de estoque parado
- **Estoque** de veículos (marca/modelo/ano/placa/cor/categoria/status)
- **Vendas** com cliente, financiamento (Pan/Santander/BV/Bradesco/etc), margem em tempo real
- **Clientes** com histórico de compras
- **Mix Ideal** do estoque (Hatch 40% · SUV 35% · Sedan 15% · Picape 10%)

### Atalhos
- `?` mostra a lista de atalhos
- `Cmd+K` / `Ctrl+K` busca rápida
- `1-9` pula direto pra cada aba

## Sobre os dados

Tudo é salvo em `localStorage` do navegador. Para mover entre dispositivos:
1. Vai em Configurações → Baixar backup → salva o `.json`
2. Abre no outro dispositivo → Configurações → Restaurar do arquivo

Sem servidor. Sem custo recorrente. Sem assinatura.
