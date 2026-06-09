# Design: Lembretes, Conversa e Treino — cars-web

**Data:** 2026-06-09  
**App:** `cars-web` (pessoal) apenas  
**Módulo alvo:** Agenda  

---

## Contexto

Adição de 3 novas abas ao módulo Agenda do app pessoal:

1. **Lembretes** — lista dedicada com notificações do browser e recorrência
2. **Conversa** — assistente de texto estilo chat, interpreta comandos em linguagem natural via IA e registra gastos, eventos, tarefas e lembretes; acessível via FAB e card na tela inicial
3. **Treino** — feed unificado para musculação, corrida e ciclismo com banco de exercícios, templates e execução dia a dia

---

## Arquitetura

### Novas abas no módulo Agenda

Abas adicionadas à navegação do módulo Agenda (além das existentes):

| Aba | Componente |
|-----|-----------|
| `lembretes` | `Lembretes.jsx` |
| `conversa` | `Conversa.jsx` |
| `treino` | `Treino.jsx` |

### Novos arquivos

```
apps/cars-web/src/
  components/pages/
    Lembretes.jsx
    Conversa.jsx
    Treino.jsx
  lib/
    conversaParser.js     ← regex local + fallback IA
    exerciciosBase.js     ← banco de exercícios pré-populado
```

### Novos estados em App.jsx

Seguem o padrão existente: `useState` + `saveAll()` + localStorage.

```js
const [lembretes,          setLembretes]          = useState([]);
const [conversaHistorico,  setConversaHistorico]  = useState([]);
const [exerciciosDB,       setExerciciosDB]        = useState([]);
const [treinoTemplates,    setTreinoTemplates]    = useState([]);
const [treinos,            setTreinos]            = useState([]);
```

Todos persistidos na chave existente `"financas:dados:v1"` via `saveAll()`.

`exerciciosDB` é inicializado com os exercícios pré-populados de `exerciciosBase.js` na primeira carga do app (quando o array estiver vazio). Exercícios custom adicionados pelo usuário são mesclados ao mesmo array com `isCustom: true`.

---

## Módulo 1 — Lembretes

### Modelo de dados

```js
{
  id: string,
  titulo: string,
  descricao?: string,
  data: "YYYY-MM-DD",
  horario: "HH:MM",
  recorrencia: null | {
    tipo: "diario" | "semanal" | "mensal",
    diasSemana?: number[],   // 0=dom … 6=sab (tipo semanal)
    diaMes?: number,         // 1–31 (tipo mensal)
  },
  concluido: boolean,
  createdAt: string,
}
```

### UI

Lista agrupada em 4 seções: **Hoje**, **Amanhã**, **Esta semana**, **Depois**.

Cada item exibe: hora · título · ícone de recorrência (🔁) · botões [✓ Concluir] [✎ Editar] [🗑 Excluir].

Modal de criação/edição: título (obrigatório), data, hora, toggle de recorrência (mostra opções quando ativo).

### Notificações do browser

- API: `window.Notification`
- Permissão solicitada na criação do primeiro lembrete
- Na abertura do app: agenda `setTimeout` para cada lembrete do dia com horário futuro
- Lembrete recorrente concluído: gera automaticamente a próxima ocorrência antes de marcar como concluído

---

## Módulo 2 — Conversa

### Acesso

- **FAB flutuante** — ícone de chat no canto inferior direito, visível em todas as abas do módulo Agenda. Abre painel lateral (slide-in) com o histórico de conversa.
- **Card na AgendaInicio** — card com input direto no topo da tela inicial da Agenda. Enviar a mensagem abre o painel lateral e executa o comando.

### Comandos suportados

| Intenção | Exemplos | Ação |
|----------|----------|------|
| Gasto | `"gasto 50 almoço"`, `"gastei 120 no mercado"` | Cria transação em Finanças |
| Evento | `"reunião amanhã 14h"`, `"dentista sexta 9h"` | Cria evento na Agenda |
| Tarefa | `"tarefa ligar pro banco"`, `"fazer relatório hoje"` | Cria tarefa |
| Lembrete | `"lembra pagar fatura sexta 10h"` | Cria lembrete |
| Relatório | `"relatório"`, `"resumo"`, `"como tô"` | Exibe painel rápido |

### Parsing

1. `conversaParser.js` tenta regex local para os padrões mais comuns (rápido, sem API)
2. Se não reconhecer: envia para Claude/Gemini com contexto mínimo; IA retorna JSON:
   ```json
   { "action": "gasto", "params": { "valor": 50, "descricao": "almoço" } }
   ```
