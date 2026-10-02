import { describe, it, expect } from "vitest";
import { parseRSS } from "../rss.js";
import { montarBriefing, registrarGosto, feedsDasPrefs, PREFS_PADRAO } from "../noticias.js";

const RSS_GOOGLE = `<?xml version="1.0"?><rss><channel><title>"Petrobras" - Google Notícias</title>
<item><title>Petrobras anuncia dividendos - InfoMoney</title><link>https://news.google.com/rss/articles/abc</link>
<pubDate>Fri, 02 Oct 2026 10:00:00 GMT</pubDate><description>&lt;a href="x"&gt;Petrobras anuncia dividendos&lt;/a&gt;&amp;nbsp;&lt;font&gt;InfoMoney&lt;/font&gt;</description>
<source url="https://www.infomoney.com.br">InfoMoney</source></item></channel></rss>`;
const RSS_G1 = `<rss><channel><title>g1 &gt; Economia</title>
<item><title><![CDATA[Dólar fecha em queda]]></title><link>https://g1.globo.com/a.html</link>
<description><![CDATA[<img src="https://s.glbimg.com/x.jpg" /><br />Moeda recuou 0,8% com dados dos EUA.]]></description>
<pubDate>Fri, 02 Oct 2026 09:00:00 -0300</pubDate></item></channel></rss>`;

describe("agente de notícias", () => {
  it("parseia Google Notícias (fonte separada, sem resumo repetido)", () => {
    const [n] = parseRSS(RSS_GOOGLE);
    expect(n).toMatchObject({ titulo: "Petrobras anuncia dividendos", fonte: "InfoMoney", resumo: "" });
    expect(n.data).toBe("2026-10-02T10:00:00.000Z");
  });
  it("parseia g1 com CDATA, imagem e resumo", () => {
    const [n] = parseRSS(RSS_G1);
    expect(n.titulo).toBe("Dólar fecha em queda");
    expect(n.fonte).toBe("g1 > Economia");
    expect(n.resumo).toBe("Moeda recuou 0,8% com dados dos EUA.");
    expect(n.imagem).toBe("https://s.glbimg.com/x.jpg");
  });
  it("briefing: sem repetidas, sem fonte bloqueada, gosto pesa", () => {
    const agora = new Date("2026-10-02T12:00:00Z").getTime();
    const res = [
      { tema: "mercado", itens: [{ titulo: "A", link: "1", fonte: "X", data: "2026-10-02T11:00:00Z" }, { titulo: "B", link: "2", fonte: "Ruim", data: "2026-10-02T11:30:00Z" }] },
      { tema: "carros", itens: [{ titulo: "A", link: "3", fonte: "Y", data: "2026-10-02T11:00:00Z" }, { titulo: "C", link: "4", fonte: "Z", data: "2026-10-02T06:00:00Z" }] },
    ];
    let prefs = { ...PREFS_PADRAO, fontesBloq: ["ruim"] };
    expect(montarBriefing(res, prefs, agora).map(n => n.titulo)).toEqual(["A", "C"]);
    prefs = registrarGosto(prefs, { tema: "carros", fonte: "Z" }, 1);
    expect(montarBriefing(res, prefs, agora).map(n => n.titulo)).toEqual(["C", "A"]);
  });
  it("palavras-chave viram busca no Google Notícias", () => {
    const f = feedsDasPrefs({ temas: [], palavras: ["Porto"] });
    expect(f[0].tema).toBe("palavra:Porto");
    expect(f[0].feed).toContain("news.google.com/rss/search");
  });
});
