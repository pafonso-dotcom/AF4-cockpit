/* ============================================================
   IMPORT / EXPORT — CSV, OFX, PDF
   ============================================================ */

import Papa from "papaparse";
import { fmt, fmtN } from "./format.js";

const parseOFX = (text) => {
  const out = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  const tag = (block, name) => {
    const xml = block.match(new RegExp(`<${name}>([^<]*?)<\\/${name}>`, "i"));
    if (xml) return xml[1].trim();
    const sgml = block.match(new RegExp(`<${name}>([^<\\n\\r]*)`, "i"));
    return sgml ? sgml[1].trim() : "";
  };
  let m;
  while ((m = re.exec(text)) !== null) {
    const b = m[1];
    const dateRaw = tag(b, "DTPOSTED");
    const amount = parseFloat(tag(b, "TRNAMT"));
    const memo = tag(b, "MEMO");
    const name = tag(b, "NAME");
    if (isNaN(amount) || !dateRaw) continue;
    const iso = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
    out.push({
      data: iso,
      valor: Math.abs(amount),
      tipo: amount >= 0 ? "receita" : "despesa",
      descricao: name || memo || "Lançamento bancário",
      origem: "ofx",
    });
  }
  return out;
};

// --- CSV helpers ---
const parseDataBR = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const br = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (br) {
    const [, d, m, y] = br;
    const yyyy = y.length === 2 ? "20" + y : y;
    return `${yyyy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
};
const parseValorBR = (s) => {
  if (s == null || s === "") return 0;
  if (typeof s === "number") return s;
  const cleaned = String(s).replace(/[^\d,.\-]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(",", "."));
  return parseFloat(cleaned) || 0;
};
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const autoMapCSV = (headers) => {
  const map = { data: "", valor: "", tipo: "", descricao: "", categoria: "" };
  for (const h of headers) {
    const n = norm(h);
    if (!map.data && (n.includes("data") || n === "date" || n.includes("vencim"))) map.data = h;
    if (!map.valor && (n === "valor" || n === "value" || n === "amount" || n.includes("valor"))) map.valor = h;
    if (!map.descricao && (n.includes("descric") || n === "description" || n.includes("historic")
        || n.includes("lancamento") || n === "memo" || n === "name")) map.descricao = h;
    if (!map.tipo && (n === "tipo" || n === "type")) map.tipo = h;
    if (!map.categoria && n.includes("categor")) map.categoria = h;
  }
  return map;
};

// --- Download / Print helpers ---
const downloadFile = (content, filename, mime = "text/plain;charset=utf-8") => {
  const blob = new Blob(["\ufeff" + content], { type: mime }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
const printHTML = (html) => {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const trigger = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
    setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 3000);
  };
  // Wait for fonts/images
  setTimeout(trigger, 800);
};

// --- CSV export ---
const exportCSV = (transacoes) => {
  const rows = transacoes.map(t => ({
    Data: t.data || "",
    Tipo: t.tipo === "receita" ? "Receita" : "Despesa",
    Descricao: t.descricao || "",
    Categoria: t.categoria || "",
    Conta: t.conta || "",
    Valor: t.tipo === "despesa" ? -Math.abs(Number(t.valor)) : Math.abs(Number(t.valor)),
    Compensado: t.compensado ? "Sim" : "Não",
    Observacoes: t.obs || "",
  }));
  const csv = Papa.unparse(rows, { delimiter: ";", quotes: true });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `af4-cockpit-transacoes-${stamp}.csv`, "text/csv;charset=utf-8");
};

// --- XLSX export (Excel) ---
const exportXLSX = async (data) => {
  // Lazy import: SheetJS só carrega quando o usuário pede xlsx
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) {
    throw new Error("Biblioteca xlsx não disponível. Instale com `npm install xlsx`.");
  }
  const wb = XLSX.utils.book_new();

  if (data.transacoes?.length) {
    const rows = data.transacoes.map(t => ({
      Data: t.data || "",
      Tipo: t.tipo === "receita" ? "Receita" : "Despesa",
      "Descrição": t.descricao || "",
      Categoria: t.categoria || "",
      Conta: t.conta || "",
      Valor: t.tipo === "despesa" ? -Math.abs(Number(t.valor)) : Math.abs(Number(t.valor)),
      Compensado: t.compensado ? "Sim" : "Não",
      Fixa: t.fixa ? "Sim" : "Não",
      "Observações": t.obs || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 11 }, { wch: 6 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Transações");
  }

  if (data.ativos?.length) {
    const rows = data.ativos.map(a => ({
      Ticker: a.ticker,
      Nome: a.nome,
      Tipo: a.tipo,
      Quantidade: a.qtd,
      "Preço Médio": a.pm,
      "Preço Atual": a.preco,
      Investido: a.qtd * a.pm,
      Valor: a.qtd * a.preco,
      Resultado: a.qtd * (a.preco - a.pm),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Investimentos");
  }

  if (data.contas?.length) {
    const rows = data.contas.map(c => ({
      Nome: c.nome,
      Instituição: c.instituicao,
      Tipo: c.tipo,
      Saldo: Number(c.saldo || 0),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Contas");
  }

  if (data.parcelamentos?.length && data.cartoes) {
    const rows = data.parcelamentos.map(p => {
      const cartao = data.cartoes.find(c => c.id === p.cartaoId);
      const valorParcela = p.valorTotal / p.totalParcelas;
      const pagas = p.parcelasPagas?.length || 0;
      return {
        "Descrição": p.descricao,
        Cartão: cartao?.nome || "—",
        "Data Compra": p.dataCompra,
        "1ª Parcela": p.dataPrimeira,
        "Valor Total": p.valorTotal,
        "Total Parcelas": p.totalParcelas,
        "Parcelas Pagas": pagas,
        "Restantes": p.totalParcelas - pagas,
        "Valor Parcela": valorParcela,
        "Saldo Devedor": valorParcela * (p.totalParcelas - pagas),
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Parcelamentos");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `af4-cockpit-${stamp}.xlsx`);
};

// --- PDF report (HTML → browser print) ---
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMonthBR = (yyyymm) => {
  if (!yyyymm) return "Sem data";
  const [y, m] = yyyymm.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[parseInt(m) - 1] || ""} ${y}`;
};

