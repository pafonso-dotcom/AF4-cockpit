// Helpers de exportação de relatórios — PDF (window.print), CSV, PNG (html2canvas opcional)

/**
 * toPDF — isola o card pelo id e dispara window.print().
 * Adiciona classe .print-only-this no body que o CSS @media print
 * usa pra esconder os outros elementos.
 */
export function toPDF(elementId) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`[exportRelatorio.toPDF] Elemento #${elementId} não encontrado`);
    return;
  }
  // Adiciona classe especial no body + atributo data-print-target no elemento alvo
  document.body.setAttribute("data-print-only", elementId);
  el.classList.add("print-only-this");
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.removeAttribute("data-print-only");
      el.classList.remove("print-only-this");
    }, 500);
  }, 60);
}

/**
 * toCSV — recebe array de objetos (ou array de arrays) e dispara download.
 * Aceita data como:
 *   - { headers: [...], rows: [[...], [...]] }
 *   - [{ col1, col2, ... }] (extrai keys da primeira linha)
 */
export function toCSV(data, filename = "relatorio.csv") {
  let headers, rows;
  if (data && data.headers && data.rows) {
    headers = data.headers;
    rows = data.rows;
  } else if (Array.isArray(data) && data.length > 0) {
    headers = Object.keys(data[0]);
    rows = data.map(r => headers.map(h => r[h]));
  } else {
    console.warn("[exportRelatorio.toCSV] data inválida");
    return;
  }

  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    // Sempre envolve em aspas e escapa aspas internas dobrando-as
    return `"${s.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.map(escape).join(";"),
    ...rows.map(r => r.map(escape).join(";")),
  ].join("\n");

  // BOM UTF-8 pro Excel abrir certo
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * toPNG — usa html2canvas se disponível. Se não, mostra aviso pedindo PDF.
 * Carrega html2canvas dinamicamente (não bloqueia bundle inicial).
 */
export async function toPNG(elementId, filename = "relatorio.png") {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`[exportRelatorio.toPNG] Elemento #${elementId} não encontrado`);
    return false;
  }
  try {
    // Import dinâmico — só carrega html2canvas quando o usuário pedir PNG.
    // @vite-ignore evita o erro de resolução em build (módulo opcional).
    const modName = "html2canvas";
    const mod = await import(/* @vite-ignore */ modName).catch(() => null);
    if (!mod || !mod.default) {
      console.warn("[exportRelatorio.toPNG] html2canvas não instalado. Use PDF.");
      return false;
    }
    const html2canvas = mod.default;
    const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
    return true;
  } catch (e) {
    console.error("[exportRelatorio.toPNG] erro", e);
    return false;
  }
}

// Detecta se html2canvas tá disponível (pra esconder o botão PNG quando não)
export async function hasPNGSupport() {
  try {
    const modName = "html2canvas";
    const mod = await import(/* @vite-ignore */ modName).catch(() => null);
    return !!(mod && mod.default);
  } catch {
    return false;
  }
}
