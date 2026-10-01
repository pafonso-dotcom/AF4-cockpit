import { todayISO } from "./format.js";

/* ============================================================
   FATURA DO CARTÃO · helpers puros

   Regra de competência de uma compra avulsa: compra feita DEPOIS
   do dia de fechamento do cartão cai na fatura do mês seguinte.
   ============================================================ */

/** Competência (AAAA-MM) em que uma compra de dataISO cai na fatura. */
export function competenciaDaCompra(dataISO, fechamento) {
  const data = String(dataISO || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(data)) return null;
  let comp = data.slice(0, 7);
  const fech = Number(fechamento);
  if (fech >= 1 && fech <= 31 && Number(data.slice(8, 10)) > fech) {
    const [y, m] = comp.split("-").map(Number);
    const d = new Date(y, m, 1); // mês seguinte
    comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return comp;
}

/**
 * Competência ESPERADA da fatura que está aberta pra pagamento hoje
 * (bug 2026-09-30: fatura do Mercado Livre importada dia 30/09 caía em
 * Set, mas fecha dia 29 e vence dia 4 → é a fatura de Out).
 *
 * Regra: a fatura em aberto vence na PRÓXIMA ocorrência do dia de
 * vencimento a partir de hoje — a competência é o mês desse vencimento.
 * Sem dia de vencimento cadastrado, devolve null (quem chama decide o
 * fallback).
 */
export function competenciaFaturaEsperada(cartao, hojeISO) {
  const venc = Number(cartao?.vencimento);
  if (!(venc >= 1 && venc <= 31)) return null;
  const hoje = /^\d{4}-\d{2}-\d{2}/.test(String(hojeISO || "")) ? String(hojeISO).slice(0, 10) : null;
  if (!hoje) return null;
  const [y, m, d] = hoje.split("-").map(Number);
  // vira o mês quando o dia de vencimento deste mês já passou
  const alvo = new Date(y, (m - 1) + (d > venc ? 1 : 0), 1);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Soma das PARCELAS em aberto de um cartão que vencem em monthKey.
 * Mesma regra da tela Cartões: parcela N cai em dataPrimeira + (N-1) meses
 * (ou dataCompra + N meses, sem dataPrimeira).
 */
export function parcelasPendentesNoMes(cartao, parcelamentos = [], monthKey) {
  if (!cartao || !monthKey) return 0;
  return (parcelamentos || []).reduce((s, p) => {
    if (!p || p.cartaoId !== cartao.id) return s;
    const total = p.totalParcelas || 0;
    if (total <= 0) return s;
    const base = p.dataPrimeira || p.dataCompra;
    if (!base) return s;
    const [y, m, d] = base.split("-").map(Number);
    const start = p.dataPrimeira ? m : m + 1;
    const vpp = Number(p.valorParcela) || (Number(p.valorTotal) || 0) / total;
    const pagas = new Set(p.parcelasPagas || []);
    let devido = 0;
    for (let n = 1; n <= total; n++) {
      if (pagas.has(n)) continue;
      const dt = new Date(y, start - 1 + (n - 1), d || 1);
      if (`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` === monthKey) devido += vpp;
    }
    return s + devido;
  }, 0);
}

/**
 * Soma das compras AVULSAS pendentes do cartão (lançadas à mão ou por foto,
 * sem vir de fatura importada) cuja competência é monthKey. É o que faz a
 * compra lançada na hora aparecer no "a pagar" do cartão sem esperar a
 * fatura fechar.
 *
 * `incluirAnteriores`: também soma competências ANTERIORES a monthKey —
 * rolagem pra quando a fatura do mês já está fechada/paga (como no banco,
 * a compra pendente cai na próxima fatura aberta).
 */
export function avulsasPendentesNoMes(cartao, transacoes = [], monthKey, { incluirAnteriores = false } = {}) {
  if (!cartao || !monthKey) return 0;
  return (transacoes || []).reduce((s, t) => {
    if (!t || t.cartaoId !== cartao.id || t.tipo !== "despesa" || t.compensado) return s;
    if (String(t.origem || "").startsWith("fatura-")) return s;
    const comp = competenciaDaCompra(t.data, cartao.fechamento);
    if (!comp) return s;
    const entra = incluirAnteriores ? comp <= monthKey : comp === monthKey;
    return entra ? s + (Number(t.valor) || 0) : s;
  }, 0);
}

// ===== Helpers de parcelas/fatura (movidos da tela Cartões — fonte única) =====
// Mantidos no nível do módulo pra que o cálculo do "valor a pagar" do cartão
// use EXATAMENTE a mesma regra da lista de parcelas (match por id OU nome,
// valor da parcela = valorParcela ?? valorTotal/totalParcelas). Assim o total
// sempre bate com o que aparece na tela.
export const normNomeCartao = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export const valorDaParcela = (p) =>
  Number(p.valorParcela || (p.valorTotal && p.totalParcelas ? p.valorTotal / p.totalParcelas : 0)) || 0;
export function parcelasAtivasDoCartao(cartao, parcelamentos = []) {
  return parcelamentos.filter(p => {
    if ((p.parcelasPagas?.length || 0) >= p.totalParcelas) return false;
    if (p.cartaoId === cartao.id) return true;
    if (normNomeCartao(p.cartaoNome) === normNomeCartao(cartao.nome)) return true;
    return false;
  });
}
// Mês corrente no formato YYYY-MM (chave de competência).
export const mesAtualKey = () => todayISO().slice(0, 7);
// Mês em que a parcela N cai. Se tem dataPrimeira, soma (N-1) meses;
// senão usa dataCompra + 1 mês. Retorna Date ou null se não há base.
export function dataDaParcela(p, n) {
  const base = p.dataPrimeira || p.dataCompra;
  if (!base) return null;
  const [y, m, d] = base.split("-").map(Number);
  const startMonth = p.dataPrimeira ? m : m + 1;
  return new Date(y, startMonth - 1 + (n - 1), d);
}
// Fatura do mês = só as parcelas que VENCEM neste mês (monthKey) e que AINDA
// não estão marcadas como pagas. Assim, depois de pagar/antecipar a fatura,
// o valor deixa de aparecer como "a pagar" (antes somava 1 parcela de cada
// parcelamento em curso, ignorando data e pagamento).
export function faturaMensalDoCartao(cartao, parcelamentos = [], monthKey = mesAtualKey()) {
  return parcelasAtivasDoCartao(cartao, parcelamentos).reduce((s, p) => {
    const pagas = new Set(p.parcelasPagas || []);
    let devido = 0;
    for (let n = 1; n <= (p.totalParcelas || 0); n++) {
      if (pagas.has(n)) continue;
      const dt = dataDaParcela(p, n);
      if (!dt) continue;
      if (`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` === monthKey) {
        devido += valorDaParcela(p);
      }
    }
    return s + devido;
  }, 0);
}
// Valor a pagar do mês COMPLETO: se há fatura importada (que já soma à vista +
// fixas + parcelas) e não está paga, usa o valor dela; senão, parcelas do mês
// ainda não pagas + compras avulsas pendentes lançadas no app (manual/foto) —
// sem isso, a compra lançada na hora não aparecia no "a pagar" do cartão.
// A fatura importada só conta no MÊS DA COMPETÊNCIA dela: importar a fatura de
// agosto ainda em julho NÃO vira "a pagar" de julho — ela aparece no mês
// seguinte. (Sem competência gravada — legado — mantém o comportamento antigo.)
export function valorAPagarMes(cartao, parcelamentos = [], transacoes = [], monthKey = mesAtualKey()) {
  const fi = cartao.faturaImportada;
  const fiDesteMes = fi && (!fi.competencia || fi.competencia === monthKey);
  if (fiDesteMes && fi.paga) return 0;
  const fiTotal = fiDesteMes ? Number(fi.valorTotal) || 0 : 0;
  if (fiTotal > 0) return fiTotal; // fatura importada já soma tudo do mês
  return faturaMensalDoCartao(cartao, parcelamentos, monthKey)
       + avulsasPendentesNoMes(cartao, transacoes, monthKey);
}

/**
 * Fatura EM ABERTO do cartão — o número em destaque no card da tela Cartões.
 * Fatura importada não paga manda (mesmo com competência no mês seguinte);
 * senão, o a pagar do mês corrente. Devolve { valor, mes, paga }.
 */
export function faturaEmAberto(cartao, parcelamentos = [], transacoes = [], monthKey = mesAtualKey()) {
  const fi = cartao?.faturaImportada;
  const paga = !!(fi && fi.paga && (!fi.competencia || fi.competencia === monthKey));
  const aPagar = valorAPagarMes(cartao, parcelamentos, transacoes, monthKey);
  const fiAberta = fi && !fi.paga ? Number(fi.valorTotal) || 0 : 0;
  if (fiAberta > 0) return { valor: fiAberta, mes: fi.competencia || monthKey, paga: false };
  return { valor: aPagar, mes: monthKey, paga };
}
