// Mapa de dividendos — monta uma grade Ativo × Mês (Jan–Dez) com a renda
// estimada de proventos, pra você montar uma carteira que paga o ano todo.
//
// Fonte dos meses de pagamento (híbrido):
//   1. override manual do usuário (clicou no mês);  2. inferido do histórico de
//   proventos já lançado;  3. default por tipo (FII = todo mês; ação = trimestral).
// A renda é estimada por yields-base (DY médio por classe), distribuída nos
// meses pagadores. Tudo local — nada de API.

import { YIELDS_MENSAIS } from "./yields-base.js";

export const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPOS_PAGADORES = ["acao", "fii", "stock", "reit"];

const norm = (s = "") => String(s).trim().toUpperCase();

// Meses default por tipo (índices 0–11).
export function mesesDefault(tipo) {
  if (tipo === "fii") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // mensal
  if (tipo === "acao" || tipo === "stock" || tipo === "reit") return [2, 5, 8, 11]; // trimestral (Mar/Jun/Set/Dez)
  return [];
}

// Infere os meses em que um ticker pagou, a partir do histórico de proventos
// lançados manualmente (cada item { data:"YYYY-MM-DD", ticker }).
export function inferirMesesDoHistorico(ticker, proventosManuais = []) {
  const tk = norm(ticker);
  const meses = new Set();
  for (const p of proventosManuais || []) {
    if (norm(p.ticker) !== tk) continue;
    const m = Number(String(p.data || "").slice(5, 7)) - 1;
    if (m >= 0 && m <= 11) meses.add(m);
  }
  return [...meses].sort((a, b) => a - b);
}

// DY estimado (%) por tipo, quando não há DY informado.
export function dyEstimado(tipo) {
  return (YIELDS_MENSAIS[tipo] ?? 0) * 12 * 100;
}

/**
 * Soma dos proventos POR COTA pagos nos últimos 12 meses.
 * Base do yield-on-cost: YoC = proventosPorCota12m / preço médio pago × 100.
 * @param {Array} divs  [{ pagamento:"YYYY-MM-DD", valor:number/cota }]
 * @param {Date} [hoje]
 */
export function proventosPorCota12m(divs = [], hoje = new Date()) {
  const limite = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
  const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
  return (divs || []).reduce((s, d) => (d && d.pagamento >= limiteISO && Number(d.valor) > 0 ? s + Number(d.valor) : s), 0);
}

function valorPosicao(item) {
  if (item.valorPlanejado != null) return Number(item.valorPlanejado) || 0; // candidato
  return (Number(item.qtd) || 0) * (Number(item.preco) || 0); // ativo da carteira
}

function mesesDoItem(item, overrides, mesesInferidos) {
  const ov = overrides[norm(item.ticker)];
  if (ov && Array.isArray(ov.meses)) return ov.meses;
  if (Array.isArray(item.meses) && item.meses.length) return item.meses; // candidato com meses explícitos
  const inf = mesesInferidos[norm(item.ticker)];
  if (inf && inf.length) return inf;
  return mesesDefault(item.tipo);
}

/**
 * Monta o mapa de dividendos.
 * @param {object} p
 * @param {Array} p.ativos        ativos da carteira ({ ticker, tipo, qtd, preco })
 * @param {Array} [p.candidatos]  planejados ({ ticker, tipo, valorPlanejado, dy?, meses? })
 * @param {object} [p.overrides]  { [TICKER]: { meses:number[] } } — ajustes do usuário
 * @param {Array} [p.proventosManuais] histórico p/ inferir meses
 * @param {object} [p.fundamentos]  { [TICKER]: { dados:{ dy } } } — DY real, se houver
 * @param {object} [p.historicoReal] { [TICKER]: [{ pagamento:"YYYY-MM-DD", valor:number/cota }] } — proventos anunciados (brapi)
 * @param {Date}   [p.hoje]       referência da janela de 12 meses (testável)
 * @returns {{ rows, totaisPorMes:number[], rendaAnualTotal:number, rendaMensalMedia:number, lacunas:number[] }}
 */
