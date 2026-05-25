/**
 * Carteiras Modelo · presets IdV (Investidor de Verdade)
 *
 * Cada modelo define, por classe (fii / acao / stock / reit):
 *   - regras de boa prática (mín FIIs por segmento, diversificação setorial, etc.)
 *   - lista de tickers com % alvo dentro da classe
 *   - segmento/setor de cada ticker
 *
 * Os tickers/% saem direto das planilhas IdV (cf. prints).
 * Custom: usuário pode duplicar um preset e editar livre.
 */

// ============================================================
// FIIs — Modelo COMPLETO (11 FIIs em 5 segmentos)
// ============================================================
const FII_COMPLETO_TICKERS = [
  { ticker: "HGRE11", pct: 8.5,  segmento: "Laje Corporativa" },
  { ticker: "RCRB11", pct: 8.5,  segmento: "Laje Corporativa" },
  { ticker: "VILG11", pct: 8.5,  segmento: "Logística" },
  { ticker: "HGLG11", pct: 8.5,  segmento: "Logística" },
  { ticker: "VISC11", pct: 11.0, segmento: "Shopping" },
  { ticker: "XPML11", pct: 11.0, segmento: "Shopping" },
  { ticker: "VRTA11", pct: 10.0, segmento: "Recebíveis (TVM)" },
  { ticker: "BCRI11", pct: 10.0, segmento: "Recebíveis (TVM)" },
  { ticker: "KNRI11", pct: 16.0, segmento: "Recebíveis (TVM)" },
  { ticker: "HGRU11", pct: 5.0,  segmento: "Outros" },
  { ticker: "FIIB11", pct: 3.0,  segmento: "Outros" },
];

const FII_INICIANTE_TICKERS = [
  { ticker: "HGRE11", pct: 12.5, segmento: "Laje Corporativa" },
  { ticker: "RCRB11", pct: 12.5, segmento: "Laje Corporativa" },
  { ticker: "VILG11", pct: 12.5, segmento: "Logística" },
  { ticker: "HGLG11", pct: 12.5, segmento: "Logística" },
  { ticker: "VISC11", pct: 12.5, segmento: "Shopping" },
  { ticker: "XPML11", pct: 12.5, segmento: "Shopping" },
  { ticker: "VRTA11", pct: 12.5, segmento: "Recebíveis (TVM)" },
  { ticker: "BCRI11", pct: 12.5, segmento: "Recebíveis (TVM)" },
];

const FII_REGRAS = [
  { id: "min_2_por_seg",  tipo: "min_por_grupo", grupo: "segmento", valor: 2, label: "Pelo menos 2 FIIs por segmento" },
  { id: "pct_seg_25",     tipo: "alvo_grupo_pct", grupo: "segmento", valor: 25, tolerancia: 8, label: "~25% por segmento (exceto Outros)" },
  { id: "qtd_min",        tipo: "min_tickers", valor: 8, label: "Mínimo 8 FIIs" },
  { id: "qtd_max",        tipo: "max_tickers", valor: 15, label: "Máximo 15 FIIs" },
];

// ============================================================
// AÇÕES BR — Modelo COMPLETO (12 ações em 9 setores)
// ============================================================
const ACAO_COMPLETO_TICKERS = [
  { ticker: "FLRY3", pct: 11.0, segmento: "Saúde" },
  { ticker: "WEGE3", pct: 11.0, segmento: "Bens Industriais" },
  { ticker: "EGIE3", pct: 4.0,  segmento: "Energia Elétrica" },
  { ticker: "CPFE3", pct: 4.0,  segmento: "Energia Elétrica" },
  { ticker: "EQTL3", pct: 4.0,  segmento: "Energia Elétrica" },
  { ticker: "ITUB4", pct: 5.5,  segmento: "Bancos" },
  { ticker: "BBDC4", pct: 5.5,  segmento: "Bancos" },
  { ticker: "PSSA3", pct: 11.0, segmento: "Seguros" },
  { ticker: "ODPV3", pct: 11.0, segmento: "Saúde Odonto" },
  { ticker: "RENT3", pct: 11.0, segmento: "Aluguel de Veículos" },
  { ticker: "EZTC3", pct: 11.0, segmento: "Construção" },
  { ticker: "SMTO3", pct: 11.0, segmento: "Açúcar & Etanol" },
];

