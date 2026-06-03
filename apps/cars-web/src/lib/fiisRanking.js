/* ============================================================
   RANKING FIIs · provedor de dados (BRAPI + base curada → notas)

   Monta o universo de FIIs (BRAPI), enriquece com os indicadores curados
   (base de fundamentos, quando houver) e pontua com notasFiis. Campos que
   ainda não temos automáticos (vacância, nº imóveis, taxa) entram depois
   com a CVM (dados abertos) — aqui a estrutura já fica pronta.
   ============================================================ */
import { rankearFiis } from "./notasFiis.js";
import { API } from "./api.js";

// Heurística de tipo (tijolo/papel) a partir do nome/segmento da BRAPI.
// A CVM refina isso depois; aqui é só pra não vir vazio.
function inferirTipo(nome, segmento) {
  const t = `${nome || ""} ${segmento || ""}`.toLowerCase();
  if (/papel|cri|receb|t[ií]tulo|cr[ée]dito|high\s*yield|fof/.test(t)) return "Papel";
  return "Tijolo";
}

/**
 * Carrega e pontua o ranking de FIIs.
 * @param {object} opts { token?, fundamentos?:map, max?:number, soPotencial?, minGeral? }
 * @returns {Promise<{ok, linhas, erro?, fonte?}>}
 */
export async function carregarRankingFiis({ token, fundamentos = {}, max = 0, soPotencial = false, minGeral = 0 } = {}) {
  const stocks = await API.fiiList(token);
  if (!stocks || !stocks.length) {
    return { ok: false, linhas: [], erro: "Não consegui buscar a lista de FIIs na BRAPI. Confira o token BRAPI em ⚙ Configurações." };
  }
  let universo = stocks.filter(s => /11$/.test(String(s.stock || "")));
  if (max > 0) universo = universo.slice(0, max);

  const ativos = universo.map(s => {
    const tk = String(s.stock).toUpperCase();
    const cur = fundamentos[tk]?.dados || {};
    const segmento = cur.segmento || s.sector || "";
    const tipo = cur.tipo || inferirTipo(s.name, segmento);
    return {
      ticker: tk,
      nome: cur.nome || fundamentos[tk]?.nome || s.name || tk,
      tipo,
      segmento,
      vacancia: cur.vacancia,
      imoveis: cur.imoveis,
      inquilinos: cur.inquilinos,
      pctCRI: cur.pctCRI,
      numAtivos: cur.numAtivos,
      ipoAnos: cur.ipo ?? cur.ipoAnos,
      taxaAdm: cur.taxaAdm,
      dy: cur.dy ?? s.dividendYield ?? null,
      preco: s.close ?? null,
    };
  });

  return { ok: true, linhas: rankearFiis(ativos, { soPotencial, minGeral }), fonte: universo.length };
}
