#!/usr/bin/env node
// Pós-build: escreve dist/app-arquivos.json com a lista de TODOS os arquivos
// do app compilado. É o que permite o botão "Baixar cópia do aplicativo"
// (Configurações → Backup) montar um ZIP do sistema inteiro no navegador,
// sem os dados do usuário.

import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "..", "dist");
if (!existsSync(DIST)) {
  console.error("[app-arquivos] dist/ não existe — rode o vite build antes.");
  process.exit(1);
}

function listar(dir, prefixo = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefixo ? `${prefixo}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listar(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const arquivos = listar(DIST).filter(p => p !== "app-arquivos.json").sort();
writeFileSync(
  join(DIST, "app-arquivos.json"),
  JSON.stringify({ geradoEm: new Date().toISOString(), arquivos }, null, 2)
);
console.log(`[app-arquivos] ${arquivos.length} arquivos listados em dist/app-arquivos.json`);
