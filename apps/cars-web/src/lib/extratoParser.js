/**
 * Parsers de extratos bancários (OFX e CSV) com auto-categorização.
 *
 * Formatos suportados:
 *  - OFX (XML-like): padronizado, fácil de extrair
 *  - CSV genérico: detecta o banco pelo header (Itaú, Nubank, Bradesco, etc.)
 *  - MoneyWiz CSV: preset para exports em português do app MoneyWiz
 */
import Papa from "papaparse";

/* ============================================================
   AUTO-CATEGORIZAÇÃO POR PALAVRA-CHAVE
   ============================================================ */

const REGRAS = [
  // Alimentação
  { keys: ["mercado", "supermerc", "padaria", "açougue", "açai", "ifood", "rappi"], cat: "Alimentação" },
  { keys: ["restaurante", "lanchonete", "outback", "mcdonald", "burger", "pizza", "dominos"], cat: "Alimentação" },
  // Transporte
  { keys: ["uber", "99 ", "99app", "taxi", "metro", "onibus", "ônibus"], cat: "Transporte" },
  { keys: ["posto", "shell", "ipiranga", "petrobras", "ale "], cat: "Transporte", sub: "Combustível" },
  { keys: ["estacionament", "zona azul", "pedagio", "pedágio", "ipva", "licenc"], cat: "Transporte" },
  // Moradia
  { keys: ["aluguel", "condomin", "iptu"], cat: "Moradia" },
  { keys: ["energia", "luz ", "elektro", "enel ", "cpfl"], cat: "Moradia", sub: "Energia" },
  { keys: ["sabesp", "agua ", "água"], cat: "Moradia", sub: "Água" },
  { keys: ["vivo", "claro ", "tim ", "oi ", "internet"], cat: "Moradia", sub: "Internet/Telefone" },
  // Saúde
  { keys: ["farmacia", "farmácia", "drogaria", "drogasil", "raia "], cat: "Saúde" },
  { keys: ["plano de saude", "bradesco saude", "unimed", "sulamerica", "amil"], cat: "Saúde" },
  { keys: ["dentista", "medico", "médico", "consulta", "exame"], cat: "Saúde" },
  // Lazer
  { keys: ["netflix", "spotify", "hbo", "disney", "amazon prime", "deezer", "apple music"], cat: "Lazer", sub: "Streaming" },
  { keys: ["cinema", "show ", "ingresso", "teatro"], cat: "Lazer" },
  { keys: ["bar ", "boteco", "pub "], cat: "Lazer" },
  // Educação
  { keys: ["escola", "faculdade", "colegio", "colégio", "curso", "udemy"], cat: "Educação" },
  // Receitas
  { keys: ["salario", "salário", "folha pagamento", "remuneracao"], cat: "Salário", tipo: "receita" },
  { keys: ["pix recebido", "ted recebido", "doc recebido"], cat: "Outros", tipo: "receita" },
  // Loja AF4
  { keys: ["af4", "motors", "venda veiculo", "venda veículo"], cat: "Loja AF4" },
];

export function categorizar(descricao, valor) {
  const d = (descricao || "").toLowerCase();
  for (const r of REGRAS) {
    if (r.keys.some(k => d.includes(k))) {
      return {
        categoria: r.cat,
        subcategoria: r.sub || null,
        tipo: r.tipo || (valor < 0 ? "despesa" : "receita"),
      };
    }
  }
  return { categoria: "Outros", subcategoria: null, tipo: valor < 0 ? "despesa" : "receita" };
}

/* ============================================================
   PARSER OFX
   ============================================================ */

export function parseOFX(text) {
  if (!text || typeof text !== "string") return { transacoes: [], erro: "Arquivo vazio" };

  const transacoes = [];

  // Detecta banco pelo header / institution
  let banco = "Desconhecido";
  const orgMatch = text.match(/<ORG>([^<\r\n]+)/i);
  if (orgMatch) banco = orgMatch[1].trim();

  // Cada transação em OFX vem entre <STMTTRN>...</STMTTRN>
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = trnRegex.exec(text)) !== null) {
    const block = match[1];

    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };

    const tipo = get("TRNTYPE"); // CREDIT / DEBIT / etc
    const dataRaw = get("DTPOSTED"); // YYYYMMDD[HHMMSS[.XXX[stamp]]]
    const valorRaw = get("TRNAMT");
    const memo = get("MEMO") || get("NAME") || "Transação";
    const fitid = get("FITID");

    if (!dataRaw || !valorRaw) continue;

    const data = `${dataRaw.slice(0, 4)}-${dataRaw.slice(4, 6)}-${dataRaw.slice(6, 8)}`;
    const valor = parseFloat(valorRaw);

    transacoes.push({
      _id: fitid || `${data}-${valor}-${transacoes.length}`,
      data,
      descricao: memo.replace(/\s+/g, " "),
      valor: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
      tipoOFX: tipo,
      ...categorizar(memo, valor),
    });
  }

  return { transacoes, banco };
}

