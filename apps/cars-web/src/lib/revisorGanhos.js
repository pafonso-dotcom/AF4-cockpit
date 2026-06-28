// Revisor de ganhos — auditoria das RECEITAS do mês.
// Tudo local (só usa transações). Espelha os limiares/estilo dos demais módulos
// de inteligência do app.

const normDesc = (s = "") =>
  String(s).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 50);

const mesDe = (t) => String(t?.data || "").slice(0, 7);

// Soma de receitas de um conjunto de transações já filtrado.
const somaReceitas = (txs) =>
  txs.reduce((s, t) => s + (Number(t.valor) || 0), 0);

// "YYYY-MM" do mês N posições antes de mesISO (N>0 = passado).
function mesDeslocado(mesISO, n) {
  const [a, m] = mesISO.split("-").map(Number);
  const d = new Date(a, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param {Array} transacoes  todas as transações (o chamador filtra escopo, se quiser)
 * @param {string} mesISO     "YYYY-MM" do mês a revisar
 * @param {object} [opts]
 * @param {number} [opts.lookback=4]  meses anteriores analisados pra recorrência
 * @param {number} [opts.serieMeses=6] tamanho da série histórica
 * @returns {{
 *   mes:string, total:number, totalAnterior:number, variacaoPct:number|null,
 *   fontes:Array<{fonte:string,valor:number,pct:number}>,
 *   concentracao:{fonte:string,pct:number}|null,
 *   faltando:Array<{descricao:string,valorTipico:number,ultimaData:string,mesesVistos:number}>,
 *   duplicadas:Array<{descricao:string,valor:number,ocorrencias:number}>,
 *   serie:Array<{mes:string,total:number}>,
 * }}
 */
export function revisarGanhos(transacoes = [], mesISO, { lookback = 4, serieMeses = 6 } = {}) {
  const receitas = (transacoes || []).filter(
    (t) => t && t.tipo === "receita" && Number(t.valor) > 0 && t.data
  );

  const doMes = receitas.filter((t) => mesDe(t) === mesISO);
  const mesAnt = mesDeslocado(mesISO, 1);
  const doAnterior = receitas.filter((t) => mesDe(t) === mesAnt);

  const total = somaReceitas(doMes);
  const totalAnterior = somaReceitas(doAnterior);
  const variacaoPct =
    totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : null;

  // ---- Composição da renda por fonte (categoria) ----
  const porFonte = {};
  for (const t of doMes) {
    const fonte = (t.categoria || "Outros").trim() || "Outros";
    porFonte[fonte] = (porFonte[fonte] || 0) + (Number(t.valor) || 0);
  }
  const fontes = Object.entries(porFonte)
    .map(([fonte, valor]) => ({ fonte, valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
  const concentracao =
    fontes.length > 0 && fontes[0].pct >= 60
      ? { fonte: fontes[0].fonte, pct: fontes[0].pct }
      : null;

  // ---- Recorrentes esperadas que NÃO entraram este mês ----
  // Olha os `lookback` meses anteriores; se uma descrição apareceu em 2+ meses
  // distintos e não há ocorrência no mês de referência, vira "esperada não recebida".
  const janela = new Set();
  for (let i = 1; i <= lookback; i++) janela.add(mesDeslocado(mesISO, i));
  const histPorDesc = {};
  for (const t of receitas) {
    if (!janela.has(mesDe(t))) continue;
    const k = normDesc(t.descricao);
    if (!k) continue;
    (histPorDesc[k] = histPorDesc[k] || []).push(t);
  }
  const presentesNoMes = new Set(doMes.map((t) => normDesc(t.descricao)));
  const faltando = [];
  for (const [k, items] of Object.entries(histPorDesc)) {
    const meses = new Set(items.map(mesDe));
    if (meses.size < 2) continue; // não é recorrente o bastante
    if (presentesNoMes.has(k)) continue; // já entrou este mês
    const valores = items.map((t) => Number(t.valor) || 0).sort((a, b) => a - b);
    const valorTipico = valores[Math.floor(valores.length / 2)]; // mediana
    const ultima = items.reduce((a, b) => (b.data > a.data ? b : a), items[0]);
    faltando.push({
      descricao: ultima.descricao,
      valorTipico,
      ultimaData: ultima.data,
      mesesVistos: meses.size,
    });
  }
  faltando.sort((a, b) => b.valorTipico - a.valorTipico);

  // ---- Duplicadas no mês (mesma descrição normalizada + mesmo valor) ----
  const dupMap = {};
  for (const t of doMes) {
    const k = `${normDesc(t.descricao)}|${Number(t.valor)}`;
    (dupMap[k] = dupMap[k] || []).push(t);
  }
  const duplicadas = Object.values(dupMap)
    .filter((items) => items.length >= 2)
    .map((items) => ({
      descricao: items[0].descricao,
      valor: Number(items[0].valor) || 0,
      ocorrencias: items.length,
    }))
    .sort((a, b) => b.valor - a.valor);

  // ---- Série dos últimos `serieMeses` meses (inclui o de referência) ----
  const serie = [];
  for (let i = serieMeses - 1; i >= 0; i--) {
    const m = mesDeslocado(mesISO, i);
    serie.push({ mes: m, total: somaReceitas(receitas.filter((t) => mesDe(t) === m)) });
  }

  return { mes: mesISO, total, totalAnterior, variacaoPct, fontes, concentracao, faltando, duplicadas, serie };
}
