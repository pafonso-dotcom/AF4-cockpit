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
 * Média mensal de despesas dos últimos N meses COMPLETOS (pura).
 * - `media`: TODAS as despesas do mês (fixas + variáveis + cartão) — base do
 *   indicador "dias de caixa";
 * - `mediaVariaveis`: só transações variáveis (fonte "transacao", tipo
 *   "variavel") — o gasto do dia a dia que NÃO aparece agendado no futuro
 *   (mercado, gasolina...) e por isso vira estimativa na projeção.
 */
export function mediaMensalDespesas(state = {}, escopo = "tudo", hoje = new Date(), meses = 3) {
  let total = 0, totalVar = 0;
  for (let i = 1; i <= meses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const x of getDespesasDoMes(mesISO, state, escopo)) {
      const v = Number(x.valor) || 0;
      total += v;
      if (x.fonte === "transacao" && x.tipo === "variavel") totalVar += v;
    }
  }
  return { media: total / meses, mediaVariaveis: totalVar / meses };
}

/**
 * @param opts {{ estimarVariaveis?: boolean, saldoMinimo?: number, cenario?: string }}
 *  - estimarVariaveis (default true): injeta o gasto do dia a dia (média 3m
 *    das variáveis) como eventos SEMANAIS estimados — sem isso a projeção
 *    fica otimista, só com o que está agendado;
 *  - saldoMinimo: colchão de segurança — detecta o 1º dia abaixo dele;
 *  - cenario: "realista" (default) | "pessimista" (a receber/cheques contam
 *    70% — inadimplência/atraso — e o dia a dia estimado sobe 20%) |
 *    "otimista" (dia a dia estimado desce 20%).
 * @returns {{
 *  saldoInicial, saldoFinal, eventos, porDia,
 *  piorDia: {dataISO, saldo}|null, primeiroNegativo: string|null,
 *  primeiroAbaixoMinimo: string|null, diasDeCaixa: number|null,
 *  mediaMensalDespesas, mediaMensalVariaveis
 * }}
 *  eventos = [{ data, descricao, tipo:"entrada"|"saida", valor, saldoApos, fonte, atrasado, estimado? }]
 *  porDia  = [{ dataISO, entradas, saidas, saldoFim }]
 */
export function montarFluxoCaixa(state = {}, escopo = "tudo", dias = 60, hoje = new Date(),
                                 { estimarVariaveis = true, saldoMinimo = 0, cenario = "realista" } = {}) {
  const st = aplicarEscopo(state, escopo);
  const saldoInicial = somaContasBRL(st.contas || []);
  const { media: mediaMensal, mediaVariaveis } = mediaMensalDespesas(state, escopo, hoje);
  // 🎭 Cenários: fatores explícitos e explicáveis.
  const fatorEntradaIncerta = cenario === "pessimista" ? 0.7 : 1; // devedores/cheques
  const fatorVariaveis = cenario === "pessimista" ? 1.2 : cenario === "otimista" ? 0.8 : 1;

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
      // Pessimista: entradas INCERTAS (a receber de terceiros e cheques)
      // contam 70% — inadimplência/atraso; o resto fica intacto.
      const incerta = x._tipo === "entrada" && (x.fonte === "devedor" || x.fonte === "cheque");
      const fator = incerta ? fatorEntradaIncerta : 1;
      return {
        data: atrasado ? hojeISO : d10,
        descricao: x.descricao || x.categoria || "—",
        tipo: x._tipo,
        valor: (Number(x.valor) || 0) * fator,
        fonte: x.fonte || "",
        atrasado,
        ajustado: fator !== 1,
      };
    })
    .filter(e => e.data && e.valor > 0 && e.data >= hojeISO && e.data <= fimISO);

  // 💡 Estimativa do gasto do dia a dia: as variáveis (mercado, gasolina...)
  // não estão agendadas no futuro — sem elas a projeção sai otimista. Média
  // mensal dos últimos 3 meses vira uma saída SEMANAL estimada.
  if (estimarVariaveis && mediaVariaveis > 0) {
    const semanal = (mediaVariaveis * fatorVariaveis * 7) / 30;
    for (let off = 7; off <= dias; off += 7) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + off);
      eventosBase.push({
        data: diaISO(d),
        descricao: "Gastos do dia a dia (estimativa · média 3m)",
        tipo: "saida",
        valor: semanal,
        fonte: "estimativa",
        atrasado: false,
        estimado: true,
      });
    }
  }
  eventosBase.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "entrada" ? -1 : 1));

  // Acumula saldo evento a evento e agrega por dia.
  let saldo = saldoInicial;
  let piorDia = null, primeiroNegativo = null, primeiroAbaixoMinimo = null;
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
    if (saldoMinimo > 0 && dia.saldoFim < saldoMinimo && !primeiroAbaixoMinimo) primeiroAbaixoMinimo = dia.dataISO;
  }

  // 🛟 Dias de caixa: quantos dias a despesa MÉDIA (tudo incluso) o saldo
  // atual aguenta, se nada entrar.
  const mediaDiaria = mediaMensal / 30;
  const diasDeCaixa = mediaDiaria > 0 ? Math.max(0, Math.floor(saldoInicial / mediaDiaria + 1e-9)) : null;

  return {
    saldoInicial,
    saldoFinal: saldo,
    eventos,
    porDia: [...porDiaMap.values()],
    piorDia,
    primeiroNegativo,
    primeiroAbaixoMinimo,
    diasDeCaixa,
    mediaMensalDespesas: mediaMensal,
    mediaMensalVariaveis: mediaVariaveis,
  };
}
