/* ============================================================
   COMPARTILHAR BOLÃO POR LINK
   ─────────────────────────────────────────────────────────────
   Estratégia: codifica o bolão (JSON compacto) em base64-url
   e coloca no fragmento da URL: https://app/#b/<base64>
     - Funciona offline (sem Supabase)
     - Funciona em Capacitor (apenas hash, não precisa SPA fallback server)
     - Sem necessidade de banco de dados pra esse fluxo
   Tradeoff: URL fica longa em bolões grandes (≈ 4-5 KB pra 100 apostas).
   ============================================================ */

/** Chaves curtas pra reduzir tamanho da URL */
const SHORT = { nome: "n", concursoAlvo: "c", jogos: "j", participantes: "p", estrategia: "e", custoTotal: "x", criadoEm: "t" };
const SHORT_P = { id: "i", nome: "n", cotas: "c", valorPago: "v" };

function compactar(bolao) {
  const out = {
    [SHORT.nome]: bolao.nome,
    [SHORT.concursoAlvo]: bolao.concursoAlvo,
    [SHORT.jogos]: bolao.jogos,
    [SHORT.participantes]: bolao.participantes.map(p => ({
      [SHORT_P.id]: p.id,
      [SHORT_P.nome]: p.nome,
      [SHORT_P.cotas]: p.cotas,
      [SHORT_P.valorPago]: p.valorPago,
    })),
    [SHORT.estrategia]: bolao.estrategia,
    [SHORT.custoTotal]: bolao.custoTotal,
    [SHORT.criadoEm]: bolao.criadoEm,
  };
  return out;
}

function expandir(compact) {
  return {
    nome: compact[SHORT.nome],
    concursoAlvo: compact[SHORT.concursoAlvo],
    jogos: compact[SHORT.jogos] || [],
    participantes: (compact[SHORT.participantes] || []).map(p => ({
      id: p[SHORT_P.id],
      nome: p[SHORT_P.nome],
      cotas: p[SHORT_P.cotas],
      valorPago: p[SHORT_P.valorPago],
    })),
    estrategia: compact[SHORT.estrategia],
    custoTotal: compact[SHORT.custoTotal],
    criadoEm: compact[SHORT.criadoEm],
    status: "ativo",
  };
}

/** base64-url encode/decode (RFC 4648 §5, sem padding) */
function b64urlEncode(bytes) {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - str.length % 4) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

/**
 * Encoda um bolão num token base64-url pra colocar na URL.
 * @returns {string} token (≈ 50-500 chars dependendo do tamanho do bolão)
 */
export function encodeBolao(bolao) {
  const json = JSON.stringify(compactar(bolao));
  return b64urlEncode(new TextEncoder().encode(json));
}

/**
 * Decoda um token de URL. Retorna null se inválido.
 */
export function decodeBolao(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const bytes = b64urlDecode(token);
    const json = new TextDecoder().decode(bytes);
    const compact = JSON.parse(json);
    const b = expandir(compact);
    if (!b.nome || !Array.isArray(b.jogos) || !b.jogos.length) return null;
    return b;
  } catch {
    return null;
  }
}

/** URL completa para compartilhar (usa o hash da location atual) */
export function urlDoBolao(bolao, base) {
  const token = encodeBolao(bolao);
  const origem = base || (typeof location !== "undefined"
    ? `${location.origin}${location.pathname}`
    : "");
  return `${origem}#b/${token}`;
}

/** Lê o token da URL (hash) se existir */
export function tokenDaURL() {
  if (typeof location === "undefined") return null;
  const m = location.hash.match(/^#b\/(.+)$/);
  return m ? m[1] : null;
}

/** Limpa o token da URL sem causar reload */
export function limparTokenDaURL() {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  } catch {}
}
