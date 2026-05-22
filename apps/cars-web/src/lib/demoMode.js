/**
 * MODO DEMO · cenário fictício completo da AF4
 * Ativa/desativa um snapshot rico (5 contas, 30+ transações, 12 veículos, etc.)
 * sem perder os dados reais — faz backup antes e restaura ao desativar.
 *
 * Chaves no localStorage:
 *   af4:demo:active   → "1" se o modo demo estiver ativo
 *   af4:demo:backup   → snapshot dos dados reais (recuperado ao desativar)
 */

const REAL_KEY = "financas:dados:v1";
const DEMO_ACTIVE = "af4:demo:active";
const DEMO_BACKUP = "af4:demo:backup";

export function isDemoActive() {
  try { return localStorage.getItem(DEMO_ACTIVE) === "1"; }
  catch { return false; }
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysFwd = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function buildSeed() {
  const contas = [
    { id: "demo-c1", nome: "Itaú PJ",    instituicao: "Itaú Unibanco", tipo: "corrente", saldo: 62840, cor: "#ec7000" },
    { id: "demo-c2", nome: "Nubank",     instituicao: "Nu Pagamentos", tipo: "corrente", saldo: 18920.50, cor: "#8a2be2" },
    { id: "demo-c3", nome: "Sicoob",     instituicao: "Cooperativa", tipo: "poupanca", saldo: 8430.12, cor: "#00ae9d" },
    { id: "demo-c4", nome: "XP CTVM",    instituicao: "XP Investimentos", tipo: "investimento", saldo: 142500, cor: "#c9a961" },
    { id: "demo-c5", nome: "Carteira",   instituicao: "Dinheiro físico", tipo: "carteira", saldo: 1240, cor: "#9ca3af" },
  ];

  const categorias = [
    { id: "demo-cat1", nome: "Salário",       tipo: "receita", cor: "#4ade80" },
    { id: "demo-cat2", nome: "Freelance",     tipo: "receita", cor: "#60a5fa" },
    { id: "demo-cat3", nome: "Loja AF4",      tipo: "receita", cor: "#c9a961" },
    { id: "demo-cat4", nome: "Moradia",       tipo: "despesa", cor: "#f87171" },
    { id: "demo-cat5", nome: "Alimentação",   tipo: "despesa", cor: "#fb923c" },
    { id: "demo-cat6", nome: "Transporte",    tipo: "despesa", cor: "#fbbf24" },
    { id: "demo-cat7", nome: "Saúde",         tipo: "despesa", cor: "#ec4899" },
    { id: "demo-cat8", nome: "Lazer",         tipo: "despesa", cor: "#a78bfa" },
    { id: "demo-cat9", nome: "Educação",      tipo: "despesa", cor: "#06b6d4" },
    { id: "demo-cat10", nome: "Outros",       tipo: "despesa", cor: "#9ca3af" },
  ];

  const transacoes = [
    { id: "demo-t1",  tipo: "receita", descricao: "Salário maio", categoria: "Salário", conta: "Nubank", data: daysAgo(0), valor: 8500, compensado: true, fixa: true, vencimento: 13 },
    { id: "demo-t2",  tipo: "receita", descricao: "Freelance Cliente A", categoria: "Freelance", conta: "Nubank", data: daysAgo(3), valor: 1800, compensado: true, fixa: false },
    { id: "demo-t3",  tipo: "receita", descricao: "Loja AF4 — venda Onix", categoria: "Loja AF4", conta: "Itaú PJ", data: daysAgo(11), valor: 72500, compensado: true, fixa: false },
    { id: "demo-t4",  tipo: "despesa", descricao: "Aluguel apartamento", categoria: "Moradia", conta: "Nubank", data: daysAgo(8), valor: 2200, compensado: true, fixa: true, vencimento: 5 },
    { id: "demo-t5",  tipo: "despesa", descricao: "Mercado Pão de Açúcar", categoria: "Alimentação", conta: "Nubank", data: daysAgo(5), valor: 487.30, compensado: true, fixa: false },
    { id: "demo-t6",  tipo: "despesa", descricao: "Posto Shell", categoria: "Transporte", conta: "Nubank", data: daysAgo(2), valor: 280, compensado: true, fixa: false, subcategoria: "Combustível" },
    { id: "demo-t7",  tipo: "despesa", descricao: "Plano de saúde Bradesco", categoria: "Saúde", conta: "Nubank", data: daysAgo(1), valor: 850, compensado: true, fixa: true, vencimento: 12 },
    { id: "demo-t8",  tipo: "despesa", descricao: "Restaurante Outback", categoria: "Lazer", conta: "Nubank", data: daysAgo(4), valor: 245, compensado: true, fixa: false },
    { id: "demo-t9",  tipo: "despesa", descricao: "Netflix", categoria: "Lazer", conta: "Nubank", data: daysAgo(10), valor: 55.90, compensado: true, fixa: true, vencimento: 3 },
    { id: "demo-t10", tipo: "despesa", descricao: "HBO Max", categoria: "Lazer", conta: "Nubank", data: daysAgo(10), valor: 49.90, compensado: true, fixa: true, vencimento: 3 },
    { id: "demo-t11", tipo: "despesa", descricao: "Spotify", categoria: "Lazer", conta: "Nubank", data: daysAgo(15), valor: 21.90, compensado: true, fixa: true, vencimento: 1 },
    { id: "demo-t12", tipo: "despesa", descricao: "Curso de inglês", categoria: "Educação", conta: "Nubank", data: daysAgo(7), valor: 320, compensado: true, fixa: true, vencimento: 10 },
    { id: "demo-t13", tipo: "despesa", descricao: "Uber", categoria: "Transporte", conta: "Nubank", data: daysAgo(6), valor: 48.50, compensado: true, fixa: false },
    { id: "demo-t14", tipo: "receita", descricao: "Loja AF4 — venda Polo", categoria: "Loja AF4", conta: "Itaú PJ", data: daysAgo(5), valor: 89900, compensado: true, fixa: false },
    { id: "demo-t15", tipo: "despesa", descricao: "Pizza Domino's", categoria: "Alimentação", conta: "Nubank", data: daysAgo(2), valor: 89, compensado: true, fixa: false },
    // Pendentes (próximos)
    { id: "demo-t16", tipo: "despesa", descricao: "Cartão Itaú · fatura junho", categoria: "Outros", conta: "Itaú PJ", data: daysFwd(7), valor: 3420.55, compensado: false, fixa: false },
    { id: "demo-t17", tipo: "receita", descricao: "Salário junho", categoria: "Salário", conta: "Nubank", data: daysFwd(18), valor: 8500, compensado: false, fixa: true, vencimento: 13 },
    // Histórico (mês anterior pra MoM)
    { id: "demo-t18", tipo: "receita", descricao: "Salário abril", categoria: "Salário", conta: "Nubank", data: daysAgo(31), valor: 8500, compensado: true, fixa: true },
    { id: "demo-t19", tipo: "despesa", descricao: "Aluguel abril", categoria: "Moradia", conta: "Nubank", data: daysAgo(38), valor: 2200, compensado: true, fixa: true },
    { id: "demo-t20", tipo: "despesa", descricao: "Mercado abril", categoria: "Alimentação", conta: "Nubank", data: daysAgo(33), valor: 412, compensado: true, fixa: false },
    { id: "demo-t21", tipo: "receita", descricao: "Loja AF4 — venda Sandero", categoria: "Loja AF4", conta: "Itaú PJ", data: daysAgo(40), valor: 52300, compensado: true, fixa: false },
  ];

  const ativos = [
    { id: "demo-a1", ticker: "PETR4", nome: "Petrobras",   tipo: "acao", qtd: 200, pm: 32.40, preco: 38.20, base: 0 },
    { id: "demo-a2", ticker: "ITSA4", nome: "Itaúsa",      tipo: "acao", qtd: 1500, pm: 9.20, preco: 10.85, base: 0 },
    { id: "demo-a3", ticker: "BBAS3", nome: "Banco do Brasil", tipo: "acao", qtd: 100, pm: 48.30, preco: 56.40, base: 0 },
    { id: "demo-a4", ticker: "HGLG11", nome: "CSHG Logística", tipo: "fii", qtd: 80, pm: 175.00, preco: 180.50, base: 0 },
    { id: "demo-a5", ticker: "MXRF11", nome: "Maxi Renda",  tipo: "fii", qtd: 500, pm: 10.10, preco: 10.45, base: 0 },
    { id: "demo-a6", ticker: "BTC",   nome: "Bitcoin",     tipo: "cripto", qtd: 0.05, pm: 280000, preco: 348000, base: 0 },
    { id: "demo-a7", ticker: "TESOURO IPCA 2029", nome: "Tesouro IPCA+ 2029", tipo: "tesouro", qtd: 1, pm: 3850, preco: 4120, base: 0 },
  ];

  const metas = [
    { id: "demo-m1", nome: "Reserva de emergência", alvo: 60000, atual: 38500, prazo: daysFwd(180), cor: "#4ade80" },
    { id: "demo-m2", nome: "Casa própria",          alvo: 250000, atual: 85000, prazo: daysFwd(720), cor: "#c9a961" },
    { id: "demo-m3", nome: "Viagem Europa 2027",    alvo: 25000, atual: 6800,   prazo: daysFwd(420), cor: "#60a5fa" },
  ];

  const cartoes = [
    { id: "demo-cc1", nome: "Itaú Visa Infinite", limite: 18000, diaFechamento: 5, diaVencimento: 12, cor: "#1c2333", instituicao: "Itaú" },
    { id: "demo-cc2", nome: "Nubank Ultravioleta", limite: 8000, diaFechamento: 28, diaVencimento: 5, cor: "#8a2be2", instituicao: "Nubank" },
  ];

  const parcelamentos = [
    { id: "demo-p1", descricao: "iPhone 16 Pro", cartaoId: "demo-cc1", valorTotal: 9500, totalParcelas: 10, parcelasPagas: [1,2,3], dataCompra: daysAgo(90), dataPrimeira: daysAgo(60) },
  ];

  const devedores = [
    { id: "demo-d1", nome: "João Silva",     valor: 2200, vencimento: daysFwd(2), recebido: false, categoria: "Outros", obs: "Empréstimo pessoal", parcela: "1/3" },
    { id: "demo-d2", nome: "Maria Oliveira", valor: 3500, vencimento: daysFwd(9), recebido: false, categoria: "Loja AF4", obs: "Cheque 2/3 da venda Creta", parcela: "2/3" },
    { id: "demo-d3", nome: "Pedro Costa",    valor: 1200, vencimento: daysAgo(5), recebido: false, categoria: "Outros", obs: "Cesta básica emprestada" },
    { id: "demo-d4", nome: "Carlos Mendes",  valor: 1550, vencimento: "", recebido: false, categoria: "Outros", obs: "Reembolso jantar empresa" },
  ];

  const dividas = [
    { id: "demo-dv1", nome: "Imobiliária Real Tatuí", valor: 2200, vencimento: daysFwd(3), pago: false, categoria: "Moradia", obs: "Aluguel junho" },
    { id: "demo-dv2", nome: "Auto Brasil",            valor: 8500, vencimento: daysFwd(15), pago: false, categoria: "Outros", obs: "Última parcela compra Creta", parcela: "5/5" },
    { id: "demo-dv3", nome: "Bradesco Saúde",         valor: 850,  vencimento: daysFwd(8),  pago: false, categoria: "Saúde", obs: "Mensalidade junho" },
  ];

  const veiculos = [
    {
      id: "demo-v1", marca: "HYUNDAI", modelo: "Creta Comfort", cor: "Prata", corHex: "#c0c0c0",
      anoFabricacao: 2022, anoModelo: 2023, km: 42000, placa: "FTK-9E71",
      combustivel: "flex", cambio: "automatico",
      valorCompra: 68000, valorFipe: 72000, valorAnunciado: 76900, valorMinimo: 74000,
      categoria: "suv", status: "estoque",
      fornecedor: "Auto Brasil Multimarcas", dataCompra: daysAgo(22), formaCompra: "financiado",
      despesasEntrada: [
        { id: "de1", tipo: "Transferência", descricao: "DETRAN-SP", valor: 450, data: daysAgo(20) },
        { id: "de2", tipo: "Polimento / Limpeza", descricao: "Polimento técnico", valor: 380, data: daysAgo(19) },
        { id: "de3", tipo: "Reparo / Mecânica", descricao: "Pastilhas + revisão", valor: 1620, data: daysAgo(16) },
      ],
      dataEntrada: daysAgo(22),
    },
    {
      id: "demo-v2", marca: "VOLKSWAGEN", modelo: "Polo Highline", cor: "Branco", corHex: "#fff",
      anoFabricacao: 2022, anoModelo: 2022, km: 38500, placa: "KLM-8E45",
      combustivel: "flex", cambio: "automatico",
      valorCompra: 78000, valorFipe: 82000, valorAnunciado: 89900, valorMinimo: 86000,
      categoria: "sedan", status: "vendido",
      fornecedor: "João Particular", dataCompra: daysAgo(60), formaCompra: "vista",
      despesasEntrada: [{ id: "de4", tipo: "Documentação", valor: 420, data: daysAgo(58) }],
      dataEntrada: daysAgo(60), dataVenda: daysAgo(5),
    },
    {
      id: "demo-v3", marca: "CHEVROLET", modelo: "Onix LT", cor: "Prata", corHex: "#c0c0c0",
      anoFabricacao: 2021, anoModelo: 2021, km: 56000, placa: "GDH-4K22",
      combustivel: "flex", cambio: "manual",
      valorCompra: 58000, valorFipe: 62000, valorAnunciado: 72500, valorMinimo: 68000,
      categoria: "compacto", status: "vendido",
      fornecedor: "Leilão Copart", dataCompra: daysAgo(45), formaCompra: "vista",
      despesasEntrada: [],
      dataEntrada: daysAgo(45), dataVenda: daysAgo(11),
    },
  ];

  const vendas = [
    {
      id: "demo-vd1", veiculoId: "demo-v2", clienteId: "demo-cl1",
      dataVenda: daysAgo(5), valorVenda: 89900,
      despesas: 380, despesasVenda: [],
      formaPagamento: "financiamento", banco: "Banco Pan", parcelas: 48, entrada: 0,
      comissao: 1798, comissaoPaga: false, vendedor: "Anderson Kid",
      lucroLiquido: 9302, margem: { absoluta: 9302, percentual: 11.9 },
      chequesRecebidos: [], valorTroca: 0,
    },
    {
      id: "demo-vd2", veiculoId: "demo-v3", clienteId: "demo-cl2",
      dataVenda: daysAgo(11), valorVenda: 72500,
      despesas: 0, despesasVenda: [],
      formaPagamento: "vista",
      comissao: 1450, comissaoPaga: true, vendedor: "Paulo",
      lucroLiquido: 13050, margem: { absoluta: 13050, percentual: 22.5 },
      chequesRecebidos: [], valorTroca: 0,
    },
  ];

  const clientes = [
    { id: "demo-cl1", nome: "Ana Souza",   telefone: "(15) 99876-5432", email: "ana@email.com", cidade: "Tatuí-SP", obs: "Cliente fiel · 2ª compra" },
    { id: "demo-cl2", nome: "Carlos Mendes", telefone: "(15) 98765-1234", email: "", cidade: "Sorocaba-SP", obs: "" },
    { id: "demo-cl3", nome: "Maria Oliveira", telefone: "(15) 97654-3210", email: "maria@email.com", cidade: "Tatuí-SP", obs: "Cheques pré em dia" },
  ];

  const cheques = [
    { id: "demo-ch1", numero: "000231", emitente: "Maria Oliveira", banco: "Itaú", agencia: "1234", conta: "56789-0", data: daysFwd(9),  valor: 6000, parcela: "2/3", status: "aguardando", obs: "Venda Creta" },
    { id: "demo-ch2", numero: "000232", emitente: "Maria Oliveira", banco: "Itaú", agencia: "1234", conta: "56789-0", data: daysFwd(39), valor: 6000, parcela: "3/3", status: "aguardando", obs: "Venda Creta" },
    { id: "demo-ch3", numero: "000230", emitente: "Maria Oliveira", banco: "Itaú", agencia: "1234", conta: "56789-0", data: daysAgo(20), valor: 6000, parcela: "1/3", status: "compensado", obs: "Venda Creta" },
  ];

  const leads = [
    { id: "demo-l1", nome: "Roberto Silva", telefone: "(15) 91111-2222", cidade: "Tatuí-SP", origem: "WhatsApp", valorEstimado: 65000, veiculoInteresse: "Honda Civic 2020+", estagio: "negociacao", proximoContato: daysFwd(2), obs: "Quer entrega rápida" },
    { id: "demo-l2", nome: "Juliana Pereira", telefone: "(15) 92222-3333", cidade: "Sorocaba-SP", origem: "Webmotors", valorEstimado: 85000, veiculoInteresse: "Hyundai HB20 Premium", estagio: "atendimento", proximoContato: daysFwd(0), obs: "" },
    { id: "demo-l3", nome: "Fernando Costa", telefone: "(15) 93333-4444", cidade: "Itu-SP", origem: "Indicação", valorEstimado: 110000, veiculoInteresse: "Toyota Corolla XEi", estagio: "aprov", proximoContato: daysFwd(5), obs: "Documentação no banco" },
    { id: "demo-l4", nome: "Patrícia Ramos", telefone: "(15) 94444-5555", cidade: "Tatuí-SP", origem: "Instagram", valorEstimado: 55000, veiculoInteresse: "Compacto até 60k", estagio: "novo", proximoContato: "", obs: "Primeiro contato hoje" },
  ];

  return {
    contas, categorias, transacoes, ativos, metas,
    cartoes, parcelamentos, devedores, dividas,
    veiculos, vendas, clientes, cheques, leads,
    themeId: "noir",
    savedAt: new Date().toISOString(),
  };
}

/** Ativa o modo demo: faz backup do real e carrega dados fictícios. */
export function ativarDemo() {
  try {
    const real = localStorage.getItem(REAL_KEY);
    if (real) localStorage.setItem(DEMO_BACKUP, real);
    const seed = buildSeed();
    localStorage.setItem(REAL_KEY, JSON.stringify(seed));
    localStorage.setItem(DEMO_ACTIVE, "1");
    return true;
  } catch (err) {
    console.warn("Falha ao ativar modo demo:", err);
    return false;
  }
}

/** Desativa o modo demo: restaura backup dos dados reais. */
export function desativarDemo() {
  try {
    const backup = localStorage.getItem(DEMO_BACKUP);
    if (backup) {
      localStorage.setItem(REAL_KEY, backup);
      localStorage.removeItem(DEMO_BACKUP);
    } else {
      localStorage.removeItem(REAL_KEY);
    }
    localStorage.removeItem(DEMO_ACTIVE);
    return true;
  } catch (err) {
    console.warn("Falha ao desativar modo demo:", err);
    return false;
  }
}
