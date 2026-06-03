// Parser de planilha semanal de FIIs (formato "Método Davi" — cabeçalho com "Cód do fundo").
// SheetJS é carregado sob demanda (lazy import), igual ao resto do app.

// Mapeia a "Classificação" da planilha em { tipo, segmento }.
// A planilha mistura os dois conceitos numa coluna só — aqui separamos.
function classificarFII(classificacao) {
  const c = (classificacao || "").trim();
  const cl = c.toLowerCase();

  // Tipo de FII
  let tipo = "Tijolo"; // default
  if (cl.includes("título") || cl.includes("titulo") || cl.includes("val. mob") || cl.includes("papel") || cl.includes("recebí") || cl.includes("recebi") || cl.includes("cri")) tipo = "Papel";
  else if (cl.includes("híbrido") || cl.includes("hibrido")) tipo = "Híbrido";
  else if (cl.includes("fundo de fundos") || cl.includes("fof")) tipo = "FOF";
  else if (cl.includes("desenvolv")) tipo = "Desenvolvimento";

  // Segmento — só preenche se a classificação for um segmento real (de Tijolo)
  const segmentosValidos = {
    "lajes corporativas": "Lajes Corporativas",
    "logística": "Logística", "logistica": "Logística",
    "shoppings": "Shoppings", "shopping": "Shoppings",
    "títulos e val. mob.": "Títulos e Val. Mob.", "titulos e val. mob.": "Títulos e Val. Mob.",
    "residencial": "Residencial",
    "hospital": "Hospital", "hotel": "Hotel",
    "outros": "Outros",
  };
  const segmento = segmentosValidos[cl] || ""; // Híbrido/FOF/Desenvolvimento não têm segmento específico

  return { tipo, segmento };
}

// Converte patrimônio pra bilhões com validação (negativo/zero = vazio)
function patrimonioBi(plRaw) {
  const n = parseFloat(plRaw);
  if (isNaN(n) || n <= 0) return ""; // negativo ou zero = dado inválido
  return (n / 1e9).toFixed(2);
}

/**
 * Lê um arquivo Excel/CSV de FIIs e retorna análises prontas.
 * @param {File} file
 * @param {Set<string>|null} tickersPermitidos - se fornecido, só importa esses tickers.
 * @returns {{ analises: Array, totalNaPlanilha: number, ignoradosForaCarteira: number }}
 */
export async function importarPlanilhaFII(file, tickersPermitidos = null) {
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) throw new Error("Biblioteca xlsx não disponível.");

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Achar a linha de cabeçalho (que contém "Cód do fundo")
  let headerIdx = linhas.findIndex(l =>
    l.some(c => {
      const s = String(c).toLowerCase();
      return s.includes("cód do fundo") || s.includes("cod do fundo");
    })
  );
  if (headerIdx < 0) headerIdx = 2; // fallback

  const header = (linhas[headerIdx] || []).map(h => String(h).toLowerCase().trim());
  const col = (nome) => header.findIndex(h => h.includes(nome));

  const idxTicker = col("cód do fundo") >= 0 ? col("cód do fundo") : col("cod do fundo");
  const idxClass  = col("classificação") >= 0 ? col("classificação") : col("classificacao");
  const idxPL     = col("patrimônio") >= 0 ? col("patrimônio") : col("patrimonio");
  const idxListagem = col("tempo de listagem") >= 0 ? col("tempo de listagem") : col("listagem");
  const idxAdm    = col("administrador");
  const idxDY     = col("dy");

  const analises = [];
  let totalNaPlanilha = 0, ignoradosForaCarteira = 0;
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const linha = linhas[i] || [];
    const ticker = String(linha[idxTicker] || "").trim().toUpperCase();
    if (!ticker || !/^[A-Z]{4}11$/.test(ticker)) continue; // só tickers FII válidos
    totalNaPlanilha++;

    // Filtro de carteira: ignora tickers fora do set permitido
    if (tickersPermitidos && !tickersPermitidos.has(ticker)) { ignoradosForaCarteira++; continue; }

    const classificacao = String(linha[idxClass] || "").trim();
    const { tipo, segmento } = classificarFII(classificacao);
    const dyRaw = parseFloat(linha[idxDY]) || 0;
    const dyPct = dyRaw > 0 && dyRaw < 1 ? (dyRaw * 100).toFixed(2) : (dyRaw > 0 ? dyRaw.toFixed(2) : "");

    analises.push({
      id: `idv-${Date.now()}-${ticker}`,
      classe: "fii",
      ticker,
      valores: {
        tipo,
        segmento,
        ipo: String(linha[idxListagem] || "").trim(),
        patrimonio: patrimonioBi(linha[idxPL]),
        administrador: String(linha[idxAdm] || "").trim(),
        dy: dyPct,
      },
      origem: "planilha",
      criadoEm: new Date().toISOString(),
    });
  }
  return { analises, totalNaPlanilha, ignoradosForaCarteira };
}

