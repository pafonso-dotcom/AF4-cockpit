import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Caminho relativo: funciona em GitHub Pages (sub-pasta) e domínio próprio.
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: ["es2017", "safari12"],
  },
  preview: {
    host: "0.0.0.0",
    strictPort: true,
  },
});
