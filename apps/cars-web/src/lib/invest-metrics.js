/* ============================================================
   INVEST METRICS · Sharpe, Sortino, Drawdown, VaR, Beta
   Cálculos clássicos a partir de séries de retornos.
   ============================================================ */

const CDI_ANUAL = 0.105;       // 10,5% a.a.
const CDI_DIARIO = 0.000395;   // CDI diário aproximado

/**
 * Estima retorno mensal de um ativo a partir do preço médio e cotação atual.
 * Como não temos histórico real de preços por dia, simulamos com base na variação.
 */
export const retornoMensal = (ativo) => {
  const preco = Number(ativo.preco || 0);
  const precoMedio = Number(ativo.pm ?? ativo.precoMedio ?? ativo.preco ?? 0);
  if (precoMedio <= 0) return 0;
  return (preco - precoMedio) / precoMedio;
};

/**
 * Gera série sintética de retornos mensais ao redor do retorno real do ativo —
 * usada só como ESTIMATIVA ILUSTRATIVA quando não há histórico real de preços.
 * DETERMINÍSTICA: mesma carteira → mesma série (seed derivada dos ativos),
 * em vez de Math.random() que mudava os números a cada render.
 */
function seedFrom(str = "") {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedDaCarteira = (ativos = []) =>
  ativos.map((a) => `${a.ticker}:${a.qtd}:${a.pm}`).join("|") || "af4";

const gerarSerie = (retornoAlvo, vol = 0.05, n = 12, seedStr = "af4") => {
  const rnd = mulberry32(seedFrom(seedStr));
  const serie = [];
  for (let i = 0; i < n; i++) {
    // ruído normal aproximado por Box-Muller simplificado
    const u1 = rnd() || 0.001;
    const u2 = rnd();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    serie.push(retornoAlvo / n + z * vol);
  }
  return serie;
};

/**
 * Retorno mensal médio da carteira (ponderado pelo valor de cada ativo).
 */
export const retornoCarteira = (ativos) => {
  const total = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  if (total <= 0) return 0;
  return ativos.reduce((s, a) => {
    const valor = Number(a.qtd || 0) * Number(a.preco || 0);
    const peso = valor / total;
    return s + peso * retornoMensal(a);
  }, 0);
};

/**
 * Sharpe Ratio = (retorno - taxa livre de risco) / volatilidade
 * Anualizado.
 */
export const sharpeRatio = (ativos) => {
  if (!ativos || ativos.length === 0) return null;
  const r = retornoCarteira(ativos);
  const rAnualizado = (1 + r) ** 12 - 1;
  const serie = gerarSerie(r, 0.04, 12, seedDaCarteira(ativos));
  const media = serie.reduce((s, x) => s + x, 0) / serie.length;
  const variancia = serie.reduce((s, x) => s + (x - media) ** 2, 0) / serie.length;
  const vol = Math.sqrt(variancia) * Math.sqrt(12); // anualizado
  if (vol === 0) return null;
  return ((rAnualizado - CDI_ANUAL) / vol).toFixed(2);
};

/**
 * Sortino Ratio = (retorno - taxa livre) / desvio downside
 */
export const sortinoRatio = (ativos) => {
  if (!ativos || ativos.length === 0) return null;
  const r = retornoCarteira(ativos);
  const rAnualizado = (1 + r) ** 12 - 1;
  const serie = gerarSerie(r, 0.04, 12, seedDaCarteira(ativos));
  const negativos = serie.filter(x => x < 0);
  if (negativos.length === 0) return "∞";
  const downsideVar = negativos.reduce((s, x) => s + x ** 2, 0) / negativos.length;
  const downside = Math.sqrt(downsideVar) * Math.sqrt(12);
  if (downside === 0) return null;
  return ((rAnualizado - CDI_ANUAL) / downside).toFixed(2);
};

/**
 * Drawdown máximo (queda do pico ao vale) nos últimos 12 meses simulados.
 */
export const maxDrawdown = (ativos) => {
  if (!ativos || ativos.length === 0) return null;
  const r = retornoCarteira(ativos);
  const serie = gerarSerie(r, 0.05, 12, seedDaCarteira(ativos));
  let pico = 1, valor = 1, maxDD = 0;
  for (const ret of serie) {
    valor *= (1 + ret);
    if (valor > pico) pico = valor;
    const dd = (pico - valor) / pico;
    if (dd > maxDD) maxDD = dd;
  }
  return (-(maxDD * 100)).toFixed(1);
};

/**
 * Volatilidade anualizada (%).
 */
export const volatilidade = (ativos) => {
  if (!ativos || ativos.length === 0) return null;
  const r = retornoCarteira(ativos);
  const serie = gerarSerie(r, 0.04, 12, seedDaCarteira(ativos));
  const media = serie.reduce((s, x) => s + x, 0) / serie.length;
  const variancia = serie.reduce((s, x) => s + (x - media) ** 2, 0) / serie.length;
  const vol = Math.sqrt(variancia) * Math.sqrt(12) * 100;
  return vol.toFixed(1);
};

/**
 * VaR 95% (valor em risco) mensal — perda máxima provável.
 */
export const valueAtRisk = (ativos, percentil = 0.95) => {
  if (!ativos || ativos.length === 0) return null;
  const r = retornoCarteira(ativos);
  const serie = gerarSerie(r, 0.04, 240, seedDaCarteira(ativos)); // 20 anos pra ter cauda
  serie.sort((a, b) => a - b);
  const idx = Math.floor(serie.length * (1 - percentil));
  const perdaPercent = serie[idx];
  const valorCarteira = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  return Math.abs(perdaPercent * valorCarteira);
};

/**
 * Beta vs IBOV (proxy: ações vs FIIs vs cripto vs RF).
 * Usamos um beta médio típico por classe.
 */
const BETA_CLASSE = { acao: 1.0, fii: 0.5, cripto: 1.6, rf: 0.05, etf: 0.95, outro: 0.5 };

export const beta = (ativos) => {
  if (!ativos || ativos.length === 0) return null;
  const total = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  if (total <= 0) return null;
  const betaPond = ativos.reduce((s, a) => {
    const valor = Number(a.qtd || 0) * Number(a.preco || 0);
    const peso = valor / total;
    const tipo = (a.tipo || "outro").toLowerCase();
    return s + peso * (BETA_CLASSE[tipo] || BETA_CLASSE.outro);
  }, 0);
  return betaPond.toFixed(2);
};

/**
 * Alpha (excesso de retorno sobre CDI), em pontos percentuais.
 */
export const alpha = (ativos) => {
  if (!ativos || ativos.length === 0) return null;
  const r = retornoCarteira(ativos);
  const rAnualizado = (1 + r) ** 12 - 1;
  return ((rAnualizado - CDI_ANUAL) * 100).toFixed(1);
};

/**
 * Stress test em cenários macro.
 * Retorna { cenario, prob, impactoPct, valorEstimado }
 */
export const stressTest = (ativos) => {
  const total = (ativos || []).reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  if (!ativos || ativos.length === 0 || total <= 0) return [];

  // Pesos por classe
  const pesos = { acao: 0, fii: 0, cripto: 0, rf: 0, etf: 0, outro: 0 };
  ativos.forEach(a => {
    const valor = Number(a.qtd || 0) * Number(a.preco || 0);
    const tipo = (a.tipo || "outro").toLowerCase();
    pesos[tipo] = (pesos[tipo] || 0) + valor / total;
  });

  const cenarios = [
    {
      nome: "Selic sobe 2pp",
      prob: "Moderada",
      // ações caem, FII cai, RF sobe um pouco
      impactoPct: -(pesos.acao * 8 + pesos.fii * 10 + pesos.cripto * 2 - pesos.rf * 4),
    },
    {
      nome: "Crise cambial (USD +20%)",
      prob: "Baixa",
      // cripto sobe, ações exportadoras sobem, FII fica
      impactoPct: (pesos.cripto * 15 + pesos.acao * 3 - pesos.fii * 2),
    },
    {
      nome: "Crash IBOV −30%",
      prob: "Baixa",
      impactoPct: -(pesos.acao * 30 + pesos.fii * 15 + pesos.cripto * 25),
    },
    {
      nome: "Bull market (+25%)",
      prob: "Moderada",
      impactoPct: (pesos.acao * 25 + pesos.fii * 12 + pesos.cripto * 35 + pesos.rf * 2),
    },
  ];

  return cenarios.map(c => ({
    ...c,
    impactoPct: c.impactoPct.toFixed(1),
    valorEstimado: total * (1 + c.impactoPct / 100),
  }));
};

/**
 * Calendário de proventos simulado para os próximos 90 dias.
 * Cada ativo tipo "acao" ou "fii" gera 1 provento por mês.
 */
// Pseudo-random determinístico baseado em string (mesma seed = mesmo resultado)
function pseudoRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // LCG simples — gera valor em [0,1)
  return ((h * 9301 + 49297) % 233280) / 233280;
}

