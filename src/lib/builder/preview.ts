import type { BuilderFile, BuilderFramework } from "./types";

/**
 * Builds a single self-contained HTML document (used as an iframe `srcDoc`)
 * from the files the model generated. Runs entirely client-side:
 * - "html": the model's own index.html, with linked .css/.js files inlined.
 * - "typescript": same, but the linked .ts entry script is run through
 *   Babel standalone (loaded from a CDN inside the iframe) to strip types.
 * - "react" / "next": no bundler is available, so every component file is
 *   concatenated (import/export stripped) and transpiled together with
 *   Babel standalone's React + TypeScript presets, then mounted onto #root.
 */

const CDN = {
  react: "https://unpkg.com/react@18/umd/react.development.js",
  reactDom: "https://unpkg.com/react-dom@18/umd/react-dom.development.js",
  babel: "https://unpkg.com/@babel/standalone/babel.min.js",
  tailwind: "https://cdn.tailwindcss.com",
};

function escapeClosingTags(src: string): string {
  return src.replace(/<\/(script|style)/gi, "<\\/$1");
}

function byExactPath(files: BuilderFile[], path: string): BuilderFile | undefined {
  const norm = path.replace(/^\.?\/+/, "").toLowerCase();
  return files.find((f) => f.path.replace(/^\.?\/+/, "").toLowerCase() === norm);
}

function byBasename(files: BuilderFile[], ref: string): BuilderFile | undefined {
  const base = ref.split("/").pop()?.split("?")[0]?.toLowerCase();
  if (!base) return undefined;
  return files.find((f) => f.path.split("/").pop()?.toLowerCase() === base);
}

function fallbackDoc(message: string): string {
  return `<!doctype html><html><body style="font:13px system-ui;color:#666;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;text-align:center;">${message}</body></html>`;
}

/** Removes ES module syntax so plain concatenated scripts share one scope. */
function stripModuleSyntax(src: string): string {
  return src
    .replace(/^\s*import[^\n;]*;?\s*$/gm, "")
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+(?=const\s|function\s|class\s|let\s|var\s|async\s)/gm, "")
    .replace(/^\s*["']use client["'];?\s*$/gm, "");
}

function isComponentFile(path: string): boolean {
  const p = path.toLowerCase();
  if (p.endsWith(".d.ts")) return false;
  if (p.includes("config")) return false;
  if (p.includes("/api/") || p.startsWith("api/")) return false;
  if (p === "package.json" || p === "tsconfig.json") return false;
  return /\.(jsx|tsx|ts|js)$/.test(p);
}

function findEntryComponentName(
  files: BuilderFile[],
  preferredPaths: string[],
  fallback: string,
): string {
  for (const path of preferredPaths) {
    const f = byExactPath(files, path);
    if (!f) continue;
    const m = f.content.match(/export\s+default\s+function\s+(\w+)/);
    if (m?.[1]) return m[1];
    return fallback;
  }
  for (const f of files) {
    const m = f.content.match(/export\s+default\s+function\s+(\w+)/);
    if (m?.[1]) return m[1];
  }
  return fallback;
}

function reactShell(entryName: string, css: string, code: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="${CDN.react}"><\/script>
<script src="${CDN.reactDom}"><\/script>
<script src="${CDN.babel}"><\/script>
<script src="${CDN.tailwind}"><\/script>
<style>html,body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,sans-serif;}
${escapeClosingTags(css)}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react,typescript">
const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, Fragment } = React;

${escapeClosingTags(code)}

const __mountEl = document.getElementById("root");
try {
  ReactDOM.createRoot(__mountEl).render(<${entryName} />);
} catch (err) {
  __mountEl.innerHTML =
    '<pre style="color:#b91c1c;white-space:pre-wrap;padding:16px;font:12px/1.5 monospace;">' +
    (err && err.message ? err.message : String(err)) +
    "<\\/pre>";
}
<\/script>
</body>
</html>`;
}

function buildReactPreview(files: BuilderFile[]): string {
  const css = files
    .filter((f) => f.path.toLowerCase().endsWith(".css"))
    .map((f) => f.content)
    .join("\n\n");
  const code = files
    .filter((f) => isComponentFile(f.path))
    .map((f) => `// ---- ${f.path} ----\n${stripModuleSyntax(f.content)}`)
    .join("\n\n");
  if (!code.trim()) return fallbackDoc("No React component has been generated yet.");
  const entry = findEntryComponentName(files, ["app.jsx", "app.tsx"], "App");
  return reactShell(entry, css, code);
}

