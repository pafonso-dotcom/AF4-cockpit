# Lembretes + Conversa + Treino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new tabs to the Agenda module of cars-web: Lembretes (with browser notifications and recurrence), Conversa (in-app NLP chat that registers expenses/tasks/events via text), and Treino (unified workout feed for musculação, corrida, and ciclismo with exercise library and AI-generated plans).

**Architecture:** All three features live as new tabs within the existing `modulo === "financas"` rendering block in App.jsx, following the exact same pattern as Tarefas, Habitos, and Diario. State is added to App.jsx and persisted via the existing `saveAll()`/`loadAll()` localStorage mechanism. No new routing or infrastructure needed.

**Tech Stack:** React 18, Lucide React icons, existing `T` theme, `uid()` / `todayISO()` / `fmt()` from `lib/format.js`, `toast` from `lib/toast.js`, `confirm` from `lib/confirm.js`, Claude/Gemini API keys already stored in `apiKeys` prop.

---

## File Map

**Create:**
- `apps/cars-web/src/lib/exerciciosBase.js` — pre-populated exercise library (~38 items)
- `apps/cars-web/src/lib/conversaParser.js` — regex + AI fallback command parser
- `apps/cars-web/src/components/pages/Lembretes.jsx` — reminders list + modal + notifications
- `apps/cars-web/src/components/pages/Conversa.jsx` — chat UI + action execution
- `apps/cars-web/src/components/pages/Treino.jsx` — workout feed + calendar + execution

**Modify:**
- `apps/cars-web/src/components/Header.jsx` — add 3 entries to `AGENDA_TABS`
- `apps/cars-web/src/App.jsx` — add 5 state vars, update `saveAll`/`loadAll`, add 3 tab renderers, add Conversa FAB
- `apps/cars-web/src/components/pages/AgendaInicio.jsx` — add Conversa quick-input card at top

---

## Task 1: Foundation — state, tabs, lib stubs

**Files:**
- Modify: `apps/cars-web/src/components/Header.jsx`
- Modify: `apps/cars-web/src/App.jsx`
- Create: `apps/cars-web/src/lib/exerciciosBase.js`
- Create: `apps/cars-web/src/lib/conversaParser.js`

- [ ] **Step 1: Add 3 tabs to `AGENDA_TABS` in Header.jsx**

Find the `AGENDA_TABS` array (line ~32) and add the three new entries. Import the icons at the top of the file — `Bell`, `MessageCircle`, and `Dumbbell` from `lucide-react` (add alongside existing imports).

Replace:
```js
export const AGENDA_TABS = [
  { id: "inicio",     label: "Início",       icon: Home },
  { id: "calendario", label: "Calendário",   icon: Calendar },
  { id: "notas",      label: "Compromissos", icon: StickyNote },
  { id: "tarefas",    label: "Tarefas",      icon: CheckSquare },
  { id: "metas",      label: "Metas",        icon: Target },
  { id: "compras",    label: "Compras",      icon: Tag },
  { id: "habitos",    label: "Hábitos",      icon: Repeat },
  { id: "diario",     label: "Diário",       icon: BookOpen },
  { id: "ideias",     label: "Ideias",       icon: Sparkles },
  { id: "sugestoes",  label: "Sugestões",    icon: Lightbulb },
];
```

With:
```js
export const AGENDA_TABS = [
  { id: "inicio",     label: "Início",       icon: Home },
  { id: "calendario", label: "Calendário",   icon: Calendar },
  { id: "notas",      label: "Compromissos", icon: StickyNote },
  { id: "tarefas",    label: "Tarefas",      icon: CheckSquare },
  { id: "lembretes",  label: "Lembretes",    icon: Bell },
  { id: "conversa",   label: "Conversa",     icon: MessageCircle },
  { id: "treino",     label: "Treino",       icon: Dumbbell },
  { id: "metas",      label: "Metas",        icon: Target },
  { id: "compras",    label: "Compras",      icon: Tag },
  { id: "habitos",    label: "Hábitos",      icon: Repeat },
  { id: "diario",     label: "Diário",       icon: BookOpen },
  { id: "ideias",     label: "Ideias",       icon: Sparkles },
  { id: "sugestoes",  label: "Sugestões",    icon: Lightbulb },
];
```

- [ ] **Step 2: Add 5 state variables to App.jsx**

Find the block of agenda-related useState declarations (around line 135, near `const [habitos, setHabitos] = useState([])`) and add after `sugestoes`:

```js
const [lembretes,         setLembretes]         = useState([]);
const [conversaHistorico, setConversaHistorico] = useState([]);
const [exerciciosDB,      setExerciciosDB]      = useState([]);
const [treinoTemplates,   setTreinoTemplates]   = useState([]);
const [treinos,           setTreinos]           = useState([]);
```

- [ ] **Step 3: Update `loadAll` in App.jsx**

Find the block where `setCompras`, `setIdeias`, `setTarefas` etc. are called inside `loadAll` (around line 250). Add after `setSugestoes(data.sugestoes || [])`:

```js
setLembretes(data.lembretes || []);
setConversaHistorico(data.conversaHistorico || []);
setExerciciosDB(prev => {
  if (data.exerciciosDB && data.exerciciosDB.length > 0) return data.exerciciosDB;
  return prev; // keep default (will be seeded in step 4)
});
setTreinoTemplates(data.treinoTemplates || []);
setTreinos(data.treinos || []);
```

- [ ] **Step 4: Seed `exerciciosDB` on first load in App.jsx**

Find the `useEffect` that calls `loadAll()` (the one that runs on mount). After the `loadAll()` result is processed, add initialization of the exercise DB. Find the pattern where `loadAll` is awaited and add:

```js
// Seed exerciciosDB with defaults if empty after load
setExerciciosDB(prev => {
  if (prev.length > 0) return prev;
  return EXERCICIOS_BASE;
});
```

Also add the import at the top of App.jsx:
```js
import { EXERCICIOS_BASE } from "./lib/exerciciosBase.js";
```

- [ ] **Step 5: Update `saveAll` call in App.jsx**

Find the `saveAll({...})` call (around line 339). Add the 5 new keys to the object:

```js
saveAll({
  // ...existing keys...,
  lembretes, conversaHistorico, exerciciosDB, treinoTemplates, treinos,
});
```

And add them to the dependency array of the `useEffect` that triggers save:
```js
}, [...existingDeps, lembretes, conversaHistorico, exerciciosDB, treinoTemplates, treinos]);
```

- [ ] **Step 6: Add imports for the 3 new page components in App.jsx**

At the top of App.jsx, alongside existing page imports:
```js
import Lembretes from "./components/pages/Lembretes.jsx";
import Conversa  from "./components/pages/Conversa.jsx";
import Treino    from "./components/pages/Treino.jsx";
```

- [ ] **Step 7: Add 3 tab renderers in App.jsx**

Inside the `{modulo === "financas" && ( ... )}` block (around line 984, after the `diario` block and before the closing `</div>`), add:

```jsx
{tab === "lembretes" && (
  <Lembretes lembretes={lembretes} setLembretes={setLembretes} />
)}
{tab === "conversa" && (
  <Conversa
    conversaHistorico={conversaHistorico}
    setConversaHistorico={setConversaHistorico}
    transacoes={transacoes} setTransacoes={setTransacoes}
    categorias={categorias}
    agenda={agenda} setAgenda={setAgenda}
    tarefas={tarefas} setTarefas={setTarefas}
    lembretes={lembretes} setLembretes={setLembretes}
    treinos={treinos}
    apiKeys={apiKeys}
    hidden={hidden}
  />
)}
{tab === "treino" && (
  <Treino
    treinos={treinos} setTreinos={setTreinos}
    exerciciosDB={exerciciosDB} setExerciciosDB={setExerciciosDB}
    treinoTemplates={treinoTemplates} setTreinoTemplates={setTreinoTemplates}
    apiKeys={apiKeys}
  />
)}
```

- [ ] **Step 8: Create `exerciciosBase.js`**

