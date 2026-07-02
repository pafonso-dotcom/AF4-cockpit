// Helpers do módulo Despesas Fixas (independente de Transações)
//
// Modelo:
//   fixas[]:           templates de compromissos recorrentes
//   fixaOcorrencias[]: 12 entradas/ano geradas a partir de cada fixa

/**
 * Data de vencimento (YYYY-MM-DD) de uma fixa num mês (YYYY-MM), aplicando o
 * mesmo clamp de dia usado na geração de ocorrências (1–28, evita "Fev 30").
 */
export function dataVencimentoNoMes(mesISO, diaVencimento) {
  const diaSafe = Math.min(Math.max(parseInt(diaVencimento, 10) || 1, 1), 28);
  return `${mesISO}-${String(diaSafe).padStart(2, "0")}`;
}

/**
 * Gera as ocorrências de uma fixa para um ano específico (1 por mês).
 * Respeita inicioEm/terminoEm da fixa pra não gerar fora do range.
 */
export function gerarOcorrencias(fixa, ano = new Date().getFullYear()) {
  const ocorrencias = [];
  const inicioMes = fixa.inicioEm ? parseInt(fixa.inicioEm.slice(5), 10) : 1;
  const inicioAno = fixa.inicioEm ? parseInt(fixa.inicioEm.slice(0, 4), 10) : ano;
  const fimMes = fixa.terminoEm ? parseInt(fixa.terminoEm.slice(5), 10) : 12;
  const fimAno = fixa.terminoEm ? parseInt(fixa.terminoEm.slice(0, 4), 10) : ano;

  // Se ano todo está fora do range da fixa, devolve vazio
  if (ano < inicioAno) return [];
  if (ano > fimAno) return [];

  for (let m = 1; m <= 12; m++) {
    if (ano === inicioAno && m < inicioMes) continue;
    if (ano === fimAno && m > fimMes) continue;

    const mesStr = String(m).padStart(2, "0");
    const mesISO = `${ano}-${mesStr}`;
    ocorrencias.push({
      id: `occ-${fixa.id}-${ano}-${mesStr}`,
      fixaId: fixa.id,
      mes: mesISO,
      dataVencimento: dataVencimentoNoMes(mesISO, fixa.diaVencimento),
      valor: parseFloat(fixa.valor) || 0,
      status: "pendente",
      dataPagamento: null,
      transacaoId: null,
      valorPago: null,
    });
  }
  return ocorrencias;
}

/**
 * Status real de uma ocorrência considerando a data atual.
 * "paga" → fica paga. Senão, "atrasada" se vencimento < hoje, "pendente" caso contrário.
 */
export function statusReal(ocorrencia, hoje = new Date()) {
  if (ocorrencia.status === "paga") return "paga";
  const hojeISO = hoje.toISOString().slice(0, 10);
  if (ocorrencia.dataVencimento < hojeISO) return "atrasada";
  return "pendente";
}

/**
 * Resumo de um mês: total previsto, já pago, pendente, atrasado.
 */
export function resumoMes(ocorrencias, mes /* "YYYY-MM" */, hoje = new Date()) {
  const doMes = ocorrencias.filter(o => o.mes === mes);
  const previsto = doMes.reduce((s, o) => s + (o.valor || 0), 0);

  const pagas = doMes.filter(o => o.status === "paga");
  const jaPago = pagas.reduce((s, o) => s + (o.valorPago ?? o.valor ?? 0), 0);

  const atrasadas = doMes.filter(o => statusReal(o, hoje) === "atrasada");
  const atrasado = atrasadas.reduce((s, o) => s + (o.valor || 0), 0);

  const pendentes = doMes.filter(o => statusReal(o, hoje) === "pendente");
  const pendente = pendentes.reduce((s, o) => s + (o.valor || 0), 0);

  return {
    total: doMes.length,
    previsto,
    jaPago, qtdPagas: pagas.length,
    pendente, qtdPendentes: pendentes.length,
    atrasado, qtdAtrasadas: atrasadas.length,
  };
}

/**
 * Garante que existem ocorrências para o ano-alvo de cada fixa.
 * Idempotente: se já tem alguma do ano, não adiciona nada.
 * Retorna a lista de ocorrências possivelmente expandida.
 */
export function garantirOcorrenciasDoAno(fixas, ocorrenciasAtuais, ano) {
  const novas = [];
  for (const fixa of fixas) {
    const temDoAno = ocorrenciasAtuais.some(o => o.fixaId === fixa.id && o.mes.startsWith(`${ano}-`));
    if (temDoAno) continue;
    novas.push(...gerarOcorrencias(fixa, ano));
  }
  if (novas.length === 0) return ocorrenciasAtuais;
  return [...ocorrenciasAtuais, ...novas];
}
