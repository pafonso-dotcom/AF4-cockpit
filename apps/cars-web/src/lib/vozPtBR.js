/**
 * Escolhe a voz pt-BR do aparelho — MASCULINA por padrão (pedido 2026-10-02).
 * - Você pode escolher a voz na mão (fica salva: af4:voz-nome).
 * - A lista de vozes carrega ASSÍNCRONA (iPhone/Chrome devolvem [] na 1ª
 *   chamada); por isso pré-carregamos no início e ouvimos "voiceschanged" —
 *   antes, a 1ª leitura caía na voz padrão (feminina).
 * Nomes masculinos conhecidos: iPhone/Mac "Felipe"; Windows/Edge "Daniel",
 * "Antonio", "Donato", "Fabio", "Humberto", "Julio", "Nicolau", "Valerio".
 */
const MASC = /felipe|daniel|antonio|ant[oô]nio|donato|fabio|f[aá]bio|humberto|julio|j[uú]lio|nicolau|valerio|val[eé]rio|ricardo|eddy|reed|rocko|grandpa|vov[oô]|male|masculin/i;
const FEM = /luciana|francisca|thalita|leila|let[ií]cia|manuela|brenda|elza|giovanna|yara|joana|catarina|flo|sandy|shelley|grandma|vov[oó]|female|feminin/i;
const K_NOME = "af4:voz-nome";

let vozes = [];
function atualizar() { try { const v = window.speechSynthesis?.getVoices?.() || []; if (v.length) vozes = v; } catch {} return vozes; }
if (typeof window !== "undefined" && window.speechSynthesis) {
  atualizar();
  try { window.speechSynthesis.addEventListener?.("voiceschanged", atualizar); } catch {}
  // iOS às vezes não dispara o evento: tenta de novo algumas vezes.
  [300, 1000, 2500, 5000].forEach(ms => setTimeout(atualizar, ms));
}

/** Vozes em português disponíveis no aparelho (pt-BR primeiro). */
export function vozesPortugues() {
  const vs = atualizar();
  return vs.filter(v => /^pt/i.test(v.lang))
    .sort((a, b) => (/BR/i.test(b.lang) ? 1 : 0) - (/BR/i.test(a.lang) ? 1 : 0));
}
export const ehMasculina = (v) => !!v && MASC.test(v.name) && !FEM.test(v.name);
export function vozSalva() { try { return localStorage.getItem(K_NOME) || ""; } catch { return ""; } }
export function salvarVoz(nome) { try { nome ? localStorage.setItem(K_NOME, nome) : localStorage.removeItem(K_NOME); } catch {} }

/** Todas as vozes do aparelho (português primeiro) — pro seletor. */
export function todasVozes() {
  const vs = atualizar();
  const pt = vs.filter(v => /^pt/i.test(v.lang));
  return [...pt, ...vs.filter(v => !/^pt/i.test(v.lang))];
}
// "Voz do sistema": não escolhe voz nem idioma — o navegador usa a voz
// configurada no computador/celular (ex.: Felipe no Mac), mesmo quando ela
// não aparece na lista do navegador (Safari esconde algumas).
export const VOZ_SISTEMA = "__sistema__";

export function escolherVozPtBR() {
  const nome = vozSalva();
  if (nome === VOZ_SISTEMA) return { sistema: true };
  const pt = vozesPortugues();
  const escolhida = nome && (pt.find(v => v.name === nome) || todasVozes().find(v => v.name === nome));
  if (escolhida) return { voz: escolhida, pitch: 1 };
  const br = pt.filter(v => /BR/i.test(v.lang));
  const homem = (br.length ? br : pt).filter(ehMasculina)
    .sort((a, b) => (/natural|premium|enhanced|online/i.test(b.name) ? 1 : 0) - (/natural|premium|enhanced|online/i.test(a.name) ? 1 : 0))[0]
    || pt.find(ehMasculina);
  if (homem) return { voz: homem, pitch: 1 };
  // Sem voz masculina instalada: a disponível, bem mais grave.
  return { voz: br[0] || pt[0] || null, pitch: 0.55 };
}

/** Aplica a voz escolhida numa fala. */
export function aplicarVoz(u) {
  const { voz, pitch, sistema } = escolherVozPtBR();
  if (sistema) return u; // sem voice/lang: fala com a voz padrão do sistema
  u.lang = voz?.lang || "pt-BR";
  if (voz) u.voice = voz;
  u.pitch = pitch;
  return u;
}
