import type { RequestHandler } from "express";
import fs from "node:fs";
import path from "node:path";

function isRendererModule(requestPath: string, apiRoot: string): boolean {
  // Query strings must not turn an unknown API endpoint into a module request.
  if (!/\.(ts|tsx|js|jsx|css|json|vue|svelte)$/.test(requestPath)) return false;

  let filePath: string;
  try {
    filePath = path.resolve(apiRoot, `.${decodeURIComponent(requestPath)}`);
  } catch {
    return false;
  }
  const relativePath = path.relative(apiRoot, filePath);
  if (relativePath.startsWith(`..${path.sep}`) || relativePath === ".." || path.isAbsolute(relativePath)) {
    return false;
  }

  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function apiNotFound(viteApiRoot?: string): RequestHandler {
  return (req, res, next) => {
    // Mounted after real API routes, before Vite. Only existing renderer files
    // may pass through; missing modules must not reach the HTML fallback.
    if (
      viteApiRoot &&
      (req.method === "GET" || req.method === "HEAD") &&
      isRendererModule(req.path, viteApiRoot)
    ) {
      next();
      return;
    }
    res.status(404).json({ error: "API route not found" });
  };
}
