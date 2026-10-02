/**
 * Busca de voos SEM cadastro e SEM reserva (pedido 2026-10-02): monta o link
 * da pesquisa pronta nos buscadores (preços reais). O app só abre a busca.
 */
const iata = (s) => /^[A-Za-z]{3}$/.test(String(s || "").trim()) ? String(s).trim().toUpperCase() : "";

export function linksBuscaVoos({ origem = "", destino = "", ida = "", volta = "", adultos = 1 } = {}) {
  const o = String(origem || "").trim(), d = String(destino || "").trim();
  const n = Math.max(1, Number(adultos) || 1);
  const links = [];
  // Google Voos aceita cidade ou código, em linguagem natural.
  const q = `Voos de ${o || "São Paulo"} para ${d}${ida ? ` em ${ida}` : ""}${volta ? ` volta ${volta}` : " só ida"}${n > 1 ? ` ${n} adultos` : ""}`;
  links.push({ id: "google", nome: "Google Voos", url: `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=${encodeURIComponent(q)}` });
  const oi = iata(o), di = iata(d);
  if (oi && di && ida) {
    const yymmdd = (iso) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
    links.push({ id: "skyscanner", nome: "Skyscanner",
      url: `https://www.skyscanner.com.br/transporte/passagens-aereas/${oi.toLowerCase()}/${di.toLowerCase()}/${yymmdd(ida)}/${volta ? yymmdd(volta) + "/" : ""}?adultsv2=${n}` });
    links.push({ id: "kayak", nome: "Kayak",
      url: `https://www.kayak.com.br/flights/${oi}-${di}/${ida}${volta ? "/" + volta : ""}/${n}adults` });
  }
  return links;
}

const CHAVE_ORIGEM = "af4:voo-origem";
export function origemPadrao() { try { return localStorage.getItem(CHAVE_ORIGEM) || "GRU"; } catch { return "GRU"; } }
export function salvarOrigemPadrao(v) { try { if (v) localStorage.setItem(CHAVE_ORIGEM, v); } catch {} }
