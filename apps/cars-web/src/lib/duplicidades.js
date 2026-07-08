// Varredura de duplicidades no Financeiro — checa as principais coleções
// (transações, dívidas, devedores, fixas, cheques, parcelamentos, cartões,
// contas, categorias) e agrupa itens que parecem repetidos pela mesma "chave".
// Puro/local — a UI (modal) decide o que remover, sempre mantendo 1 de cada
// grupo e com desfazer.

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Agrupa itens (com id) por chave; devolve só os grupos com 2+ itens.
function agrupar(itens, chaveFn) {
  const map = new Map();
  (itens || []).forEach((it) => {
    if (!it || it.id == null) return; // sem id não dá pra remover com segurança
    const k = chaveFn(it);
    if (k == null || k === "") return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  });
  return [...map.values()].filter((g) => g.length > 1);
}

/**
 * Varre o estado financeiro e devolve os grupos duplicados por tipo.
 * @returns {{ grupos: Array, porTipo: Object, totalExtra: number, totalGrupos: number }}
 *   grupo = { tipo, label, manter:id, remover:[id], exemplos:[string], qtd:number }
 */
export function varrerDuplicidades(state = {}) {
  const grupos = [];
  const add = (tipo, label, itens, chaveFn, rotulo) => {
    for (const g of agrupar(itens, chaveFn)) {
      grupos.push({
        tipo, label,
        manter: g[0].id,
        remover: g.slice(1).map((x) => x.id),
        exemplos: g.map(rotulo),
        qtd: g.length,
      });
    }
  };

  add("transacoes", "Transações", state.transacoes,
    (t) => (t.tipo ? `${t.tipo}|${round2(t.valor)}|${(t.data || "").slice(0, 10)}|${norm(t.conta)}|${norm(t.descricao)}` : null),
    (t) => `${t.descricao || "—"} · ${round2(t.valor)} · ${(t.data || "").slice(0, 10)}`);
  add("dividas", "Dívidas (a pagar)", state.dividas,
    (d) => `${norm(d.nome)}|${round2(d.valor)}|${d.vencimento || ""}`,
    (d) => `${d.nome || "—"} · ${round2(d.valor)}`);
  add("devedores", "A receber (devedores)", state.devedores,
    (d) => `${norm(d.nome)}|${round2(d.valor)}|${d.vencimento || ""}`,
    (d) => `${d.nome || "—"} · ${round2(d.valor)}`);
  add("fixas", "Despesas fixas", state.fixas,
    (f) => `${norm(f.descricao)}|${round2(f.valor)}`,
    (f) => `${f.descricao || "—"} · ${round2(f.valor)}`);
  add("cheques", "Cheques", state.cheques,
    (c) => `${norm(c.de)}|${round2(c.valor)}|${c.vencimento || ""}|${norm(c.numero)}`,
    (c) => `${c.de || "—"} · ${round2(c.valor)}`);
  add("parcelamentos", "Parcelamentos (cartão)", state.parcelamentos,
    (p) => `${norm(p.descricao)}|${round2(p.valorTotal)}|${p.totalParcelas}|${p.cartaoId || ""}`,
    (p) => `${p.descricao || "—"} · ${round2(p.valorTotal)}`);
  add("cartoes", "Cartões", state.cartoes,
    (c) => norm(c.nome),
    (c) => c.nome || "—");
  add("contas", "Contas", state.contas,
    (c) => norm(c.nome),
    (c) => c.nome || "—");
  add("categorias", "Categorias", state.categorias,
    (c) => `${norm(c.nome)}|${c.tipo || ""}`,
    (c) => `${c.nome || "—"}${c.tipo ? ` (${c.tipo})` : ""}`);

  const porTipo = {};
  for (const g of grupos) {
    if (!porTipo[g.tipo]) porTipo[g.tipo] = { tipo: g.tipo, label: g.label, grupos: [], remover: [] };
    porTipo[g.tipo].grupos.push(g);
    porTipo[g.tipo].remover.push(...g.remover);
  }
  const totalExtra = grupos.reduce((s, g) => s + g.remover.length, 0);
  return { grupos, porTipo, totalExtra, totalGrupos: grupos.length };
}
