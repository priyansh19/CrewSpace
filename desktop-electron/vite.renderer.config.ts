import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The renderer source now lives in ui/src (shared with the web distribution).
const UI_SRC = path.resolve(__dirname, "../ui/src");
const UI_ROOT = path.resolve(__dirname, "../ui");

export default defineConfig({
  root: UI_ROOT,
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": UI_SRC,
      lexical: path.resolve(__dirname, "node_modules/lexical/Lexical.mjs"),
    },
  },
  server: {
    port: 5285,
    proxy: {
      "/api": {
        // In Electron dev mode proxy to the embedded server (default 3150).
        target: process.env.VITE_API_TARGET ?? "http://localhost:3150",
        ws: true,
        bypass: (req) => {
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
      input: path.resolve(UI_ROOT, "index.html"),
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
