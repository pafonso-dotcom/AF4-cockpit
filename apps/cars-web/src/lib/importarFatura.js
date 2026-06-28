// Engine de matching e distribuição da importação de fatura para o Planejamento.
//
// Tipos de item retornados pela IA:
//   - "vista"   → despesa variável (1 transação no mês da fatura)
//   - "fixa"    → assinatura recorrente (template + 12 ocorrências; 1ª paga na fatura)
//   - "parcela" → match com parcelamento existente OU criação de parcelamento novo

const normalize = (s = "") => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, "")
  .replace(/\s+/g, " ").trim();

function jaccardSimilarity(a, b) {
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.size / union.size;
}

/**
 * Tenta achar um parcelamento existente que case com o item da fatura.
 * Critérios (todos devem bater):
 *  - mesmo totalParcelas
 *  - valorParcela com diferença ≤ 1%
 *  - nome similar (subset ou jaccard > 0.6)
 * Em caso de dúvida, retorna null (prefere criar novo a casar errado).
 */
export function matchParcelamento(item, parcelamentosExistentes = []) {
  if (!item || item.tipo !== "parcela") return null;
  if (!Array.isArray(parcelamentosExistentes) || parcelamentosExistentes.length === 0) return null;

  const descNorm = normalize(item.descricao || "");
  const valorItem = Number(item.valor_parcela || item.valor) || 0;
  const totalItem = Number(item.parcela_total) || 0;
  const dataItem = brDateToISO(item.data_compra) || item.data || item.data_compra;

  const candidatos = parcelamentosExistentes.filter(p => {
    // Total de parcelas precisa bater
    if (Number(p.totalParcelas) !== totalItem) return false;

    // Valor da parcela precisa bater (tolerância 1%)
    const valorParc = Number(p.valorParcela) || (p.valorTotal && p.totalParcelas ? p.valorTotal / p.totalParcelas : 0);
    if (!valorParc) return false;
    const dif = Math.abs(valorParc - valorItem) / valorParc;
    if (dif > 0.01) return false;

    // Descrição similar (subset OU jaccard > 0.5)
    const pNorm = normalize(p.descricao || "");
    const descMatch = pNorm.includes(descNorm) || descNorm.includes(pNorm) || jaccardSimilarity(pNorm, descNorm) > 0.5;
    if (descMatch) return true;

    // Match secundário: data de compra próxima (≤ 7 dias)
    if (dataItem && p.dataCompra) {
      const diasDif = Math.abs(new Date(dataItem) - new Date(p.dataCompra)) / 86400000;
      if (Number.isFinite(diasDif) && diasDif <= 7) return true;
    }

    return false;
  });

  return candidatos[0] || null;
}

/**
 * Tenta achar uma despesa fixa existente que case com o item da fatura.
 * Critérios:
 *  - valor com diferença ≤ 1%
 *  - nome similar (subset OU jaccard > 0.5)
 * Evita duplicar fixas quando a mesma fatura é reimportada.
 */
export function matchFixaExistente(item, fixasExistentes = []) {
  if (!item) return null;
  if (!Array.isArray(fixasExistentes) || fixasExistentes.length === 0) return null;

  const descNorm = normalize(item.descricao || "");
  if (!descNorm) return null;
  const valorItem = Number(item.valor) || 0;

  const candidatos = fixasExistentes.filter(f => {
    const valorFixa = Number(f.valor) || 0;
    if (!valorFixa) return false;
    const dif = Math.abs(valorFixa - valorItem) / valorFixa;
    if (dif > 0.01) return false;

    const fNorm = normalize(f.descricao || "");
    if (!fNorm) return false;
    return fNorm.includes(descNorm) || descNorm.includes(fNorm) || jaccardSimilarity(fNorm, descNorm) > 0.5;
  });

  return candidatos[0] || null;
}

/**
 * Concilia uma linha "vista" da fatura com uma transação que o usuário JÁ lançou
 * à mão (durante o mês). Evita o duplicado clássico: você lança a compra quando
 * gasta, e depois a fatura traz a mesma linha.
 *
 * Critérios:
 *  - é despesa, não veio de fatura (origem != "fatura*"), não está em `usados`
 *  - mesmo cartão (se `cartaoId` for informado e a transação tiver cartaoId)
 *  - valor igual (tolerância: 1% ou 1 centavo, o que for maior)
 *  - data dentro da janela (`janelaDias`, padrão 4)
 *  - se ambas têm descrição, exige alguma similaridade (evita casar 2 compras
 *    de mesmo valor/dia que não têm nada a ver)
 * Entre vários candidatos, escolhe o de data mais próxima.
 * Em caso de dúvida, retorna null (prefere não conciliar a conciliar errado).
 *
 * @returns {object|null} a transação existente que casa, ou null
 */
