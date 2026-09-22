/* ============================================================
   MAPA DE GASTOS DO CALENDÁRIO · em que dias o dinheiro saiu

   Soma as DESPESAS REAIS (transações) por dia do mês, com recorte
   opcional por categoria (a raiz conta junto com as filhas).
   Alimenta o modo "💸 Gastos" do Calendário: célula mais escura =
   dia que gastou mais.

   O que NÃO conta como gasto:
   - transferência entre contas (transferenciaId) — dinheiro só mudou
     de bolso;
   - receitas, obviamente.
   Aceita o tipo legado "saida" além de "despesa".
   ============================================================ */

export function mapaGastosMes({ transacoes = [], categorias = [], ym, categoriaFiltro = "" } = {}) {
  // Filtro por categoria: a raiz escolhida + as filhas dela (parentId).
  let nomesFiltro = null;
  if (categoriaFiltro) {
    const raiz = (categorias || []).find(c => c?.nome === categoriaFiltro);
    const filhas = raiz ? (categorias || []).filter(c => c?.parentId === raiz.id).map(c => c.nome) : [];
    nomesFiltro = new Set([categoriaFiltro, ...filhas]);
  }

  const porDia = {};
  let total = 0;
  for (const t of transacoes || []) {
    if (!t || (t.tipo !== "despesa" && t.tipo !== "saida")) continue;
    if (!String(t.data || "").startsWith(ym)) continue;
    if (t.transferenciaId) continue;
    const cat = t.categoria || "Sem categoria";
    if (nomesFiltro && !nomesFiltro.has(cat)) continue;
    const dia = parseInt(String(t.data).slice(8, 10), 10);
    if (!(dia >= 1 && dia <= 31)) continue;
    const v = Number(t.valor) || 0;
    if (v <= 0) continue;
    const d = (porDia[dia] ||= { total: 0, porCategoria: {}, itens: 0 });
    d.total += v;
    d.itens += 1;
    d.porCategoria[cat] = (d.porCategoria[cat] || 0) + v;
    total += v;
  }

  let max = 0, diaMax = null;
  for (const [dia, d] of Object.entries(porDia)) {
    d.top = Object.entries(d.porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nome, valor]) => ({ nome, valor }));
    if (d.total > max) { max = d.total; diaMax = parseInt(dia, 10); }
  }

  return { porDia, max, diaMax, total };
}

/** Intensidade 0..1 pro heat da célula — raiz quadrada pra dias pequenos
 *  ainda aparecerem (escala linear apagava tudo que não fosse o pico). */
export function intensidadeGasto(valor, max) {
  if (!(max > 0) || !(valor > 0)) return 0;
  return Math.min(1, Math.sqrt(valor / max));
}

/** Escala de fogo em 4 degraus (menos → mais), estilo mapa de calor:
 *  marrom · laranja-queimado · laranja vivo · rosa-quente. */
export const CORES_HEAT = ["#4d3826", "#9c561c", "#ea771c", "#ff4d6d"];

export function corHeat(valor, max) {
  const i = intensidadeGasto(valor, max);
  if (i <= 0) return null;
  if (i < 0.35) return CORES_HEAT[0];
  if (i < 0.6) return CORES_HEAT[1];
  if (i < 0.85) return CORES_HEAT[2];
  return CORES_HEAT[3];
}

/** Padrão que dói: fim de semana gasta N× mais que dia útil (ou o inverso).
 *  Compara a MÉDIA diária (sáb+dom vs seg–sex) do mês; null se equilibrado
 *  ou sem dados dos dois lados. */
export function insightFimDeSemana(porDia = {}, ym = "") {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return null;
  let somaFds = 0, nFds = 0, somaUteis = 0, nUteis = 0;
  for (const [dia, d] of Object.entries(porDia)) {
    const dow = new Date(y, m - 1, Number(dia)).getDay();
    if (dow === 0 || dow === 6) { somaFds += d.total; nFds++; }
    else { somaUteis += d.total; nUteis++; }
  }
  if (!nFds || !nUteis) return null;
  const mFds = somaFds / nFds, mUteis = somaUteis / nUteis;
  if (mUteis <= 0 || mFds <= 0) return null;
  const ratio = mFds / mUteis;
  if (ratio >= 1.3) return { tipo: "fds", ratio: +ratio.toFixed(1) };
  if (ratio <= 1 / 1.3) return { tipo: "uteis", ratio: +(1 / ratio).toFixed(1) };
  return null;
}
