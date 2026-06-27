// Orçamento por categoria: usa o campo `limite` (orçamento mensal) das categorias
// de despesa e compara com o gasto do mês. Mesmos limiares dos alertas do app:
//   ≥100% → "estourado", ≥80% → "alerta", senão "ok".

/**
 * @param {Array} categorias  categorias (cada uma { nome, tipo, limite, cor })
 * @param {Array} transacoes  transações JÁ filtradas por escopo (o chamador filtra)
 * @param {string} mesISO     "YYYY-MM" do mês a avaliar
 * @returns {Array<{ id, nome, cor, limite, gasto, pct, estado }>} ordenado por % desc
 */
export function calcOrcamentoCategorias(categorias = [], transacoes = [], mesISO) {
  const gastoPorCat = {};
  for (const t of transacoes || []) {
    if (!t || t.tipo !== "despesa") continue;
    if (mesISO && !String(t.data || "").startsWith(mesISO)) continue;
    const cat = t.categoria || "";
    if (!cat) continue;
    gastoPorCat[cat] = (gastoPorCat[cat] || 0) + (Number(t.valor) || 0);
  }

  return (categorias || [])
    .filter((c) => c && c.tipo === "despesa" && Number(c.limite) > 0)
    .map((c) => {
      const limite = Number(c.limite) || 0;
      const gasto = gastoPorCat[c.nome] || 0;
      const pct = limite > 0 ? (gasto / limite) * 100 : 0;
      const estado = pct >= 100 ? "estourado" : pct >= 80 ? "alerta" : "ok";
      return { id: c.id, nome: c.nome, cor: c.cor, limite, gasto, pct, estado };
    })
    .sort((a, b) => b.pct - a.pct);
}
