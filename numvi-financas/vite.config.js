import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Variante do build (mesma var que o app usa em runtime). Define o nome do
// PWA para que pessoal e comercial instalem com nomes/ícones distinguíveis.
const RAW = String(process.env.VITE_NUMVI_VARIANT || "pessoal").toLowerCase().trim();
const IS_COMERCIAL = RAW === "comercial" || RAW === "financas" || RAW === "finanças";
const APP_NAME  = IS_COMERCIAL ? "Numvi Finanças" : "Numvi Pessoal";
const APP_SHORT = IS_COMERCIAL ? "Finanças" : "Pessoal";

// Plugin: injeta o nome da variante no título/meta do index.html e reescreve
// o manifest.webmanifest gerado em dist/ (name + short_name).
function numviBranding() {
  return {
    name: "numvi-branding",
    transformIndexHtml(html) {
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${APP_NAME}</title>`)
        .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1${APP_NAME}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${APP_NAME}$2`);
    },
    closeBundle() {
      try {
        const p = path.resolve(process.cwd(), "dist/manifest.webmanifest");
        if (!fs.existsSync(p)) return;
        const m = JSON.parse(fs.readFileSync(p, "utf8"));
        m.name = APP_NAME;
        m.short_name = APP_SHORT;
        fs.writeFileSync(p, JSON.stringify(m, null, 2));
      } catch {
        // best-effort — não falha o build por causa do nome do manifest
      }
    },
  };
}

export default defineConfig({
  // Caminho relativo: funciona tanto em GitHub Pages (sub-pasta
  // /AF4-cockpit/) quanto em domínio próprio na raiz.
  base: "./",
  plugins: [react(), numviBranding()],
  build: {
    outDir: "dist",
    sourcemap: false,
    // iOS Safari ≥14 — abrange iPads/iPhones de 2017 em diante.
    // Padrão "modules" do Vite assume Safari 15+, deixando iPads
    // antigos com tela branca por causa de sintaxe nao suportada.
    target: ["es2017", "safari12"],
  },
  preview: {
    // Permite acesso via domínio (nginx → localhost:3004)
    allowedHosts: ["af4.codder.com.br", "localhost", "127.0.0.1"],
    host: "0.0.0.0",
    strictPort: true,
  },
});
