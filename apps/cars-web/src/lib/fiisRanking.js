/* ============================================================
   RANKING FIIs · provedor de dados (BRAPI + CVM + base curada → notas)

   - BRAPI: universo de FIIs + preço/DY.
   - CVM (dados abertos, via /api/cvm-fii): segmento, tipo e IPO oficiais,
     casados por nome normalizado (o cadastro não traz o ticker da B3).
   - Base curada (fundamentos): tem prioridade sobre tudo.
   Campos ainda não automáticos (vacância, nº imóveis, taxa) ficam pra IA
   ("Completar com IA") e pro informe trimestral da CVM (próximo passo).
   ============================================================ */
import { rankearFiis } from "./notasFiis.js";
import { API } from "./api.js";

// Heurística de tipo (tijolo/papel) a partir de texto.
function inferirTipo(...textos) {
  const t = textos.map(x => String(x || "")).join(" ").toLowerCase();
  if (/papel|cri|receb|t[ií]tulo|cr[ée]dito|high\s*yield|fof/.test(t)) return "Papel";
  if (t.trim()) return "Tijolo";
  return null;
}

function normNome(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/fundo de investimento imobiliario|fdo\.? ?inv\.? ?imob\.?|imobiliario|\bfii\b|\bfdo\b|\binv\b|\bimob\b|\bresp\b|\bltda\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function anosDesde(dataStr) {
  if (!dataStr) return null;
  const m = String(dataStr).match(/(19|20)\d{2}/);
  if (!m) return null;
  const ano = Number(m[0]);
  const dif = new Date().getFullYear() - ano;
  return dif >= 0 && dif < 100 ? dif : null;
}

async function carregarCVM() {
  try {
    const r = await fetch("/api/cvm-fii");
    if (!r.ok) return null;
    const j = await r.json();
    return j.ok ? (j.fundos || null) : null;
  } catch { return null; }
}

function indexarCVM(fundos) {
  const mapa = new Map();
  if (!fundos) return mapa;
  for (const f of fundos) {
    const k = normNome(f.nome);
    if (k && !mapa.has(k)) mapa.set(k, f);
  }
  return mapa;
}

// Casa um nome da BRAPI com um fundo da CVM (exato normalizado, depois prefixo).
function casarCVM(mapa, nomeBrapi) {
  const k = normNome(nomeBrapi);
  if (!k) return null;
  if (mapa.has(k)) return mapa.get(k);
  if (k.length >= 5) {
    for (const [chave, f] of mapa) {
      if (chave.length >= 5 && (chave.startsWith(k) || k.startsWith(chave))) return f;
    }
  }
  return null;
}

/**
 * Carrega e pontua o ranking de FIIs.
 * @param {object} opts { token?, fundamentos?:map, max?, soPotencial?, minGeral?, usarCVM? }
 * @returns {Promise<{ok, linhas, erro?, fonte?, cvmCasados?}>}
 */
export async function carregarRankingFiis({ token, fundamentos = {}, max = 0, soPotencial = false, minGeral = 0, usarCVM = true } = {}) {
  const [stocks, cvm] = await Promise.all([
    API.fiiList(token),
    usarCVM ? carregarCVM() : Promise.resolve(null),
  ]);
  if (!stocks || !stocks.length) {
    return { ok: false, linhas: [], erro: "Não consegui buscar a lista de FIIs na BRAPI. Confira o token BRAPI em ⚙ Configurações." };
  }
  const cvmIndex = indexarCVM(cvm);

  let universo = stocks.filter(s => /11$/.test(String(s.stock || "")));
  if (max > 0) universo = universo.slice(0, max);

  let cvmCasados = 0;
  const ativos = universo.map(s => {
    const tk = String(s.stock).toUpperCase();
    const cur = fundamentos[tk]?.dados || {};
    const cv = casarCVM(cvmIndex, s.name);
    if (cv) cvmCasados++;

    const segmento = cur.segmento || cv?.segmento || s.sector || "";
    const tipo = cur.tipo || inferirTipo(cv?.classe, cv?.segmento, s.name, segmento) || "Tijolo";
    const ipoAnos = cur.ipo ?? cur.ipoAnos ?? anosDesde(cv?.dataRegistro);

    return {
      ticker: tk,
      nome: cur.nome || fundamentos[tk]?.nome || cv?.nome || s.name || tk,
      tipo,
      segmento,
      vacancia: cur.vacancia,
      imoveis: cur.imoveis,
      inquilinos: cur.inquilinos,
      pctCRI: cur.pctCRI,
      numAtivos: cur.numAtivos,
      ipoAnos,
      taxaAdm: cur.taxaAdm,
      dy: cur.dy ?? s.dividendYield ?? null,
      preco: s.close ?? null,
      administrador: cur.administrador || cv?.administrador || "",
    };
  });

  return { ok: true, linhas: rankearFiis(ativos, { soPotencial, minGeral }), fonte: universo.length, cvmCasados };
}
