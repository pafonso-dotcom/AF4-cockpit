/* ============================================================
   EXPORT APP · cópia do sistema (o programa, SEM os dados)

   Baixa todos os arquivos do app compilado (listados em
   /app-arquivos.json, gerado no build) e monta um ZIP com a pasta
   completa. Serve como cofre: se o site/worker sumir, o usuário
   tem o aplicativo inteiro guardado — os dados dele ficam nos
   backups JSON/CSV, que são separados de propósito.
   ============================================================ */

import { criarZip } from "./exportCSV.js";

const LEIA_ME = (qtd) => `Cópia do aplicativo Afinanças — gerada em ${new Date().toLocaleString("pt-BR")}

Esta pasta contém os ${qtd} arquivos do PROGRAMA instalado (HTML, JS, CSS,
ícones). Os SEUS DADOS não estão aqui — eles ficam no navegador e nos
backups JSON/CSV feitos em Configurações → Backup.

COMO RODAR O APLICATIVO DESTA PASTA (em caso de perda total):

  • Windows: clique duas vezes em "iniciar-windows.bat".
    (Não precisa instalar nada — se não houver Python, ele usa o
    PowerShell do próprio Windows via servidor.ps1.)
  • Mac: clique duas vezes em "Iniciar-Mac.command".
    (Se o Mac bloquear na primeira vez: botão direito no arquivo → Abrir.)

  O navegador abre sozinho em http://localhost:8000 com o app rodando.
  Deixe a janela preta/do Terminal aberta enquanto usa.

  Alternativa manual (qualquer sistema com Python):
    python3 -m http.server 8000   (dentro desta pasta)

Depois de abrir, restaure seus dados importando o backup JSON em
Configurações → Backup → Importar.

O código-fonte completo continua no repositório GitHub do projeto.
`;

// Iniciador Windows: serve a pasta e abre o navegador. Tenta python/py e,
// se não tiver nada instalado, cai no servidor.ps1 — PowerShell vem em
// todo Windows, então funciona sem instalar nada.
const INICIAR_BAT = [
  "@echo off",
  'cd /d "%~dp0"',
  "echo Afinancas — servindo em http://localhost:8000",
  "echo Deixe esta janela aberta enquanto usa o aplicativo.",
  'start "" http://localhost:8000',
  "python -m http.server 8000 2>nul",
  "if errorlevel 1 py -m http.server 8000 2>nul",
  'if errorlevel 1 powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"',
  "if errorlevel 1 npx --yes serve -l 8000 .",
  "pause",
  "",
].join("\r\n");

// Servidor estático em PowerShell puro (HttpListener) — fallback do .bat
// pra Windows sem Python nem Node. SPA: caminho inexistente → index.html.
const SERVIDOR_PS1 = [
  "$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path",
  "$listener = New-Object System.Net.HttpListener",
  '$listener.Prefixes.Add("http://localhost:8000/")',
  "$listener.Start()",
  'Write-Host "Afinancas em http://localhost:8000 — deixe esta janela aberta."',
  '$tipos = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".webmanifest"="application/manifest+json"; ".svg"="image/svg+xml"; ".png"="image/png"; ".ico"="image/x-icon"; ".txt"="text/plain; charset=utf-8"; ".woff"="font/woff"; ".woff2"="font/woff2" }',
  "while ($listener.IsListening) {",
  "  $ctx = $listener.GetContext()",
  '  $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))',
  '  if ($caminho -eq "") { $caminho = "index.html" }',
  "  $arquivo = Join-Path $pasta $caminho",
  '  if (-not (Test-Path $arquivo -PathType Leaf)) { $arquivo = Join-Path $pasta "index.html" }',
  "  try {",
  "    $bytes = [IO.File]::ReadAllBytes($arquivo)",
  "    $ext = [IO.Path]::GetExtension($arquivo).ToLower()",
  "    if ($tipos.ContainsKey($ext)) { $ctx.Response.ContentType = $tipos[$ext] }",
  "    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)",
  "  } catch { $ctx.Response.StatusCode = 500 }",
  "  $ctx.Response.Close()",
  "}",
  "",
].join("\r\n");

// Iniciador Mac/Linux: python3 → ruby (vinha no macOS) → npx.
const INICIAR_COMMAND = `#!/bin/bash
cd "$(dirname "$0")"
echo "Afinanças — servindo em http://localhost:8000"
echo "Deixe esta janela aberta enquanto usa o aplicativo."
( sleep 1; open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null ) &
python3 -m http.server 8000 || ruby -run -e httpd . -p 8000 || npx --yes serve -l 8000 .
`;

// Baixa a cópia completa do app em ZIP. Retorna a qtd de arquivos.
export async function baixarCopiaDoApp() {
  const res = await fetch("/app-arquivos.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Lista de arquivos do app não encontrada (app-arquivos.json).");
  const { arquivos } = await res.json();
  if (!Array.isArray(arquivos) || !arquivos.length) throw new Error("Lista de arquivos vazia.");

  const raiz = `afinancas-app-${new Date().toISOString().slice(0, 10)}`;
  const out = [];
  // Baixa em lotes pra não abrir 100+ conexões simultâneas
  const LOTE = 8;
  for (let i = 0; i < arquivos.length; i += LOTE) {
    const parte = await Promise.all(
      arquivos.slice(i, i + LOTE).map(async (p) => {
        const r = await fetch(`/${p}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`Falha ao baixar ${p} (${r.status}).`);
        return { nome: `${raiz}/${p}`, conteudo: new Uint8Array(await r.arrayBuffer()) };
      })
    );
    out.push(...parte);
  }
  out.push({ nome: `${raiz}/leia-me.txt`, conteudo: LEIA_ME(arquivos.length) });
  out.push({ nome: `${raiz}/iniciar-windows.bat`, conteudo: INICIAR_BAT });
  out.push({ nome: `${raiz}/servidor.ps1`, conteudo: SERVIDOR_PS1 });
  out.push({ nome: `${raiz}/Iniciar-Mac.command`, conteudo: INICIAR_COMMAND, executavel: true });

  const blob = new Blob([criarZip(out)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${raiz}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return arquivos.length;
}
