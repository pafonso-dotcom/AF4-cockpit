/* ============================================================
   PROVENTOS PREVISTOS DO MÊS · KPI pro Resumo do dia

   Quanto ainda vai cair de dividendo/JCP/rendimento no mês
   corrente (pendentes = previstos no calendário − já recebidos
   − ignorados). Mesmo cálculo da tela Proventos, reduzido a um
   número pro Painel.
   ============================================================ */

import { calendarioProventos } from "./invest-metrics.js";

/** Cache local das cotas reais anunciadas (mesmo da tela Proventos/Mapa). */
export function lerProvReaisCache() {
  try {
    return JSON.parse(localStorage.getItem("af4:mapa-div:proventos-brapi:v1") || "null")?.porTicker || {};
  } catch { return {}; }
}

export function proventosPendentesDoMes({
  ativos = [],
  proventosRecebidos = {},
  proventosIgnorados = {},
  proventosManuais = [],
  provReais = {},
  hoje = new Date(),
} = {}) {
  const mesKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  let auto = [];
  try { auto = calendarioProventos(ativos, hoje, provReais) || []; } catch {}
  const todos = [...auto, ...(proventosManuais || [])];
  const pend = todos.filter(p =>
    p && String(p.data || "").slice(0, 7) === mesKey
    && !proventosRecebidos[p.id]
    && !proventosIgnorados[p.id]
  );
  return {
    total: pend.reduce((s, p) => s + (Number(p.total) || 0), 0),
    qtd: pend.length,
  };
}
