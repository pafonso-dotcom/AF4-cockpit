/**
 * Orçamento de viagem (pedido 2026-10-02). Fica em `viagem.orcamento`:
 *   { pessoas, itens: [{ id, cat, desc, moeda, valor, pago, forma, milhas, programa }], milheiro: {programa: R$/mil} }
 * - moeda: "BRL" | "EUR" | "USD" (convertida pelo câmbio do dia)
 * - passagens podem ser pagas em dinheiro, milhas ou misto (milhas + taxas em dinheiro)
 * É só PREVISÃO: não entra em saldo, fluxo, "pode gastar" nem patrimônio.
 */

export const CATEGORIAS_VIAGEM = [
  { k: "passagens",  icone: "✈️", label: "Passagens" },
  { k: "hospedagem", icone: "🏨", label: "Hospedagem" },
  { k: "carro",      icone: "🚗", label: "Aluguel de carro" },
  { k: "transporte", icone: "⛽", label: "Combustível / pedágio / transporte" },
  { k: "alimentacao", icone: "🍽️", label: "Alimentação" },
  { k: "passeios",   icone: "🎟️", label: "Passeios / ingressos" },
  { k: "compras",    icone: "🛍️", label: "Compras" },
  { k: "seguro",     icone: "🛡️", label: "Seguro viagem" },
  { k: "outros",     icone: "📦", label: "Outros" },
];
export const CAT_POR_K = Object.fromEntries(CATEGORIAS_VIAGEM.map(c => [c.k, c]));

// Valor estimado do milheiro (R$ por 1.000 milhas) — editável na viagem.
export const MILHEIRO_PADRAO = {
  "Smiles": 18, "LATAM Pass": 25, "TudoAzul": 20, "Livelo": 35, "TAP Miles&Go": 30, "Outro": 20,
};
export const PROGRAMAS = Object.keys(MILHEIRO_PADRAO);

export const MOEDAS = { BRL: "R$", EUR: "€", USD: "US$" };

/** Noites e dias da viagem a partir das datas (mínimo 1 dia). */
export function duracaoViagem(v) {
  if (!v?.inicio) return { dias: 1, noites: 0 };
  const a = new Date(v.inicio + "T00:00:00"), b = new Date((v.fim || v.inicio) + "T00:00:00");
  const noites = Math.max(0, Math.round((b - a) / 86400000));
  return { dias: noites + 1, noites };
}

/** Converte um valor pra R$ (cambio = { EUR, USD } em R$; sem cotação → 0). */
export function emReais(valor, moeda = "BRL", cambio = {}) {
  const v = Number(valor) || 0;
  if (!moeda || moeda === "BRL") return v;
  const taxa = Number(cambio[moeda]) || 0;
  return taxa > 0 ? v * taxa : 0;
}

/** Resumo do orçamento: dinheiro (previsto/pago/falta), milhas e custo equivalente. */
export function resumoOrcamento(orc, cambio = {}, duracao = { dias: 1 }) {
  const itens = orc?.itens || [];
  const milheiro = { ...MILHEIRO_PADRAO, ...(orc?.milheiro || {}) };
  let previsto = 0, pago = 0, milhas = 0, milhasPagas = 0, milhasBRL = 0, semCambio = false;
  const porCat = {};
  for (const it of itens) {
    const usaMilhas = it.cat === "passagens" && (it.forma === "milhas" || it.forma === "misto");
    const dinheiro = it.forma === "milhas" && it.cat === "passagens" ? 0 : emReais(it.valor, it.moeda, cambio);
    if (it.moeda && it.moeda !== "BRL" && (Number(it.valor) || 0) > 0 && !(Number(cambio[it.moeda]) > 0)) semCambio = true;
    const m = usaMilhas ? Number(it.milhas) || 0 : 0;
    const mBRL = m ? (m / 1000) * (Number(milheiro[it.programa || "Outro"]) || 0) : 0;
    previsto += dinheiro;
    if (it.pago) { pago += dinheiro; milhasPagas += m; }
    milhas += m; milhasBRL += mBRL;
    porCat[it.cat] = (porCat[it.cat] || 0) + dinheiro + mBRL;
  }
  const pessoas = Math.max(1, Number(orc?.pessoas) || 1);
  const total = previsto + milhasBRL;
  return {
    previsto, pago, falta: Math.max(0, previsto - pago),
    milhas, milhasPagas, milhasBRL, total, semCambio,
    porPessoa: total / pessoas, porDia: total / Math.max(1, duracao.dias || 1),
    pctPago: previsto > 0 ? Math.min(100, (pago / previsto) * 100) : 0,
    porCat: CATEGORIAS_VIAGEM.map(c => ({ ...c, valor: porCat[c.k] || 0 })).filter(c => c.valor > 0),
  };
}

// Valores-base (R$) da estimativa rápida, por estilo.
const BASE = {
  economica: { hospNoite: 250, carroDia: 150, comidaPessoaDia: 120, passeiosPessoaDia: 80, seguroPessoaDia: 15, transpDia: 60 },
  conforto:  { hospNoite: 550, carroDia: 250, comidaPessoaDia: 220, passeiosPessoaDia: 150, seguroPessoaDia: 25, transpDia: 90 },
  luxo:      { hospNoite: 1200, carroDia: 450, comidaPessoaDia: 450, passeiosPessoaDia: 300, seguroPessoaDia: 40, transpDia: 150 },
};
export const ESTILOS = { economica: "Econômica", conforto: "Conforto", luxo: "Luxo" };

/** Itens de estimativa pras categorias que ainda estão vazias. */
export function estimarOrcamento(estilo = "conforto", pessoas = 2, duracao = { dias: 1, noites: 0 }, comCarro = true, itensAtuais = [], gerarId = () => Math.random().toString(36).slice(2, 10)) {
  const b = BASE[estilo] || BASE.conforto;
  const p = Math.max(1, Number(pessoas) || 1);
  const { dias, noites } = duracao;
  const temCat = new Set((itensAtuais || []).map(i => i.cat));
  const novos = [
    ["hospedagem", `${noites} noite(s) × ${b.hospNoite}`, b.hospNoite * Math.max(1, noites)],
    comCarro ? ["carro", `${dias} dia(s) × ${b.carroDia}`, b.carroDia * dias] : null,
    ["transporte", `${dias} dia(s) × ${b.transpDia}`, b.transpDia * dias],
    ["alimentacao", `${p} pessoa(s) × ${dias} dia(s)`, b.comidaPessoaDia * p * dias],
    ["passeios", `${p} pessoa(s) × ${dias} dia(s)`, b.passeiosPessoaDia * p * dias],
    ["seguro", `${p} pessoa(s) × ${dias} dia(s)`, b.seguroPessoaDia * p * dias],
  ].filter(Boolean).filter(([cat]) => !temCat.has(cat));
  return novos.map(([cat, desc, valor]) => ({ id: gerarId(), cat, desc: `Estimativa · ${desc}`, moeda: "BRL", valor, pago: false }));
}
