/* ============================================================
   NOTAS FIIs · motor de pontuação (metodologia de tijolo + papel)

   Codifica as faixas das tabelas da metodologia e produz as 4 notas do
   ranking, em escala 0–10 (✅ = 10 · 🟡 = 6 · ❌ = 2), igual ao print:
     - Nota Ativo  = Tipo + Segmento
     - Nota Imóvel = Tijolo: Vacância + nº Imóveis + Inquilinos
                     Papel : Alocação (% em CRI + nº de ativos)
     - Nota Gestão = IPO (tempo de listagem) + Taxa de administração
     - Nota Geral  = média das três
   "Melhor potencial" = Nota Ativo > 8 E Nota Imóvel > 8 (filtro do ranking).

   Os dados por FII chegam de uma fonte automática (CVM dados abertos +
   BRAPI); este módulo só pontua. Critérios sem dado são ignorados (não
   derrubam a média), pra Tijolo/Papel/Híbrido conviverem na mesma tabela.
   ============================================================ */

const VERDE = 10, AMARELO = 6, VERMELHO = 2;

const norm = (s) => String(s || "")
  .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ---- Pontuação por critério (retorna 0–10 ou null se sem dado) ----
function pTipo(tipo) {
  const t = norm(tipo);
  if (!t) return null;
  if (t.includes("tijolo") || t.includes("papel")) return VERDE;
  if (t.includes("hibrido")) return AMARELO;
  if (t.includes("desenvolv") || t.includes("fof")) return VERMELHO;
  return AMARELO;
}
function pSegmento(seg) {
  const s = norm(seg);
  if (!s) return null;
  const bom = ["laje", "corporativ", "logistic", "shopping", "titulo", "val. mob", "val mob", "tvm", "cri", "recebivel"];
  const ruim = ["hospital", "hotel"];
  const ok = ["residencial", "outros", "hibrido"];
  if (ruim.some(k => s.includes(k))) return VERMELHO;
  if (bom.some(k => s.includes(k))) return VERDE;
  if (ok.some(k => s.includes(k))) return AMARELO;
  return AMARELO;
}
function pVacancia(v) {
  if (v == null || v === "" || isNaN(Number(v))) return null;
  const x = Number(v);
  if (x < 25) return VERDE;
  if (x <= 30) return AMARELO;
  return VERMELHO;
}
function pImoveis(n) {
  if (n == null || n === "" || isNaN(Number(n))) return null;
  const x = Number(n);
  if (x >= 10) return VERDE;
  if (x >= 6) return AMARELO;
  return VERMELHO; // 1 a 5
}
function pInquilinos(s) {
  const t = norm(s);
  if (!t) return null;
  if (t.includes("multi")) return VERDE;
  if (t.includes("mono")) return VERMELHO;
  return null;
}
function pIPO(anos) {
  if (anos == null || anos === "" || isNaN(Number(anos))) return null;
  const x = Number(anos);
  if (x >= 5) return VERDE;
  if (x >= 3) return AMARELO;
  return VERMELHO;
}
// Alocação dos FIIs de papel: % em CRI + nº de ativos na carteira.
function pAlocacao(pctCRI, numAtivos) {
  const p = Number(pctCRI), n = Number(numAtivos);
  if ((pctCRI == null || isNaN(p)) && (numAtivos == null || isNaN(n))) return null;
  if (p >= 75 && n >= 50) return VERDE;
  if (p >= 50 && n >= 30) return AMARELO;
  return VERMELHO;
}
// Taxa de administração (dado fraco em base aberta; opcional).
function pTaxa(tipo, taxaAdm) {
  if (taxaAdm == null || taxaAdm === "" || isNaN(Number(taxaAdm))) return null;
  const t = norm(tipo), x = Number(taxaAdm);
  const limite = t.includes("papel") ? 1 : 2; // papel ~1% · tijolo ~2%
  if (x <= limite) return VERDE;
  return VERMELHO;
}

// Média ignorando critérios sem dado (null). Null se nada pontuou.
function media(arr) {
  const v = arr.filter(x => x != null);
  if (v.length === 0) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}
const r1 = (x) => x == null ? null : Math.round(x * 10) / 10;

/**
 * Pontua um FII e devolve as 4 notas (0–10) + flag de potencial.
 * @param {object} a indicadores do FII (qualquer subconjunto):
 *   { tipo, segmento, vacancia, imoveis, inquilinos, pctCRI, numAtivos,
 *     ipoAnos, taxaAdm, dy }
 */
export function notasFii(a = {}) {
  const ehPapel = norm(a.tipo).includes("papel")
    || norm(a.segmento).match(/titulo|cri|recebivel|val\.? mob|tvm/);

  const notaAtivo = media([pTipo(a.tipo), pSegmento(a.segmento)]);

  const notaImovel = ehPapel
    ? media([pAlocacao(a.pctCRI, a.numAtivos)])
    : media([pVacancia(a.vacancia), pImoveis(a.imoveis), pInquilinos(a.inquilinos)]);

  const notaGestao = media([pIPO(a.ipoAnos), pTaxa(a.tipo, a.taxaAdm)]);

  const notaGeral = media([notaAtivo, notaImovel, notaGestao]);

  return {
    notaAtivo: r1(notaAtivo),
    notaImovel: r1(notaImovel),
    notaGestao: r1(notaGestao),
    notaGeral: r1(notaGeral),
    dy: a.dy != null && !isNaN(Number(a.dy)) ? Number(a.dy) : null,
    // "Melhor potencial": ativo E imóvel acima de 8 (critério do ranking).
    melhorPotencial: notaAtivo != null && notaImovel != null && notaAtivo > 8 && notaImovel > 8,
  };
}

/**
 * Ordena uma lista de FIIs por Nota Geral (desc) e, opcionalmente, filtra
 * só os de "melhor potencial". Cada item ganha o campo `notas`.
 * @param {Array} ativos lista com indicadores (ver notasFii)
 * @param {object} opts { soPotencial?:boolean, minGeral?:number }
 */
export function rankearFiis(ativos = [], opts = {}) {
  const { soPotencial = false, minGeral = 0 } = opts;
  let linhas = ativos.map(a => ({ ...a, notas: notasFii(a) }));
  if (soPotencial) linhas = linhas.filter(l => l.notas.melhorPotencial);
  if (minGeral > 0) linhas = linhas.filter(l => (l.notas.notaGeral ?? -1) >= minGeral);
  linhas.sort((x, y) => (y.notas.notaGeral ?? -1) - (x.notas.notaGeral ?? -1));
  return linhas.map((l, i) => ({ ...l, rank: i + 1 }));
}
