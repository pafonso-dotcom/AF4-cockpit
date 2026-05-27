/* ============================================================
   Parser de XLSX da Lotofácil (formato asloterias.com.br)
   - Detecta a linha de cabeçalho ("Concurso | Data | bola 1..15")
   - Normaliza para JSON: [{ numero, data, dezenas: [int×15] }]
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");

function pickFile() {
  const arg = process.argv[2];
  if (arg) return path.isAbsolute(arg) ? arg : path.join(DATA_DIR, arg);
  const candidates = (existsSync(DATA_DIR) ? readdirSync(DATA_DIR) : [])
    .filter(f => f.toLowerCase().endsWith(".xlsx"));
  if (!candidates.length) throw new Error(`Nenhum .xlsx em ${DATA_DIR}`);
  return path.join(DATA_DIR, candidates[0]);
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const cells = (rows[i] || []).map(c => String(c ?? "").toLowerCase().trim());
    if (cells.includes("concurso") && cells.some(c => /bola\s*1$/.test(c))) {
      return i;
    }
  }
  return -1;
}

function parseDataBR(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const m = String(d).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const y = yy.length === 2 ? `20${yy}` : yy;
  return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function main() {
  const file = pickFile();
  console.log(`[parse] lendo ${path.relative(ROOT, file)}`);
  const buf = readFileSync(file);
  const wb = XLSX.read(buf, { cellDates: true, type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  const hi = findHeaderRow(rows);
  if (hi < 0) throw new Error("Cabeçalho não encontrado");
  const header = rows[hi].map(c => String(c ?? "").toLowerCase().trim());
  const idxConcurso = header.indexOf("concurso");
  const idxData = header.indexOf("data");
  const idxBolas = header
    .map((h, i) => /bola\s*\d+/.test(h) ? i : -1)
    .filter(i => i >= 0)
    .slice(0, 15);

  if (idxBolas.length !== 15) throw new Error(`Esperava 15 bolas, achei ${idxBolas.length}`);
  console.log(`[parse] header row=${hi} · concurso@${idxConcurso} · data@${idxData} · bolas[${idxBolas.length}]`);

  const concursos = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const numero = Number(r[idxConcurso]);
    if (!Number.isFinite(numero)) continue;
    const data = parseDataBR(r[idxData]);
    const dezenas = idxBolas.map(j => Number(r[j])).filter(n => n >= 1 && n <= 25);
    if (dezenas.length !== 15) continue;
    concursos.push({ numero, data, dezenas: [...new Set(dezenas)].sort((a, b) => a - b) });
  }

  concursos.sort((a, b) => a.numero - b.numero);
  console.log(`[parse] ${concursos.length} concursos · #${concursos[0].numero} (${concursos[0].data}) → #${concursos.at(-1).numero} (${concursos.at(-1).data})`);

  const out = path.join(DATA_DIR, "concursos.json");
  writeFileSync(out, JSON.stringify(concursos));
  console.log(`[parse] salvo em ${path.relative(ROOT, out)} (${(JSON.stringify(concursos).length / 1024).toFixed(1)} KB)`);
}

main();
