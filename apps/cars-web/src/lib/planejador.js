// Planejador "Paz Financeira" — método dos 3 baldes.
// Pega a SOBRA do mês e divide em Reserva de emergência, Bens duráveis e
// Riqueza de longo prazo (base 50/30/20, ajustada pelo quanto falta em cada
// balde). Calcula o aporte/mês necessário por meta (PMT) e projeta a riqueza
// futura (valor futuro + valor de hoje, descontada a inflação).
//
// Fórmulas validadas contra a planilha de origem (mesmos números).
// Ferramenta educacional — não é recomendação de investimento.

// Taxa mensal equivalente a uma taxa anual.
export function taxaMensal(retAnual) {
  return Math.pow(1 + (Number(retAnual) || 0), 1 / 12) - 1;
}

/**
 * Aporte mensal necessário (PMT) pra sair de `saldo` e chegar em `alvo` em
 * `meses`, com retorno anual `retAnual`. Considera o rendimento do saldo atual.
 * Retorna 0 se a meta já está coberta ou se meses <= 0.
 */
export function pmtMeta(saldo, alvo, meses, retAnual) {
  const m = Math.round(Number(meses) || 0);
  if (m <= 0) return 0;
  const rm = taxaMensal(retAnual);
  const comp = Math.pow(1 + rm, m);
  const fvSaldo = (Number(saldo) || 0) * comp;
  const falta = (Number(alvo) || 0) - fvSaldo;
  if (falta <= 0) return 0;
  const fatorAnuidade = rm === 0 ? m : (comp - 1) / rm;
  return falta / fatorAnuidade;
}

/**
 * Projeta a riqueza: saldo atual rendendo + aportes mensais, por `meses`.
 * Retorna { fv (valor futuro), vp (valor de hoje, descontada a inflação) }.
 */
export function projetarRiqueza(saldo, aporteMensal, retAnual, meses, inflacaoAnual = 0) {
  const m = Math.round(Number(meses) || 0);
  const rm = taxaMensal(retAnual);
  const comp = Math.pow(1 + rm, m);
  const fatorAnuidade = rm === 0 ? m : (comp - 1) / rm;
  const fv = (Number(saldo) || 0) * comp + (Number(aporteMensal) || 0) * fatorAnuidade;
  const anos = m / 12;
  const vp = fv / Math.pow(1 + (Number(inflacaoAnual) || 0), anos);
  return { fv, vp, comp, fatorAnuidade, meses: m };
}

/**
 * "Vale a pena parcelar?" — custo real de um parcelamento.
 * @returns { parcela, totalPago, jurosTotais, custoOportunidade }
 *   custoOportunidade = quanto o valor à vista viraria se investido na riqueza
 *   pelo horizonte (até a aposentadoria).
 */