/* ============================================================
   PARSER CSV
   ============================================================ */

function detectDelimiter(linha) {
  const counts = {
    ";": (linha.match(/;/g) || []).length,
    ",": (linha.match(/,/g) || []).length,
    "\t": (linha.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseLineCSV(line, delim) {
  // Lida com aspas e campos vazios
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === delim && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseValorBR(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  // Remove R$, espaços, parênteses (que indicam negativo)
  let s = String(v).trim();
  const negativo = s.includes("(") || s.startsWith("-") || s.includes("D");
  s = s.replace(/[R$\s()D]/gi, "").replace(/^-/, "");
  // Troca vírgula decimal
  if (s.includes(",") && s.includes(".")) {
    // 1.234,56 → 1234.56
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s) || 0;
  return negativo ? -n : n;
}

function parseDataBR(d) {
  if (!d) return null;
  // Aceita: DD/MM/YYYY · YYYY-MM-DD · DD-MM-YYYY
  const m1 = d.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

/**
 * Detecta o formato do CSV pelo cabeçalho e tenta extrair transações.
 * Suporta: Itaú, Nubank, Bradesco, Santander, BB, Inter, C6, formato genérico.
 */
export function parseCSV(text) {
  if (!text || typeof text !== "string") return { transacoes: [], erro: "Arquivo vazio" };

  const linhas = text.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return { transacoes: [], erro: "CSV sem dados" };

  const delim = detectDelimiter(linhas[0]);
  const header = parseLineCSV(linhas[0], delim).map(h => h.toLowerCase());

  // Identifica colunas
  const idxData  = header.findIndex(h => /data|dt /.test(h));
  const idxDesc  = header.findIndex(h => /descric|histor|memo|estabele/.test(h));
  const idxValor = header.findIndex(h => /valor|amount|montante/.test(h));

  // Detecta banco
  let banco = "Genérico";
  const headerJoin = header.join(" | ");
  if (/nu\b|nubank/i.test(headerJoin)) banco = "Nubank";
  else if (/itau|itaú/i.test(headerJoin)) banco = "Itaú";
  else if (/bradesco/i.test(headerJoin)) banco = "Bradesco";
  else if (/santander/i.test(headerJoin)) banco = "Santander";
  else if (/banco do brasil|bb /i.test(headerJoin)) banco = "Banco do Brasil";
  else if (/inter/i.test(headerJoin)) banco = "Inter";

  if (idxData < 0 || idxValor < 0) {
    return { transacoes: [], erro: `Não foi possível identificar as colunas (Data: ${idxData}, Valor: ${idxValor}). Cabeçalho: "${linhas[0].slice(0, 80)}"` };
  }

  const transacoes = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = parseLineCSV(linhas[i], delim);
    if (cols.length < 2) continue;

    const data = parseDataBR(cols[idxData]);
    const desc = idxDesc >= 0 ? cols[idxDesc] : "Transação";
    const valor = parseValorBR(cols[idxValor]);

    if (!data || !valor) continue;

    transacoes.push({
      _id: `${data}-${valor}-${i}`,
      data,
      descricao: desc.replace(/"/g, "").replace(/\s+/g, " ").trim(),
      valor: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
      ...categorizar(desc, valor),
    });
  }

  return { transacoes, banco };
}

/* ============================================================
   PRESET MoneyWiz (CSV exportado em PT)
   Cabeçalho: Conta · Transferências · Descrição · Beneficiário ·
              Categoria · Data · Memorando · Valor · Câmbio · ...
   Particularidades:
   - Primeira linha "sep=,". Data DD/MM/YYYY. Valor BR (1.234,56).
   - Memorando vira fallback quando Descrição é vazia ou "0".
   - Categoria hierárquica "Pai > Filho" → categoria + subcategoria.
   - Linhas com "Transferências" preenchido viram categoria
     "Transferência" (não somam nos KPIs de despesa/receita normais).
   ============================================================ */

function isMoneyWizCSV(text) {
  if (!text) return false;
  const head = String(text).slice(0, 600).toLowerCase();
  return /"conta"/.test(head)
      && /"transfer[êe]ncias"/.test(head)
      && /"memorando"/.test(head)
      && /"valor"/.test(head);
}

function noAccents(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function flattenCategoria(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "0") return { categoria: "", subcategoria: null };
  const parts = s.split(/\s*[>:]\s*/);
  if (parts.length >= 2) {
    return { categoria: parts[0].trim(), subcategoria: parts.slice(1).join(" / ").trim() };
  }
  return { categoria: s, subcategoria: null };
}

export function parseMoneyWiz(text) {
  // Remove a linha "sep=,"
  const limpo = String(text || "").replace(/^sep=[^\r\n]*\r?\n/i, "");
  const res = Papa.parse(limpo, { header: true, skipEmptyLines: true });
  const linhas = res?.data || [];
  if (linhas.length === 0) return { transacoes: [], erro: "Nenhum dado encontrado no arquivo MoneyWiz." };

  // Localiza chaves de coluna (case-insensitive, sem acentos)
  const keys = Object.keys(linhas[0] || {});
  const findKey = (re) => keys.find(k => re.test(noAccents(k).toLowerCase())) || "";
  const kTransf = findKey(/^transferencias$/);
  const kDesc   = findKey(/^descricao$/);
  const kBenef  = findKey(/^beneficiario$/);
  const kCat    = findKey(/^categoria$/);
  const kData   = findKey(/^data$/);
  const kMemo   = findKey(/^memorando$/);
  const kValor  = findKey(/^valor$/);

  const transacoes = [];
  linhas.forEach((row, i) => {
    const data = parseDataBR(row[kData]);
    const valor = parseValorBR(row[kValor]);
    if (!data || valor == null || valor === 0) return;

    // Descrição com fallback para Memorando, e para "Lançamento" se nada
    let desc = String(row[kDesc] || "").trim();
    if (!desc || desc === "0") desc = String(row[kMemo] || "").trim();
    if (!desc || desc === "0") desc = "Lançamento";

    // Beneficiário (várias linhas trazem "0" como placeholder)
    const benef = String(row[kBenef] || "").trim();
    const benefOk = benef && benef !== "0";

    // Transferência? (coluna "Transferências" preenchida)
    const transfRaw = String(row[kTransf] || "").trim();
    let categoria, subcategoria;
    if (transfRaw && transfRaw !== "0") {
      categoria = "Transferência";
      subcategoria = transfRaw;
    } else {
      const flat = flattenCategoria(row[kCat]);
      categoria = flat.categoria || "Outros";
      subcategoria = flat.subcategoria || null;
    }

    // Observação: junta memorando (se diferente) + beneficiário
    const obsParts = [];
    const memo = String(row[kMemo] || "").trim();
    if (memo && memo !== desc && memo !== "0") obsParts.push(memo);
    if (benefOk && !desc.includes(benef)) obsParts.push(`Benef.: ${benef}`);
    const obs = obsParts.join(" · ").replace(/\s+/g, " ").trim() || undefined;

    transacoes.push({
      _id: `mw-${data}-${i}-${Math.abs(valor)}`,
      data,
      descricao: desc.replace(/\s+/g, " ").trim().slice(0, 200),
      valor: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
      categoria,
      subcategoria,
      obs,
    });
  });

  if (transacoes.length === 0) {
    return { transacoes: [], erro: "Nenhuma transação válida encontrada no arquivo MoneyWiz." };
  }

  return { transacoes, banco: "MoneyWiz" };
}

/** Dispatcher universal: detecta formato e parseia. */
export function parseExtrato(text, filename = "") {
  const lower = (text || "").trim().toLowerCase();
  const fname = filename.toLowerCase();
  if (lower.startsWith("ofxheader") || lower.includes("<ofx>") || fname.endsWith(".ofx")) {
    return parseOFX(text);
  }
  if (isMoneyWizCSV(text)) {
    return parseMoneyWiz(text);
  }
  return parseCSV(text);
}
