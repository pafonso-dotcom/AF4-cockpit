/**
 * Busca global — procura em vários conjuntos de dados (contas, ativos,
 * transações, categorias, metas, notas) e devolve resultados navegáveis
 * para o Command Palette.
 *
 * Cada resultado: { grupo, label, sub, modulo, tab, key }
 *  - grupo: rótulo curto (ex.: "Conta", "Ativo")
 *  - modulo/tab: destino ao escolher
 *  - key: chave única para render
 */

// Normaliza: minúsculas + remove acentos (busca tolerante).
const norm = (s) =>
  (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function buscarGlobal(query, dados = {}, limitePorGrupo = 5) {
  const q = norm(query).trim();
  if (q.length < 2) return [];

  const {
    transacoes = [], contas = [], ativos = [],
    notas = [], metas = [], categorias = [],
  } = dados;

  const out = [];
  const bate = (...campos) => campos.some(c => norm(c).includes(q));

  // Contas
  for (const c of contas) {
    if (out.filter(x => x.grupo === "Conta").length >= limitePorGrupo) break;
    if (bate(c.nome, c.instituicao)) {
      out.push({ grupo: "Conta", label: c.nome || "Conta", sub: c.instituicao || "", modulo: "financas", tab: "contas", key: `conta-${c.id}` });
    }
  }

  // Ativos
  for (const a of ativos) {
    if (out.filter(x => x.grupo === "Ativo").length >= limitePorGrupo) break;
    if (bate(a.ticker, a.nome)) {
      out.push({ grupo: "Ativo", label: a.ticker || a.nome || "Ativo", sub: a.nome || "", modulo: "invest", tab: "carteira", key: `ativo-${a.id}` });
    }
  }

  // Transações
  for (const t of transacoes) {
    if (out.filter(x => x.grupo === "Transação").length >= limitePorGrupo) break;
    if (bate(t.descricao, t.categoria, t.obs)) {
      const sinal = t.tipo === "receita" ? "+" : "−";
      out.push({ grupo: "Transação", label: t.descricao || "(sem descrição)", sub: `${sinal} ${t.categoria || ""}`.trim(), modulo: "financas", tab: "transacoes", key: `tx-${t.id}` });
    }
  }

  // Categorias
  for (const c of categorias) {
    if (out.filter(x => x.grupo === "Categoria").length >= limitePorGrupo) break;
    if (bate(c.nome)) {
      out.push({ grupo: "Categoria", label: c.nome || "Categoria", sub: c.tipo || "", modulo: "financas", tab: "categorias", key: `cat-${c.id}` });
    }
  }

  // Metas
  for (const m of metas) {
    if (out.filter(x => x.grupo === "Meta").length >= limitePorGrupo) break;
    if (bate(m.nome)) {
      out.push({ grupo: "Meta", label: m.nome || "Meta", sub: "", modulo: "financas", tab: "metas", key: `meta-${m.id}` });
    }
  }

  // Notas / Compromissos
  for (const n of notas) {
    if (out.filter(x => x.grupo === "Nota").length >= limitePorGrupo) break;
    if (bate(n.titulo, n.conteudo)) {
      out.push({ grupo: "Nota", label: n.titulo || (n.conteudo || "").slice(0, 40) || "Nota", sub: "", modulo: "financas", tab: "notas", key: `nota-${n.id}` });
    }
  }

  return out;
}
