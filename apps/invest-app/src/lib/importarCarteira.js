// Importador genérico de carteira por planilha (Excel/CSV).
// Detecta as colunas por nome de cabeçalho (flexível: B3, CEI, planilhas próprias).
// SheetJS carregado sob demanda (lazy import), como no resto do app.

const norm = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
  .toLowerCase().trim();

// Sinônimos de cada campo no cabeçalho.
const COLS = {
  ticker: ["ticker", "codigo de negociacao", "codigo", "cod", "ativo", "papel", "produto", "simbolo"],
  qtd: ["quantidade", "qtd", "qtde", "quant", "qtd.", "quantidade total"],
  pm: ["preco medio", "preco medio (r$)", "pm", "preco de custo", "custo medio", "preco medio de compra", "valor de compra"],
  preco: ["preco", "preco atual", "preco de fechamento", "cotacao", "ultimo", "preco unitario"],
  tipo: ["tipo", "categoria", "classe", "classe do ativo"],
};

function acharIdx(headerNorm, sinonimos) {
  // match exato primeiro; depois "contém".
  for (const s of sinonimos) { const i = headerNorm.indexOf(s); if (i >= 0) return i; }
  for (let i = 0; i < headerNorm.length; i++) {
    if (sinonimos.some(s => headerNorm[i].includes(s))) return i;
  }
  return -1;
}

// Deduz o tipo do ativo a partir do ticker (padrão B3) ou do texto da planilha.
function deduzTipo(ticker, tipoTexto) {
  const t = norm(tipoTexto);
  if (t.includes("fii") || t.includes("imobil")) return "fii";
  if (t.includes("acao") || t.includes("acoes")) return "acao";
  if (t.includes("etf")) return "etf";
  if (t.includes("cripto") || t.includes("crypto")) return "cripto";
  if (t.includes("tesouro")) return "tesouro";
  const tk = String(ticker || "").toUpperCase();
  if (/11$/.test(tk)) return "fii";       // FIIs/ETFs terminam em 11
  if (/\d$/.test(tk)) return "acao";       // ações terminam em número (3,4)
  return "acao";
}

const toNum = (v) => {
  if (typeof v === "number") return v;
  const s = String(v || "").replace(/[R$\s.]/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Lê o arquivo e retorna { itens, erros }.
 * Cada item: { ticker, nome, tipo, qtd, pm }.
 */
export async function importarCarteiraPlanilha(file) {
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) throw new Error("Biblioteca de planilha indisponível.");

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!linhas.length) throw new Error("Planilha vazia.");

  // Acha a linha de cabeçalho: a primeira que tenha algo de "ticker" + "quantidade".
  let headerIdx = -1, idx = {};
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const h = linhas[i].map(norm);
    const tk = acharIdx(h, COLS.ticker);
    const qt = acharIdx(h, COLS.qtd);
    if (tk >= 0 && qt >= 0) {
      headerIdx = i;
      idx = {
        ticker: tk, qtd: qt,
        pm: acharIdx(h, COLS.pm),
        preco: acharIdx(h, COLS.preco),
        tipo: acharIdx(h, COLS.tipo),
      };
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error("Não encontrei as colunas. A planilha precisa ter ao menos 'Ticker/Código' e 'Quantidade'.");
  }

  const itens = [];
  const erros = [];
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i];
    const ticker = String(row[idx.ticker] || "").toUpperCase().trim().replace(/\s+/g, "");
    if (!ticker || ticker.length < 3 || /total/i.test(ticker)) continue; // pula vazios/linha de total
    const qtd = toNum(row[idx.qtd]);
    if (qtd <= 0) { erros.push(`${ticker}: quantidade inválida`); continue; }
    const pm = idx.pm >= 0 ? toNum(row[idx.pm]) : 0;
    const tipo = deduzTipo(ticker, idx.tipo >= 0 ? row[idx.tipo] : "");
    itens.push({ ticker, nome: ticker, tipo, qtd, pm });
  }

  if (itens.length === 0) throw new Error("Nenhum ativo válido encontrado na planilha.");
  return { itens, erros };
}
