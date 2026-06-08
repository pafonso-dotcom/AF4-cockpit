// Escopo financeiro: separa dados Pessoal vs Negócio.
// Toggle global no header controla qual fatia o app mostra.

const KEY = "af4:escopo-ativo";

/** Lê escopo ativo do localStorage. Default: "pessoal" — a conta marcada como
 *  Negócio NÃO é contabilizada no painel até você trocar o seletor. */
export function lerEscopo() {
  const v = localStorage.getItem(KEY);
  if (v === "pessoal" || v === "negocio" || v === "tudo") return v;
  return "pessoal";
}

/** Salva escopo ativo. */
export function salvarEscopo(escopo) {
  if (!["pessoal", "negocio", "tudo"].includes(escopo)) return;
  localStorage.setItem(KEY, escopo);
}

/** Heurística de detecção automática pelos nomes. */
export function detectarEscopoConta(conta) {
  const txt = `${conta.nome || ""} ${conta.banco || ""} ${conta.instituicao || ""} ${conta.tipo || ""}`.toLowerCase();
  const palavrasNegocio = ["loja", "af4", "cnpj", "pj", "empresa", "negocio", "negócio", "comercial"];
  if (palavrasNegocio.some(p => txt.includes(p))) return "negocio";
  return "pessoal";
}

/** Filtra array por escopo. Itens sem campo "escopo" são considerados "pessoal" (legado). */
export function filtrarPorEscopo(itens, escopoAtivo, getEscopo = i => i?.escopo) {
  if (!Array.isArray(itens)) return [];
  if (!escopoAtivo || escopoAtivo === "tudo") return itens;
  return itens.filter(i => (getEscopo(i) || "pessoal") === escopoAtivo);
}

/**
 * Migração one-shot: marca contas e categorias antigas com escopo detectado.
 * Controlada por flag no localStorage — roda só uma vez.
 */
export function migrarEscoposAuto(state, setters) {
  const FLAG = "af4:escopo-migrado";
  if (localStorage.getItem(FLAG) === "1") return false;

  if (Array.isArray(state.contas) && setters.setContas) {
    setters.setContas(state.contas.map(c => c.escopo ? c : { ...c, escopo: detectarEscopoConta(c) }));
  }
  if (Array.isArray(state.categorias) && setters.setCategorias) {
    setters.setCategorias(state.categorias.map(c => c.escopo ? c : { ...c, escopo: "pessoal" }));
  }
  localStorage.setItem(FLAG, "1");
  return true;
}
