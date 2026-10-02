/**
 * Escolhe a voz pt-BR do aparelho — MASCULINA (pedido 2026-10-02).
 * Nomes conhecidos: iPhone/Mac "Felipe"; Windows/Edge "Daniel", "Antonio",
 * "Donato", "Fabio", "Humberto", "Julio", "Nicolau", "Valerio".
 * Se o aparelho não tiver voz masculina em português (ex.: Chrome só tem a
 * "Google português do Brasil", feminina), usa a que tiver com tom mais grave.
 */
const MASC = /felipe|daniel|antonio|ant[oô]nio|donato|fabio|f[aá]bio|humberto|julio|j[uú]lio|nicolau|valerio|val[eé]rio|ricardo|male|masculin/i;
const FEM = /luciana|francisca|thalita|leila|let[ií]cia|manuela|brenda|elza|giovanna|yara|female|feminin|joana|catarina/i;

export function escolherVozPtBR() {
  let vs = [];
  try { vs = window.speechSynthesis?.getVoices?.() || []; } catch {}
  const pt = vs.filter(v => /^pt[-_]BR/i.test(v.lang));
  const ptAll = pt.length ? pt : vs.filter(v => /^pt/i.test(v.lang));
  const homem = ptAll.filter(v => MASC.test(v.name) && !FEM.test(v.name))
    .sort((a, b) => (/natural|premium|enhanced|online/i.test(b.name) ? 1 : 0) - (/natural|premium|enhanced|online/i.test(a.name) ? 1 : 0))[0];
  if (homem) return { voz: homem, pitch: 1 };
  // Sem voz masculina: a não-feminina se houver, senão a primeira — com tom grave.
  const outra = ptAll.find(v => !FEM.test(v.name)) || ptAll[0] || null;
  return { voz: outra, pitch: 0.7 };
}

/** Aplica a voz escolhida numa fala. */
export function aplicarVoz(u) {
  const { voz, pitch } = escolherVozPtBR();
  u.lang = "pt-BR";
  if (voz) u.voice = voz;
  u.pitch = pitch;
  return u;
}
