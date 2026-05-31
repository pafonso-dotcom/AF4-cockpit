// Importador genérico de carteira por planilha (Excel/CSV).
// Detecção AUTOMÁTICA: varre todas as abas, acha a linha de cabeçalho por
// sinônimos de coluna e deduz o tipo do ativo — sem o usuário escolher nada.
// Compatível com extratos B3/CEI, planilhas de FII ("Cód do fundo") e próprias.
// SheetJS é carregado sob demanda (lazy import), como no resto do app.

const norm = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
  .toLowerCase().trim();

// Sinônimos de cada campo no cabeçalho.
const COLS = {
  ticker: ["ticker", "codigo de negociacao", "cod de negociacao", "codigo", "cod do fundo", "cod fundo", "cod", "ativo", "papel", "produto", "simbolo", "fundo"],
  qtd: ["quantidade", "qtd", "qtde", "quant", "quantidade total", "qtd total", "quantidade disponivel"],
  pm: ["preco medio", "preco medio (r$)", "pm", "preco de custo", "custo medio", "preco medio de compra", "valor de compra", "preco compra"],
  preco: ["preco", "preco atual", "preco de fechamento", "cotacao", "ultimo", "preco unitario", "valor atual", "preco (r$)"],
  tipo: ["tipo", "categoria", "classe", "classe do ativo", "classificacao", "segmento"],
};

// match exato → prefixo → contém
function acharIdx(headerNorm, sinonimos) {
  for (const s of sinonimos) { const i = headerNorm.indexOf(s); if (i >= 0) return i; }
  for (let i = 0; i < headerNorm.length; i++) {
    if (sinonimos.some(s => headerNorm[i] === s)) return i;
  }
  for (let i = 0; i < headerNorm.length; i++) {
    if (sinonimos.some(s => headerNorm[i].includes(s))) return i;
  }
  return -1;
}

// Deduz o tipo a partir do ticker (padrão B3), do texto da planilha ou do nome da aba.
function deduzTipo(ticker, tipoTexto, abaNome) {
  const t = norm(tipoTexto) + " " + norm(abaNome);
  if (t.includes("fii") || t.includes("imobil") || t.includes("fundo")) return "fii";
  if (t.includes("acao") || t.includes("acoes")) return "acao";
  if (t.includes("etf")) return "etf";
  if (t.includes("cripto") || t.includes("crypto") || t.includes("moeda")) return "cripto";
  if (t.includes("tesouro") || t.includes("renda fixa") || t.includes("cdb")) return "tesouro";
  if (t.includes("stock") || t.includes("reit") || t.includes("eua") || t.includes("exterior")) return "stock";
  const tk = String(ticker || "").toUpperCase();
  if (/USDT?$/.test(tk) || /^(BTC|ETH|SOL|ADA|XRP)$/.test(tk)) return "cripto";
  if (/11$/.test(tk)) return "fii";       // FIIs/ETFs terminam em 11
  if (/[0-9]$/.test(tk)) return "acao";    // ações terminam em número (3,4)
  if (/^[A-Z]{1,5}$/.test(tk)) return "stock"; // só letras → ação EUA
  return "acao";
}

const toNum = (v) => {
  if (typeof v === "number") return v;
  let s = String(v || "").trim();
  if (!s) return 0;
  // formato BR "1.234,56" → tira pontos de milhar e troca vírgula por ponto
  s = s.replace(/[R$\s%]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const tickerValido = (tk) =>
  tk && tk.length >= 3 && tk.length <= 12 && /[A-Z]/.test(tk) && !/total|carteira|soma|^—$/i.test(tk);

// Lê uma aba (matriz de linhas) e devolve os ativos achados, ou [] se não for tabela de ativos.
function lerAba(linhas, abaNome) {
  let headerIdx = -1, idx = {};
  for (let i = 0; i < Math.min(linhas.length, 20); i++) {
    const h = (linhas[i] || []).map(norm);
    const tk = acharIdx(h, COLS.ticker);
    if (tk < 0) continue;
    // Aceita aba mesmo SEM coluna de quantidade (ex.: planilha de análise de FII).
    headerIdx = i;
    idx = {
      ticker: tk,
      qtd: acharIdx(h, COLS.qtd),
      pm: acharIdx(h, COLS.pm),
      preco: acharIdx(h, COLS.preco),
      tipo: acharIdx(h, COLS.tipo),
    };
    break;
  }
  if (headerIdx < 0) return [];

  const itens = [];
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i] || [];
    const ticker = String(row[idx.ticker] || "").toUpperCase().trim().replace(/\s+/g, "");
    if (!tickerValido(ticker)) continue;
    const qtd = idx.qtd >= 0 ? toNum(row[idx.qtd]) : 0; // sem coluna de qtd → 0 (usuário ajusta)
    const pm = idx.pm >= 0 ? toNum(row[idx.pm]) : 0;
    const tipo = deduzTipo(ticker, idx.tipo >= 0 ? row[idx.tipo] : "", abaNome);
    itens.push({ ticker, nome: ticker, tipo, qtd, pm });
  }
  return itens;
}

/**
 * Lê o arquivo e retorna { itens, erros, semQuantidade }.
 * Detecta automaticamente a aba/tipo. Cada item: { ticker, nome, tipo, qtd, pm }.
 */
export async function importarCarteiraPlanilha(file) {
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) throw new Error("Biblioteca de planilha indisponível.");

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // Varre TODAS as abas e usa a que tiver mais ativos (detecção automática).
  let melhor = [];
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws) continue;
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const itens = lerAba(linhas, nome);
    if (itens.length > melhor.length) melhor = itens;
  }

  if (melhor.length === 0) {
    throw new Error("Não reconheci a planilha. Ela precisa ter uma coluna de Ticker/Código (e, de preferência, Quantidade).");
  }

  // Dedup por ticker (soma quantidades; mantém 1º PM>0).
  const mapa = new Map();
  for (const it of melhor) {
    const ex = mapa.get(it.ticker);
    if (ex) {
      ex.qtd += it.qtd;
      if (!ex.pm && it.pm) ex.pm = it.pm;
    } else {
      mapa.set(it.ticker, { ...it });
    }
  }
  const itens = Array.from(mapa.values());
  const semQuantidade = itens.every(i => i.qtd <= 0);
  return { itens, erros: [], semQuantidade };
}