// ─────────────────────────────────────────────────────────────
// Helpers compartilhados — parsers de Ações / Stocks / REITs
// (formato "Planilha de Ouro": aba única, header na linha 3 / índice 2,
//  dados a partir da linha 4. Percentuais vêm em decimal.)
// ─────────────────────────────────────────────────────────────

// Carrega o SheetJS sob demanda e devolve a 1ª aba como matriz de linhas.
async function lerPlanilha(file) {
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) throw new Error("Biblioteca xlsx não disponível.");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
}

// Acha o índice da linha de cabeçalho (célula igual a `termo`). Fallback: linha 3 (índice 2).
function acharHeaderIdx(linhas, termo = "ticker") {
  const idx = linhas.findIndex(l => l.some(c => String(c).toLowerCase().trim() === termo));
  return idx >= 0 ? idx : 2;
}

// Decimal → percentual com 2 casas (0.22 → "22.00"). Vazio/inválido → "".
function pct(v) {
  const n = parseFloat(v);
  return isNaN(n) ? "" : (n * 100).toFixed(2);
}

// Número com N casas decimais. Vazio/inválido → "".
function num(v, casas = 2) {
  const n = parseFloat(v);
  return isNaN(n) ? "" : n.toFixed(casas);
}

// Tag Along: 1 → "100%", 0.8–0.99 → "80%", abaixo → "<80%". Vazio → "".
function tagAlongLabel(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return "";
  if (n >= 1) return "100%";
  if (n >= 0.8) return "80%";
  return "<80%";
}

// "Sim"/"Não" → sócio majoritário. Vazio → "".
function socioLabel(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  return s.startsWith("s") ? "Governo" : "Instituição Privada";
}

// Devolve uma função que acha o índice da coluna cujo header contém `termo`
// (robusto a mudança de ordem das colunas).
function colMap(header) {
  const h = (header || []).map(c => String(c).toLowerCase().trim());
  return (termo) => h.findIndex(x => x.includes(termo.toLowerCase()));
}

// ─────── AÇÕES BR ───────
export async function importarPlanilhaAcoes(file, tickersPermitidos = null) {
  const linhas = await lerPlanilha(file);
  const hIdx = acharHeaderIdx(linhas, "ticker");
  const col = colMap(linhas[hIdx]);
  const ci = {
    ticker: col("ticker"), tipo: col("tipo de ação"), tagalong: col("tag along"),
    freefloat: col("free float"), segmento: col("segmento de listagem"),
    governo: col("governo como major"), patrim: col("patrim liq"), liquidez: col("liquidez"),
    margemEbit: col("margem ebit"), margemLiq: col("margem líquida"), roic: col("roic"),
    roe: col("roe"), ipo: col("anos desde o ipo"), lucro: col("anos gerando lucro"),
    divida: col("dívida líquida/ebitda"),
  };
  const analises = [];
  let totalNaPlanilha = 0, ignoradosForaCarteira = 0;
  for (let i = hIdx + 1; i < linhas.length; i++) {
    const L = linhas[i] || [];
    const ticker = String(L[ci.ticker] || "").trim().toUpperCase();
    if (!ticker || !/^[A-Z]{4}\d{1,2}$/.test(ticker)) continue;
    totalNaPlanilha++;
    if (tickersPermitidos && !tickersPermitidos.has(ticker)) { ignoradosForaCarteira++; continue; }
    analises.push({
      id: `idv-${Date.now()}-${ticker}`,
      classe: "acao",
      ticker,
      valores: {
        tipo: String(L[ci.tipo] || "").trim(),
        tagalong: ci.tagalong >= 0 ? tagAlongLabel(L[ci.tagalong]) : "",
        freefloat: pct(L[ci.freefloat]),
        segmento: String(L[ci.segmento] || "").trim(),
        socio: ci.governo >= 0 ? socioLabel(L[ci.governo]) : "",
        pl: ci.patrim >= 0 ? num(parseFloat(L[ci.patrim]) / 1e9) : "",
        liquidez: ci.liquidez >= 0 ? num(parseFloat(L[ci.liquidez]) / 1e6) : "",
        margemEbit: pct(L[ci.margemEbit]),
        margemLiq: pct(L[ci.margemLiq]),
        roe: pct(L[ci.roe]), // critério "ROE / ROIC" — usa ROE
        ipo: String(L[ci.ipo] || "").trim(),
        lucro: String(L[ci.lucro] || "").trim(),
        dividaEbitda: num(L[ci.divida]),
      },
      origem: "planilha",
      criadoEm: new Date().toISOString(),
    });
  }
  return { analises, totalNaPlanilha, ignoradosForaCarteira };
}

