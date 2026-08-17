import { createFileRoute } from "@tanstack/react-router";
import type { NodeModule, ParamField } from "@/lib/nodes/types";

/**
 * Real, hosted, high-end-styled test page for ANY node in a workflow:
 *
 *   GET  /api/public/node/<workflowId>/<nodeId>?key=<execKey>
 *        Renders an actual HTML page with a real form built from that
 *        node's field schema (whatever it declares in the registry),
 *        pre-filled with its saved parameters.
 *
 *   POST same URL
 *        Runs that exact node for real (real HTTP calls, real credentials,
 *        through the same engine "Test this node" uses) with the submitted
 *        values, and renders the real result.
 *
 * This one route covers every node kind registered in `lib/nodes/registry.ts`
 * (currently ~1,076) because every node shares the same `NodeModule` shape
 * (`fields`, `defaults`, `execute`) — there is nothing kind-specific to
 * hand-author per node, and hard-coding 1,076 near-identical files would
 * immediately drift from the registry that is the actual source of truth.
 * New nodes registered in the future automatically get a working page here
 * with zero extra code.
 */

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GROUP_COLORS: Record<string, string> = {
  Triggers: "#f59e0b",
  Core: "#6366f1",
  Logic: "#8b5cf6",
  Data: "#0ea5e9",
  Files: "#14b8a6",
  Flow: "#6366f1",
  AI: "#ec4899",
  "AI Models": "#ec4899",
  "AI Memory": "#ec4899",
  "AI Tools": "#ec4899",
  "AI Retrieval": "#ec4899",
  Communication: "#22c55e",
  Databases: "#0ea5e9",
  "Dev & Ops": "#64748b",
  "CRM & Commerce": "#f97316",
  Marketing: "#f97316",
  "Social Media": "#22c55e",
  Productivity: "#0ea5e9",
  "Forms & Surveys": "#f59e0b",
  Analytics: "#0ea5e9",
  "HR & Finance": "#64748b",
  "Cloud & Storage": "#14b8a6",
  Utilities: "#64748b",
};

function colorFor(group: string): string {
  return GROUP_COLORS[group] ?? "#6366f1";
}