```js
// apps/cars-web/src/lib/exerciciosBase.js
export const EXERCICIOS_BASE = [
  // Musculação — Peito
  { id: "ex-supino-reto",     nome: "Supino Reto",        grupoMuscular: "Peito",    modalidade: "musculacao", isCustom: false },
  { id: "ex-supino-inc",      nome: "Supino Inclinado",   grupoMuscular: "Peito",    modalidade: "musculacao", isCustom: false },
  { id: "ex-crucifixo",       nome: "Crucifixo",          grupoMuscular: "Peito",    modalidade: "musculacao", isCustom: false },
  { id: "ex-peck-deck",       nome: "Peck Deck",          grupoMuscular: "Peito",    modalidade: "musculacao", isCustom: false },
  // Costas
  { id: "ex-puxada",          nome: "Puxada Frontal",     grupoMuscular: "Costas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-remada-baixa",    nome: "Remada Baixa",       grupoMuscular: "Costas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-remada-curv",     nome: "Remada Curvada",     grupoMuscular: "Costas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-pullup",          nome: "Pull-up",            grupoMuscular: "Costas",   modalidade: "musculacao", isCustom: false },
  // Ombros
  { id: "ex-desenvolvimento", nome: "Desenvolvimento",    grupoMuscular: "Ombros",   modalidade: "musculacao", isCustom: false },
  { id: "ex-elev-lateral",    nome: "Elevação Lateral",   grupoMuscular: "Ombros",   modalidade: "musculacao", isCustom: false },
  { id: "ex-elev-frontal",    nome: "Elevação Frontal",   grupoMuscular: "Ombros",   modalidade: "musculacao", isCustom: false },
  // Bíceps
  { id: "ex-rosca-direta",    nome: "Rosca Direta",       grupoMuscular: "Bíceps",   modalidade: "musculacao", isCustom: false },
  { id: "ex-rosca-martelo",   nome: "Rosca Martelo",      grupoMuscular: "Bíceps",   modalidade: "musculacao", isCustom: false },
  // Tríceps
  { id: "ex-triceps-corda",   nome: "Tríceps Corda",      grupoMuscular: "Tríceps",  modalidade: "musculacao", isCustom: false },
  { id: "ex-triceps-testa",   nome: "Tríceps Testa",      grupoMuscular: "Tríceps",  modalidade: "musculacao", isCustom: false },
  { id: "ex-dip",             nome: "Dip",                grupoMuscular: "Tríceps",  modalidade: "musculacao", isCustom: false },
  // Pernas
  { id: "ex-agachamento",     nome: "Agachamento Livre",  grupoMuscular: "Pernas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-leg-press",       nome: "Leg Press",          grupoMuscular: "Pernas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-cadeira-ext",     nome: "Cadeira Extensora",  grupoMuscular: "Pernas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-cadeira-flex",    nome: "Cadeira Flexora",    grupoMuscular: "Pernas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-stiff",           nome: "Stiff",              grupoMuscular: "Pernas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-mesa-romana",     nome: "Mesa Romana",        grupoMuscular: "Pernas",   modalidade: "musculacao", isCustom: false },
  { id: "ex-panturrilha",     nome: "Panturrilha",        grupoMuscular: "Pernas",   modalidade: "musculacao", isCustom: false },
  // Core
  { id: "ex-abdominal",       nome: "Abdominais",         grupoMuscular: "Core",     modalidade: "musculacao", isCustom: false },
  { id: "ex-prancha",         nome: "Prancha",            grupoMuscular: "Core",     modalidade: "musculacao", isCustom: false },
  // Corrida
  { id: "run-leve",           nome: "Corrida Leve",       grupoMuscular: "Cardio",   modalidade: "corrida",    isCustom: false },
  { id: "run-moderada",       nome: "Corrida Moderada",   grupoMuscular: "Cardio",   modalidade: "corrida",    isCustom: false },
  { id: "run-intensa",        nome: "Corrida Intensa",    grupoMuscular: "Cardio",   modalidade: "corrida",    isCustom: false },
  { id: "run-intervalado",    nome: "Intervalado",        grupoMuscular: "Cardio",   modalidade: "corrida",    isCustom: false },
  // Ciclismo
  { id: "bike-leve",          nome: "Pedal Leve",         grupoMuscular: "Cardio",   modalidade: "ciclismo",   isCustom: false },
  { id: "bike-moderado",      nome: "Pedal Moderado",     grupoMuscular: "Cardio",   modalidade: "ciclismo",   isCustom: false },
  { id: "bike-intenso",       nome: "Pedal Intenso",      grupoMuscular: "Cardio",   modalidade: "ciclismo",   isCustom: false },
  { id: "bike-indoor",        nome: "Ciclismo Indoor",    grupoMuscular: "Cardio",   modalidade: "ciclismo",   isCustom: false },
];
```

- [ ] **Step 9: Create `conversaParser.js` stub**

```js
// apps/cars-web/src/lib/conversaParser.js
// Returns { action, params } or null if unrecognized.
// action: "gasto" | "evento" | "tarefa" | "lembrete" | "relatorio" | "desconhecido"

import { todayISO } from "./format.js";

function resolverData(token) {
  const hoje = new Date();
  if (!token) return todayISO();
  const t = token.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t === "hoje") return todayISO();
  if (t === "amanha" || t === "amanhã") {
    const d = new Date(hoje); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const dias = { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 0 };
  if (dias[t] !== undefined) {
    const d = new Date(hoje);
    const diff = (dias[t] - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  // dd/mm
  const dmMatch = token.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmMatch) {
    const year = hoje.getFullYear();
    return `${year}-${dmMatch[2].padStart(2, "0")}-${dmMatch[1].padStart(2, "0")}`;
  }
  return todayISO();
}

function resolverHorario(token) {
  if (!token) return "09:00";
  const m = token.match(/(\d{1,2})[h:](\d{0,2})/i);
  if (m) return `${m[1].padStart(2, "0")}:${(m[2] || "00").padStart(2, "0")}`;
  const soHora = token.match(/^(\d{1,2})$/);
  if (soHora) return `${soHora[1].padStart(2, "0")}:00`;
  return "09:00";
}

export function parsearLocal(texto) {
  const t = texto.trim();

  // Relatório
  if (/^(relat[oó]rio|resumo|como\s+t[oô]|status)\s*$/i.test(t)) {
    return { action: "relatorio", params: {} };
  }

  // Gasto: "gasto 50 almoço" | "gastei 120 no mercado" | "paguei 30 uber"
  const gastoM = t.match(/^(?:gasto(?:i)?|gastei|paguei|comprei)\s+(?:de\s+)?(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s+(?:(?:em|no|na|num|numa)\s+)?(.+)/i);
  if (gastoM) {
    const valor = parseFloat(gastoM[1].replace(",", "."));
    return { action: "gasto", params: { valor, descricao: gastoM[2].trim() } };
  }

  // Tarefa: "tarefa ligar pro banco"
  const tarefaM = t.match(/^(?:tarefa|criar?\s+tarefa|add\s+tarefa)\s+(.+)/i);
  if (tarefaM) {
    return { action: "tarefa", params: { titulo: tarefaM[1].trim() } };
  }

  // Lembrete: "lembra pagar fatura sexta 10h"
  const lembM = t.match(/^(?:lembrete?|lembrar?|lembra)\s+(.+?)(?:\s+(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}[\/\-]\d{1,2}))?(?:\s+(?:às?\s+)?(\d{1,2}[h:]?\d{0,2}))?$/i);
  if (lembM) {
    return {
      action: "lembrete",
      params: {
        titulo: lembM[1].trim(),
        data: resolverData(lembM[2]),
        horario: resolverHorario(lembM[3]),
      },
    };
  }

  // Evento: "reunião amanhã 14h" | "dentista sexta 9h30"
  const eventoM = t.match(/^(.+?)\s+(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}[\/\-]\d{1,2})\s+(?:às?\s+)?(\d{1,2}[h:]?\d{0,2})/i);
  if (eventoM) {
    return {
      action: "evento",
      params: {
        titulo: eventoM[1].trim(),
        data: resolverData(eventoM[2]),
        horario: resolverHorario(eventoM[3]),
      },
    };
  }

  return null;
}

export async function parsear(texto, apiKeys = {}) {
  const local = parsearLocal(texto);
  if (local) return local;

  // Fallback: IA
  const key = apiKeys.anthropic || apiKeys.gemini;
  if (!key) return { action: "desconhecido", params: { texto } };

  try {
    const prompt = `Interprete este comando em português e retorne JSON com "action" e "params".
