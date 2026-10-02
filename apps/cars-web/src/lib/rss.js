/**
 * Parser de RSS/Atom mínimo, sem DOM (roda no navegador, no Worker e nos
 * testes). Usado pelo Agente de Notícias (2026-10-02).
 * Devolve [{ titulo, link, fonte, data (ISO), resumo, imagem }].
 */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodificar(s = "") {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export const semTags = (s = "") => decodificar(decodificar(s)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const tag = (bloco, nome) => {
  const m = bloco.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "i"));
  return m ? m[1] : "";
};
const attr = (bloco, nome, at) => {
  const m = bloco.match(new RegExp(`<${nome}\\b[^>]*\\b${at}="([^"]+)"`, "i"));
  return m ? decodificar(m[1]) : "";
};

export function parseRSS(xml = "", fontePadrao = "") {
  const canal = semTags(tag(xml.split(/<item[\s>]|<entry[\s>]/i)[0] || "", "title")) || fontePadrao;
  const blocos = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocos.map(b => {
    let titulo = semTags(tag(b, "title"));
    let fonte = semTags(tag(b, "source")) || canal;
    // Google Notícias põe " - Fonte" no fim do título.
    if (fonte && titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3)).trim();
    const link = semTags(tag(b, "link")) || attr(b, "link", "href");
    const dataTxt = semTags(tag(b, "pubDate")) || semTags(tag(b, "published")) || semTags(tag(b, "updated")) || semTags(tag(b, "dc:date"));
    const d = dataTxt ? new Date(dataTxt) : null;
    let resumo = semTags(tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded"));
    // Resumo que só repete o título (caso do Google Notícias) não serve.
    if (resumo && titulo && resumo.replace(/\s*\S+$/, "").startsWith(titulo.slice(0, 40))) resumo = "";
    if (resumo.length > 320) resumo = resumo.slice(0, 317).replace(/\s+\S*$/, "") + "…";
    const imagem = attr(b, "media:content", "url") || attr(b, "media:thumbnail", "url") || attr(b, "enclosure", "url")
      || ((tag(b, "description").match(/<img[^>]+src="([^"]+)"/i) || [])[1] || "");
    return { titulo, link, fonte, data: d && !isNaN(d) ? d.toISOString() : null, resumo, imagem: decodificar(imagem) };
  }).filter(n => n.titulo && n.link);
}
