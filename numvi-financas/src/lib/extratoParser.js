/**
 * Parsers de extratos bancários (OFX e CSV) com auto-categorização.
 *
 * Banco brasileiro exporta em 2 formatos:
 *  - OFX (XML-like): padronizado, fácil de extrair
 *  - CSV: cada banco usa um formato próprio, mas detectamos pelo header
 */

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
    // parseValorBR (não parseFloat): alguns bancos BR gravam TRNAMT com vírgula
    // decimal ("-150,50"), e parseFloat cortaria os centavos.
    const valor = parseValorBR(valorRaw);

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

// Converte qualquer texto de valor (BR ou US) em número, PRESERVANDO os
// centavos. Lida com: "1.234,56" (BR), "1,234.56" (US), "150,50", "150.50",
// "1.234" (milhar BR sem centavos), "(150,00)" e "150,00 D" (negativos).
function parseValorBR(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const orig = String(v).trim();
  // Negativo: parênteses, sinal "-" ou marcação "D" (débito) dos extratos BR.
  const negativo = /^\(.*\)$/.test(orig) || /^-/.test(orig) || /(^|\s)D($|\s)/i.test(orig);
  // Sobra só dígitos, vírgula e ponto.
  let s = orig.replace(/[^\d,.]/g, "");
  if (!s) return 0;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    // O separador que aparecer por ÚLTIMO é o decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", "."); // BR: 1.234,56
    else s = s.replace(/,/g, ""); // US: 1,234.56
  } else if (temVirgula) {
    s = s.replace(",", "."); // 150,50 → 150.50
  } else if (temPonto) {
    // Só ponto: é decimal se houver um único ponto com 1–2 casas (150.5 / 150.50).
    // Caso contrário é separador de milhar (1.234 / 1.234.567) e deve sair.
    const partes = s.split(".");
    if (partes.length > 2 || (partes[1] || "").length === 3) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s) || 0;
  return negativo ? -Math.abs(n) : n;
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
    let cols = parseLineCSV(linhas[i], delim);
    if (cols.length < 2) continue;

    // Arquivo separado por vírgula em que o valor usa vírgula decimal: "150,50"
    // vira duas colunas ["150","50"] e os centavos somem. Quando a linha tem
    // exatamente 1 coluna a mais que o cabeçalho e o trecho após o valor são
    // 1–2 dígitos, juntamos de volta (e corrigimos o índice da descrição).
    let iDesc = idxDesc;
    if (delim === "," && cols.length === header.length + 1
        && /^\d+$/.test(cols[idxValor] || "") && /^\d{1,2}$/.test(cols[idxValor + 1] || "")) {
      cols = [
        ...cols.slice(0, idxValor),
        `${cols[idxValor]},${cols[idxValor + 1]}`,
        ...cols.slice(idxValor + 2),
      ];
      if (iDesc > idxValor) iDesc -= 1; // descrição depois do valor deslocou 1
    }

    const data = parseDataBR(cols[idxData]);
    const desc = iDesc >= 0 ? cols[iDesc] : "Transação";
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
   DETECÇÃO DE DUPLICIDADE
   ============================================================ */

/**
 * Gera uma chave normalizada de um lançamento para comparar duplicatas.
 *
 * Usa só DATA + VALOR (absoluto) + TIPO — que é o que de fato identifica o
 * "mesmo lançamento". A descrição NÃO entra na chave de propósito: o mesmo
 * lançamento costuma ter descrições diferentes (extrato do banco vs. registro
 * manual, ou OFX vs. CSV vs. PDF), e exigir descrição igual fazia a duplicata
 * passar despercebida.
 */
export function chaveTransacao(t) {
  const data = String(t?.data || "").slice(0, 10);
  const valor = Math.abs(Number(t?.valor) || 0).toFixed(2);
  const tipo = t?.tipo || "";
  return `${data}|${valor}|${tipo}`;
}

/**
 * Marca como `_duplicada` cada transação nova que já existe na lista de
 * lançamentos existentes OU que se repete dentro do próprio lote importado.
 * Não remove nada — só sinaliza, para a UI desmarcar por padrão.
 */
export function marcarDuplicadas(novas, existentes) {
  const existSet = new Set((existentes || []).map(chaveTransacao));
  const vistasNoLote = new Set();
  return (novas || []).map((t) => {
    const k = chaveTransacao(t);
    const duplicada = existSet.has(k) || vistasNoLote.has(k);
    vistasNoLote.add(k);
    return { ...t, _duplicada: duplicada };
  });
}

/** Dispatcher universal: detecta formato e parseia. */
export function parseExtrato(text, filename = "") {
  const lower = (text || "").trim().toLowerCase();
  const fname = filename.toLowerCase();
  if (lower.startsWith("ofxheader") || lower.includes("<ofx>") || fname.endsWith(".ofx")) {
    return parseOFX(text);
  }
  return parseCSV(text);
}
