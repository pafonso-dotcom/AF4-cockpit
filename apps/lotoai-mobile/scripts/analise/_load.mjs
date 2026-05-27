import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");
export const DATA_DIR = path.join(ROOT, "data");

export function loadConcursos() {
  const p = path.join(DATA_DIR, "concursos.json");
  if (!existsSync(p)) throw new Error("Rode parse-xlsx.mjs primeiro");
  return JSON.parse(readFileSync(p, "utf-8"));
}

export const NUMEROS = Array.from({ length: 25 }, (_, i) => i + 1);
export const PRIMOS = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
export const FIBONACCI = new Set([1, 2, 3, 5, 8, 13, 21]);
export const MOLDURA = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);

export function pad(n, w = 2) { return String(n).padStart(w, "0"); }
export function pct(x, d = 2) { return `${(x * 100).toFixed(d)}%`; }
