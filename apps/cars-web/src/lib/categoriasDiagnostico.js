/* ============================================================
   DIAGNÓSTICO DE CATEGORIAS · varredura da taxonomia

   Aponta o que atrapalha a clareza dos gastos e prepara as
   correções de um clique (aplicadas pela tela Categorias):

   1. FORA DO CADASTRO — nome de categoria usado em transações mas
      que não existe no cadastro (fica cinza/“⚠” nas telas e fora
      dos orçamentos). Correção: criar a categoria.
   2. DUPLICADAS — categorias com o mesmo nome a menos de
      maiúsculas/acentos/espaços ("Mercado" e "mercado "). Correção:
      unificar (transações apontam pra que ficou; a outra sai).
   3. SUBCATEGORIA ÓRFÃ — transações com subcategoria que não está
      na lista da categoria. Correção: adicionar como subcategoria.
   4. SEM USO — categorias (e filhas) sem nenhuma transação:
      candidatas a excluir pra enxugar a lista. Só informativo.
   ============================================================ */

export const normNomeCat = (s = "") =>
  String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function diagnosticoCategorias({ categorias = [], transacoes = [] } = {}) {
  const cats = (categorias || []).filter(Boolean);
  const txs = (transacoes || []).filter(Boolean);

  // Usos por nome de categoria (transações)
  const usosPorNome = {};
  for (const t of txs) {
    const nome = (t.categoria || "").trim();
    if (!nome) continue;
    const e = (usosPorNome[nome] ||= { usos: 0, receita: 0, despesa: 0 });
    e.usos += 1;
    if (t.tipo === "receita") e.receita += 1; else e.despesa += 1;
  }

  const nomesCadastro = new Set(cats.map(c => normNomeCat(c.nome)));

  // 1. Fora do cadastro — sugere o tipo pela maioria das transações
  const foraDoCadastro = Object.entries(usosPorNome)
    .filter(([nome]) => !nomesCadastro.has(normNomeCat(nome)))
    .map(([nome, e]) => ({ nome, usos: e.usos, tipoSugerido: e.receita > e.despesa ? "receita" : "despesa" }))
    .sort((a, b) => b.usos - a.usos);

  // 2. Duplicadas — grupos com 2+ categorias no mesmo nome normalizado.
  // A "principal" (que fica na unificação) é a com mais usos; empate → a
  // que tem filhas/subcategorias; depois a primeira.
  const porNorm = {};
  for (const c of cats) (porNorm[normNomeCat(c.nome)] ||= []).push(c);
  const usosDe = (c) => usosPorNome[(c.nome || "").trim()]?.usos || 0;
  const pesoEstrutura = (c, todas) =>
    (todas.some(x => x.parentId === c.id) ? 1 : 0) + ((c.subcategorias || []).length ? 1 : 0);
  const duplicadas = Object.values(porNorm)
    .filter(g => g.length > 1)
    .map(grupo => {
      const ordenado = [...grupo].sort((a, b) =>
        (usosDe(b) - usosDe(a)) || (pesoEstrutura(b, cats) - pesoEstrutura(a, cats)));
      return { manter: ordenado[0], remover: ordenado.slice(1), usos: grupo.map(usosDe) };
    });

  // 3. Subcategorias órfãs — t.subcategoria fora da lista da categoria.
  // Lookup: nome EXATO primeiro (senão uma duplicada "mercado " atropela a
  // "Mercado" certa no mapa normalizado); norm só como fallback.
  const catPorNomeExato = {};
  const catPorNorm2 = {};
  for (const c of cats) {
    catPorNomeExato[(c.nome || "").trim()] ??= c;
    catPorNorm2[normNomeCat(c.nome)] ??= c;
  }
  const orfasMap = {};
  for (const t of txs) {
    const sub = (t.subcategoria || "").trim();
    if (!sub) continue;
    const cat = catPorNomeExato[(t.categoria || "").trim()] || catPorNorm2[normNomeCat(t.categoria || "")];
    if (!cat) continue; // sem categoria válida cai no caso 1
    const tem = (cat.subcategorias || []).some(s => normNomeCat(s?.nome) === normNomeCat(sub));
    if (tem) continue;
    const k = `${cat.id}|${normNomeCat(sub)}`;
    const e = (orfasMap[k] ||= { categoria: cat, subcategoria: sub, usos: 0 });
    e.usos += 1;
  }
  const subOrfas = Object.values(orfasMap).sort((a, b) => b.usos - a.usos);

  // 4. Sem uso — nem a categoria nem as filhas têm transação
  const filhasDe = {};
  for (const c of cats) if (c.parentId) (filhasDe[c.parentId] ||= []).push(c);
  const temUso = (c) => usosDe(c) > 0;
  const semUso = cats.filter(c => {
    if (temUso(c)) return false;
    if (!c.parentId && (filhasDe[c.id] || []).some(temUso)) return false;
    return true;
  });

  return {
    foraDoCadastro, duplicadas, subOrfas, semUso,
    totalProblemas: foraDoCadastro.length + duplicadas.length + subOrfas.length,
  };
}

