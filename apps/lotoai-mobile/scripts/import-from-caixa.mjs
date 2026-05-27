#!/usr/bin/env node
/* ============================================================
   Importa concursos novos da Lotofácil
   - Lê data/concursos.json pra descobrir o último concurso já importado
   - Busca novos na API oficial da Caixa (servicebus2.caixa.gov.br)
   - Fallback: mirrors públicos no GitHub se a Caixa estiver fora
   - Salva incremental em data/concursos.json + public/concursos.json
   - Idempotente: rodar 2x não duplica concursos
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "concursos.json");
const PUBLIC_FILE = path.join(ROOT, "public", "concursos.json");

const FONTES = [
  {
    nome: "Caixa (oficial)",
    latest: () => "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/",
    porId: (n) => `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${n}`,
    parse: parseCaixa,
  },
  {
    nome: "loteriascaixa-api (mirror)",
    latest: () => "https://loteriascaixa-api.herokuapp.com/api/lotofacil/latest",
    porId: (n) => `https://loteriascaixa-api.herokuapp.com/api/lotofacil/${n}`,
    parse: parseHerokuMirror,
  },
];

function parseCaixa(j) {
  if (!j || !j.numero || !Array.isArray(j.listaDezenas)) return null;
  return {
    numero: Number(j.numero),
    data: parseDataBR(j.dataApuracao || j.data),
    dezenas: j.listaDezenas.map(Number).sort((a, b) => a - b),
  };
}

function parseHerokuMirror(j) {
  if (!j || !j.concurso || !Array.isArray(j.dezenas)) return null;
  return {
    numero: Number(j.concurso),
    data: parseDataBR(j.data),
    dezenas: j.dezenas.map(Number).sort((a, b) => a - b),
  };
}

function parseDataBR(d) {
  if (!d) return null;
  const m = String(d).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const [, dd, mm, yy] = m;
    const y = yy.length === 2 ? `20${yy}` : yy;
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

async function tentarFontes(numero) {
  for (const f of FONTES) {
    const url = numero ? f.porId(numero) : f.latest();
    try {
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "LOTOAI-import/1.0",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`  ✗ ${f.nome} → HTTP ${res.status}`);
        continue;
      }
      const j = await res.json();
      const parsed = f.parse(j);
      if (parsed && parsed.dezenas?.length === 15) {
        console.log(`  ✓ ${f.nome} → #${parsed.numero} (${parsed.data})`);
        return parsed;
      }
      console.warn(`  ✗ ${f.nome} → resposta malformada`);
    } catch (e) {
      console.warn(`  ✗ ${f.nome} → ${e.message}`);
    }
  }
  return null;
}

function lerLocais() {
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function salvar(concursos) {
  concursos.sort((a, b) => a.numero - b.numero);
  const json = JSON.stringify(concursos);
  writeFileSync(DATA_FILE, json);
  writeFileSync(PUBLIC_FILE, json);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const max = Number((process.argv.find(a => a.startsWith("--max=")) || "").split("=")[1]) || 30;

  console.log(`\n[import] ${dryRun ? "DRY RUN · " : ""}limite ${max} concursos novos\n`);

  const atual = lerLocais();
  const ultimoLocal = atual.length ? atual[atual.length - 1].numero : 0;
  console.log(`[import] último local: #${ultimoLocal} (${atual.length} concursos no arquivo)\n`);

  console.log(`[import] buscando concurso mais recente da Caixa…`);
  const ultimoRemoto = await tentarFontes();
  if (!ultimoRemoto) {
    console.error("\n[import] ✗ nenhuma fonte disponível. Tente novamente em alguns minutos.");
    process.exit(2);
  }

  const novos = [];
  const inicio = ultimoLocal + 1;
  const fim = Math.min(ultimoRemoto.numero, ultimoLocal + max);
  if (inicio > ultimoRemoto.numero) {
    console.log(`\n[import] nada a importar · histórico já em #${ultimoLocal}`);
    return;
  }

  console.log(`\n[import] importando #${inicio} → #${fim} (${fim - inicio + 1} concursos)`);

  // último já veio na primeira chamada
  if (ultimoRemoto.numero === fim) novos.push(ultimoRemoto);

  for (let n = inicio; n < fim; n++) {
    console.log(`\n[#${n}]`);
    const c = await tentarFontes(n);
    if (c) novos.push(c);
    else console.warn(`  ⚠ pulando #${n} — nenhuma fonte retornou`);
    // pequeno delay para não bater rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  // dedupe e merge
  const mapaPorNumero = new Map(atual.map(c => [c.numero, c]));
  for (const c of novos) mapaPorNumero.set(c.numero, c);
  const final = [...mapaPorNumero.values()].sort((a, b) => a.numero - b.numero);

  console.log(`\n[import] ${novos.length} novos · total agora: ${final.length}`);

  if (dryRun) {
    console.log("[import] DRY RUN — nada salvo");
    return;
  }
  salvar(final);
  console.log(`[import] ✓ salvo em data/concursos.json + public/concursos.json`);
}

main().catch(e => { console.error("[import] erro fatal:", e); process.exit(1); });
