import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