// ─────── STOCKS US ───────
export async function importarPlanilhaStock(file, tickersPermitidos = null) {
  const linhas = await lerPlanilha(file);
  const hIdx = acharHeaderIdx(linhas, "ticker");
  const col = colMap(linhas[hIdx]);
  const ci = {
    ticker: col("ticker"), lucro: col("anos sem prejuízo"), lpa: col("cagr do lpa"),
    divida: col("dívida líquida/ebitda"), roe: col("roe"), roic: col("roic"),
    margemLiq: col("margem líquida"), margemEbit: col("margem ebit"),
    ipo: col("anos desde o ipo"), sharpe: col("sharpe"),
  };
  const analises = [];
  let totalNaPlanilha = 0, ignoradosForaCarteira = 0;
  for (let i = hIdx + 1; i < linhas.length; i++) {
    const L = linhas[i] || [];
    const ticker = String(L[ci.ticker] || "").trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) continue;
    totalNaPlanilha++;
    if (tickersPermitidos && !tickersPermitidos.has(ticker)) { ignoradosForaCarteira++; continue; }
    analises.push({
      id: `idv-${Date.now()}-${ticker}`,
      classe: "stock",
      ticker,
      valores: {
        lucro: String(L[ci.lucro] || "").trim(),
        lpa: pct(L[ci.lpa]),
        dividaEbitda: num(L[ci.divida]),
        roe: pct(L[ci.roe]),
        roic: pct(L[ci.roic]),
        margemLiq: pct(L[ci.margemLiq]),
        margemEbit: pct(L[ci.margemEbit]),
        ipo: String(L[ci.ipo] || "").trim(),
        sharpe: num(L[ci.sharpe]),
      },
      origem: "planilha",
      criadoEm: new Date().toISOString(),
    });
  }
  return { analises, totalNaPlanilha, ignoradosForaCarteira };
}

// ─────── REITS US ───────
export async function importarPlanilhaReit(file, tickersPermitidos = null) {
  const linhas = await lerPlanilha(file);
  const hIdx = acharHeaderIdx(linhas, "ticker");
  const col = colMap(linhas[hIdx]);
  const ci = {
    ticker: col("ticker"), lucro: col("anos sem prejuízo"), lpa: col("cagr do lpa"),
    divida: col("dívida líquida/ebitda"), roe: col("roe"),
    margemLiq: col("margem líquida"), margemEbit: col("margem ebit"), ipo: col("anos desde o ipo"),
  };
  const analises = [];
  let totalNaPlanilha = 0, ignoradosForaCarteira = 0;
  for (let i = hIdx + 1; i < linhas.length; i++) {
    const L = linhas[i] || [];
    const ticker = String(L[ci.ticker] || "").trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) continue;
    totalNaPlanilha++;
    if (tickersPermitidos && !tickersPermitidos.has(ticker)) { ignoradosForaCarteira++; continue; }
    analises.push({
      id: `idv-${Date.now()}-${ticker}`,
      classe: "reit",
      ticker,
      valores: {
        lucro: String(L[ci.lucro] || "").trim(),
        lpa: pct(L[ci.lpa]),
        dividaEbitda: num(L[ci.divida]),
        roe: pct(L[ci.roe]),
        margemLiq: pct(L[ci.margemLiq]),
        margemEbit: pct(L[ci.margemEbit]),
        ipo: String(L[ci.ipo] || "").trim(),
      },
      origem: "planilha",
      criadoEm: new Date().toISOString(),
    });
  }
  return { analises, totalNaPlanilha, ignoradosForaCarteira };
}
