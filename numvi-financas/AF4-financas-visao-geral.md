# AF4 finanças — Visão geral do projeto

> Documento gerado a partir do código (não de memória). Descreve tudo que o
> produto **AF4 finanças** tem hoje: módulos, telas, recursos, backend e stack.

---

## 1. O que é

App de **gestão financeira pessoal** (PWA — instala no celular/desktop como
app). Cada usuário tem sua conta, seus dados isolados e sincronizados na nuvem.
Foco no **módulo Finanças + Agenda**. Funciona offline (dados locais) e
sincroniza quando online.

- **Marca:** AF4 finanças
- **Tipo:** SPA React, instalável como PWA
- **Multiusuário:** login obrigatório, dados isolados por usuário
- **Offline-first:** roda em localStorage e espelha no Supabase

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Front-end | React 18 + Vite |
| Gráficos | Recharts |
| Ícones | lucide-react |
| Import planilhas | papaparse (CSV) · xlsx (Excel) |
| Auth + Sync nuvem | Supabase (Postgres + RLS) |
| Backend/API | Cloudflare Worker |
| IA | Claude (chat, OCR de recibo/fatura) + Gemini |
| PWA | manifest + service worker (instalável, offline) |

**Endpoints do Worker:**
- `/api/ping` — healthcheck
- `/api/recibo` — OCR de comprovante por foto (Claude Vision)
- `/api/ai-chat` — chat financeiro com o Claude
- `/api/gemini` — chamadas Gemini
- `/api/usuarios` — lista de usuários (painel do gestor, via service role)
- `/api/indices` — índices de mercado (cotações)

---

## 3. Acesso & multiusuário

- **Login/Cadastro/Recuperar senha** (Supabase Auth).
- **Isolamento por usuário:** cada conta só lê/escreve as próprias linhas
  (tabelas `numvi_com_state` / `numvi_com_keys` + RLS por `user_id`).
- **Perfis de permissão:** módulos podem ser ligados/desligados por perfil.
- **Gestor (admin):** painel gerencial visível só pro gestor (clientes não veem).
- **Primeiro acesso:** começa limpo (sem dados fake) + categorias padrão +
  card de boas-vindas com CTA pra criar a primeira conta.

---

## 4. Módulo FINANÇAS — telas

| Tela | O que faz |
|---|---|
| **Painel (Dashboard)** | Visão geral: patrimônio, total em contas, receitas/despesas do mês, evolução do patrimônio, contas, gastos por categoria (donut), a receber, projeção dos próximos meses, insights da IA. |
| **Contas** | Cadastro de contas (banco/carteira), saldos, saldo inicial. |
| **Extrato da conta** | Extrato estilo banco: saldo do dia, conferência com o banco, ordem valor·saldo, observação na linha. |
| **Cartões** | Cartões de crédito, faturas, compras parceladas (com progresso de parcelas pagas). |
| **Extrato do cartão** | Lançamentos e fatura por cartão. |
| **Análise de Fatura** | Importa/analisa fatura do cartão (com IA), classifica e lança. |
| **Transações** | Lista de lançamentos com filtros, busca, seleção em massa (recategorizar, mover de conta, excluir), comprovante anexado, marcação pago/pendente. |
| **A Receber & Dívidas** | Recebíveis (quem te deve) e dívidas (o que você deve), com baixas e situação (em dia/atrasado/pago). |
| **Despesas Fixas** | Contas recorrentes (luz, água, aluguel…), vencimento, marcar como paga, ocorrências mês a mês. |
| **Planejamento** | Hub com várias visões: Resumo executivo, A pagar/receber, Despesas, Parcelas, Recebíveis, Previsão, Reserva de emergência, Atenção, Controle anual. |
| **Categorias** | Gerencia categorias/subcategorias, cores e limites por categoria. |
| **Análise IA** | Análise inteligente das finanças. |
| **Pergunte ao Claude** | Chat: pergunta sobre suas finanças e recebe respostas com base nos seus dados. |
| **Relatórios** | Receita×Despesa (6 meses), Top categorias do mês, sobra mensal, tendências por categoria — com export PDF/CSV. |
| **Histórico (Auditoria)** | Log de alterações (o que mudou, quando). |

---

## 5. Módulo AGENDA (incorporado)

| Tela | O que faz |
|---|---|
| **Agenda · Início** | Resumo do dia (top 3, compromissos). |
| **Calendário** | Visão mensal/semana/dia de compromissos e vencimentos. |
| **Compromissos** | Eventos/lembretes. |
| **Tarefas** | Lista de tarefas. |
| **Metas** | Metas (financeiras e pessoais). |
| **Compras** | Lista de compras. |
| **Hábitos** | Acompanhamento de hábitos. |
| **Diário** | Anotações diárias. |
| **Ideias** | Captura de ideias. |
| **Sugestões** | Sugestões de melhoria do app. |

---

## 6. Recursos transversais

**Lançar transações de vários jeitos:**
- Manual (modal de nova transação)
- **Por voz** (ditar a transação)
- **Por foto** (OCR de comprovante via Claude)
- **Importar extrato** (CSV/Excel/colar texto) com parser
- **Importar fatura** do cartão

**Inteligência (IA):**
- Chat "Pergunte ao Claude" sobre suas finanças
- Análise IA / insights no painel
- OCR de recibo e de fatura
- Alertas e sugestões automáticas

**Sincronização & backup:**
- Sync na nuvem (Supabase) por usuário
- **Backup automático** local
- Backup/restauração por **texto compartilhável** (prefixo `AF4SYNCv1:`)
- Sync por **GitHub Gist** (token próprio)
- Export/Import de dados (arquivo)

**Experiência:**
- **PWA** instalável (ícone na home, offline)
- **Temas** (7 paletas escuras + 3 claras) com seletor
- **Atalhos de teclado** + Command Palette (busca rápida Ctrl/Cmd+K)
- **Escopos** (ex.: pessoal vs outros) pra filtrar dados
- Ocultar valores (modo privacidade)
- Responsivo (desktop + mobile com barra inferior)

**Mercado/investimentos (infra presente no código):**
- Cotações, índices, watchlist, métricas de carteira, evolução de patrimônio
  (módulo de investimentos existe no código; no produto comercial o foco é o
  módulo Finanças + Agenda).

---

## 7. Dados & estado

- **Estado do app** (contas, transações, cartões, categorias, fixas,
  parcelamentos, dívidas, devedores, metas, agenda, etc.) persistido em
  localStorage e espelhado no Supabase por usuário.
- **Categorias padrão** já vêm prontas (Salário, Moradia, Alimentação,
  Transporte, Saúde, Educação, Lazer, Assinaturas, Cartão, etc.).
- **Seeds vazios** (sem dados fictícios) — o usuário começa do zero.

---

## 8. Status atual

- Núcleo financeiro completo e funcional.
- Rebrand concluído: **Numvi → AF4 finanças** (logo, textos, PWA, manifest).
- Painel, donut e relatório alinhados (mesma base de cálculo).
- **Pendente pra beta:** projeto Supabase dedicado + RLS, liberar cadastro,
  secrets de IA no Worker (ver checklist de lançamento).
