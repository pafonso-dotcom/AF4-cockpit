/**
 * CVM · cadastro de FIIs (dados abertos, oficial e grátis).
 *
 * Baixa o cadastro de FIIs da CVM, parseia (CSV ; latin1) e devolve um JSON
 * enxuto por fundo: { cnpj, nome, segmento, tipo, dataRegistro, administrador }.
 * Cacheia 12h (o cadastro muda devagar) pra não rebaixar a CVM a cada request.
 *
 * Observação: o cadastro NÃO traz o ticker da B3 — o casamento com o ticker é
 * feito no cliente por nome normalizado (ver fiisRanking.js). Vacância / nº de
 * imóveis vêm do informe trimestral (ZIP) — próximo passo.
 */
const CANDIDATOS = [
  "https://dados.cvm.gov.br/dados/FII/CAD/DADOS/cad_fii.csv",
  "https://dados.cvm.gov.br/dados/FII/CAD/DADOS/inf_cadastral_fii.csv",
  "https://dados.cvm.gov.br/dados/FII/CAD/DADOS/registro_fundo.csv",
];

export async function onRequest(context) {
  const { request } = context;
  const cache = caches.default;
  const cacheKey = new Request(new URL("/__cvm-fii-cache", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let csv = null, fonte = null;
  for (const url of CANDIDATOS) {
    try {
      const r = await fetch(url, { cf: { cacheTtl: 43200, cacheEverything: true } });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        // CVM publica em latin1 (ISO-8859-1).
        csv = new TextDecoder("iso-8859-1").decode(buf);
        fonte = url;
        break;
      }
    } catch { /* tenta o próximo candidato */ }
  }
  if (!csv) return json({ ok: false, erro: "Cadastro de FIIs da CVM indisponível no momento." }, 502);

  let fundos;
  try { fundos = parseCadastro(csv); }
  catch (e) { return json({ ok: false, erro: `Falha ao ler o cadastro da CVM: ${String(e?.message || e)}` }, 500); }

  const body = JSON.stringify({ ok: true, fonte, atualizado: new Date().toISOString(), total: fundos.length, fundos });
  const resp = new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=43200" },
  });
  context.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function parseCadastro(csv) {
  const linhas = csv.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ";" : ",";
  const head = linhas[0].split(sep).map(h => norm(h));

  const acha = (...frags) => head.findIndex(h => frags.every(f => h.includes(f)));
  const iCNPJ = acha("cnpj");
  const iDenomC = acha("denom", "comerc");
  const iDenomS = acha("denom", "social");
  const iSeg = acha("segmento");
  const iReg = (() => { const a = acha("data", "registro"); return a >= 0 ? a : acha("dt", "registro"); })();
  const iAdm = acha("administrador");
  const iSit = acha("situacao");
  const iClasse = acha("classe") >= 0 ? acha("classe") : acha("mandato");

  const out = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(sep);
    const nome = ((iDenomC >= 0 ? c[iDenomC] : "") || (iDenomS >= 0 ? c[iDenomS] : "") || "").trim();
    const cnpj = (iCNPJ >= 0 ? String(c[iCNPJ] || "") : "").replace(/\D/g, "");
    if (!nome && !cnpj) continue;
    const situacao = iSit >= 0 ? (c[iSit] || "").trim() : "";
    // só fundos em funcionamento normal interessam ao ranking
    if (situacao && !/funcion|normal|em funcionamento/i.test(situacao)) continue;
    out.push({
      cnpj,
      nome,
      segmento: iSeg >= 0 ? (c[iSeg] || "").trim() : "",
      classe: iClasse >= 0 ? (c[iClasse] || "").trim() : "",
      dataRegistro: iReg >= 0 ? (c[iReg] || "").trim() : "",
      administrador: iAdm >= 0 ? (c[iAdm] || "").trim() : "",
    });
  }
  return out;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