function buildNextPreview(files: BuilderFile[]): string {
  const runnable = files.filter(
    (f) => isComponentFile(f.path) && !/next\.config|tailwind\.config|postcss\.config/i.test(f.path),
  );
  const css = files
    .filter((f) => f.path.toLowerCase().endsWith(".css"))
    .map((f) => f.content)
    .join("\n\n");
  const code = runnable
    .map((f) => `// ---- ${f.path} ----\n${stripModuleSyntax(f.content)}`)
    .join("\n\n");
  if (!code.trim()) return fallbackDoc("No page component has been generated yet.");
  const entry = findEntryComponentName(files, ["app/page.tsx", "pages/index.tsx"], "Page");
  return reactShell(entry, css, code);
}

function buildHtmlPreview(files: BuilderFile[]): string {
  const index = byExactPath(files, "index.html") ?? files.find((f) => f.path.toLowerCase().endsWith(".html"));
  if (!index) return fallbackDoc("No index.html file has been generated yet.");

  let html = index.content;
  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (match, href: string) => {
    if (!/\.css(\?|$)/i.test(href)) return match;
    const f = byBasename(files, href);
    return f ? `<style>\n${escapeClosingTags(f.content)}\n</style>` : match;
  });
  html = html.replace(
    /<script([^>]*)\ssrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (match, pre: string, src: string, post: string) => {
      const f = byBasename(files, src);
      if (!f) return match;
      return `<script${pre}${post}>\n${escapeClosingTags(f.content)}\n</script>`;
    },
  );
  return html;
}

function buildTypescriptPreview(files: BuilderFile[]): string {
  const index = byExactPath(files, "index.html") ?? files.find((f) => f.path.toLowerCase().endsWith(".html"));
  const script =
    byExactPath(files, "script.ts") ?? files.find((f) => /\.tsx?$/i.test(f.path) && !f.path.endsWith(".d.ts"));

  if (!index) {
    // No document was authored — synthesize a bare shell around the script.
    const css = files
      .filter((f) => f.path.toLowerCase().endsWith(".css"))
      .map((f) => f.content)
      .join("\n\n");
    const code = script ? stripModuleSyntax(script.content) : "";
    return `<!doctype html><html><head><meta charset="utf-8"/><script src="${CDN.babel}"><\/script>
<style>html,body{margin:0;font-family:system-ui,sans-serif;}\n${escapeClosingTags(css)}</style></head>
<body><div id="app"></div>
<script type="text/babel" data-presets="typescript">\n${escapeClosingTags(code)}\n<\/script>
</body></html>`;
  }

  let html = index.content;
  // Make sure Babel standalone is present so a <script type="module" src="script.ts">
  // (or any .ts include) can be transpiled in-browser.
  if (!/babel\.min\.js|babel-standalone/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n<script src="${CDN.babel}"><\/script>`);
  }
  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (match, href: string) => {
    if (!/\.css(\?|$)/i.test(href)) return match;
    const f = byBasename(files, href);
    return f ? `<style>\n${escapeClosingTags(f.content)}\n</style>` : match;
  });
  html = html.replace(
    /<script([^>]*)\ssrc=["']([^"']+\.ts)["']([^>]*)>\s*<\/script>/gi,
    (match, pre: string, src: string, post: string) => {
      const f = byBasename(files, src);
      if (!f) return match;
      return `<script type="text/babel" data-presets="typescript"${pre.replace(/\stype=["'][^"']*["']/i, "")}${post}>\n${escapeClosingTags(
        stripModuleSyntax(f.content),
      )}\n</script>`;
    },
  );
  return html;
}

export function buildPreviewDoc(framework: BuilderFramework, files: BuilderFile[]): string {
  if (files.length === 0) return fallbackDoc("Describe what to build to see a live preview here.");
  switch (framework) {
    case "html":
      return buildHtmlPreview(files);
    case "typescript":
      return buildTypescriptPreview(files);
    case "react":
      return buildReactPreview(files);
    case "next":
      return buildNextPreview(files);
  }
}
