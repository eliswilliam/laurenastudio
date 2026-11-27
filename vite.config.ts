/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  appType: "spa",
  server: {
    host: "::",
    port: 8080,
    watch: { usePolling: true, interval: 300 },
    proxy: {
      // In Docker: VITE_BACKEND_TARGET=http://api:8000
      // Locally:   falls back to http://localhost:8000
      "/api": {
        target: process.env.VITE_BACKEND_TARGET || "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: process.env.VITE_BACKEND_TARGET || "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
}));