const buildPDFReport = ({ transacoes, contas, ativos, totais, escopo }) => {
  const byMonth = {};
  transacoes.forEach(t => {
    const m = (t.data || "").slice(0, 7) || "Sem data";
    (byMonth[m] = byMonth[m] || []).push(t);
  });
  const months = Object.keys(byMonth).sort().reverse();
  const totalReceitas = transacoes.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor), 0);
  const totalDespesas = transacoes.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor), 0);

  const showContas = escopo.contas !== false;
  const showAtivos = escopo.ativos !== false;
  const showTransacoes = escopo.transacoes !== false;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>AF4 Cockpit · Relatório · ${new Date().toLocaleDateString("pt-BR")}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: 'Poppins', system-ui, sans-serif; color: #1a1612; margin: 0; line-height: 1.5; background: #faf6e9; font-weight: 400; }
  .num { font-family: 'Poppins', system-ui, sans-serif; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; font-weight: 500; }
  .eyebrow { font-family: 'Poppins', system-ui, sans-serif; font-size: 8.5pt; letter-spacing: 0.3em; text-transform: uppercase; color: #8a7d68; font-weight: 500; }
  h1 { font-family: 'Poppins', system-ui, sans-serif; font-size: 36pt; margin: 4pt 0 2pt; line-height: 1; letter-spacing: -0.03em; font-weight: 700; }
  h1 em { color: #8a6a3a; font-style: italic; font-weight: 600; }
  h2 { font-family: 'Poppins', system-ui, sans-serif; font-size: 20pt; margin: 24pt 0 6pt; letter-spacing: -0.02em; font-weight: 600; border-top: 1px solid #c9bb9d; padding-top: 14pt; }
  h3 { font-family: 'Poppins', system-ui, sans-serif; font-size: 13pt; margin: 14pt 0 4pt; font-weight: 500; color: #5e503c; }
  .header { padding-bottom: 16pt; margin-bottom: 18pt; border-bottom: 1px solid #c9bb9d; }
  .lead { color: #5e503c; font-size: 11pt; margin-top: 6pt; font-weight: 300; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #c9bb9d; margin: 12pt 0 4pt; }
  .stat { background: #faf6e9; padding: 10pt 12pt; }
  .stat .lbl { font-size: 7.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: #5e503c; font-family: 'Poppins', system-ui, sans-serif; font-weight: 500; }
  .stat .val { font-family: 'Poppins', system-ui, sans-serif; font-size: 17pt; margin-top: 4pt; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 8pt; font-size: 9.5pt; }
  th { text-align: left; font-family: 'Poppins', system-ui, sans-serif; font-size: 7.5pt; letter-spacing: 0.18em; text-transform: uppercase; color: #5e503c; font-weight: 500; padding: 6pt 4pt 5pt; border-bottom: 1px solid #c9bb9d; }
  td { padding: 5pt 4pt; border-bottom: 1px solid #ebe2cc; vertical-align: top; }
  td.num, th.num { text-align: right; }
  .green { color: #56784f; }
  .red { color: #9a4032; }
  .gold { color: #8a6a3a; }
  .muted { color: #8a7d68; font-size: 9pt; }
  .month-section { page-break-inside: avoid; margin-bottom: 12pt; }
  .ornament { display: flex; align-items: center; gap: 12px; color: #8a6a3a; font-style: italic; margin: 18pt 0 6pt; font-family: 'Poppins', system-ui, sans-serif; font-weight: 500; }
  .ornament::before, .ornament::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, #c9bb9d, transparent); }
  .footer { margin-top: 28pt; padding-top: 12pt; border-top: 1px solid #c9bb9d; text-align: center; font-style: italic; color: #5e503c; font-size: 9.5pt; }
  .footer em { font-family: 'Poppins', system-ui, sans-serif; font-size: 13pt; color: #8a6a3a; font-weight: 600; font-style: italic; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
  }
</style>
</head><body>
  <div class="header">
    <div class="eyebrow">Relatório · emitido em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
    <h1><em>AF4 Cockpit</em> · Painel de Comando</h1>
    <div class="lead">Síntese de contas, transações e investimentos.</div>
  </div>

  <div class="ornament"><span style="font-size:10pt;letter-spacing:0.2em;text-transform:uppercase;font-style:normal">Patrimônio</span></div>
  <div class="stats">
    <div class="stat"><div class="lbl">Patrimônio total</div><div class="val">${escHtml(fmt(totais.patrimonio))}</div></div>
    <div class="stat"><div class="lbl">Saldo em contas</div><div class="val">${escHtml(fmt(totais.saldoContas))}</div></div>
    <div class="stat"><div class="lbl">Receitas</div><div class="val green">${escHtml(fmt(totalReceitas))}</div></div>
    <div class="stat"><div class="lbl">Despesas</div><div class="val red">${escHtml(fmt(totalDespesas))}</div></div>
  </div>

  ${showContas ? `<h2>Contas</h2>
  <table>
    <thead><tr><th>Nome</th><th>Instituição</th><th>Tipo</th><th class="num">Saldo</th></tr></thead>
    <tbody>${contas.map(c => `<tr>
      <td><strong>${escHtml(c.nome)}</strong></td>
      <td>${escHtml(c.instituicao)}</td>
      <td style="text-transform:capitalize" class="muted">${escHtml(c.tipo)}</td>
      <td class="num">${escHtml(fmt(c.saldo))}</td>
    </tr>`).join("")}</tbody>
  </table>` : ""}

  ${showAtivos ? `<h2>Investimentos</h2>
  <table>
    <thead><tr>
      <th>Ticker</th><th>Nome</th><th>Tipo</th>
      <th class="num">Qtd</th><th class="num">PM</th><th class="num">Preço</th>
      <th class="num">Valor</th><th class="num">Resultado</th>
    </tr></thead>
    <tbody>${ativos.map(a => {
      const v = a.qtd * a.preco, c = a.qtd * a.pm, g = v - c;
      return `<tr>
        <td><strong>${escHtml(a.ticker)}</strong></td>
        <td>${escHtml(a.nome)}</td>
        <td class="muted" style="text-transform:capitalize">${escHtml(a.tipo)}</td>
        <td class="num">${escHtml(fmtN(a.qtd, a.tipo === "cripto" ? 6 : 0))}</td>
        <td class="num muted">${escHtml(fmt(a.pm))}</td>
        <td class="num">${escHtml(fmt(a.preco))}</td>
        <td class="num">${escHtml(fmt(v))}</td>
        <td class="num ${g >= 0 ? "green" : "red"}">${g >= 0 ? "+" : ""}${escHtml(fmt(g))}</td>
      </tr>`;
    }).join("")}</tbody>
  </table>` : ""}

  ${showTransacoes ? `<h2>Transações</h2>
  ${months.map(m => `<div class="month-section">
    <h3>${fmtMonthBR(m)}</h3>
    <table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Status</th><th class="num">Valor</th></tr></thead>
      <tbody>${byMonth[m].map(t => `<tr>
        <td class="num muted">${escHtml(t.data || "—")}</td>
        <td>
          <strong>${escHtml(t.descricao)}</strong>
          ${t.obs ? `<div style="font-size:8.5pt;color:#8a7d68;font-style:italic;margin-top:2pt;line-height:1.3">${escHtml(t.obs)}</div>` : ""}
        </td>
        <td class="muted">${escHtml(t.categoria || "—")}</td>
        <td class="muted">${escHtml(t.conta || "—")}</td>
        <td style="font-size:8pt;letter-spacing:0.1em;text-transform:uppercase;color:${t.compensado ? "#56784f" : "#8a6a3a"}">
          ${t.compensado ? "● Compensada" : "○ Pendente"}
        </td>
        <td class="num ${t.tipo === "receita" ? "green" : "red"}">${t.tipo === "receita" ? "+" : "−"} ${escHtml(fmt(t.valor))}</td>
      </tr>`).join("")}</tbody>
    </table>
  </div>`).join("")}` : ""}

  <div class="footer">
    <em>finis</em><br>
    AF4 Cockpit · Painel de Comando · Gerado em ${new Date().toLocaleString("pt-BR")}
  </div>
</body></html>`;
};

export { parseOFX, parseDataBR, parseValorBR, autoMapCSV, norm, printHTML, exportCSV, exportXLSX, buildPDFReport };
