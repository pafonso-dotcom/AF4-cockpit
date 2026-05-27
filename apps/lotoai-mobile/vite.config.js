import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: ["es2017", "safari12"],
  },
  preview: {
    allowedHosts: ["lotoai.codder.com.br", "localhost", "127.0.0.1"],
    host: "0.0.0.0",
    strictPort: true,
  },
});
