/**
 * 🚨 Alerta de gasto fora do normal (2026-09-29) — detecção de anomalia
 * ao estilo dos apps de 2026, SEM IA: heurística sobre os próprios dados.
 *
 * Dois sinais, ambos comparando com a média dos 3 meses anteriores:
 *  - CATEGORIA ESTOURADA: gasto do mês corrente ≥ 2× a média da categoria
 *    (e diferença ≥ R$ 100, categoria com histórico em ≥ 2 meses);
 *  - COMPRA ATÍPICA: despesa dos últimos 7 dias ≥ 3× a média das compras
 *    daquela categoria (e ≥ R$ 300).
 * Devolve itens no formato dos avisos do resumo do dia ({icone,texto,cor}).
 * Puro e testável.
 */

const mesKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const DIA_MS = 24 * 60 * 60 * 1000;

export function detectarAnomalias({ transacoes = [], hoje = new Date(), fmt = (v) => String(v), max = 3 } = {}) {
  const mesAtual = mesKey(hoje);
  const meses3 = [];
  for (let i = 1; i <= 3; i++) meses3.push(mesKey(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)));

  // Soma por categoria: mês corrente e cada um dos 3 anteriores; e a lista
  // de valores por categoria nos 3m (pra média por compra).
  const atualPorCat = new Map();
  const passadoPorCatMes = new Map(); // cat -> Map(mes -> soma)
  const valoresPorCat = new Map();    // cat -> [valores 3m]
  for (const t of transacoes) {
    if (!t || t.tipo !== "despesa") continue;
    const v = Number(t.valor);
    if (!Number.isFinite(v) || v <= 0) continue;
    const mes = String(t.data || "").slice(0, 7);
    const cat = t.categoria || "Sem categoria";
    if (mes === mesAtual) {
      atualPorCat.set(cat, (atualPorCat.get(cat) || 0) + v);
    } else if (meses3.includes(mes)) {
      if (!passadoPorCatMes.has(cat)) passadoPorCatMes.set(cat, new Map());
      const m = passadoPorCatMes.get(cat);
      m.set(mes, (m.get(mes) || 0) + v);
      if (!valoresPorCat.has(cat)) valoresPorCat.set(cat, []);
      valoresPorCat.get(cat).push(v);
    }
  }

  const avisos = [];

  // 1) Categoria estourada no mês
  for (const [cat, atual] of atualPorCat) {
    const porMes = passadoPorCatMes.get(cat);
    if (!porMes || porMes.size < 2) continue; // precisa de histórico
    const media = [...porMes.values()].reduce((s, x) => s + x, 0) / 3; // média sobre 3 meses
    if (media <= 0) continue;
    const razao = atual / media;
    if (razao >= 2 && atual - media >= 100) {
      avisos.push({
        icone: "🚨", cor: "red", _peso: razao,
        texto: `${cat} já está em ${fmt(atual)} — ${razao.toFixed(1)}× a média (${fmt(media)}/mês)`,
      });
    }
  }

  // 2) Compra atípica nos últimos 7 dias
  const corte = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 7).getTime();
  for (const t of transacoes) {
    if (!t || t.tipo !== "despesa") continue;
    const v = Number(t.valor);
    const td = Date.parse(String(t.data || "").slice(0, 10));
    if (!Number.isFinite(v) || v < 300 || !Number.isFinite(td)) continue;
    if (td < corte || td > hoje.getTime() + DIA_MS) continue;
    const cat = t.categoria || "Sem categoria";
    const vals = valoresPorCat.get(cat) || [];
    if (vals.length < 3) continue; // precisa de histórico de compras
    const mediaCompra = vals.reduce((s, x) => s + x, 0) / vals.length;
    if (mediaCompra > 0 && v >= 3 * mediaCompra) {
      avisos.push({
        icone: "👀", cor: "gold", _peso: v / mediaCompra,
        texto: `Compra atípica: ${t.descricao || cat} ${fmt(v)} (média em ${cat}: ${fmt(mediaCompra)})`,
      });
    }
  }

  return avisos
    .sort((a, b) => b._peso - a._peso)
    .slice(0, max)
    .map(({ _peso, ...a }) => a);
}
