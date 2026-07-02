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