/** Unificação de duplicadas — devolve o novo estado (puro, testável):
 *  transações das removidas passam a apontar pro nome da mantida; filhas e
 *  subcategorias das removidas migram pra mantida; removidas saem da lista. */
export function aplicarUnificacao({ manter, remover }, { categorias = [], transacoes = [] } = {}) {
  const idsRemover = new Set(remover.map(c => c.id));
  const nomesRemover = new Set(remover.map(c => normNomeCat(c.nome)));

  // Re-aponta quem usa QUALQUER grafia removida — a comparação com a mantida
  // é pelo nome EXATO (as duplicadas diferem justamente só em caixa/espaço).
  const transacoesNovas = transacoes.map(t =>
    t && nomesRemover.has(normNomeCat(t.categoria || "")) && (t.categoria || "") !== manter.nome
      ? { ...t, categoria: manter.nome }
      : t
  );

  // Subcategorias herdadas (sem duplicar por nome)
  const subsManter = [...(manter.subcategorias || [])];
  const nomesSubs = new Set(subsManter.map(s => normNomeCat(s?.nome)));
  for (const r of remover) {
    for (const s of r.subcategorias || []) {
      if (!nomesSubs.has(normNomeCat(s?.nome))) { subsManter.push(s); nomesSubs.add(normNomeCat(s?.nome)); }
    }
  }

  const categoriasNovas = categorias
    .filter(c => !idsRemover.has(c.id))
    .map(c => {
      let novo = c;
      if (idsRemover.has(c.parentId)) novo = { ...novo, parentId: manter.id }; // filha migra
      if (c.id === manter.id) novo = { ...novo, subcategorias: subsManter };
      return novo;
    });

  return { categorias: categoriasNovas, transacoes: transacoesNovas };
}

/** Fusão MANUAL de categorias (De → Para), escolhida pelo usuário no
 *  Diagnóstico — pra juntar categorias-estabelecimento ("Padaria",
 *  "MercadoLivre") na categoria real ("Alimentação"). Puro:
 *  - transações/fixas/parcelamentos/dívidas com a categoria ORIGEM passam
 *    pra DESTINO; o nome antigo vira subcategoria do lançamento (rastro);
 *  - a origem vira SUBCATEGORIA cadastrada da destino (e some da lista);
 *  - filhas (parentId) e subcategorias da origem migram pra destino. */
export function fundirCategorias(origem, destino, dados = {}) {
  const { categorias = [], transacoes = [], fixas = [], parcelamentos = [], dividas = [] } = dados;
  const nomeOrig = String(origem?.nome || "").trim();

  const troca = (obj) => {
    if (!obj || String(obj.categoria || "").trim() !== nomeOrig) return obj;
    return { ...obj, categoria: destino.nome, subcategoria: obj.subcategoria || nomeOrig };
  };

  // Subcategorias da destino: herda as da origem + a PRÓPRIA origem vira sub.
  const subs = [...(destino.subcategorias || [])];
  const nomesSubs = new Set(subs.map(s => normNomeCat(s?.nome)));
  for (const s of origem.subcategorias || []) {
    if (!nomesSubs.has(normNomeCat(s?.nome))) { subs.push(s); nomesSubs.add(normNomeCat(s?.nome)); }
  }
  if (nomeOrig && !nomesSubs.has(normNomeCat(nomeOrig))) subs.push({ id: `sub-${origem.id}`, nome: nomeOrig });

  const categoriasNovas = categorias
    .filter(c => c.id !== origem.id)
    .map(c => {
      let novo = c;
      if (c.parentId === origem.id) novo = { ...novo, parentId: destino.id };
      if (c.id === destino.id) novo = { ...novo, subcategorias: subs };
      return novo;
    });

  return {
    categorias: categoriasNovas,
    transacoes: transacoes.map(troca),
    fixas: fixas.map(troca),
    parcelamentos: parcelamentos.map(troca),
    dividas: dividas.map(troca),
  };
}

/** Funde TODAS as filhas (parentId) de uma categoria nela, de uma vez —
 *  aplica fundirCategorias em sequência, puro. Cada filha vira subcategoria
 *  da mãe e os lançamentos migram com rastro. */
export function fundirTodasFilhas(mae, dados = {}) {
  const filhas = (dados.categorias || []).filter(c => c?.parentId === mae.id);
  let atual = {
    categorias: dados.categorias || [], transacoes: dados.transacoes || [],
    fixas: dados.fixas || [], parcelamentos: dados.parcelamentos || [], dividas: dados.dividas || [],
  };
  let maeAtual = mae;
  for (const f of filhas) {
    const r = fundirCategorias(f, maeAtual, atual);
    atual = r;
    maeAtual = r.categorias.find(c => c.id === mae.id) || maeAtual;
  }
  return { ...atual, n: filhas.length };
}
