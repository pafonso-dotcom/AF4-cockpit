// Paletas semânticas compartilhadas — mood (diário), prioridade (tarefas) e
// tipo de evento (agenda/calendário). Antes essas cores estavam hardcoded e
// repetidas em Diario.jsx, AgendaInicio.jsx e Calendario.jsx. Centralizar aqui
// evita divergência e facilita ajuste único.
//
// São cores fixas (não dependem do tema) porque representam SIGNIFICADO
// (verde = bom, vermelho = ruim, etc.), mas foram escolhidas com saturação
// média para manter contraste razoável tanto em fundo claro quanto escuro.

// ===== Humor / mood (Diário) — 5 a 1 =====
export const MOOD = [
  { v: 5, emoji: "😄", label: "Ótimo",   cor: "#3f9e4d" },
  { v: 4, emoji: "🙂", label: "Bem",     cor: "#6fae4f" },
  { v: 3, emoji: "😐", label: "Neutro",  cor: "#b08a3a" },
  { v: 2, emoji: "😕", label: "Mal",     cor: "#c97a4a" },
  { v: 1, emoji: "😢", label: "Difícil", cor: "#cf5a48" },
];

// ===== Prioridade (Tarefas / foco do dia) =====
export const PRIORIDADE_COR = {
  alta:  "#d64545",
  media: "#c08a2a",
  baixa: "#3f7fb8",
};

// ===== Tipo de evento (Agenda / Calendário) =====
export const EVENTO_TIPO = {
  compromisso: { cor: "#b08a3a", lbl: "Compromisso" },
  viagem:      { cor: "#3f9e4d", lbl: "Viagem" },
  lembrete:    { cor: "#3f7fb8", lbl: "Lembrete" },
  pessoal:     { cor: "#cf5a78", lbl: "Pessoal" },
  evento:      { cor: "#c97a4a", lbl: "Evento" },
};