const ACAO_INICIANTE_TICKERS = [
  { ticker: "ITSA4", pct: 12.5, segmento: "Holding" },
  { ticker: "WEGE3", pct: 12.5, segmento: "Bens Industriais" },
  { ticker: "EGIE3", pct: 12.5, segmento: "Energia Elétrica" },
  { ticker: "ITUB4", pct: 12.5, segmento: "Bancos" },
  { ticker: "FLRY3", pct: 12.5, segmento: "Saúde" },
  { ticker: "PSSA3", pct: 12.5, segmento: "Seguros" },
  { ticker: "RENT3", pct: 12.5, segmento: "Aluguel de Veículos" },
  { ticker: "EZTC3", pct: 12.5, segmento: "Construção" },
];

const ACAO_REGRAS = [
  { id: "qtd_min",   tipo: "min_tickers", valor: 10, label: "Mínimo 10 empresas" },
  { id: "qtd_max",   tipo: "max_tickers", valor: 15, label: "Máximo 15 empresas" },
  { id: "setor_min", tipo: "min_grupos", grupo: "segmento", valor: 7,  label: "Diversificação em pelo menos 7 setores" },
  { id: "setor_max", tipo: "max_por_grupo", grupo: "segmento", valor: 22, label: "Máx 22% em um único setor" },
];

// ============================================================
// STOCKS (US) — Modelo COMPLETO (10 stocks pulverizados 8% cada)
// ============================================================
const STOCK_COMPLETO_TICKERS = [
  { ticker: "BMI",  pct: 8.0, segmento: "Indústria" },
  { ticker: "NVDA", pct: 8.0, segmento: "Tecnologia" },
  { ticker: "ANSS", pct: 8.0, segmento: "Tecnologia" },
  { ticker: "DIS",  pct: 8.0, segmento: "Mídia & Entretenimento" },
  { ticker: "UNH",  pct: 8.0, segmento: "Saúde" },
  { ticker: "NICE", pct: 8.0, segmento: "Tecnologia" },
  { ticker: "FFIV", pct: 8.0, segmento: "Tecnologia" },
  { ticker: "INGR", pct: 8.0, segmento: "Alimentos" },
  { ticker: "MLI",  pct: 8.0, segmento: "Indústria" },
  { ticker: "ILMN", pct: 0.0, segmento: "Saúde / Biotech" },
];

const STOCK_INICIANTE_TICKERS = [
  { ticker: "VOO", pct: 100.0, segmento: "ETF Índice S&P 500" },
];

const STOCK_REGRAS = [
  { id: "voo_first", tipo: "info", label: "Comece via ETF VOO (500 maiores empresas dos EUA)" },
  { id: "qtd_max",   tipo: "max_tickers", valor: 12, label: "Máx 12 papéis individuais" },
];

// ============================================================
// REITs (US) — Modelo
// ============================================================
const REIT_COMPLETO_TICKERS = [
  { ticker: "VNQ",  pct: 70.0, segmento: "ETF REITs diversificado" },
  { ticker: "EQIX", pct: 30.0, segmento: "Data Centers" },
];

const REIT_INICIANTE_TICKERS = [
  { ticker: "VNQ", pct: 100.0, segmento: "ETF REITs diversificado" },
];

const REIT_REGRAS = [
  { id: "vnq_first", tipo: "info", label: "Comece via ETF VNQ (100 maiores REITs do mundo)" },
];

// ============================================================
// Modelos prontos
// ============================================================
export const MODELOS_BUILTIN = [
  {
    id: "idv-iniciante",
    nome: "IdV · Iniciante",
    descricao: "Carteira mínima viável: 8 FIIs + 8 ações + VOO + VNQ. Ideal pra começar.",
    builtin: true,
    classes: {
      fii:   { regras: FII_REGRAS.filter(r => r.id !== "qtd_max"), tickers: FII_INICIANTE_TICKERS },
      acao:  { regras: ACAO_REGRAS.filter(r => r.id === "qtd_min" || r.id === "setor_min"), tickers: ACAO_INICIANTE_TICKERS },
      stock: { regras: STOCK_REGRAS.filter(r => r.id === "voo_first"), tickers: STOCK_INICIANTE_TICKERS },
      reit:  { regras: REIT_REGRAS, tickers: REIT_INICIANTE_TICKERS },
    },
  },
  {
    id: "idv-completo",
    nome: "IdV · Completo",
    descricao: "11 FIIs em 5 segmentos, 12 ações em 9 setores, 10 stocks pulverizados, REIT diversificado.",
    builtin: true,
    classes: {
      fii:   { regras: FII_REGRAS, tickers: FII_COMPLETO_TICKERS },
      acao:  { regras: ACAO_REGRAS, tickers: ACAO_COMPLETO_TICKERS },
      stock: { regras: STOCK_REGRAS, tickers: STOCK_COMPLETO_TICKERS },
      reit:  { regras: REIT_REGRAS, tickers: REIT_COMPLETO_TICKERS },
    },
  },
];

