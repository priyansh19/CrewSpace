import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      lexical: path.resolve(__dirname, "node_modules/lexical/Lexical.mjs"),
    },
  },
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:3150",
        ws: true,
        bypass: (req) => {
          // Don't proxy Vite source-module requests — only real API calls
          if (req.url && /\.(ts|tsx|js|jsx|css|json|vue|svelte)(\?|$)/.test(req.url)) {
            return req.url;
          }
          return undefined;
        },
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "renderer-dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
          "vendor-three":  ["three"],
          "vendor-r3f":    ["@react-three/fiber", "@react-three/drei"],
          "vendor-ui":     ["lucide-react", "clsx", "tailwind-merge", "class-variance-authority"],
          "vendor-query":  ["@tanstack/react-query"],
          "vendor-editor": ["@mdxeditor/editor", "lexical"],
        },
      },
    },
  },
});