function pageShell(title: string, accent: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; --accent: ${accent}; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: #0b0c10;
    background-image: radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    padding: 40px 20px; display: flex; justify-content: center; color: #e5e7eb;
  }
  .wrap { width: 100%; max-width: 640px; }
  .card {
    background: #16171d; border-radius: 16px; border: 1px solid #24262f;
    box-shadow: 0 1px 0 rgba(255,255,255,.03) inset, 0 20px 60px rgba(0,0,0,.45);
    padding: 30px 30px 26px; margin-bottom: 16px;
  }
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
  .badge {
    width: 40px; height: 40px; border-radius: 11px; flex: none;
    background: color-mix(in srgb, var(--accent) 22%, #16171d);
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px; color: var(--accent);
  }
  .group-pill {
    display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent);
    padding: 3px 9px; border-radius: 999px; margin-bottom: 8px;
  }
  h1 { font-size: 21px; margin: 0; font-weight: 650; letter-spacing: -.01em; color: #f5f5f7; }
  p.desc { color: #9ca3af; font-size: 13.5px; margin: 10px 0 0; line-height: 1.55; }
  .kind { color: #6b7280; font-size: 11px; font-family: ui-monospace, Menlo, monospace; margin-top: 6px; }
  .warn {
    margin-top: 16px; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.5;
    background: rgba(245, 158, 11, .1); border: 1px solid rgba(245, 158, 11, .3); color: #fbbf24;
  }
  .stub {
    margin-top: 16px; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.5;
    background: rgba(239, 68, 68, .08); border: 1px solid rgba(239, 68, 68, .28); color: #f87171;
  }
  fieldset { border: none; padding: 0; margin: 0; }
  label { display: block; font-size: 12.5px; font-weight: 600; margin: 0 0 6px; color: #d1d5db; }
  .help { font-weight: 400; color: #6b7280; font-size: 11.5px; margin-top: 4px; }
  .field { margin-bottom: 16px; }
  input, textarea, select {
    width: 100%; padding: 10px 12px; border-radius: 9px; border: 1px solid #2c2e38;
    font-size: 13.5px; font-family: inherit; background: #0f1015; color: #e5e7eb;
  }
  textarea, input[type="text"].code, .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }
  textarea { min-height: 84px; resize: vertical; }
  input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
  select { appearance: none; background-image: linear-gradient(45deg, transparent 50%, #9ca3af 50%), linear-gradient(135deg, #9ca3af 50%, transparent 50%); background-position: calc(100% - 18px) center, calc(100% - 13px) center; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
  button {
    width: 100%; margin-top: 4px; padding: 12px 16px; border-radius: 10px; border: none;
    background: var(--accent); color: #0b0c10; font-size: 14px; font-weight: 700; cursor: pointer;
    letter-spacing: -.01em;
  }
  button:hover { filter: brightness(1.08); }
  .ok { color: #34d399; }
  .err { color: #f87171; }
  .meta { display: flex; gap: 14px; font-size: 11.5px; color: #6b7280; margin-top: 14px; flex-wrap: wrap; }
  .meta b { color: #d1d5db; font-weight: 600; }
  pre { background: #0f1015; border: 1px solid #24262f; border-radius: 10px; padding: 14px; font-size: 12px; overflow: auto; color: #d1d5db; line-height: 1.6; }
  .foot { text-align: center; font-size: 11px; color: #4b5563; margin-top: 4px; }
  a { color: var(--accent); }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .back { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #9ca3af; text-decoration: none; margin-bottom: 14px; }
</style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

function inputHtml(field: ParamField, value: unknown): string {
  const name = escapeHtml(field.key);
  const v = value === undefined || value === null ? "" : String(value);
  const help = field.help ? `<p class="help">${escapeHtml(field.help)}</p>` : "";
  const opAttr = field.operations?.length
    ? ` data-operations="${escapeHtml(field.operations.join("|"))}"`
    : "";

  if (field.type === "select") {
    const opts = (field.options ?? [])
      .map((o) => `<option value="${escapeHtml(o)}"${o === v ? " selected" : ""}>${escapeHtml(o)}</option>`)
      .join("");
    return `<div class="field" data-field="${name}"${opAttr}><label for="f_${name}">${escapeHtml(field.label)}</label><select id="f_${name}" name="${name}">${opts}</select>${help}</div>`;
  }
  if (field.type === "textarea" || field.type === "code") {
    return `<div class="field" data-field="${name}"${opAttr}><label for="f_${name}">${escapeHtml(field.label)}</label><textarea class="code" id="f_${name}" name="${name}" placeholder="${escapeHtml(field.placeholder ?? "")}">${escapeHtml(v)}</textarea>${help}</div>`;
  }
  const type = field.type === "number" ? "number" : "text";
  return `<div class="field" data-field="${name}"${opAttr}><label for="f_${name}">${escapeHtml(field.label)}</label><input id="f_${name}" name="${name}" type="${type}" value="${escapeHtml(v)}" placeholder="${escapeHtml(field.placeholder ?? "")}" /></div>`;
}

/** Vanilla JS: only show fields relevant to the currently selected Operation, same rule the in-app inspector uses. */
const OPERATION_SCRIPT = `
<script>
(function () {
  var opSelect = document.querySelector('select[name="operation"]');
  function sync() {
    var current = opSelect ? opSelect.value : null;
    document.querySelectorAll('[data-operations]').forEach(function (el) {
      var ops = el.getAttribute('data-operations').split('|');
      el.style.display = !current || ops.indexOf(current) !== -1 ? '' : 'none';
    });
  }
  if (opSelect) { opSelect.addEventListener('change', sync); sync(); }
})();
</script>`;

async function loadNode(workflowId: string, nodeId: string) {
  const { fetchWorkflow } = await import("@/lib/engine/engine.server");
  const { getNode } = await import("@/lib/nodes/registry");
  const flow = await fetchWorkflow(workflowId).catch(() => null);
  if (!flow) return { flow: null, node: null, mod: null } as const;
  const node = (flow.nodes ?? []).find((n) => n.id === nodeId) ?? null;
  const mod: NodeModule | undefined = node ? getNode(node.data.kind) : undefined;
  return { flow, node, mod: mod ?? null } as const;
}

async function handleGet(workflowId: string, nodeId: string, key: string): Promise<Response> {
  const { verifyExecKey } = await import("@/lib/exec-key.server");
  if (!(await verifyExecKey(workflowId, key))) {
    return pageShell("Unauthorized", "#f87171", `<div class="card"><h1 class="err">Invalid or missing key</h1><p class="desc">This page needs the workflow's execution key. Copy the link from the node's inspector panel in the editor.</p></div>`, 401);
  }

  const { flow, node, mod } = await loadNode(workflowId, nodeId);
  if (!flow) return pageShell("Not found", "#f87171", `<div class="card"><h1 class="err">Workflow not found</h1></div>`, 404);
  if (!node || !mod) return pageShell("Not found", "#f87171", `<div class="card"><h1 class="err">Node not found</h1><p class="desc">This node doesn't exist in "${escapeHtml(flow.name)}" anymore.</p></div>`, 404);

  const accent = colorFor(mod.group);
  const params = (node.data.params ?? {}) as Record<string, unknown>;
  const hasCredential = Boolean(node.data.credentials?.length || node.data.credential);
  const needsCredential = Boolean(mod.credentialRequired) && !hasCredential;

  const fieldsHtml = mod.fields.map((f) => inputHtml(f, params[f.key] ?? mod.defaults[f.key])).join("\n");

  const body = `
    <a class="back" href="javascript:history.back()">&larr; Back</a>
    <div class="card">
      <div class="group-pill">${escapeHtml(mod.group)}</div>
      <div class="head">
        <div class="badge">${escapeHtml(mod.name.slice(0, 1))}</div>
        <div>
          <h1>${escapeHtml(node.data.label || mod.name)}</h1>
        </div>
      </div>
      <p class="desc">${escapeHtml(mod.description)}</p>
      <p class="kind">kind: ${escapeHtml(mod.kind)} &middot; workflow: ${escapeHtml(flow.name)}</p>
      ${mod.stub ? `<div class="stub"><strong>Partially implemented:</strong> ${escapeHtml(mod.stub)}</div>` : ""}
      ${needsCredential ? `<div class="warn">This node needs a credential to do real work and none is attached yet. Attach one on the Credentials screen, then reopen this page.</div>` : ""}
    </div>

    <form method="POST" class="card">
      <fieldset>
        ${fieldsHtml || `<p class="desc">This node takes no parameters — running it will call <code>execute()</code> as-is.</p>`}
      </fieldset>
      <button type="submit">Run this node for real</button>
      <p class="foot" style="margin-top:12px;text-align:left;">Runs through the real engine — real HTTP calls, real credentials, real response. Nothing here is simulated.</p>
    </form>
  `;
  return pageShell(`${mod.name} · test`, accent, body + OPERATION_SCRIPT);
}

async function handlePost(request: Request, workflowId: string, nodeId: string, key: string): Promise<Response> {
  const { verifyExecKey } = await import("@/lib/exec-key.server");
  if (!(await verifyExecKey(workflowId, key))) {
    return Response.json({ error: "Invalid or missing key" }, { status: 401 });
  }

  const { rateLimit, clientIp, tooManyRequests } = await import("@/lib/rate-limit.server");
  const gate = await rateLimit(`node-test:ip:${clientIp(request)}`, 60, 60);
  if (!gate.allowed) return tooManyRequests(gate);

  const { flow, node, mod } = await loadNode(workflowId, nodeId);
  if (!flow || !node || !mod) {
    return pageShell("Not found", "#f87171", `<div class="card"><h1 class="err">Node not found</h1></div>`, 404);
  }

  const form = await request.formData();
  const overrides: Record<string, unknown> = {};
  for (const field of mod.fields) {
    if (!form.has(field.key)) continue;
    const raw = String(form.get(field.key) ?? "");
    overrides[field.key] = field.type === "number" ? (raw === "" ? 0 : Number(raw)) : raw;
  }

  const { runWorkflow } = await import("@/lib/engine/engine.server");
  const result = await runWorkflow({
    workflowId: flow.id,
    mode: "manual",
    trigger: [],
    onlyNodeId: node.id,
    paramOverrides: overrides,
    persist: false,
  });

  const accent = colorFor(mod.group);
  const step = result.steps[0];
  const statusLine = result.ok
    ? `<h1 class="ok">Ran successfully</h1>`
    : `<h1 class="err">Run failed</h1>`;
  const errorBlock = result.error || step?.error
    ? `<pre class="err">${escapeHtml(step?.error ?? result.error)}</pre>`
    : "";
  const logsBlock = step?.logs?.length
    ? `<p class="help" style="margin-top:14px;">Logs</p><pre>${escapeHtml(step.logs.join("\n"))}</pre>`
    : "";
  const itemsBlock = step
    ? `<p class="help" style="margin-top:14px;">Output (${step.items.length} item${step.items.length === 1 ? "" : "s"})</p><pre>${escapeHtml(JSON.stringify(step.items, null, 2))}</pre>`
    : "";

  const body = `
    <a class="back" href="javascript:history.back()">&larr; Back to form</a>
    <div class="card">
      ${statusLine}
      <div class="meta">
        <span><b>${escapeHtml(mod.name)}</b></span>
        <span>${result.ms}ms</span>
        <span>${escapeHtml(step?.attempts ?? 1)} attempt(s)</span>
      </div>
      ${errorBlock}
      ${logsBlock}
      ${itemsBlock}
    </div>
  `;
  return pageShell(`${mod.name} · result`, accent, body, result.ok ? 200 : 500);
}

export const Route = createFileRoute("/api/public/node/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        const [workflowId, nodeId] = (params._splat ?? "").split("/").filter(Boolean);
        const key = new URL(request.url).searchParams.get("key") ?? "";
        if (!workflowId || !nodeId)
          return pageShell("Missing parameters", "#f87171", `<div class="card"><h1 class="err">Missing workflow or node id</h1></div>`, 400);
        return handleGet(workflowId, nodeId, key);
      },
      POST: ({ request, params }) => {
        const [workflowId, nodeId] = (params._splat ?? "").split("/").filter(Boolean);
        const key = new URL(request.url).searchParams.get("key") ?? "";
        if (!workflowId || !nodeId) return Response.json({ error: "Missing workflow or node id" }, { status: 400 });
        return handlePost(request, workflowId, nodeId, key);
      },
    },
  },
});
