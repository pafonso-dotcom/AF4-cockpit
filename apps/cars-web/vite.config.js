import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Carimbo de build (data/hora UTC) — muda a cada compilação/deploy. Mostrado
// no rodapé para confirmar visualmente que o app atualizou para a versão nova.
const BUILD_ID = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

export default defineConfig({
  // Caminho relativo: funciona tanto em GitHub Pages (sub-pasta
  // /AF4-cockpit/) quanto em domínio próprio na raiz.
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    // iOS Safari ≥14 — abrange iPads/iPhones de 2017 em diante.
    // Padrão "modules" do Vite assume Safari 15+, deixando iPads
    // antigos com tela branca por causa de sintaxe nao suportada.
    target: ["es2017", "safari12"],
    rollupOptions: {
      // @anthropic-ai/sdk é importado dinamicamente em conversaParser.js
      // apenas quando o usuário fornece uma API key. Externalizar evita erro
      // de build por módulo não instalado.
      external: ["@anthropic-ai/sdk"],
    },
  },
  preview: {
    // Permite acesso via domínio (nginx → localhost:3004)
    allowedHosts: ["af4.codder.com.br", "localhost", "127.0.0.1"],
    host: "0.0.0.0",
    strictPort: true,
  },
});