// ============================================================
// Helpers de análise
// ============================================================

/**
 * Normaliza ticker pra comparação tolerante.
 * - Uppercase
 * - Remove sufixos comuns: .SA, .SAO, .US, .NYSE, .NASDAQ
 * - Remove espaços/whitespace
 */
export function normalizeTicker(t) {
  if (!t) return "";
  return String(t)
    .trim()
    .toUpperCase()
    .replace(/\.(SA|SAO|US|NYSE|NASDAQ|NQ|NY)$/i, "")
    .replace(/\s+/g, "");
}

/**
 * Verifica uma regra contra os tickers do modelo + carteira atual.
 * Retorna { ok: bool, valorAtual: any, mensagem: string }
 */
export function avaliarRegra(regra, tickersModelo, ativosCarteira) {
  const tickerByCarteira = new Map(
    (ativosCarteira || [])
      .filter(a => Number(a.qtd || 0) > 0)
      .map(a => [normalizeTicker(a.ticker), a])
  );
  const tickersDoModeloNaCarteira = tickersModelo
    .filter(t => tickerByCarteira.has(normalizeTicker(t.ticker)));

  switch (regra.tipo) {
    case "min_tickers": {
      const n = tickersDoModeloNaCarteira.length;
      return { ok: n >= regra.valor, valorAtual: n, mensagem: `${n} de ${regra.valor} mínimo` };
    }
    case "max_tickers": {
      const n = tickersDoModeloNaCarteira.length;
      return { ok: n <= regra.valor, valorAtual: n, mensagem: `${n} de ${regra.valor} máx` };
    }
    case "min_por_grupo": {
      // pelo menos N tickers em cada grupo (segmento/setor) presente no modelo
      const grupos = [...new Set(tickersModelo.map(t => t[regra.grupo]))];
      const naCarteiraPorGrupo = grupos.map(g => ({
        grupo: g,
        n: tickersDoModeloNaCarteira.filter(t => t[regra.grupo] === g).length,
      }));
      const faltam = naCarteiraPorGrupo.filter(x => x.n < regra.valor);
      return {
        ok: faltam.length === 0,
        valorAtual: faltam.length,
        mensagem: faltam.length === 0
          ? `Todos os ${grupos.length} grupos ok`
          : `Faltam em: ${faltam.map(x => x.grupo).join(", ")}`,
      };
    }
    case "min_grupos": {
      // mínimo de grupos distintos representados na carteira
      const grupos = new Set(tickersDoModeloNaCarteira.map(t => t[regra.grupo]));
      return {
        ok: grupos.size >= regra.valor,
        valorAtual: grupos.size,
        mensagem: `${grupos.size} de ${regra.valor} mínimo`,
      };
    }
    case "max_por_grupo": {
      // % máximo do total alvo em um único grupo
      const grupos = [...new Set(tickersModelo.map(t => t[regra.grupo]))];
      const pctPorGrupo = grupos.map(g => ({
        grupo: g,
        pct: tickersModelo.filter(t => t[regra.grupo] === g).reduce((s, t) => s + Number(t.pct || 0), 0),
      }));
      const acima = pctPorGrupo.filter(x => x.pct > regra.valor);
      return {
        ok: acima.length === 0,
        valorAtual: acima.length,
        mensagem: acima.length === 0
          ? "Distribuição equilibrada"
          : `Acima: ${acima.map(x => `${x.grupo} ${x.pct.toFixed(1)}%`).join(", ")}`,
      };
    }
    case "alvo_grupo_pct": {
      // % de cada grupo deve estar próximo do valor (com tolerância)
      const grupos = [...new Set(tickersModelo.map(t => t[regra.grupo] || "Outros"))];
      const desvios = grupos
        .filter(g => g !== "Outros")
        .map(g => ({
          grupo: g,
          pct: tickersModelo.filter(t => (t[regra.grupo] || "Outros") === g).reduce((s, t) => s + Number(t.pct || 0), 0),
        }))
        .map(x => ({ ...x, desvio: Math.abs(x.pct - regra.valor) }));
      const foraToler = desvios.filter(x => x.desvio > (regra.tolerancia || 5));
      return {
        ok: foraToler.length === 0,
        valorAtual: foraToler.length,
        mensagem: foraToler.length === 0
          ? `Próximo de ${regra.valor}% em todos`
          : `Fora: ${foraToler.map(x => `${x.grupo} ${x.pct.toFixed(0)}%`).join(", ")}`,
      };
    }
    case "info":
      return { ok: true, valorAtual: null, mensagem: regra.label };
    default:
      return { ok: true, valorAtual: null, mensagem: "" };
  }
}