Actions possíveis: gasto (params: valor number, descricao string), evento (params: titulo, data YYYY-MM-DD, horario HH:MM), tarefa (params: titulo), lembrete (params: titulo, data YYYY-MM-DD, horario HH:MM), relatorio (params: {}).
Data de hoje: ${todayISO()}
Comando: "${texto}"
Responda APENAS JSON válido, sem markdown.`;

    let result;
    if (apiKeys.anthropic) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: apiKeys.anthropic, dangerouslyAllowBrowser: true });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      result = JSON.parse(msg.content[0].text);
    } else {
      const { callGemini } = await import("./gemini.js");
      const raw = await callGemini(prompt, apiKeys.gemini);
      result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    }
    return result;
  } catch {
    return { action: "desconhecido", params: { texto } };
  }
}
```

- [ ] **Step 10: Build and verify**

```bash
pnpm --filter @repo/cars-web build 2>&1 | tail -10
```

Expected: `✓ built in` with no new errors. Existing duplicate-key warning is pre-existing and OK.

- [ ] **Step 11: Commit**

```bash
git add apps/cars-web/src/components/Header.jsx \
        apps/cars-web/src/App.jsx \
        apps/cars-web/src/lib/exerciciosBase.js \
        apps/cars-web/src/lib/conversaParser.js
git commit -m "feat(cars-web): foundation for Lembretes/Conversa/Treino — state, tabs, libs"
```

---

## Task 2: Lembretes.jsx

**Files:**
- Create: `apps/cars-web/src/components/pages/Lembretes.jsx`

- [ ] **Step 1: Create `Lembretes.jsx`**

```jsx
import React, { useMemo, useState, useEffect } from "react";
import { Bell, Plus, Check, Edit3, Trash2, Repeat, AlertCircle } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

function dataAmanha() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dataFimSemana() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function gerarProximaOcorrencia(lembrete) {
  const { recorrencia, data, horario } = lembrete;
  if (!recorrencia) return null;
  const base = new Date(data + "T" + horario);
  if (recorrencia.tipo === "diario") {
    base.setDate(base.getDate() + 1);
  } else if (recorrencia.tipo === "semanal") {
    base.setDate(base.getDate() + 7);
  } else if (recorrencia.tipo === "mensal") {
    base.setMonth(base.getMonth() + 1);
  }
  return { ...lembrete, id: uid(), concluido: false, createdAt: new Date().toISOString(), data: base.toISOString().slice(0, 10) };
}

function agendarNotificacoes(lembretes) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const hoje = todayISO();
  lembretes
    .filter(l => !l.concluido && l.data === hoje && l.horario)
    .forEach(l => {
      const [h, m] = l.horario.split(":").map(Number);
      const agora = new Date();
      const alvo = new Date();
      alvo.setHours(h, m, 0, 0);
      const diff = alvo - agora;
      if (diff > 0) {
        setTimeout(() => {
          new Notification("Lembrete", { body: l.titulo, icon: "/favicon.ico" });
        }, diff);
      }
    });
}

export default function Lembretes({ lembretes = [], setLembretes }) {
  const [editando, setEditando] = useState(null);
  const hoje = todayISO();
  const amanha = dataAmanha();
  const fimSemana = dataFimSemana();

  useEffect(() => {
    agendarNotificacoes(lembretes);
  }, [lembretes]);

  const grupos = useMemo(() => {
    const ativos = lembretes.filter(l => !l.concluido).sort((a, b) =>
      (a.data || "9999").localeCompare(b.data || "9999") || (a.horario || "").localeCompare(b.horario || "")
    );
    return {
      hoje:    ativos.filter(l => l.data === hoje),
      amanha:  ativos.filter(l => l.data === amanha),
      semana:  ativos.filter(l => l.data > amanha && l.data <= fimSemana),
      depois:  ativos.filter(l => !l.data || l.data > fimSemana),
      concluidos: lembretes.filter(l => l.concluido).slice(-10),
    };
  }, [lembretes, hoje, amanha, fimSemana]);

  const concluir = (id) => {
    const lembrete = lembretes.find(l => l.id === id);
    if (!lembrete) return;
    let novo = lembretes.map(l => l.id === id ? { ...l, concluido: true } : l);
    if (lembrete.recorrencia) {
      const proxima = gerarProximaOcorrencia(lembrete);
      if (proxima) novo = [...novo, proxima];
    }
    setLembretes(novo);
    toast.success("Lembrete concluído.");
  };

  const excluir = async (id) => {
    const l = lembretes.find(x => x.id === id);
    const ok = await confirm({ title: `Excluir "${l?.titulo}"?`, confirmLabel: "Excluir", danger: true });
    if (!ok) return;
    setLembretes(lembretes.filter(x => x.id !== id));
    toast.success("Removido.");
  };

  const salvar = async (data) => {
    if (data.id) {
      setLembretes(lembretes.map(l => l.id === data.id ? { ...l, ...data } : l));
    } else {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      setLembretes([...lembretes, { ...data, id: uid(), concluido: false, createdAt: new Date().toISOString() }]);
    }
    setEditando(null);
    toast.success("Salvo.");
  };

  const novoLembrete = () => setEditando({ id: null, titulo: "", data: hoje, horario: "09:00", recorrencia: null });

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Agenda"
        title="Lembretes"
        sub="Lembretes com notificação no horário certo."
        action={
          <button className="btn-gold" onClick={novoLembrete}>
            <Plus size={13} className="inline mr-1.5" /> Novo lembrete
          </button>
        }
      />

      {lembretes.filter(l => !l.concluido).length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12 }}>
          <Bell size={36} style={{ color: T.gold, marginBottom: 12 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
            Sem lembretes
          </h3>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
            Clique em "Novo lembrete" para adicionar.
          </p>
        </div>
      )}

      {[
        { key: "hoje",   label: "Hoje" },
        { key: "amanha", label: "Amanhã" },
        { key: "semana", label: "Esta semana" },
        { key: "depois", label: "Depois" },
      ].map(({ key, label }) => grupos[key].length > 0 && (
        <div key={key} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {grupos[key].map(l => (
              <LembreteCard key={l.id} lembrete={l} onConcluir={concluir} onEditar={setEditando} onExcluir={excluir} />
            ))}
          </div>
        </div>
      ))}

      {editando && (
        <LembreteModal lembrete={editando} onSalvar={salvar} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

function LembreteCard({ lembrete: l, onConcluir, onEditar, onExcluir }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${T.gold}`, borderRadius: 8,
      padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <button onClick={() => onConcluir(l.id)}
        style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${T.gold}`, background: "transparent", cursor: "pointer", flexShrink: 0, display: "grid", placeItems: "center" }}>
        <Check size={13} style={{ color: T.gold }} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{l.titulo}</span>
          {l.recorrencia && <Repeat size={11} style={{ color: T.muted, flexShrink: 0 }} title="Recorrente" />}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
          {l.horario}
          {l.recorrencia && (
            <span style={{ marginLeft: 8, color: T.gold, fontWeight: 600 }}>
              {l.recorrencia.tipo === "diario" ? "· todo dia" : l.recorrencia.tipo === "semanal" ? "· semanal" : "· mensal"}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onEditar(l)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
          <Edit3 size={13} />
        </button>
        <button onClick={() => onExcluir(l.id)} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function LembreteModal({ lembrete, onSalvar, onClose }) {
  const [form, setForm] = useState({
    id:          lembrete.id,
    titulo:      lembrete.titulo || "",
    descricao:   lembrete.descricao || "",
    data:        lembrete.data || todayISO(),
    horario:     lembrete.horario || "09:00",
    recorrencia: lembrete.recorrencia || null,
  });
  const [recAtivo, setRecAtivo] = useState(!!lembrete.recorrencia);
  const [errors, setErrors] = useState({});

  const submit = () => {
    if (!form.titulo.trim()) { setErrors({ titulo: "Obrigatório" }); return; }
    onSalvar({ ...form, titulo: form.titulo.trim(), recorrencia: recAtivo ? (form.recorrencia || { tipo: "diario" }) : null });
  };

  return (
    <Modal title={form.id ? "Editar lembrete" : "Novo lembrete"} onClose={onClose}>
      <Field label="Título" required error={errors.titulo}>
        <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} autoFocus placeholder="Ex.: Pagar fatura" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
        </Field>
        <Field label="Horário">
          <input type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
        <input type="checkbox" id="rec-toggle" checked={recAtivo} onChange={e => setRecAtivo(e.target.checked)} />
        <label htmlFor="rec-toggle" style={{ fontSize: 13, color: T.ink, cursor: "pointer" }}>Recorrência</label>
      </div>
      {recAtivo && (
        <Field label="Repetir">
          <select value={form.recorrencia?.tipo || "diario"}
            onChange={e => setForm({ ...form, recorrencia: { ...form.recorrencia, tipo: e.target.value } })}>
            <option value="diario">Todo dia</option>
            <option value="semanal">Toda semana (mesmo dia)</option>
            <option value="mensal">Todo mês (mesmo dia)</option>
          </select>
        </Field>
      )}
      <div className="flex gap-3 justify-end mt-6">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={submit}>Salvar</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
pnpm --filter @repo/cars-web build 2>&1 | tail -10
```

