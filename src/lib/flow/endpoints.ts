/**
 * Single source of truth for every public URL the app exposes.
 * Client-safe: no secrets, no server-only imports.
 */

/**
 * Production origin — the live domain the published app is served from.
 * Configurable per deployment with VITE_APP_URL (Cloudflare Pages env var);
 * falls back to the origin the app is currently served from, so the
 * "Production" URLs in the editor are always real, reachable links.
 */
const CONFIGURED_ORIGIN = (import.meta.env?.["VITE_APP_URL"] as string | undefined)?.replace(/\/+$/, "");

export const PRODUCTION_ORIGIN =
  CONFIGURED_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "https://eweblb.com");

/** Origin of the environment the editor is currently open in (preview/dev/local). */
export function testOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN;
}

export type Env = "test" | "production";

export function originFor(env: Env, customDomain?: string | null): string {
  // A verified custom domain is the canonical origin for both environments —
  // test just points at the same live domain instead of a separate preview
  // origin. Falls back to the previous per-env origin when none is set.
  if (customDomain) return `https://${customDomain}`;
  return env === "production" ? PRODUCTION_ORIGIN : testOrigin();
}

/** Execution endpoint for a whole workflow, or for one single node/trigger. */
export function execPath(workflowId: string, nodeId?: string): string {
  return `/api/public/exec/${workflowId}${nodeId ? `/${encodeURIComponent(nodeId)}` : ""}`;
}

export function execUrl(
  env: Env,
  workflowId: string,
  key: string,
  nodeId?: string,
  customDomain?: string | null,
): string {
  const query = key ? `?key=${encodeURIComponent(key)}` : "";
  return `${originFor(env, customDomain)}${execPath(workflowId, nodeId)}${query}`;
}

/** Real, hosted, styled test page for any node — form built from its actual field schema, executes for real. */
export function nodeTestUrl(env: Env, workflowId: string, nodeId: string, key: string, customDomain?: string | null): string {
  const query = key ? `?key=${encodeURIComponent(key)}` : "";
  return `${originFor(env, customDomain)}/api/public/node/${workflowId}/${nodeId}${query}`;
}

/** Public webhook endpoint of a webhook trigger node. */
export function webhookUrl(env: Env, workflowId: string, path: string, customDomain?: string | null): string {
  return `${originFor(env, customDomain)}/api/public/webhook/${workflowId}/${String(path).replace(/^\/+/, "")}`;
}

/** Real hosted form page of a form trigger node — opens as an actual fillable HTML form. */
export function formUrl(env: Env, workflowId: string, path: string, customDomain?: string | null): string {
  return `${originFor(env, customDomain)}/api/public/forms/${workflowId}/${String(path).replace(/^\/+/, "")}`;
}

/** Public chat endpoint of a chat trigger node. */
export function chatUrl(env: Env, workflowId: string, customDomain?: string | null): string {
  return `${originFor(env, customDomain)}/api/public/chat/${workflowId}`;
}

/** Shareable link that opens one execution in the Executions page. */
export function executionLink(env: Env, executionId: string, customDomain?: string | null): string {
  return `${originFor(env, customDomain)}/executions?run=${executionId}`;
}

export function curlFor(
  url: string,
  method = "POST",
  body?: string,
  headers: Record<string, string> = {},
): string {
  const all = { "content-type": "application/json", ...headers };
  return [
    `curl -i -X ${method} '${url}' \\`,
    ...Object.entries(all).map(([k, v]) => `  -H '${k}: ${v}' \\`),
    body ? `  -d '${body.replace(/\n\s*/g, "")}'` : `  -d '{}'`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Embedding — drop any node, form or workflow into another website    */
/* ------------------------------------------------------------------ */

/** Ready-to-paste <iframe> that renders a live, working panel on any site. */
export function embedIframeSnippet(url: string, height = 520): string {
  return `<iframe src="${url}" width="100%" height="${height}" style="border:1px solid #e5e7eb;border-radius:12px" loading="lazy" title="n9n"></iframe>`;
}

/** Ready-to-paste <script> that calls the endpoint from any website. */
export function embedScriptSnippet(url: string): string {
  return [
    `<script>`,
    `  // Runs this n9n endpoint from your own site and returns the real execution result.`,
    `  async function n9nRun(payload) {`,
    `    const res = await fetch(${JSON.stringify(url)}, {`,
    `      method: "POST",`,
    `      headers: { "content-type": "application/json" },`,
    `      body: JSON.stringify(payload || {}),`,
    `    });`,
    `    return res.json();`,
    `  }`,
    `<\/script>`,
  ].join("\n");
}