/**
 * Compara modelo vs carteira pra UMA classe.
 * Devolve linhas: ticker · % alvo · % atual · valor atual · falta R$
 */
export function analisarClasse({ classeConfig, ativosCarteira, ativosTipo, aporteAlvo }) {
  if (!classeConfig) return { linhas: [], totalAtual: 0, totalAlvo: 0 };

  // Ativos da carteira dessa classe (todos, mesmo não previstos no modelo)
  const ativosDaClasse = (ativosCarteira || [])
    .filter(a => Number(a.qtd || 0) > 0)
    .filter(a => (Array.isArray(ativosTipo) ? ativosTipo : [ativosTipo]).includes(a.tipo));

  const totalDaClasseAtual = ativosDaClasse.reduce((s, a) =>
    s + Number(a.qtd || 0) * Number(a.preco || 0), 0);

  const total = aporteAlvo > 0 ? totalDaClasseAtual + aporteAlvo : totalDaClasseAtual;

  // Cria linha por ticker do modelo (matching tolerante via normalizeTicker)
  const tickerToAtivo = new Map(
    ativosDaClasse.map(a => [normalizeTicker(a.ticker), a])
  );

  const linhas = classeConfig.tickers.map(t => {
    const ativo = tickerToAtivo.get(normalizeTicker(t.ticker));
    const valorAtual = ativo ? Number(ativo.qtd || 0) * Number(ativo.preco || 0) : 0;
    const valorAlvo = total * (Number(t.pct || 0) / 100);
    const falta = Math.max(0, valorAlvo - valorAtual);
    return {
      ticker: t.ticker,
      pctAlvoNoModelo: Number(t.pct || 0),
      segmento: t.segmento,
      valorAtual,
      valorAlvo,
      falta,
      temNaCarteira: !!ativo,
      qtdAtual: ativo ? Number(ativo.qtd || 0) : 0,
      precoAtual: ativo ? Number(ativo.preco || 0) : 0,
    };
  });

  // Soma dos % alvo do modelo (devia ser 100; pode ser menos se algum estiver 0%)
  const somaPctModelo = classeConfig.tickers.reduce((s, t) => s + Number(t.pct || 0), 0);

  // Ativos da carteira que NÃO estão no modelo (alerta "fora do plano")
  const tickersModeloSet = new Set(classeConfig.tickers.map(t => normalizeTicker(t.ticker)));
  const foraDoModelo = ativosDaClasse.filter(a => !tickersModeloSet.has(normalizeTicker(a.ticker)));

  return {
    linhas,
    totalAtual: totalDaClasseAtual,
    totalProjetado: total,
    somaPctModelo,
    qtdAtivosClasse: ativosDaClasse.length,
    foraDoModelo: foraDoModelo.map(a => ({
      ticker: a.ticker,
      nome: a.nome || "",
      segmento: a.segmento || "",
      qtd: Number(a.qtd || 0),
      preco: Number(a.preco || 0),
      valor: Number(a.qtd || 0) * Number(a.preco || 0),
      pctDaClasse: totalDaClasseAtual > 0 ? (Number(a.qtd || 0) * Number(a.preco || 0)) / totalDaClasseAtual * 100 : 0,
    })),
  };
}

export const TIPOS_POR_CLASSE = {
  fii:   ["fii"],
  acao:  ["acao"],
  stock: ["stock", "etf"],
  reit:  ["reit"],
};

export const LABEL_CLASSE = {
  fii:   "FIIs",
  acao:  "Ações BR",
  stock: "Stocks (US)",
  reit:  "REITs (US)",
};
