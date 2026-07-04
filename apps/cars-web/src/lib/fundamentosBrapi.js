// Fundamentos REAIS da brapi → critérios IdV.
// Converte a resposta de /quote/{ticker}?modules=defaultKeyStatistics,financialData
// nos ids dos critérios (lib/criteriosIdV.js), preenchendo só o que a API
// realmente traz — o resto (tag along, anos de lucro, tipo etc.) continua
// manual ou via "Analisar com IA". Números normalizados: % como 12.3, razões
// com 2 casas.

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Yahoo/brapi ora mandam percentuais como fração (0.271) ora já em %
// (27.1). Heurística: |v| < 1 → fração → ×100.
const pct = (v) => {
  const n = num(v);
  if (n == null) return null;
  return r1(Math.abs(n) < 1 ? n * 100 : n);
};

/**
 * @param {object} raw     results[0] da brapi
 * @param {string} classe  fii | acao | stock | reit
 * @returns {{ dados: object, preenchidos: number }}
 */
export function mapearFundamentosBrapi(raw, classe) {
  const dados = {};
  if (!raw || typeof raw !== "object") return { dados, preenchidos: 0 };
  const ks = raw.defaultKeyStatistics || {};
  const fin = raw.financialData || {};

  const põe = (id, v) => { if (v != null && Number.isFinite(v)) dados[id] = v; };

  // Comuns a todas as classes com dados de mercado
  const dy = pct(ks.dividendYield);
  const preco = num(raw.regularMarketPrice);
  const volume = num(raw.regularMarketVolume);
  const bookValue = num(ks.bookValue);
  const acoes = num(ks.sharesOutstanding);
  const plBi = bookValue != null && acoes != null ? r1((bookValue * acoes) / 1e9) : null;

  if (classe === "fii") {
    põe("dy", dy);
    põe("patrimonio", plBi != null ? r2(plBi) : null);
    return { dados, preenchidos: Object.keys(dados).length };
  }

  // acao / stock / reit compartilham a maioria dos ids
  põe("roe", pct(fin.returnOnEquity));
  põe("margemLiq", pct(fin.profitMargins));
  põe("margemEbit", pct(fin.operatingMargins));

  const totalDebt = num(fin.totalDebt);
  const ebitda = num(fin.ebitda);
  if (totalDebt != null && ebitda != null && ebitda > 0) põe("dividaEbitda", r2(totalDebt / ebitda));

  if (classe === "acao") {
    põe("pl", plBi);
    if (preco != null && volume != null) põe("liquidez", r1((preco * volume) / 1e6)); // R$ M/dia
  }

  return { dados, preenchidos: Object.keys(dados).length };
}
