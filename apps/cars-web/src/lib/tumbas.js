/**
 * Lápides (tombstones) de itens apagados — antídoto do "lançamento que volta".
 *
 * A fusão por coleção do sync (storage.js) reincorpora itens que só existem
 * num dos lados — ótimo pra não perder lançamentos novos, mas fazia um item
 * APAGADO ressuscitar se a nuvem/outro aparelho ainda o tivesse (bug relatado
 * em 2026-09-22: transação deletada voltava toda vez).
 *
 * Solução: ao apagar, o id ganha uma lápide em `tumbas` (parte do estado
 * sincronizado): { [colecao]: { [id]: timestampDaExclusao } }. A fusão une as
 * lápides dos dois lados e filtra os itens mortos em vez de reincorporá-los.
 * Lápides expiram em 180 dias (poda automática) pra não crescer pra sempre.
 */

export const TUMBAS_MAX_DIAS = 180;
const MAX_MS = TUMBAS_MAX_DIAS * 24 * 60 * 60 * 1000;

// Remove lápides velhas (mais de 180 dias) de todas as coleções.
export function podarTumbas(tumbas, agora = Date.now()) {
  if (!tumbas || typeof tumbas !== "object") return {};
  const out = {};
  for (const col of Object.keys(tumbas)) {
    const m = tumbas[col];
    if (!m || typeof m !== "object") continue;
    const vivas = {};
    for (const id of Object.keys(m)) {
      const ts = Number(m[id]) || 0;
      if (agora - ts < MAX_MS) vivas[id] = ts;
    }
    if (Object.keys(vivas).length) out[col] = vivas;
  }
  return out;
}

// Registra novas lápides numa coleção (imutável; já poda as velhas).
export function comTumbas(tumbas, colecao, ids, agora = Date.now()) {
  const base = podarTumbas(tumbas, agora);
  if (!ids || !ids.length) return base;
  const col = { ...(base[colecao] || {}) };
  for (const id of ids) if (id != null) col[id] = agora;
  return { ...base, [colecao]: col };
}

// Remove lápides de ids que VOLTARAM à vida (ex.: "Desfazer" de uma exclusão,
// restauração de backup, item recriado). Sem isso, o item restaurado seria
// morto pela própria lápide na próxima fusão de sync (pego em 2026-09-30).
export function semTumbas(tumbas, colecao, ids) {
  const col = tumbas?.[colecao];
  if (!col || !ids || !ids.length) return tumbas || {};
  const vivos = { ...col };
  let mudou = false;
  for (const id of ids) if (id != null && vivos[id] != null) { delete vivos[id]; mudou = true; }
  if (!mudou) return tumbas;
  const out = { ...tumbas };
  if (Object.keys(vivos).length) out[colecao] = vivos;
  else delete out[colecao];
  return out;
}

// Ids presentes na lista nova e ausentes na anterior (= foram [re]criados).
export function idsAdicionados(prev, nova) {
  if (!Array.isArray(nova) || nova.length === 0) return [];
  const antes = new Set((Array.isArray(prev) ? prev : []).map(x => x && x.id).filter(id => id != null));
  return nova.map(x => x && x.id).filter(id => id != null && !antes.has(id));
}

// União das lápides de dois estados (fusão de sync) — carimbo mais novo vence.
export function unirTumbas(a, b, agora = Date.now()) {
  const pa = podarTumbas(a, agora);
  const pb = podarTumbas(b, agora);
  const out = { ...pa };
  for (const col of Object.keys(pb)) {
    const m = { ...(out[col] || {}) };
    for (const id of Object.keys(pb[col])) {
      m[id] = Math.max(Number(m[id]) || 0, pb[col][id]);
    }
    out[col] = m;
  }
  return out;
}

// Ids presentes na lista anterior e ausentes na nova (= foram apagados).
export function idsRemovidos(prev, nova) {
  if (!Array.isArray(prev) || prev.length === 0) return [];
  const vivos = new Set((Array.isArray(nova) ? nova : []).map(x => x && x.id).filter(id => id != null));
  return prev.map(x => x && x.id).filter(id => id != null && !vivos.has(id));
}
