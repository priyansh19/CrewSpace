import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      lexical: path.resolve(__dirname, "./node_modules/lexical/Lexical.mjs"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
  build: {
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
