import React from "react";

/* ============================================================
   Ilustrações alegres (vetor/SVG) para a Agenda.
   Estilo flat/cute: um mascote redondinho sorridente + um
   acessório temático em cima. Leves, sem dependências, e com
   cores próprias (não dependem do tema) pra ficarem sempre alegres.
   ============================================================ */

// Mascote base: corpo, carinha (olhos, sorriso, bochechas) e um
// elemento "topo" (estrela, lâmpada, etc.) passado por quem chama.
function Mascote({ cor, cor2, topo = null, size = 72, bg = null }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {bg && <circle cx="50" cy="50" r="47" fill={bg} />}
      {topo}
      {/* corpo */}
      <ellipse cx="50" cy="61" rx="26" ry="24" fill={cor} />
      <ellipse cx="50" cy="67" rx="16" ry="13" fill={cor2} opacity="0.55" />
      {/* pezinhos */}
      <ellipse cx="41" cy="85" rx="6.5" ry="4.5" fill={cor} />
      <ellipse cx="59" cy="85" rx="6.5" ry="4.5" fill={cor} />
      {/* olhos */}
      <circle cx="43" cy="58" r="2.9" fill="#3f3330" />
      <circle cx="57" cy="58" r="2.9" fill="#3f3330" />
      <circle cx="44.1" cy="56.9" r="0.95" fill="#fff" />
      <circle cx="58.1" cy="56.9" r="0.95" fill="#fff" />
      {/* sorriso */}
      <path d="M44 65 Q50 70 56 65" stroke="#3f3330" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* bochechas */}
      <ellipse cx="37" cy="63" rx="3.6" ry="2.3" fill="#fb7185" opacity="0.5" />
      <ellipse cx="63" cy="63" rx="3.6" ry="2.3" fill="#fb7185" opacity="0.5" />
    </svg>
  );
}

/* ---------- Acessórios de topo ---------- */
const Estrela = ({ c = "#fbbf24" }) => (
  <path d="M50 12 l3.6 7.3 8.1 1.2 -5.9 5.7 1.4 8.1 -7.2-3.8 -7.2 3.8 1.4-8.1 -5.9-5.7 8.1-1.2 z" fill={c} />
);
const Lampada = () => (
  <g>
    <circle cx="50" cy="24" r="10" fill="#fde047" />
    <rect x="46" y="32" width="8" height="5" rx="2" fill="#a3a3a3" />
    <path d="M46 27 q4 4 8 0" stroke="#f59e0b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </g>
);
const Check = () => (
  <g>
    <circle cx="50" cy="24" r="11" fill="#34d399" />
    <path d="M45 24.5 l3.5 3.5 6-7" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
const Calendario = () => (
  <g>
    <rect x="38" y="15" width="24" height="22" rx="4" fill="#fff" stroke="#60a5fa" strokeWidth="2.2" />
    <rect x="38" y="15" width="24" height="7" rx="3.5" fill="#60a5fa" />
    <circle cx="45" cy="29" r="2" fill="#f472b6" />
    <circle cx="55" cy="29" r="2" fill="#fbbf24" />
  </g>
);
const Coracao = ({ c = "#fb7185" }) => (
  <path d="M50 33 C 40 25, 38 16, 45 14 C 49 13, 50 17, 50 17 C 50 17, 51 13, 55 14 C 62 16, 60 25, 50 33 Z" fill={c} />
);
const Sol = () => (
  <g stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
    <circle cx="50" cy="23" r="8" fill="#fcd34d" stroke="none" />
    <line x1="50" y1="8" x2="50" y2="12" /><line x1="50" y1="34" x2="50" y2="38" />
    <line x1="35" y1="23" x2="39" y2="23" /><line x1="61" y1="23" x2="65" y2="23" />
    <line x1="39" y1="12" x2="42" y2="15" /><line x1="58" y1="15" x2="61" y2="12" />
  </g>
);
const Foguete = () => (
  <g>
    <path d="M50 12 C 56 18, 57 28, 50 34 C 43 28, 44 18, 50 12 Z" fill="#f87171" />
    <circle cx="50" cy="22" r="3" fill="#fff" />
    <path d="M45 30 l-4 6 6-2 z" fill="#fbbf24" /><path d="M55 30 l4 6 -6-2 z" fill="#fbbf24" />
  </g>
);

/* ============================================================
   Estados vazios — por tipo de seção
   ============================================================ */
const VAZIO = {
  eventos: { cor: "#93c5fd", cor2: "#bfdbfe", bg: "#dbeafe", topo: <Calendario /> },
  tarefas: { cor: "#6ee7b7", cor2: "#a7f3d0", bg: "#d1fae5", topo: <Check /> },
  metas:   { cor: "#fcd9a8", cor2: "#fde9cf", bg: "#fef3c7", topo: <Estrela /> },
  ideias:  { cor: "#c4b5fd", cor2: "#ddd6fe", bg: "#ede9fe", topo: <Lampada /> },
};

export function IlustraVazio({ tipo = "metas", size = 76 }) {
  const cfg = VAZIO[tipo] || VAZIO.metas;
  return <Mascote cor={cfg.cor} cor2={cfg.cor2} bg={cfg.bg} topo={cfg.topo} size={size} />;
}

/* ============================================================
   Mascotes das Metas — paleta + acessório variando por índice,
   com tentativa de casar pelo nome (praia, viagem, casa…).
   ============================================================ */
const PALETAS = [
  { cor: "#f9a8c8", cor2: "#fbcfe1", bg: "#fce7f3", topo: <Coracao /> },
  { cor: "#7dd3fc", cor2: "#bae6fd", bg: "#e0f2fe", topo: <Sol /> },
  { cor: "#fcd34d", cor2: "#fde68a", bg: "#fef9c3", topo: <Estrela /> },
  { cor: "#86efac", cor2: "#bbf7d0", bg: "#dcfce7", topo: <Foguete /> },
  { cor: "#c4b5fd", cor2: "#ddd6fe", bg: "#ede9fe", topo: <Estrela c="#a78bfa" /> },
  { cor: "#fdba74", cor2: "#fed7aa", bg: "#ffedd5", topo: <Sol /> },
];

const POR_NOME = [
  { re: /praia|mar|ver[aã]o|sol/i, idx: 1 },
  { re: /viag|trip|f[ée]rias|avi[ãa]o|mundo/i, idx: 3 },
  { re: /casa|lar|im[óo]vel|apart/i, idx: 5 },
  { re: /carro|moto|ve[íi]culo/i, idx: 3 },
  { re: /reserva|emerg[êe]ncia|poupan|guard/i, idx: 2 },
  { re: /amor|casa(mento)?|anel|presente/i, idx: 0 },
];

export function MetaMascote({ seed = 0, nome = "", size = 44 }) {
  let idx = seed % PALETAS.length;
  const m = POR_NOME.find(p => p.re.test(nome || ""));
  if (m) idx = m.idx;
  const cfg = PALETAS[idx];
  return <Mascote cor={cfg.cor} cor2={cfg.cor2} bg={cfg.bg} topo={cfg.topo} size={size} />;
}
