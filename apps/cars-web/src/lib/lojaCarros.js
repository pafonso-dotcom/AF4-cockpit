/* ============================================================
   LOJA AF4 · core lib
   Entidades: Veiculo, Venda, Cliente
   Helpers para mix ideal, status, margem, KPIs
   ============================================================ */

export const STATUS_VEICULO = {
  estoque:  { label: "Em Estoque",  cor: "#C9A96B", bg: "#C9A96B22" },
  reservado:{ label: "Reservado",   cor: "#3B82F6", bg: "#3B82F622" },
  vendido:  { label: "Vendido",     cor: "#10B981", bg: "#10B98122" },
  repasse:  { label: "Repasse",     cor: "#94A3B8", bg: "#94A3B822" },
};

export const CATEGORIA_VEICULO = {
  hatch:   { label: "Hatch",      mixIdeal: 40 },
  suv:     { label: "SUV",        mixIdeal: 35 },
  sedan:   { label: "Sedan",      mixIdeal: 15 },
  picape:  { label: "Picape",     mixIdeal: 10 },
  premium: { label: "Premium",    mixIdeal: 0  },
  outro:   { label: "Outro",      mixIdeal: 0  },
};

export const FONTE_COMPRA = [
  "Repasse de concessionária",
  "Leilão",
  "Troca",
  "Particular",
  "Frotista",
  "Banco / Recuperação",
  "Outro",
];

export const BANCOS_FINANCIAMENTO = [
  "Banco Pan",
  "Santander Financiamentos",
  "BV Financeira",
  "Bradesco Financiamentos",
  "Itaú Veículos",
  "Banco Safra",
  "Omni Financeira",
  "Outro",
];

// Margem alvo por categoria (conforme relatório)
export const MARGEM_ALVO = {
  giro:    { label: "Giro Rápido", min: 5,  max: 8  },
  medio:   { label: "Médio",       min: 10, max: 15 },
  premium: { label: "Premium",     min: 15, max: 25 },
};

/**
 * Calcula margem real de uma venda considerando todos os custos.
 * Lucro = valorVenda + valorTroca - custoTotal - despesasVenda - comissao
 * Onde: custoTotal = valorCompra + despesasEntrada (acumuladas no veículo)
 */
export const calcularMargem = (veiculo, valorVenda, despesasVenda = 0, comissao = 0, valorTroca = 0) => {
  const compra = Number(veiculo.valorCompra || 0);
  const despEntrada = Array.isArray(veiculo.despesasEntrada)
    ? veiculo.despesasEntrada.reduce((s, d) => s + Number(d.valor || 0), 0)
    : 0;
  const custoTotal = compra + despEntrada;
  const venda = Number(valorVenda || 0);
  const desp = Number(despesasVenda || 0);
  const com = Number(comissao || 0);
  const troca = Number(valorTroca || 0);
  if (custoTotal <= 0) return { absoluta: 0, percentual: 0, custoTotal: 0, despEntrada };
  const receita = venda + troca; // troca entra como ativo, conta como receita
  const absoluta = receita - custoTotal - desp - com;
  const percentual = (absoluta / custoTotal) * 100;
  return { absoluta, percentual, custoTotal, despEntrada };
};

/**
 * Calcula dias em estoque.
 */
export const diasEmEstoque = (veiculo, refDate = new Date()) => {
  if (!veiculo.dataCompra) return 0;
  const compra = new Date(veiculo.dataCompra);
  const diff = refDate - compra;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/**
 * Calcula KPIs gerais da loja.
 * Critério giro: alvo 45 dias. Estoque parado = >45d sem vender.
 */
export const calcularKPIs = (veiculos, vendas, leads = []) => {
  const emEstoque = veiculos.filter(v => v.status === "estoque");
  const vendidos = veiculos.filter(v => v.status === "vendido");
  const reservados = veiculos.filter(v => v.status === "reservado");

  // Valor parado em estoque
  const valorEstoque = emEstoque.reduce((s, v) => s + Number(v.valorCompra || 0), 0);
  const valorVendaPrev = emEstoque.reduce((s, v) => s + Number(v.valorVenda || 0), 0);

  // Ticket médio
  const ticketMedio = vendas.length > 0
    ? vendas.reduce((s, v) => s + Number(v.valorVenda || 0), 0) / vendas.length
    : 0;

  // Margem média
  const margens = vendas.map(v => {
    const veic = veiculos.find(x => x.id === v.veiculoId);
    if (!veic) return 0;
    const { percentual } = calcularMargem(veic, v.valorVenda, v.despesas, v.comissao, v.valorTroca);
    return percentual;
  }).filter(m => !isNaN(m) && isFinite(m));
  const margemMedia = margens.length > 0 ? margens.reduce((s, m) => s + m, 0) / margens.length : 0;

  // Giro de estoque
  const giroEstoque = emEstoque.length > 0
    ? emEstoque.reduce((s, v) => s + diasEmEstoque(v), 0) / emEstoque.length
    : 0;

  // Estoque parado (>45 dias)
  const parados = emEstoque.filter(v => diasEmEstoque(v) > 45);

  // Conversão leads → vendas (se tiver leads)
  const conversao = leads.length > 0 ? (vendas.length / leads.length) * 100 : 0;

  // Total comissões pendentes
  const comissoesPendentes = vendas
    .filter(v => !v.comissaoPaga)
    .reduce((s, v) => s + Number(v.comissao || 0), 0);

  return {
    emEstoque: emEstoque.length,
    reservados: reservados.length,
    vendidos: vendidos.length,
    valorEstoque,
    valorVendaPrev,
    ticketMedio,
    margemMedia,
    giroEstoque,
    parados: parados.length,
    veiculosParados: parados,
    conversao,
    comissoesPendentes,
  };
};

/**
 * Calcula mix atual do estoque (% por categoria).
 */
export const calcularMix = (veiculos) => {
  const emEstoque = veiculos.filter(v => v.status === "estoque");
  if (emEstoque.length === 0) return {};
  const map = {};
  emEstoque.forEach(v => {
    const cat = v.categoria || "outro";
    map[cat] = (map[cat] || 0) + 1;
  });
  const total = emEstoque.length;
  Object.keys(map).forEach(k => { map[k] = (map[k] / total) * 100; });
  return map;
};

/**
 * Identifica desvios do mix ideal (relatório: hatch 40, SUV 35, sedan 15, picape 10).
 */
export const desviosMix = (veiculos) => {
  const atual = calcularMix(veiculos);
  const desvios = [];
  Object.entries(CATEGORIA_VEICULO).forEach(([k, cfg]) => {
    if (cfg.mixIdeal === 0) return;
    const at = atual[k] || 0;
    const desvio = at - cfg.mixIdeal;
    desvios.push({ categoria: k, label: cfg.label, atual: at, ideal: cfg.mixIdeal, desvio });
  });
  return desvios;
};