export function calcularParcelamento({ valor, nParcelas, taxaMes, retRiquezaAnual = 0, mesesHorizonte = 0 } = {}) {
  const P = Math.max(0, Number(valor) || 0);
  const n = Math.round(Number(nParcelas) || 0);
  const i = Number(taxaMes) || 0;
  let parcela = 0, totalPago = 0, jurosTotais = 0;
  if (P > 0 && n > 0) {
    if (i === 0) { parcela = P / n; totalPago = P; }
    else { parcela = (P * i) / (1 - Math.pow(1 + i, -n)); totalPago = parcela * n; }
    jurosTotais = totalPago - P;
  }
  const rm = taxaMensal(retRiquezaAnual);
  const custoOportunidade = P * Math.pow(1 + rm, Math.max(0, Math.round(Number(mesesHorizonte) || 0)));
  return { parcela, totalPago, jurosTotais, custoOportunidade };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Divide a `sobra` nos 3 baldes. O peso de cada um é a base (50/30/20) vezes o
 * quanto FALTA pra completar o balde (frac). Riqueza nunca fica abaixo do piso.
 */
export function dividirBaldes(sobra, fracReserva, fracDuravel, base = { reserva: 0.5, duravel: 0.3, riqueza: 0.2 }, pisoRiqueza = 0.05) {
  const s = Math.max(0, Number(sobra) || 0);
  const pesoR = (base.reserva ?? 0.5) * clamp01(fracReserva);
  const pesoD = (base.duravel ?? 0.3) * clamp01(fracDuravel);
  const pesoW = (base.riqueza ?? 0.2) * 1; // riqueza é sempre "incompleta"
  const soma = pesoR + pesoD + pesoW;
  if (s === 0) return { reserva: 0, duravel: 0, riqueza: 0 };
  if (soma <= 0) return { reserva: 0, duravel: 0, riqueza: s };
  let reserva = (s * pesoR) / soma;
  let duravel = (s * pesoD) / soma;
  let riqueza = (s * pesoW) / soma;
  // Piso da riqueza: garante um mínimo, tirando proporcional dos outros.
  const piso = s * (Number(pisoRiqueza) || 0);
  if (riqueza < piso) {
    const falta = piso - riqueza;
    const rd = reserva + duravel;
    riqueza = piso;
    if (rd > 0) { reserva -= (falta * reserva) / rd; duravel -= (falta * duravel) / rd; }
  }
  return { reserva, duravel, riqueza };
}

const PREMISSAS_PADRAO = {
  retReserva: 0.11, retDuravel: 0.11, retRiqueza: 0.1507,
  inflacao: 0.0426, pisoRiqueza: 0.05, prazoReserva: 12,
  base: { reserva: 0.5, duravel: 0.3, riqueza: 0.2 },
};

/**
 * Monta o plano completo a partir das entradas do usuário.
 * @returns plano com baldes (aporte/mês), metas (PMT), projeção e alerta de dívida.
 */
export function montarPlano(inp = {}) {
  const p = { ...PREMISSAS_PADRAO, ...(inp.premissas || {}), base: { ...PREMISSAS_PADRAO.base, ...((inp.premissas || {}).base || {}) } };
  const sobra = Math.max(0, Number(inp.sobra) || 0);
  const essencial = Number(inp.despesaEssencial) || 0;
  const mesesReserva = Number(inp.mesesReserva) || 6;
  const saldoReserva = Number(inp.saldoReserva) || 0;
  const saldoRiqueza = Number(inp.saldoRiqueza) || 0;
  const dividaCara = Number(inp.dividaCara) || 0;
  const idadeAtual = Number(inp.idadeAtual) || 0;
  const idadeApos = Number(inp.idadeAposentadoria) || 0;
  const bens = Array.isArray(inp.bensDuraveis) ? inp.bensDuraveis : [];

  const alvoReserva = essencial * mesesReserva;
  const alvoDuravel = bens.reduce((s, b) => s + (Number(b.valor) || 0), 0);
  const saldoDuravel = bens.reduce((s, b) => s + (Number(b.jaTenho) || 0), 0);

  const fracReserva = alvoReserva > 0 ? clamp01(1 - saldoReserva / alvoReserva) : 0;
  const fracDuravel = alvoDuravel > 0 ? clamp01(1 - saldoDuravel / alvoDuravel) : 0;

  const baldes = dividirBaldes(sobra, fracReserva, fracDuravel, p.base, p.pisoRiqueza);

  // Metas com PMT (aporte/mês pra cumprir no prazo).
  const metas = [];
  if (alvoReserva > 0) {
    metas.push({ nome: "Reserva de emergência", alvo: alvoReserva, saldo: saldoReserva, meses: p.prazoReserva,
      pmt: pmtMeta(saldoReserva, alvoReserva, p.prazoReserva, p.retReserva) });
  }
  for (const b of bens) {
    if (!(Number(b.valor) > 0)) continue;
    metas.push({ nome: b.nome || "Bem durável", alvo: Number(b.valor) || 0, saldo: Number(b.jaTenho) || 0, meses: Number(b.meses) || 0,
      pmt: pmtMeta(Number(b.jaTenho) || 0, Number(b.valor) || 0, Number(b.meses) || 0, p.retDuravel) });
  }

  // Projeção da riqueza até a aposentadoria, com o aporte da riqueza deste mês.
  const mesesHorizonte = Math.max(0, (idadeApos - idadeAtual)) * 12;
  const projecao = projetarRiqueza(saldoRiqueza, baldes.riqueza, p.retRiqueza, mesesHorizonte, p.inflacao);

  return {
    sobra,
    dividaCara,
    quitarDividaPrimeiro: dividaCara > 0,
    alvoReserva, saldoReserva, fracReserva,
    alvoDuravel, saldoDuravel, fracDuravel,
    baldes,
    metas,
    projecao: { ...projecao, anos: mesesHorizonte / 12 },
    premissas: p,
  };
}
