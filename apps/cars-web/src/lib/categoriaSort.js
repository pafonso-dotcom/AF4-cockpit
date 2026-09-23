// Ordenação alfabética de categorias (e subcategorias/tags), com acentuação
// e maiúsculas/minúsculas tratadas corretamente (pt-BR).

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Retorna uma NOVA lista de categorias (ou qualquer objeto com `.nome`)
 * ordenada alfabeticamente por nome. Não muta o array recebido.
 */
export function ordenarPorNome(lista = []) {
  return [...(lista || [])].sort((a, b) => collator.compare(a?.nome || "", b?.nome || ""));
}

/**
 * Árvore de categorias pro seletor hierárquico (pais primeiro, filhas ao
 * tocar — pedido 2026-09-23): retorna [{ pai, filhas: [...] }] ordenados.
 *
 * - Raízes = categorias SEM parentId (filha órfã de pai apagado vira raiz);
 * - `tipo` opcional filtra com a regra flexível dos selects do app
 *   (`!c.tipo || c.tipo === tipo`); sem tipo, entram todas;
 * - filhas herdam o filtro do pai (aparecem junto dele, qualquer tipo).
 */
export function arvoreCategorias(categorias = [], tipo = null) {
  const lista = (categorias || []).filter(Boolean);
  const ids = new Set(lista.map(c => c.id));
  const passaTipo = (c) => !tipo || !c.tipo || c.tipo === tipo;

  const raizes = lista.filter(c => (!c.parentId || !ids.has(c.parentId)) && passaTipo(c));
  const filhasDe = (paiId) => ordenarPorNome(lista.filter(c => c.parentId === paiId));

  return ordenarPorNome(raizes).map(pai => ({ pai, filhas: filhasDe(pai.id) }));
}
