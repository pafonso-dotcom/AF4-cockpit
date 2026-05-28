#!/usr/bin/env node
// Pre-build cleanup. O deploy extrai o tar SOBRE o diretório existente
// sem apagar arquivos antigos — então qualquer leftover (.next/, código
// Next.js antigo, etc.) precisa ser removido antes do vite build pra evitar
// confusão. Só apaga coisas que NÃO fazem parte do projeto Vite atual.

import { readdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// Diretórios/arquivos no root do cars-web que sobreviveram de versões
// anteriores (Next.js, Prisma, etc.) e devem ser removidos.
const STALE = [
  ".next", "next-env.d.ts", "next.config.ts", "next.config.js",
  "prisma", "middleware.ts", "proxy.ts", "tsconfig.json",
  "app", "lib", "components",  // diretórios da versão Next.js antiga
];

for (const name of STALE) {
  const p = join(ROOT, name);
  if (!existsSync(p)) continue;
  try {
    rmSync(p, { recursive: true, force: true });
    console.log(`[clean-stale] removed ${name}`);
  } catch (e) {
    console.warn(`[clean-stale] failed to remove ${name}:`, e?.message ?? e);
  }
}

// Whitelist do que DEVE existir no src/. Tudo fora é apagado.
const SRC = join(ROOT, "src");
const SRC_OK = new Set([
  "App.jsx", "main.jsx", "AuthGate.jsx", "index.css",
  "components", "lib", "data",
]);

if (existsSync(SRC)) {
  for (const name of readdirSync(SRC)) {
    if (SRC_OK.has(name)) continue;
    const p = join(SRC, name);
    try {
      rmSync(p, { recursive: true, force: true });
      console.log(`[clean-stale] removed src/${name}`);
    } catch (e) {
      console.warn(`[clean-stale] failed to remove src/${name}:`, e?.message ?? e);
    }
  }
}

console.log("[clean-stale] done");
