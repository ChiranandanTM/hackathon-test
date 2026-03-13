import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    middlewareMode: false,
    // HMR configuration for Vite dev server - auto-detect actual host/port
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      // Let the server auto-detect the port it's actually running on
      // This prevents issues when 5173 is in use and another port is assigned
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // Build optimization
  build: {
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        // Ensure code splitting works properly
        manualChunks: {
          'vendor': ['react', 'react-dom'],
        }
      }
    }
  },
});
