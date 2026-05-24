import React from "react";
import { T } from "../../lib/theme.js";

export default function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600&display=swap');

      * { box-sizing: border-box; }
      body { margin: 0; }
      ::selection { background: ${T.gold}; color: ${T.bg}; }

      .grain {
        position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.04;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>");
      }
      .vignette {
        position: fixed; inset: 0; pointer-events: none; z-index: 0;
        background: radial-gradient(ellipse at center, transparent 50%, ${T.dark ? "rgba(0,0,0,0.55)" : "rgba(80,60,30,0.18)"} 100%);
      }
      .num { font-family: ${T.mono}; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; font-weight: 500; }
      .serif { font-family: ${T.serif}; }
      .body { font-family: ${T.body}; }
      .sans { font-family: ${T.sans}; }
      .label-eyebrow {
        font-family: ${T.sans}; font-size: 10px; letter-spacing: 0.25em;
        text-transform: uppercase; color: ${T.muted}; font-weight: 500;
      }
      .ornament {
        display: flex; align-items: center; gap: 12px; color: ${T.gold};
        font-family: ${T.serif}; font-style: italic;
      }
      .ornament::before, .ornament::after {
        content: ""; flex: 1; height: 1px;
        background: linear-gradient(to right, transparent, ${T.border}, transparent);
      }
      .card-hover { transition: all 0.3s ease; }
      .card-hover:hover { border-color: ${T.borderHi}; transform: translateY(-2px); }
      .btn-gold {
        background: ${T.gold}; color: ${T.bg}; font-family: ${T.sans};
        font-weight: 600; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
        padding: 10px 20px; border: none; cursor: pointer; transition: all 0.2s;
      }
      .btn-gold:hover { background: ${T.goldHi}; }
      .btn-ghost {
        background: transparent; color: ${T.ink}; font-family: ${T.sans};
        font-weight: 500; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
        padding: 10px 20px; border: 1px solid ${T.border}; cursor: pointer; transition: all 0.2s;
      }
      .btn-ghost:hover { border-color: ${T.gold}; color: ${T.gold}; }
      input, select, textarea {
        background: ${T.bg}; color: ${T.ink}; border: 1px solid ${T.border};
        padding: 10px 12px; font-family: ${T.body}; font-size: 16px;
        outline: none; transition: border-color 0.2s; width: 100%;
      }
      input:focus, select:focus, textarea:focus { border-color: ${T.gold}; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: ${T.dark ? "invert(0.7) sepia(0.3)" : "invert(0.3) sepia(0.4)"}; cursor: pointer; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: ${T.bg}; }
      ::-webkit-scrollbar-thumb { background: ${T.border}; }
      ::-webkit-scrollbar-thumb:hover { background: ${T.borderHi}; }

      @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .fade-up { animation: fadeUp 0.5s ease-out both; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes spin { to { transform: rotate(360deg); } }
      .spin { animation: spin 1s linear infinite; }

      @keyframes skelPulse {
        0%, 100% { background-position: 0% 50%; opacity: 0.85; }
        50% { background-position: 100% 50%; opacity: 0.55; }
      }

      /* ========== PRINT / PDF (item 4) ========== */
      @media print {
        @page { size: A4 portrait; margin: 14mm; }
        body {
          background: #fff !important;
          color: #000 !important;
          font-size: 11pt;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body * {
          color: #000 !important;
          background: transparent !important;
          border-color: #999 !important;
          box-shadow: none !important;
        }
        /* Esconde tudo que não interessa */
        nav, header, .nav, .tabs, .qheader, button, .btn-gold, .btn-ghost,
        .no-print, [data-subnav], .grain, .vignette, .toast-container, .modal-overlay,
        [class*="overflow-x-auto"] > * + *,
        footer { display: none !important; }
        /* Mostra elementos marcados como print-only */
        .print-only { display: block !important; }
        /* Container limpo */
        .printable, .print-area {
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          background: #fff !important;
        }
        /* Tabelas com bordas limpas */
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        table th, table td {
          border: 1px solid #999 !important;
          padding: 6px 8px !important;
          font-size: 10pt !important;
        }
        /* Tipografia print */
        h1, h2, h3, h4 {
          color: #000 !important;
          page-break-after: avoid;
        }
        a { color: #000 !important; text-decoration: none !important; }
        /* Quebras de página inteligentes */
        .page-break { page-break-after: always; }
        .no-page-break { page-break-inside: avoid; }
      }

      /* ========== RESPONSIVO ========== */
      /* Mobile: reserva espaço pro BottomTabBar (56px) + safe-area-inset-bottom do iPhone.
         Footer fica escondido no celular (a tab bar substitui).
         Breakpoint subiu pra 768px pra cobrir iPad em portrait. */
      @media (max-width: 768px) {
        body { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0)); }
        footer { display: none !important; }
      }

      /* Touch-friendly: alvos clicáveis com mín 44px em mobile (iOS HIG) */
      @media (max-width: 768px) {
        button, .btn-gold, .btn-ghost { min-height: 44px; }
        input, select, textarea { font-size: 16px; padding: 12px 13px; } /* 16px evita zoom auto no iOS */

        /* Dashboard: KPIs ficam tininhos em 5 colunas no celular → 2 cols (hero ocupa 2). */
        .dash-kpi-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
        .dash-kpi-grid > :first-child { grid-column: 1 / -1; }  /* Patrimônio (hero) span 2 */
        .dash-mid-grid, .dash-bot-grid, .dash-metas-grid {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }
        /* Tipografia ligeiramente maior em valores numéricos do Dashboard */
        .dash-kpi-grid .num { font-size: 17px !important; }

        /* Header / SUBTABS rolam horizontalmente sem scrollbar visível */
        .subnav, [data-subnav] {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .subnav::-webkit-scrollbar, [data-subnav]::-webkit-scrollbar { display: none; }

        /* Tabelas longas: scroll horizontal */
        table { font-size: 12px; }
        .scroll-x-mobile { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        /* Hero / títulos */
        .h1 { font-size: 28px !important; }
        h1, h2 { word-break: break-word; }

        /* Cards e seções: reduzir padding */
        .card-mobile-pad { padding: 14px !important; }

        /* Grids comuns viram 1 col em mobile (menos os já responsivos) */
        .grid.grid-cols-2:not(.no-mobile-stack),
        .grid.grid-cols-3:not(.no-mobile-stack) { grid-template-columns: 1fr !important; }
        .grid-cols-4 { grid-template-columns: repeat(2, 1fr) !important; }

        /* Esconder visualmente itens marcados */
        .hide-mobile { display: none !important; }
      }

      /* Tablets pequenos */
      @media (min-width: 769px) and (max-width: 1024px) {
        .grid-cols-4 { grid-template-columns: repeat(2, 1fr) !important; }
      }
    `}</style>
  );
}