Expected: `✓ built in` with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cars-web/src/components/pages/Lembretes.jsx
git commit -m "feat(cars-web): add Lembretes tab with notifications and recurrence"
```

---

## Task 3: Conversa.jsx

**Files:**
- Create: `apps/cars-web/src/components/pages/Conversa.jsx`

- [ ] **Step 1: Create `Conversa.jsx`**

```jsx
import React, { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, TrendingDown, Calendar, CheckSquare, Bell, BarChart2, Loader } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO, fmt } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { parsear } from "../../lib/conversaParser.js";
import PageHeader from "../ui/PageHeader.jsx";

const CATEGORIAS_DEFAULT = ["Alimentação", "Transporte", "Saúde", "Lazer", "Outro"];

function detectarCategoria(descricao) {
  const d = descricao.toLowerCase();
  if (/almoço|jantar|café|mercado|ifood|lanche|restaurante/.test(d)) return "Alimentação";
  if (/uber|99|ônibus|táxi|gasolina|combustível/.test(d)) return "Transporte";
  if (/farmácia|médico|consulta|remédio/.test(d)) return "Saúde";
  if (/cinema|netflix|show|bar|balada/.test(d)) return "Lazer";
  return "Outro";
}

function RelatorioCard({ transacoes, tarefas, lembretes, treinos }) {
  const hoje = todayISO();
  const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  const isoSemana = inicioSemana.toISOString().slice(0, 10);

  const gastosSemana = (transacoes || [])
    .filter(t => t.tipo === "saida" && t.data >= isoSemana)
    .reduce((s, t) => s + (Number(t.valor) || 0), 0);

  const tarefasPendentes = (tarefas || []).filter(t => !t.concluida).length;
  const proximosLembretes = (lembretes || []).filter(l => !l.concluido && l.data >= hoje).slice(0, 3);
  const ultimoTreino = (treinos || []).sort((a, b) => b.data.localeCompare(a.data))[0];

  return (
    <div style={{ background: `${T.gold}10`, border: `1px solid ${T.gold}40`, borderRadius: 10, padding: 14, maxWidth: 320 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
        Resumo
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: T.ink }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: T.muted }}>Gastos esta semana</span>
          <span className="num" style={{ fontWeight: 700, color: T.red }}>{fmt(gastosSemana)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: T.muted }}>Tarefas pendentes</span>
          <span style={{ fontWeight: 700 }}>{tarefasPendentes}</span>
        </div>
        {proximosLembretes.length > 0 && (
          <div>
            <div style={{ color: T.muted, marginBottom: 3 }}>Próximos lembretes</div>
            {proximosLembretes.map(l => (
              <div key={l.id} style={{ fontSize: 11, color: T.ink, paddingLeft: 8 }}>
                · {l.titulo} — {l.data === hoje ? "hoje" : l.data} {l.horario}
              </div>
            ))}
          </div>
        )}
        {ultimoTreino && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: T.muted }}>Último treino</span>
            <span style={{ fontWeight: 600 }}>{ultimoTreino.modalidade} · {ultimoTreino.data}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Conversa({
  conversaHistorico = [], setConversaHistorico,
  transacoes = [], setTransacoes,
  categorias = [],
  agenda = [], setAgenda,
  tarefas = [], setTarefas,
  lembretes = [], setLembretes,
  treinos = [],
  apiKeys = {},
  hidden,
}) {
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversaHistorico]);

  const adicionarMsg = (msgs) => {
    setConversaHistorico(prev => [...prev, ...msgs].slice(-200));
  };

  const executarAcao = (parsed) => {
    const { action, params } = parsed;

    if (action === "gasto") {
      const cat = detectarCategoria(params.descricao);
      const catId = (categorias.find(c => c.nome === cat) || categorias[0])?.id || "outro";
      const nova = {
        id: uid(), tipo: "saida", valor: params.valor,
        descricao: params.descricao, categoriaId: catId,
        data: todayISO(), createdAt: new Date().toISOString(),
      };
      setTransacoes(prev => [...prev, nova]);
      return {
        texto: `✅ Despesa registrada`,
        detalhes: `${fmt(params.valor)} · ${params.descricao} · ${cat}`,
        cor: T.green,
      };
    }

    if (action === "evento") {
      const novo = {
        id: uid(), titulo: params.titulo, data: params.data,
        horario: params.horario, categoria: "compromisso",
        status: "agendado", createdAt: new Date().toISOString(),
      };
      setAgenda(prev => [...prev, novo]);
      return {
        texto: `📅 Evento criado`,
        detalhes: `${params.titulo} · ${params.data} ${params.horario}`,
        cor: "#60a5fa",
      };
    }

    if (action === "tarefa") {
      const nova = {
        id: uid(), titulo: params.titulo, prioridade: "media",
        concluida: false, createdAt: new Date().toISOString(),
      };
      setTarefas(prev => [...prev, nova]);
      return {
        texto: `✓ Tarefa criada`,
        detalhes: params.titulo,
        cor: T.green,
      };
    }

    if (action === "lembrete") {
      const novo = {
        id: uid(), titulo: params.titulo, data: params.data,
        horario: params.horario, recorrencia: null,
        concluido: false, createdAt: new Date().toISOString(),
      };
      setLembretes(prev => [...prev, novo]);
      return {
        texto: `🔔 Lembrete criado`,
        detalhes: `${params.titulo} · ${params.data} ${params.horario}`,
        cor: T.gold,
      };
    }

    if (action === "relatorio") {
      return { texto: null, relatorio: true };
    }

    return {
      texto: `Não entendi "${params?.texto || ""}". Tente: "gasto 50 almoço", "reunião amanhã 14h", "tarefa ligar pro banco"`,
      cor: T.muted,
    };
  };

  const enviar = async () => {
    const texto = input.trim();
    if (!texto) return;
    setInput("");

    const msgUser = { id: uid(), de: "user", texto, ts: new Date().toISOString() };
    adicionarMsg([msgUser]);
    setCarregando(true);

    try {
      const parsed = await parsear(texto, apiKeys);
      const resultado = executarAcao(parsed);
      const msgApp = { id: uid(), de: "app", ts: new Date().toISOString(), ...resultado };
      adicionarMsg([msgApp]);
    } catch (e) {
      adicionarMsg([{ id: uid(), de: "app", texto: "Erro ao processar. Tente novamente.", cor: T.red, ts: new Date().toISOString() }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fade-up py-8" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", maxHeight: 700 }}>
      <PageHeader eyebrow="Agenda" title="Conversa" sub="Digite em linguagem natural para registrar gastos, eventos, tarefas e lembretes." />

      {/* Histórico */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "8px 0", marginBottom: 8 }}>
        {conversaHistorico.length === 0 && (
          <div style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: "40px 0" }}>
            <MessageCircle size={32} style={{ color: T.border, margin: "0 auto 10px", display: "block" }} />
            Comece digitando um comando.<br />
            Ex.: <em>"gasto 50 almoço"</em>, <em>"reunião amanhã 14h"</em>
          </div>
        )}
        {conversaHistorico.map(msg => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.de === "user" ? "flex-end" : "flex-start" }}>
            {msg.de === "user" ? (
              <div style={{
                background: T.gold, color: T.bg,
                padding: "8px 14px", borderRadius: "16px 16px 4px 16px",
                fontSize: 13, maxWidth: "75%", fontWeight: 500,
              }}>
                {msg.texto}
              </div>
            ) : (
              <div style={{ maxWidth: "80%" }}>
                {msg.relatorio ? (
                  <RelatorioCard transacoes={transacoes} tarefas={tarefas} lembretes={lembretes} treinos={treinos} />
                ) : (
                  <div style={{
                    background: T.card, border: `1px solid ${msg.cor || T.border}`,
                    borderLeft: `3px solid ${msg.cor || T.border}`,
                    padding: "8px 14px", borderRadius: "4px 16px 16px 16px", fontSize: 13,
                  }}>
                    {msg.texto && <div style={{ fontWeight: 600, color: msg.cor || T.ink }}>{msg.texto}</div>}
                    {msg.detalhes && <div style={{ color: T.muted, marginTop: 2, fontSize: 11.5 }}>{msg.detalhes}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {carregando && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted, fontSize: 12 }}>
            <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Processando...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 0",
        borderTop: `1px solid ${T.border}`,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
          placeholder='gasto 50 almoço · reunião amanhã 14h · tarefa ligar pro banco'
          disabled={carregando}
          style={{ flex: 1, fontSize: 13, padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg }}
        />
        <button onClick={enviar} disabled={carregando || !input.trim()}
          style={{
            background: T.gold, color: T.bg, border: "none",
            borderRadius: 8, padding: "8px 14px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13,
            opacity: (!input.trim() || carregando) ? 0.5 : 1,
          }}>
          <Send size={14} /> Enviar
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Add `ConversaFAB` to App.jsx**

First verify if `T` is already imported in App.jsx:
```bash
grep "import { T }" apps/cars-web/src/App.jsx
```
If not found, add at the top of App.jsx alongside other lib imports:
```js
import { T } from "./lib/theme.js";
```

After the main content rendering block in App.jsx (just before the closing `</div>` of the root container, around line 1160), add the FAB component inline. First add a state variable:

```js
const [conversaFABOpen, setConversaFABOpen] = useState(false);
```

Then add the FAB and mini-panel, rendered when `modulo === "financas"`:

```jsx
{modulo === "financas" && tab !== "conversa" && (
  <>
    <button
      onClick={() => setConversaFABOpen(o => !o)}
      style={{
        position: "fixed", bottom: 80, right: 20, zIndex: 200,
        width: 50, height: 50, borderRadius: "50%",
        background: T.gold, color: T.bg, border: "none",
        boxShadow: "0 4px 16px rgba(0,0,0,.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 22,
      }}
      title="Conversa rápida"
    >
      💬
    </button>
    {conversaFABOpen && (
      <div style={{
        position: "fixed", bottom: 140, right: 20, zIndex: 200,
        width: 320, background: T.card,
        border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 14, boxShadow: "0 8px 32px rgba(0,0,0,.4)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, marginBottom: 8 }}>Conversa rápida</div>
        <ConversaFABInput
          onEnviar={(texto) => {
            setConversaFABOpen(false);
            setTab("conversa");
          }}
          onAbrirCompleto={() => { setConversaFABOpen(false); setTab("conversa"); }}
        />
      </div>
    )}
  </>
)}
```

Add `ConversaFABInput` as a small component just above the `export default function App()`:

```jsx
function ConversaFABInput({ onAbrirCompleto }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: T.muted, margin: "0 0 8px" }}>
        Clique para abrir a conversa completa.
      </p>
      <button className="btn-gold" style={{ width: "100%" }} onClick={onAbrirCompleto}>
        Abrir Conversa
      </button>
    </div>
  );
}
```

> Note: The FAB opens the full Conversa tab for simplicity. A full inline mini-chat is out of scope for this task.

- [ ] **Step 3: Build and verify**

```bash
pnpm --filter @repo/cars-web build 2>&1 | tail -10
```

Expected: `✓ built in` with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/cars-web/src/components/pages/Conversa.jsx \
        apps/cars-web/src/lib/conversaParser.js \
        apps/cars-web/src/App.jsx
git commit -m "feat(cars-web): add Conversa tab with NLP chat + FAB shortcut"
```

---

## Task 4: AgendaInicio.jsx — Conversa quick-input card

**Files:**
- Modify: `apps/cars-web/src/components/pages/AgendaInicio.jsx`

- [ ] **Step 1: Pass new props from App.jsx to AgendaInicio**

In App.jsx, find the AgendaInicio rendering (around line 939) and add the new props:

```jsx
{tab === "inicio" && (
  <AgendaInicio
    agenda={agenda} tarefas={tarefas} ideias={ideias}
    compras={compras} metas={metas}
    setTab={setTab}
    lembretes={lembretes}
    treinos={treinos}
  />
)}
```

- [ ] **Step 2: Add Conversa quick-input card to AgendaInicio.jsx**

Update the function signature to accept new props:

```jsx
export default function AgendaInicio({
  agenda = [], tarefas = [], ideias = [], compras = [], metas = [],
  setTab,
  lembretes = [],
  treinos = [],
}) {
```

Then, in the JSX return, add the Conversa card as the **first element** after the greeting/header section. Find the `return (` and add before the first section:

```jsx
{/* Conversa rápida */}
<div style={{
  background: `${T.gold}10`, border: `1px solid ${T.gold}44`,
  borderLeft: `3px solid ${T.gold}`, borderRadius: 10,
  padding: "12px 14px", marginBottom: 20,
  display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
}} onClick={() => setTab("conversa")}>
  <span style={{ fontSize: 22 }}>💬</span>
  <div>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>Conversa</div>
    <div style={{ fontSize: 11.5, color: T.muted }}>
      Registre gastos, tarefas e eventos em linguagem natural
    </div>
  </div>
  <ChevronRight size={16} style={{ color: T.gold, marginLeft: "auto" }} />
</div>
```

`ChevronRight` is already imported in `AgendaInicio.jsx`.

- [ ] **Step 3: Build and verify**

```bash
pnpm --filter @repo/cars-web build 2>&1 | tail -10
```

Expected: `✓ built in` with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/cars-web/src/components/pages/AgendaInicio.jsx \
        apps/cars-web/src/App.jsx
git commit -m "feat(cars-web): add Conversa quick-access card to AgendaInicio"
```

---

## Task 5: Treino.jsx

**Files:**
- Create: `apps/cars-web/src/components/pages/Treino.jsx`

- [ ] **Step 1: Create `Treino.jsx`**

```jsx
import React, { useMemo, useState } from "react";
import {
  Dumbbell, Plus, Check, Edit3, Trash2, ChevronLeft, ChevronRight,
  Sparkles, Play, X, Save, Bike, Zap,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO, fmt } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

const MODALIDADE_COR = {
  musculacao: "#f87171",
  corrida: "#34d399",
  ciclismo: "#60a5fa",
};

const MODALIDADE_ICON = {
  musculacao: Dumbbell,
  corrida: Zap,
  ciclismo: Bike,
};

const MODALIDADE_LABEL = {
  musculacao: "Musculação",
  corrida: "Corrida",
  ciclismo: "Ciclismo",
};

function miniCalendario(mesOffset, treinos) {
  const hoje = new Date();
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const label = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const treinosPorDia = {};
  treinos.filter(t => {
    const d = new Date(t.data + "T00:00");
    return d.getFullYear() === ano && d.getMonth() === mes;
  }).forEach(t => {
    const dia = Number(t.data.slice(8));
    if (!treinosPorDia[dia]) treinosPorDia[dia] = [];
    treinosPorDia[dia].push(t);
  });

  return { label, primeiroDia, totalDias, treinosPorDia, ano, mes };
}

export default function Treino({ treinos = [], setTreinos, exerciciosDB = [], setExerciciosDB, treinoTemplates = [], setTreinoTemplates, apiKeys = {} }) {
  const [mesOffset, setMesOffset] = useState(0);
  const [sessaoModal, setSessaoModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [iaModal, setIaModal] = useState(false);
  const [sessaoAtiva, setSessaoAtiva] = useState(null); // SessaoTreino em edição
  const hoje = todayISO();

  const sessoesHoje = useMemo(() => treinos.filter(t => t.data === hoje), [treinos, hoje]);
  const ultimos = useMemo(() => [...treinos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10), [treinos]);
  const cal = useMemo(() => miniCalendario(mesOffset, treinos), [mesOffset, treinos]);

  const iniciarTreino = (template) => {
    const sessao = {
      id: uid(),
      templateId: template?.id || null,
      data: hoje,
      modalidade: template?.modalidade || "musculacao",
      exerciciosFeitos: (template?.exercicios || []).map(e => ({
        exercicioId: e.exercicioId,
        series: Array.from({ length: e.series }, () => ({ reps: e.reps, carga: e.carga || 0, feita: false })),
      })),
      concluido: false,
      createdAt: new Date().toISOString(),
    };
    setTreinos(prev => [...prev, sessao]);
    setSessaoAtiva(sessao.id);
    setSessaoModal(false);
    toast.success("Treino iniciado!");
  };

  const iniciarSemTemplate = (modalidade) => {
    const sessao = {
      id: uid(), templateId: null, data: hoje, modalidade,
      exerciciosFeitos: [], concluido: false,
      createdAt: new Date().toISOString(),
    };
    setTreinos(prev => [...prev, sessao]);
    setSessaoAtiva(sessao.id);
    setSessaoModal(false);
    toast.success("Treino iniciado!");
  };

  const atualizarSessao = (sessaoId, novaData) => {
    setTreinos(prev => prev.map(s => s.id === sessaoId ? { ...s, ...novaData } : s));
  };

  const concluirSessao = (sessaoId) => {
    atualizarSessao(sessaoId, { concluido: true });
    setSessaoAtiva(null);
    toast.success("Treino concluído! 💪");
  };

  const excluirSessao = async (sessaoId) => {
    const ok = await confirm({ title: "Excluir este treino?", confirmLabel: "Excluir", danger: true });
    if (!ok) return;
    setTreinos(prev => prev.filter(s => s.id !== sessaoId));
    if (sessaoAtiva === sessaoId) setSessaoAtiva(null);
  };

  const sessaoAtivaObj = treinos.find(s => s.id === sessaoAtiva);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Agenda"
        title="Treino"
        sub="Musculação, corrida e ciclismo. Registre seus treinos e acompanhe a evolução."
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-ghost" onClick={() => setTemplateModal(true)}>Templates</button>
            <button className="btn-gold" onClick={() => setSessaoModal(true)}>
              <Plus size={13} className="inline mr-1" /> Iniciar treino
            </button>
          </div>
        }
      />

      {/* Treino de Hoje */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
          Treino de Hoje
        </div>
        {sessoesHoje.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "32px 24px",
            background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
          }}>
            <Dumbbell size={28} style={{ color: T.muted, marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: T.muted }}>
              Sem treino hoje. <button onClick={() => setSessaoModal(true)}
                style={{ background: "none", border: "none", color: T.gold, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                Iniciar agora
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessoesHoje.map(sessao => (
              <SessaoCard
                key={sessao.id}
                sessao={sessao}
                exerciciosDB={exerciciosDB}
                ativa={sessaoAtiva === sessao.id}
                onToggleAtiva={() => setSessaoAtiva(p => p === sessao.id ? null : sessao.id)}
                onAtualizar={(data) => atualizarSessao(sessao.id, data)}
                onConcluir={() => concluirSessao(sessao.id)}
                onExcluir={() => excluirSessao(sessao.id)}
                setExerciciosDB={setExerciciosDB}
              />
            ))}
          </div>
        )}
      </div>

      {/* Calendário */}
      <div style={{ marginBottom: 24, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => setMesOffset(o => o - 1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, textTransform: "capitalize" }}>{cal.label}</span>
          <button onClick={() => setMesOffset(o => o + 1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, textAlign: "center" }}>
          {["D","S","T","Q","Q","S","S"].map((d, i) => (
            <div key={i} style={{ fontSize: 9, color: T.faint, fontWeight: 700, paddingBottom: 4 }}>{d}</div>
          ))}
          {Array.from({ length: cal.primeiroDia }).map((_, i) => <div key={"e" + i} />)}
          {Array.from({ length: cal.totalDias }).map((_, i) => {
            const dia = i + 1;
            const sessoes = cal.treinosPorDia[dia] || [];
            const concluidos = sessoes.filter(s => s.concluido);
            const diaISO = `${cal.ano}-${String(cal.mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            const ehHoje = diaISO === hoje;
            return (
              <div key={dia} style={{
                position: "relative", paddingBottom: 6,
                background: ehHoje ? `${T.gold}22` : "transparent",
                borderRadius: 4,
              }}>
                <div style={{ fontSize: 11, color: ehHoje ? T.gold : T.ink, fontWeight: ehHoje ? 700 : 400 }}>{dia}</div>
                {sessoes.length > 0 && (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", margin: "2px auto 0",
                    background: concluidos.length > 0 ? T.green : "#fbbf24",
                  }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 10, color: T.muted }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: T.green, marginRight: 4 }} />Concluído</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", marginRight: 4 }} />Parcial</span>
        </div>
      </div>

      {/* Histórico */}
      {ultimos.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
            Histórico
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ultimos.map(s => {
              const cor = MODALIDADE_COR[s.modalidade] || T.gold;
              const Icon = MODALIDADE_ICON[s.modalidade] || Dumbbell;
              const template = treinoTemplates.find(t => t.id === s.templateId);
              return (
                <div key={s.id} style={{
                  background: T.card, border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${cor}`, borderRadius: 8,
                  padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <Icon size={16} style={{ color: cor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {template?.nome || MODALIDADE_LABEL[s.modalidade]}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>{s.data}</div>
                  </div>
                  {s.concluido
                    ? <span style={{ fontSize: 10, padding: "2px 6px", background: `${T.green}22`, color: T.green, borderRadius: 4, fontWeight: 700 }}>✓ Concluído</span>
                    : <span style={{ fontSize: 10, padding: "2px 6px", background: "#fbbf2422", color: "#fbbf24", borderRadius: 4, fontWeight: 700 }}>Parcial</span>
                  }
                  <button onClick={() => excluirSessao(s.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Iniciar treino */}
      {sessaoModal && (
        <Modal title="Iniciar Treino" onClose={() => setSessaoModal(false)}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
              Template existente
            </div>
            {treinoTemplates.length === 0 ? (
              <p style={{ fontSize: 12, color: T.muted }}>Nenhum template. Crie um abaixo ou use a IA.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {treinoTemplates.map(t => {
                  const cor = MODALIDADE_COR[t.modalidade] || T.gold;
                  return (
                    <button key={t.id} onClick={() => iniciarTreino(t)}
                      style={{
                        background: T.card, border: `1px solid ${cor}55`,
                        borderLeft: `3px solid ${cor}`, borderRadius: 8,
                        padding: "10px 14px", textAlign: "left", cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                      <span style={{ fontWeight: 600, color: T.ink, fontSize: 13 }}>{t.nome}</span>
                      <span style={{ fontSize: 10, color: cor, fontWeight: 700 }}>{MODALIDADE_LABEL[t.modalidade]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
              Iniciar do zero
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["musculacao", "corrida", "ciclismo"].map(m => {
                const cor = MODALIDADE_COR[m];
                const Icon = MODALIDADE_ICON[m];
                return (
                  <button key={m} onClick={() => iniciarSemTemplate(m)}
                    style={{
                      flex: 1, background: `${cor}15`, border: `1px solid ${cor}55`,
                      borderRadius: 8, padding: "10px 8px", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    }}>
                    <Icon size={20} style={{ color: cor }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{MODALIDADE_LABEL[m]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setSessaoModal(false); setIaModal(true); }}>
              <Sparkles size={12} className="inline mr-1" /> Criar com IA
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: IA */}
      {iaModal && (
        <IAModal
          exerciciosDB={exerciciosDB}
          apiKeys={apiKeys}
          onSalvar={(template) => {
            setTreinoTemplates(prev => [...prev, template]);
            setIaModal(false);
            iniciarTreino(template);
          }}
          onClose={() => setIaModal(false)}
        />
      )}

      {/* Modal: Gerenciar templates */}
      {templateModal && (
        <TemplateModal
          templates={treinoTemplates}
          exerciciosDB={exerciciosDB}
          setExerciciosDB={setExerciciosDB}
          onSalvar={(t) => {
            setTreinoTemplates(prev => {
              const idx = prev.findIndex(x => x.id === t.id);
              return idx >= 0 ? prev.map(x => x.id === t.id ? t : x) : [...prev, t];
            });
          }}
          onExcluir={async (id) => {
            const ok = await confirm({ title: "Excluir template?", confirmLabel: "Excluir", danger: true });
            if (!ok) return;
            setTreinoTemplates(prev => prev.filter(t => t.id !== id));
          }}
          onClose={() => setTemplateModal(false)}
        />
      )}
    </div>
  );
}

/* ---- SessaoCard: execução de uma sessão em andamento ---- */
function SessaoCard({ sessao, exerciciosDB, ativa, onToggleAtiva, onAtualizar, onConcluir, onExcluir, setExerciciosDB }) {
  const cor = MODALIDADE_COR[sessao.modalidade] || T.gold;
  const Icon = MODALIDADE_ICON[sessao.modalidade] || Dumbbell;
  const totalEx = sessao.exerciciosFeitos.length;
  const concluidosEx = sessao.exerciciosFeitos.filter(e =>
    sessao.modalidade === "musculacao"
      ? e.series?.every(s => s.feita)
      : e.concluido
  ).length;
  const pct = totalEx > 0 ? Math.round((concluidosEx / totalEx) * 100) : 0;

  const marcarSerie = (exIdx, serieIdx, feita) => {
    const novas = sessao.exerciciosFeitos.map((e, ei) => {
      if (ei !== exIdx) return e;
      return { ...e, series: e.series.map((s, si) => si === serieIdx ? { ...s, feita } : s) };
    });
    onAtualizar({ exerciciosFeitos: novas });
  };

  const atualizarSerieCampo = (exIdx, serieIdx, campo, valor) => {
    const novas = sessao.exerciciosFeitos.map((e, ei) => {
      if (ei !== exIdx) return e;
      return { ...e, series: e.series.map((s, si) => si === serieIdx ? { ...s, [campo]: Number(valor) } : s) };
    });
    onAtualizar({ exerciciosFeitos: novas });
  };

  const atualizarCardio = (exIdx, campo, valor) => {
    const novas = sessao.exerciciosFeitos.map((e, ei) =>
      ei === exIdx ? { ...e, [campo]: valor, concluido: campo === "concluido" ? valor : e.concluido } : e
    );
    onAtualizar({ exerciciosFeitos: novas });
  };

  const adicionarExercicio = (exercicioId) => {
    const ex = exerciciosDB.find(e => e.id === exercicioId);
    if (!ex) return;
    const novo = sessao.modalidade === "musculacao"
      ? { exercicioId, series: [{ reps: 12, carga: 0, feita: false }] }
      : { exercicioId, distanciaKm: 0, tempoMinutos: 0, concluido: false };
    onAtualizar({ exerciciosFeitos: [...sessao.exerciciosFeitos, novo] });
  };

  const exerciciosFiltrados = exerciciosDB.filter(e => e.modalidade === sessao.modalidade);

  return (
    <div style={{ background: T.card, border: `1px solid ${cor}55`, borderTop: `3px solid ${cor}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Icon size={18} style={{ color: cor }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{MODALIDADE_LABEL[sessao.modalidade]}</div>
          {totalEx > 0 && (
            <div style={{ fontSize: 11, color: T.muted }}>{concluidosEx}/{totalEx} exercícios · {pct}%</div>
          )}
        </div>
        {sessao.concluido
          ? <span style={{ fontSize: 10, padding: "2px 8px", background: `${T.green}22`, color: T.green, borderRadius: 4, fontWeight: 700 }}>✓ Concluído</span>
          : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={onToggleAtiva} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: T.muted }}>
                {ativa ? "Recolher" : "Expandir"}
              </button>
              <button onClick={onConcluir} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                Concluir
              </button>
            </div>
          )
        }
        <button onClick={onExcluir} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Barra de progresso */}
      {totalEx > 0 && (
        <div style={{ height: 5, background: T.border, borderRadius: 999, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: 999, transition: "width .3s" }} />
        </div>
      )}

      {/* Exercícios (quando expandido) */}
      {ativa && !sessao.concluido && (
        <>
          {sessao.exerciciosFeitos.map((ef, ei) => {
            const ex = exerciciosDB.find(e => e.id === ef.exercicioId);
            return (
              <div key={ei} style={{ marginBottom: 14, padding: "10px 12px", background: T.bgSoft, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
                  {ex?.nome || ef.exercicioId}
                </div>
                {sessao.modalidade === "musculacao" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {(ef.series || []).map((s, si) => (
                      <div key={si} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: T.muted, width: 40 }}>Série {si + 1}</span>
                        <input type="number" min="0" value={s.reps}
                          onChange={e => atualizarSerieCampo(ei, si, "reps", e.target.value)}
                          style={{ width: 52, fontSize: 12, padding: "3px 6px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }}
                          placeholder="reps" />
                        <span style={{ fontSize: 11, color: T.muted }}>×</span>
                        <input type="number" min="0" step="0.5" value={s.carga}
                          onChange={e => atualizarSerieCampo(ei, si, "carga", e.target.value)}
                          style={{ width: 60, fontSize: 12, padding: "3px 6px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }}
                          placeholder="kg" />
                        <span style={{ fontSize: 11, color: T.muted }}>kg</span>
                        <button onClick={() => marcarSerie(ei, si, !s.feita)}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: s.feita ? T.green : "transparent",
                            border: `2px solid ${s.feita ? T.green : T.border}`,
                            cursor: "pointer", display: "grid", placeItems: "center",
                          }}>
                          {s.feita && <Check size={11} style={{ color: "#fff" }} />}
                        </button>
                      </div>
                    ))}
                    <button onClick={() => {
                      const ultima = ef.series[ef.series.length - 1] || { reps: 12, carga: 0 };
                      const novas = sessao.exerciciosFeitos.map((e, idx) =>
                        idx === ei ? { ...e, series: [...e.series, { reps: ultima.reps, carga: ultima.carga, feita: false }] } : e
                      );
                      onAtualizar({ exerciciosFeitos: novas });
                    }} style={{ fontSize: 10, color: T.gold, background: "none", border: "none", cursor: "pointer", padding: "2px 0", textAlign: "left" }}>
                      + Adicionar série
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <label style={{ fontSize: 10, color: T.muted }}>Distância (km)</label>
                      <input type="number" step="0.1" min="0" value={ef.distanciaKm || ""}
                        onChange={e => atualizarCardio(ei, "distanciaKm", parseFloat(e.target.value) || 0)}
                        style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <label style={{ fontSize: 10, color: T.muted }}>Tempo (min)</label>
                      <input type="number" min="0" value={ef.tempoMinutos || ""}
                        onChange={e => atualizarCardio(ei, "tempoMinutos", parseInt(e.target.value) || 0)}
                        style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                    </div>
                    {sessao.modalidade === "corrida" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <label style={{ fontSize: 10, color: T.muted }}>Pace (min/km)</label>
                        <input type="text" value={ef.paceMinKm || ""}
                          onChange={e => atualizarCardio(ei, "paceMinKm", e.target.value)}
                          placeholder="5:30"
                          style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                      </div>
                    )}
                    {sessao.modalidade === "ciclismo" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <label style={{ fontSize: 10, color: T.muted }}>Veloc. média (km/h)</label>
                        <input type="number" step="0.1" min="0" value={ef.velocidadeMediaKmh || ""}
                          onChange={e => atualizarCardio(ei, "velocidadeMediaKmh", parseFloat(e.target.value) || 0)}
                          style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button onClick={() => atualizarCardio(ei, "concluido", !ef.concluido)}
                        style={{
                          background: ef.concluido ? T.green : "transparent",
                          border: `2px solid ${ef.concluido ? T.green : T.border}`,
                          borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                          color: ef.concluido ? "#fff" : T.muted,
                        }}>
                        {ef.concluido ? "✓ Feito" : "Marcar feito"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Adicionar exercício */}
          <div style={{ marginTop: 8 }}>
            <select onChange={e => { if (e.target.value) { adicionarExercicio(e.target.value); e.target.value = ""; } }}
              style={{ fontSize: 12, padding: "6px 10px", border: `1px dashed ${T.gold}`, borderRadius: 6, background: T.bg, color: T.muted, cursor: "pointer", width: "100%" }}>
              <option value="">+ Adicionar exercício...</option>
              {exerciciosFiltrados.map(e => (
                <option key={e.id} value={e.id}>{e.nome} {e.grupoMuscular ? `(${e.grupoMuscular})` : ""}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- TemplateModal: criar/gerenciar templates ---- */
function TemplateModal({ templates, exerciciosDB, setExerciciosDB, onSalvar, onExcluir, onClose }) {
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(null);

  const abrirNovo = () => {
    setForm({ id: uid(), nome: "", modalidade: "musculacao", exercicios: [], geradoPorIA: false, createdAt: new Date().toISOString() });
    setEditando("novo");
  };

  const salvarForm = () => {
    if (!form?.nome?.trim()) { toast.error("Nome obrigatório"); return; }
    onSalvar({ ...form, nome: form.nome.trim() });
    setEditando(null);
    toast.success("Template salvo.");
  };

  const adicionarExToTemplate = (exercicioId) => {
    if (!exercicioId) return;
    setForm(f => ({
      ...f,
      exercicios: [...f.exercicios, { exercicioId, series: 3, reps: 12, carga: 0, ordem: f.exercicios.length }],
    }));
  };

  if (editando) {
    const exerciciosFiltrados = exerciciosDB.filter(e => e.modalidade === form.modalidade);
    return (
      <Modal title={editando === "novo" ? "Novo Template" : "Editar Template"} onClose={() => setEditando(null)} wide>
        <Field label="Nome">
          <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} autoFocus placeholder="Ex.: Treino A — Peito/Tríceps" />
        </Field>
        <Field label="Modalidade">
          <select value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value, exercicios: [] })}>
            <option value="musculacao">Musculação</option>
            <option value="corrida">Corrida</option>
            <option value="ciclismo">Ciclismo</option>
          </select>
        </Field>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
            Exercícios ({form.exercicios.length})
          </div>
          {form.exercicios.map((ex, i) => {
            const exBase = exerciciosDB.find(e => e.id === ex.exercicioId);
            return (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "6px 10px", background: T.bgSoft, borderRadius: 6 }}>
                <span style={{ flex: 1, fontSize: 12, color: T.ink }}>{exBase?.nome || ex.exercicioId}</span>
                <input type="number" min="1" value={ex.series} onChange={e => setForm(f => ({ ...f, exercicios: f.exercicios.map((x, xi) => xi === i ? { ...x, series: Number(e.target.value) } : x) }))}
                  style={{ width: 40, fontSize: 12, padding: "2px 5px", border: `1px solid ${T.border}`, borderRadius: 4, background: T.bg }} />
                <span style={{ fontSize: 11, color: T.muted }}>×</span>
                <input type="number" min="1" value={ex.reps} onChange={e => setForm(f => ({ ...f, exercicios: f.exercicios.map((x, xi) => xi === i ? { ...x, reps: Number(e.target.value) } : x) }))}
                  style={{ width: 40, fontSize: 12, padding: "2px 5px", border: `1px solid ${T.border}`, borderRadius: 4, background: T.bg }} />
                <button onClick={() => setForm(f => ({ ...f, exercicios: f.exercicios.filter((_, xi) => xi !== i) }))}
                  style={{ background: "none", border: "none", color: T.red, cursor: "pointer", padding: 2 }}>
                  <X size={13} />
                </button>
              </div>
            );
          })}
          <select onChange={e => { adicionarExToTemplate(e.target.value); e.target.value = ""; }}
            style={{ fontSize: 12, padding: "6px 10px", border: `1px dashed ${T.gold}`, borderRadius: 6, background: T.bg, color: T.muted, cursor: "pointer", width: "100%", marginTop: 4 }}>
            <option value="">+ Adicionar exercício...</option>
            {exerciciosFiltrados.map(e => (
              <option key={e.id} value={e.id}>{e.nome}{e.grupoMuscular ? ` (${e.grupoMuscular})` : ""}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
          <button className="btn-gold" onClick={salvarForm}><Save size={12} className="inline mr-1" /> Salvar</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Templates de Treino" onClose={onClose} wide>
      <button className="btn-gold" style={{ marginBottom: 14 }} onClick={abrirNovo}>
        <Plus size={12} className="inline mr-1" /> Novo template
      </button>
      {templates.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>Nenhum template ainda.</p>}
      {templates.map(t => {
        const cor = MODALIDADE_COR[t.modalidade] || T.gold;
        return (
          <div key={t.id} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${cor}`, borderRadius: 8,
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{t.nome}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{MODALIDADE_LABEL[t.modalidade]} · {t.exercicios.length} exercícios</div>
            </div>
            <button onClick={() => { setForm({ ...t }); setEditando(t.id); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
              <Edit3 size={13} />
            </button>
            <button onClick={() => onExcluir(t.id)} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </Modal>
  );
}

/* ---- IAModal: criar treino com IA ---- */
function IAModal({ exerciciosDB, apiKeys, onSalvar, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [preview, setPreview] = useState(null);

  const gerar = async () => {
    if (!prompt.trim()) return;
    const key = apiKeys.anthropic || apiKeys.gemini;
    if (!key) { toast.error("Configure uma chave de IA nas Configurações."); return; }
    setCarregando(true);

    const listaExercicios = exerciciosDB
      .filter(e => e.modalidade === "musculacao")
      .map(e => `${e.id}: ${e.nome} (${e.grupoMuscular})`)
      .join("\n");

    const systemPrompt = `Você é um personal trainer. Crie um treino de musculação baseado na descrição do usuário.
Exercícios disponíveis (use apenas estes IDs):
${listaExercicios}

Retorne APENAS JSON válido no formato:
{
  "nome": "Nome do Treino",
  "modalidade": "musculacao",
  "exercicios": [
    { "exercicioId": "id-do-exercicio", "series": 4, "reps": 12, "carga": 40, "ordem": 0 }
  ]
}`;

    try {
      let raw;
      if (apiKeys.anthropic) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: apiKeys.anthropic, dangerouslyAllowBrowser: true });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        });
        raw = msg.content[0].text;
      } else {
        const { callGemini } = await import("../../lib/gemini.js");
        raw = await callGemini(systemPrompt + "\n\nDescrição: " + prompt, apiKeys.gemini);
      }
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setPreview({ ...parsed, id: uid(), geradoPorIA: true, createdAt: new Date().toISOString() });
    } catch (e) {
      toast.error("Erro ao gerar treino. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Modal title="Criar treino com IA" onClose={onClose}>
      {!preview ? (
        <>
          <Field label="Descreva o treino que quer">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ex.: treino de peito e tríceps, tenho 1h, nível intermediário"
              rows={3}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, resize: "vertical" }}
            />
          </Field>
          <div className="flex gap-3 justify-end mt-4">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-gold" onClick={gerar} disabled={carregando || !prompt.trim()}>
              {carregando ? "Gerando..." : <><Sparkles size={12} className="inline mr-1" /> Gerar treino</>}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ background: T.card, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{preview.nome}</div>
            {preview.exercicios.map((ex, i) => {
              const exBase = exerciciosDB.find(e => e.id === ex.exercicioId);
              return (
                <div key={i} style={{ fontSize: 12, color: T.muted, padding: "3px 0" }}>
                  {i + 1}. {exBase?.nome || ex.exercicioId} — {ex.series}×{ex.reps} @ {ex.carga}kg
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setPreview(null)}>Gerar outro</button>
            <button className="btn-gold" onClick={() => onSalvar(preview)}>Usar este treino</button>
          </div>
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
pnpm --filter @repo/cars-web build 2>&1 | tail -15
```

Expected: `✓ built in` with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cars-web/src/components/pages/Treino.jsx
git commit -m "feat(cars-web): add Treino tab with workout feed, calendar, templates and AI generation"
```

---

## Task 6: Push and PR

- [ ] **Step 1: Push all commits**

```bash
git push -u origin claude/cars-web-objetivos-redesign-dl689n
```

- [ ] **Step 2: Verify build one final time**

```bash
pnpm --filter @repo/cars-web build 2>&1 | grep -E "built in|error"
```

Expected: `✓ built in Xs` with no errors.

- [ ] **Step 3: Create draft PR if one doesn't exist, otherwise update existing PR #286**

The changes may be pushed to the same branch as the previous objectives redesign PR. If PR #286 is already merged (it was), a new PR should be opened automatically from this branch.
