/**
 * 💵 Fluxo de caixa — projeção DIÁRIA do caixa: cada entrada/saída futura
 * na sua data, com o saldo acumulado após cada evento ("extrato do futuro").
 *
 * Complementa o getProjecaoSaldo (que é mensal) usando os MESMOS itens dos
 * agregadores — fixas, parcelas, dívidas, a receber, cheques — que já vêm
 * com `data` dia a dia. Puro e testável.
 */
import { getDespesasDoMes, getGanhosDoMes, aplicarEscopo } from "./agregador.js";
import { somaContasBRL } from "./cambio.js";

const diaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * @returns {{
 *  saldoInicial, saldoFinal, eventos, porDia,
 *  piorDia: {dataISO, saldo}|null, primeiroNegativo: string|null
 * }}
 *  eventos = [{ data, descricao, tipo:"entrada"|"saida", valor, saldoApos, fonte, atrasado }]
 *  porDia  = [{ dataISO, entradas, saidas, saldoFim }]
 */
export function montarFluxoCaixa(state = {}, escopo = "tudo", dias = 60, hoje = new Date()) {
  const st = aplicarEscopo(state, escopo);
  const saldoInicial = somaContasBRL(st.contas || []);

  const hojeISO = diaISO(hoje);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  const fimISO = diaISO(fim);

  // Meses cobertos pela janela [hoje, hoje+dias].
  const meses = [];
  for (let d = new Date(hoje.getFullYear(), hoje.getMonth(), 1); d <= fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const mesAtual = hojeISO.slice(0, 7);

  const brutos = [];
  for (const mesISO of meses) {
    for (const d of getDespesasDoMes(mesISO, st, escopo)) {
      if (d.status === "paga") continue;
      brutos.push({ ...d, _tipo: "saida" });
    }
    const ganhos = getGanhosDoMes(mesISO, st, escopo,
      mesISO === mesAtual ? { incluirAtrasados: true } : {});
    for (const g of ganhos) {
      if (g.status === "paga") continue;
      brutos.push({ ...g, _tipo: "entrada" });
    }
  }

  // Normaliza a data: atrasado (antes de hoje) cai no bucket de HOJE —
  // dinheiro que já deveria ter entrado/saído afeta o caixa agora.
  const eventosBase = brutos
    .map(x => {
      const d10 = String(x.data || "").slice(0, 10);
      const atrasado = Boolean(d10 && d10 < hojeISO);
      return {
        data: atrasado ? hojeISO : d10,
        descricao: x.descricao || x.categoria || "—",
        tipo: x._tipo,
        valor: Number(x.valor) || 0,
        fonte: x.fonte || "",
        atrasado,
      };
    })
    .filter(e => e.data && e.valor > 0 && e.data >= hojeISO && e.data <= fimISO)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "entrada" ? -1 : 1));

  // Acumula saldo evento a evento e agrega por dia.
  let saldo = saldoInicial;
  let piorDia = null, primeiroNegativo = null;
  const porDiaMap = new Map();
  const eventos = eventosBase.map(e => {
    saldo += e.tipo === "entrada" ? e.valor : -e.valor;
    const dia = porDiaMap.get(e.data) || { dataISO: e.data, entradas: 0, saidas: 0, saldoFim: saldo };
    if (e.tipo === "entrada") dia.entradas += e.valor; else dia.saidas += e.valor;
    dia.saldoFim = saldo;
    porDiaMap.set(e.data, dia);
    return { ...e, saldoApos: saldo };
  });
  for (const dia of porDiaMap.values()) {
    if (!piorDia || dia.saldoFim < piorDia.saldo) piorDia = { dataISO: dia.dataISO, saldo: dia.saldoFim };
    if (dia.saldoFim < 0 && !primeiroNegativo) primeiroNegativo = dia.dataISO;
  }

  return {
    saldoInicial,
    saldoFinal: saldo,
    eventos,
    porDia: [...porDiaMap.values()],
    piorDia,
    primeiroNegativo,
  };
}