export function montarMapaDividendos({ ativos = [], candidatos = [], overrides = {}, proventosManuais = [], fundamentos = {}, historicoReal = {}, hoje = new Date() } = {}) {
  const itens = [
    ...ativos.filter((a) => a && TIPOS_PAGADORES.includes(a.tipo)).map((a) => ({ ...a, candidato: false })),
    ...candidatos.map((c) => ({ ...c, candidato: true })),
  ];

  const mesesInferidos = {};
  for (const it of itens) {
    const tk = norm(it.ticker);
    if (!(tk in mesesInferidos)) mesesInferidos[tk] = inferirMesesDoHistorico(tk, proventosManuais);
  }

  // Janela: últimos 12 meses a partir de `hoje`.
  const limite = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
  const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;

  const rows = itens.map((it) => {
    const valor = valorPosicao(it);

    // 1º) Histórico REAL de proventos (brapi) — só pra posições da carteira
    //     (candidato não tem qtd; continua estimado por DY planejado).
    const realDivs = !it.candidato ? (historicoReal[norm(it.ticker)] || []) : [];
    const pagamentos12m = realDivs.filter((d) => d && d.pagamento >= limiteISO && Number(d.valor) > 0);
    if (pagamentos12m.length > 0) {
      const qtd = Number(it.qtd) || 0;
      const rendaPorMes = Array(12).fill(0);
      pagamentos12m.forEach((d) => {
        const m = Number(String(d.pagamento).slice(5, 7)) - 1;
        if (m >= 0 && m <= 11) rendaPorMes[m] += Number(d.valor) * qtd;
      });
      const rendaAnual = rendaPorMes.reduce((s, v) => s + v, 0);
      const meses = rendaPorMes.map((v, m) => (v > 0 ? m : -1)).filter((m) => m >= 0);
      return {
        ticker: norm(it.ticker),
        nome: it.nome || "",
        tipo: it.tipo,
        candidato: false,
        real: true,
        valor,
        dy: valor > 0 ? (rendaAnual / valor) * 100 : 0,
        meses,
        rendaPorMes,
        rendaAnual,
      };
    }

    // 2º) Estimativa por DY (real curado > informado > média da classe).
    const meses = mesesDoItem(it, overrides, mesesInferidos).filter((m) => m >= 0 && m <= 11);
    const dyInformado = it.dy != null ? Number(it.dy) : Number(fundamentos[norm(it.ticker)]?.dados?.dy);
    const dy = Number.isFinite(dyInformado) && dyInformado > 0 ? dyInformado : dyEstimado(it.tipo);
    const rendaAnual = valor * (dy / 100);
    const porMesPag = meses.length ? rendaAnual / meses.length : 0;
    const rendaPorMes = Array(12).fill(0);
    meses.forEach((m) => { rendaPorMes[m] = porMesPag; });
    return {
      ticker: norm(it.ticker),
      nome: it.nome || "",
      tipo: it.tipo,
      candidato: !!it.candidato,
      real: false,
      valor,
      dy,
      meses,
      rendaPorMes,
      rendaAnual,
    };
  }).sort((a, b) => b.rendaAnual - a.rendaAnual);

  const totaisPorMes = Array(12).fill(0).map((_, m) => rows.reduce((s, r) => s + r.rendaPorMes[m], 0));
  const rendaAnualTotal = totaisPorMes.reduce((s, v) => s + v, 0);
  const lacunas = totaisPorMes.map((v, m) => (v <= 0.005 ? m : -1)).filter((m) => m >= 0);

  return {
    rows,
    totaisPorMes,
    rendaAnualTotal,
    rendaMensalMedia: rendaAnualTotal / 12,
    lacunas,
  };
}

/**
 * Juros mensais estimados dos ativos de RENDA FIXA (tesouro/CDB/RF) —
 * valor da posição × yield mensal da classe (lib/yields-base). Completa a
 * calculadora de meta: proventos (RV) + juros (RF) = renda mensal total.
 */
export function rendaFixaMensal(ativos = []) {
  const RF = ["tesouro", "cdb", "rf"];
  const porAtivo = (ativos || [])
    .filter((a) => a && RF.includes(String(a.tipo || "").toLowerCase()))
    .map((a) => {
      const valor = (Number(a.qtd) || 0) * (Number(a.preco) || 0);
      const rendaMensal = valor * (YIELDS_MENSAIS[String(a.tipo).toLowerCase()] ?? 0);
      return { ticker: norm(a.ticker || a.nome || "RF"), tipo: a.tipo, valor, rendaMensal };
    })
    .filter((x) => x.rendaMensal > 0)
    .sort((x, y) => y.rendaMensal - x.rendaMensal);
  return { porAtivo, total: porAtivo.reduce((s, x) => s + x.rendaMensal, 0) };
}

/**
 * Calculadora de meta de proventos: quanto a carteira gera por mês, quanto
 * falta pra meta, e o aporte necessário POR ATIVO (carteira + candidatos) pra
 * fechar o gap sozinho — quem tem DY maior precisa de menos aporte.
 * @param {object} p
 * @param {Array}  p.rows        linhas de montarMapaDividendos (têm dy e rendaAnual)
 * @param {number} p.metaMensal  renda mensal desejada (R$)
 * @param {object} [p.precos]    { [TICKER]: preço por cota } — pra converter aporte em cotas
 */
export function metaProventos({ rows = [], metaMensal = 0, precos = {}, rendaExtraMensal = 0 } = {}) {
  const rendaAnualTotal = rows.reduce((s, r) => s + (Number(r.rendaAnual) || 0), 0);
  const rendaMensalAtual = rendaAnualTotal / 12 + (Number(rendaExtraMensal) || 0);
  const meta = Number(metaMensal) || 0;

  if (meta <= 0) {
    return { rendaMensalAtual, gapMensal: 0, pctAtingido: 0, atingida: false, sugestoes: [] };
  }

  const gapMensal = Math.max(0, meta - rendaMensalAtual);
  const pctAtingido = Math.min(100, (rendaMensalAtual / meta) * 100);
  const atingida = gapMensal <= 0.005;

  const sugestoes = atingida ? [] : rows
    .filter((r) => Number(r.dy) > 0)
    .map((r) => {
      const dy = Number(r.dy);
      const aporteNecessario = (gapMensal * 12) / (dy / 100);
      const preco = Number(precos[r.ticker]) || null;
      return {
        ticker: r.ticker,
        tipo: r.tipo,
        candidato: !!r.candidato,
        real: !!r.real,
        dy,
        aporteNecessario,
        preco,
        cotas: preco ? Math.ceil(aporteNecessario / preco) : null,
      };
    })
    .sort((a, b) => b.dy - a.dy);

  return { rendaMensalAtual, gapMensal: atingida ? 0 : gapMensal, pctAtingido, atingida, sugestoes };
}