export const calendarioProventos = (ativos, hoje = new Date()) => {
  const proventos = [];

  ativos.forEach(a => {
    const tipo = (a.tipo || "").toLowerCase();
    if (tipo !== "acao" && tipo !== "fii") return;

    const qtd = Number(a.qtd || 0);
    const preco = Number(a.preco || 0);
    if (qtd <= 0 || preco <= 0) return;

    // FII: rendimento ~ 0,7-1,2% ao mês. Ação: dividendo ~ 0,5-1,5% (trimestral).
    // Usa pseudoRandom estável (mesma seed = mesmo valor a cada render)
    let valorPorCota = 0;
    let frequencia = 1;
    let tipoProv = "";

    if (tipo === "fii") {
      valorPorCota = preco * (0.007 + pseudoRandom(`${a.ticker}-yield`) * 0.005);
      frequencia = 1; // todo mês
      tipoProv = "Rendimento";
    } else {
      valorPorCota = preco * (0.005 + pseudoRandom(`${a.ticker}-yield`) * 0.01);
      frequencia = 3; // trimestral
      tipoProv = pseudoRandom(`${a.ticker}-type`) > 0.5 ? "Dividendo" : "JCP";
    }

    for (let m = 1; m <= 3; m++) {
      if (tipo === "acao" && m % frequencia !== 0) continue;
      const data = new Date(hoje);
      // dia 15 + offset estável (mesmo ticker+mês = mesmo dia)
      data.setDate(15 + Math.floor(pseudoRandom(`${a.ticker}-day-${m}`) * 10));
      data.setMonth(data.getMonth() + m - 1);
      const dataISO = data.toISOString().slice(0, 10);

      proventos.push({
        // Key estável pra rastreio de "recebido"
        id: `${a.ticker}-${dataISO}-${tipoProv}`,
        data: dataISO,
        ticker: a.ticker || a.nome,
        tipo: tipoProv,
        valorPorCota,
        qtd,
        total: valorPorCota * qtd,
      });
    }
  });

  return proventos.sort((a, b) => a.data.localeCompare(b.data));
};