export function matchTransacaoExistente(item, transacoesExistentes = [], opts = {}) {
  if (!item) return null;
  if (!Array.isArray(transacoesExistentes) || transacoesExistentes.length === 0) return null;

  const { cartaoId = null, janelaDias = 4, usados = new Set() } = opts;
  const valorItem = Number(item.valor) || 0;
  if (!valorItem) return null;
  const descNorm = normalize(item.descricao || "");
  const dataItem = brDateToISO(item.data_compra) || item.data || item.data_compra || null;
  const tolValor = Math.max(0.02, valorItem * 0.01);

  const candidatos = transacoesExistentes.filter((t) => {
    if (!t || t.tipo !== "despesa") return false;
    if (t.id && usados.has(t.id)) return false;
    if (typeof t.origem === "string" && t.origem.startsWith("fatura")) return false;
    if (cartaoId && t.cartaoId && t.cartaoId !== cartaoId) return false;

    const tv = Number(t.valor) || 0;
    if (!tv) return false;
    if (Math.abs(tv - valorItem) > tolValor) return false;

    if (dataItem && t.data) {
      const dias = Math.abs(new Date(dataItem) - new Date(t.data)) / 86400000;
      if (Number.isFinite(dias) && dias > janelaDias) return false;
    }

    const tNorm = normalize(t.descricao || "");
    if (descNorm && tNorm) {
      const ok = tNorm.includes(descNorm) || descNorm.includes(tNorm) || jaccardSimilarity(tNorm, descNorm) > 0.34;
      if (!ok) return false;
    }
    return true;
  });

  candidatos.sort((a, b) => {
    if (!dataItem) return 0;
    const da = a.data ? Math.abs(new Date(dataItem) - new Date(a.data)) : Infinity;
    const db = b.data ? Math.abs(new Date(dataItem) - new Date(b.data)) : Infinity;
    return da - db;
  });

  return candidatos[0] || null;
}

/**
 * Verifica se a fatura inteira parece já ter sido importada.
 * Retorna objeto com `duplicada: true` se ≥ 70% das parcelas já existem.
 */
export function detectarDuplicidadeFatura(analise, parcelamentos = []) {
  const itensParcela = ((analise && (analise.itens || analise.transacoes)) || [])
    .filter(i => i.tipo === "parcela");
  if (itensParcela.length === 0) {
    return { duplicada: false, percentual: 0, totalItens: 0, itensJaImportados: 0 };
  }

  const matches = itensParcela.filter(i => matchParcelamento(i, parcelamentos));
  const pct = matches.length / itensParcela.length;

  return {
    duplicada: pct >= 0.7,
    percentual: Math.round(pct * 100),
    totalItens: itensParcela.length,
    itensJaImportados: matches.length,
  };
}

/**
 * Gera 12 ocorrências de uma fixa recorrente.
 * mesInicio formato "YYYY-MM" (ex.: "2026-05")
 * A 1ª ocorrência (mesInicio) já vem como "paga" — porque veio na fatura sendo importada.
 * Retorna ocorrências SEM fixaId (caller adiciona depois).
 */
export function gerarOcorrenciasFixa(item, mesInicio, hojeISO = new Date().toISOString().slice(0, 10)) {
  const [ano, mes] = mesInicio.split("-").map(Number);
  // Tenta extrair dia da data_compra; fallback dia 1
  let dia = 1;
  if (item.data_compra && /^\d{1,2}\//.test(item.data_compra)) {
    dia = parseInt(item.data_compra.split("/")[0], 10) || 1;
  }
  if (dia > 28) dia = 28; // evita fevereiro 30

  const ocorrencias = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(ano, mes - 1 + i, dia);
    const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const dataVencimento = d.toISOString().slice(0, 10);
    ocorrencias.push({
      id: `occ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
      mes: mesKey,
      dataVencimento,
      valor: Number(item.valor) || 0,
      status: i === 0 ? "paga" : "pendente",
      dataPagamento: i === 0 ? hojeISO : null,
      valorPago: i === 0 ? (Number(item.valor) || 0) : null,
      transacaoId: null,
    });
  }
  return ocorrencias;
}

/**
 * Gera as parcelas pagas (já efetivadas) para um parcelamento novo criado a partir de uma fatura.
 * As parcelas 1..parcela_atual são marcadas como pagas (assumindo que as anteriores também estavam
 * em faturas anteriores e já foram lançadas — se isso for incorreto pro caso de uso, o usuário ajusta).
 */
export function parcelasPagasIniciais(item) {
  const ate = Number(item.parcela_atual) || 1;
  return Array.from({ length: ate }, (_, i) => i + 1);
}

/**
 * Helper de data: "DD/MM/YYYY" → "YYYY-MM-DD"
 */
export function brDateToISO(br) {
  if (!br || typeof br !== "string") return null;
  const m = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

/**
 * Helper: "DD/MM/YYYY" → "YYYY-MM"
 */
export function brDateToMonthISO(br) {
  const iso = brDateToISO(br);
  return iso ? iso.slice(0, 7) : null;
}
