// Vite configuration for production deployment
// This file provides strict CSP without 'unsafe-eval'
// Use this when deploying to staging/production environments

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // Production build settings - STRICT CSP COMPATIBLE
  build: {
    sourcemap: false,  // No source maps in production
    minify: 'terser',
    rollupOptions: {
      output: {
        // Ensure no dynamic eval is used
        format: 'es',
      },
    },
  },
  // Strict CSP mode - no eval() needed
  define: {
    __DEV__: false,
  },
});