3. App executa a ação e retorna confirmação ao chat

### UI — chat

- Bolhas: usuário à direita, app à esquerda
- Resposta do app: texto + card de confirmação com botões [Confirmar] [Editar]
- Input fixo na base + botão Enviar
- Histórico: últimas 200 mensagens, persistido em localStorage

### Relatório rápido

Exibido quando o usuário digita "relatório" ou "resumo":

- Gastos da semana atual (total + categoria com maior gasto)
- Tarefas pendentes (quantidade)
- Próximos 3 lembretes
- Último treino registrado

---

## Módulo 3 — Treino

### Modelos de dados

```js
// Exercício na biblioteca
ExercicioBase: {
  id: string,
  nome: string,
  grupoMuscular: string,          // "Peito", "Costas", "Pernas"…
  modalidade: "musculacao" | "corrida" | "ciclismo",
  instrucoes?: string,
  isCustom: boolean,              // false = pré-populado, true = criado pelo usuário
}

// Template de treino (plano)
TreinoTemplate: {
  id: string,
  nome: string,
  modalidade: "musculacao" | "corrida" | "ciclismo" | "misto",
  exercicios: [{
    exercicioId: string,
    series: number,
    reps: number,
    carga?: number,
    ordem: number,
  }],
  geradoPorIA: boolean,
  createdAt: string,
}

// Sessão realizada no dia
SessaoTreino: {
  id: string,
  templateId?: string,
  data: "YYYY-MM-DD",
  modalidade: "musculacao" | "corrida" | "ciclismo",
  exerciciosFeitos: [{
    exercicioId: string,
    // musculação:
    series?: [{ reps: number, carga: number, feita: boolean }],
    // corrida:
    distanciaKm?: number,
    tempoMinutos?: number,
    paceMinKm?: string,           // "5:30"
    // ciclismo:
    distanciaKm?: number,
    tempoMinutos?: number,
    velocidadeMediaKmh?: number,
    cadenciaRpm?: number,
  }],
  concluido: boolean,
  duracaoMinutos?: number,
  notas?: string,
  createdAt: string,
}
```

### UI — feed unificado (layout B)

**Seção "Treino de Hoje":**
- Sem treino iniciado: botão `[+ Iniciar Treino]` que abre modal de seleção (template existente ou criar novo)
- Em andamento: card por sessão com barra de progresso (exercícios concluídos / total) e lista de exercícios com campos de execução inline
- Múltiplas sessões no mesmo dia (ex.: musculação de manhã + corrida à tarde) exibidas como cards empilhados

**Execução musculação:**
Cada exercício exibe suas séries. Cada série tem campo de reps + carga + botão [✓]. Ao concluir todas as séries: exercício marcado como feito.

**Execução corrida / ciclismo:**
Campos únicos: distância (km), tempo (mm:ss), pace ou velocidade média. Botão [✓ Concluir].

**Calendário:**
Mini-calendário mensal abaixo do feed. Dias com treino marcados com ponto colorido:
- Verde: sessão concluída
- Amarelo: sessão parcial (iniciada mas não concluída)

**Histórico:**
Lista das últimas 10 sessões com modalidade, template e data.

### Banco de exercícios pré-populado

**Musculação (~30 exercícios):**
Supino Reto, Supino Inclinado, Crucifixo, Peck Deck, Puxada Frontal, Remada Baixa, Remada Curvada, Rosca Direta, Rosca Martelo, Tríceps Corda, Tríceps Testa, Agachamento Livre, Leg Press, Cadeira Extensora, Cadeira Flexora, Mesa Romana, Stiff, Desenvolvimento, Elevação Lateral, Elevação Frontal, Pull-up, Dip, Panturrilha, Abdominais, Prancha.

**Corrida (4 perfis):**
Corrida Leve, Corrida Moderada, Corrida Intensa, Intervalado.

**Ciclismo (4 perfis):**
Pedal Leve, Pedal Moderado, Pedal Intenso, Ciclismo Indoor.

### Criar treino com IA

Botão `[🤖 Criar com IA]` abre modal com input livre:

> "treino de peito e tríceps, tenho 1h, nível intermediário"

IA retorna `TreinoTemplate` completo (exercícios, séries, reps, cargas sugeridas). Usuário revisa, pode editar e salva na biblioteca de templates.

---

## Itens fora do escopo desta fase

- Sincronização com Supabase (usa localStorage como o restante do app)
- Service Worker para notificações em segundo plano (usa `setTimeout` por ora)
- Integração com GPS ou apps de corrida externos
- Histórico de evolução de carga por exercício (gráficos de progresso) — fase futura
