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
 * Gera série sintética de 12 retornos mensais ao redor do retorno real do ativo.
 * Apenas pra alimentar Sharpe/Drawdown com dados verossímeis.
 */
const gerarSerie = (retornoAlvo, vol = 0.05, n = 12) => {
  const serie = [];
  for (let i = 0; i < n; i++) {
    // ruído normal aproximado por Box-Muller simplificado
    const u1 = Math.random() || 0.001;
    const u2 = Math.random();
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
  const serie = gerarSerie(r, 0.04);
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
  const serie = gerarSerie(r, 0.04);
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
  const serie = gerarSerie(r, 0.05);
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
  const serie = gerarSerie(r, 0.04);
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
  const serie = gerarSerie(r, 0.04, 240); // 20 anos pra ter cauda
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
export const calendarioProventos = (ativos, hoje = new Date()) => {
  const proventos = [];

  ativos.forEach(a => {
    const tipo = (a.tipo || "").toLowerCase();
    if (tipo !== "acao" && tipo !== "fii") return;

    const qtd = Number(a.qtd || 0);
    const preco = Number(a.preco || 0);
    if (qtd <= 0 || preco <= 0) return;

    // FII: rendimento ~ 0,8% ao mês. Ação: dividendo ~ 0,5-1% (trimestral).
    let valorPorCota = 0;
    let frequencia = 1;
    let tipoProv = "";

    if (tipo === "fii") {
      valorPorCota = preco * (0.007 + Math.random() * 0.005);
      frequencia = 1; // todo mês
      tipoProv = "Rendimento";
    } else {
      valorPorCota = preco * (0.005 + Math.random() * 0.01);
      frequencia = 3; // trimestral
      tipoProv = Math.random() > 0.5 ? "Dividendo" : "JCP";
    }

    for (let m = 1; m <= 3; m++) {
      if (tipo === "acao" && m % frequencia !== 0) continue;
      const data = new Date(hoje);
      data.setDate(15 + Math.floor(Math.random() * 10));
      data.setMonth(data.getMonth() + m - 1);

      proventos.push({
        data: data.toISOString().slice(0, 10),
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
