import { createFileRoute } from "@tanstack/react-router";

/**
 * Real hosted form endpoint: /api/public/forms/<workflowId>/<path>
 *
 *   GET  -> renders an actual HTML <form> built from the Form Trigger node's
 *           configured fields, so anyone can open it in a browser and submit
 *           real data (not just POST JSON with curl).
 *   POST -> takes the real submission (form-encoded or JSON), runs the
 *           workflow from that trigger, and shows a real result page (or
 *           JSON, for programmatic/XHR submissions).
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseFields(raw: unknown): string[] {
  return String(raw ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Best-effort input type from a field name, so email/number fields validate for real. */
function inputTypeFor(field: string): string {
  const f = field.toLowerCase();
  if (f.includes("email")) return "email";
  if (f.includes("phone") || f.includes("tel")) return "tel";
  if (f.includes("url") || f.includes("website") || f.includes("link")) return "url";
  if (f.includes("date")) return "date";
  if (f.includes("number") || f.includes("amount") || f.includes("qty") || f.includes("count"))
    return "number";
  if (f === "message" || f.includes("comment") || f.includes("note") || f.includes("description"))
    return "textarea";
  return "text";
}

function pageShell(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #f6f6f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 440px; background: #fff; border-radius: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06);
    padding: 32px 28px; border: 1px solid rgba(0,0,0,.06);
  }
  h1 { font-size: 19px; margin: 0 0 6px; font-weight: 650; }
  p.sub { color: #6b7280; font-size: 13px; margin: 0 0 22px; line-height: 1.5; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 0 0 6px; color: #1f2937; }
  .field { margin-bottom: 16px; }
  input, textarea {
    width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #d1d5db;
    font-size: 14px; font-family: inherit; background: #fff; color: #111827;
  }
  input:focus, textarea:focus { outline: 2px solid #6366f1; outline-offset: 1px; border-color: #6366f1; }
  textarea { min-height: 88px; resize: vertical; }
  button {
    width: 100%; margin-top: 6px; padding: 11px 16px; border-radius: 8px; border: none;
    background: #111827; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  button:hover { background: #000; }
  .ok { color: #059669; }
  .err { color: #dc2626; }
  .foot { margin-top: 18px; font-size: 11px; color: #9ca3af; text-align: center; }
  pre { background: #f3f4f6; border-radius: 8px; padding: 12px; font-size: 12px; overflow: auto; }
</style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handleGet(workflowId: string, path: string): Promise<Response> {
  const { fetchWorkflow } = await import("@/lib/engine/engine.server");
  const flow = await fetchWorkflow(workflowId).catch(() => null);
  if (!flow) return pageShell("Not found", `<h1>Form not found</h1><p class="sub">This workflow doesn't exist.</p>`, 404);

  const trigger = (flow.nodes ?? []).find(
    (n) =>
      n.data.kind === "formTrigger" &&
      String(n.data.params?.["path"] ?? "").replace(/^\/+/, "") === path,
  );
  if (!trigger)
    return pageShell(
      "Not found",
      `<h1>Form not found</h1><p class="sub">No form trigger is published at "/${escapeHtml(path)}" on this workflow.</p>`,
      404,
    );

  const fields = parseFields(trigger.data.params?.["formFields"] ?? "name, email");
  const title = String(trigger.data.params?.["title"] ?? flow.name ?? "Form");

  const inputs = fields
    .map((field) => {
      const type = inputTypeFor(field);
      const label = field.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const name = escapeHtml(field);
      if (type === "textarea") {
        return `<div class="field"><label for="${name}">${escapeHtml(label)}</label><textarea id="${name}" name="${name}"></textarea></div>`;
      }
      return `<div class="field"><label for="${name}">${escapeHtml(label)}</label><input id="${name}" name="${name}" type="${type}" /></div>`;
    })
    .join("\n");

  const body = `
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">Real submissions here run the "${escapeHtml(flow.name)}" workflow live.${flow.active ? "" : ' <strong class="err">This workflow is currently inactive — submissions will be rejected until you activate it.</strong>'}</p>
    <form method="POST">
      ${inputs}
      <button type="submit">Submit</button>
    </form>
    <p class="foot">Hosted form · workflow ${escapeHtml(flow.id)}</p>
  `;
  return pageShell(title, body);
}

async function handlePost(request: Request, workflowId: string, path: string): Promise<Response> {
  const { rateLimit, clientIp, tooManyRequests } = await import("@/lib/rate-limit.server");
  const ipGate = await rateLimit(`form:ip:${clientIp(request)}`, 60, 60);
  if (!ipGate.allowed) return tooManyRequests(ipGate);

  const { fetchWorkflow, runWorkflow } = await import("@/lib/engine/engine.server");
  const flow = await fetchWorkflow(workflowId).catch(() => null);
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");

  if (!flow) {
    return wantsJson
      ? Response.json({ error: "Workflow not found" }, { status: 404 })
      : pageShell("Not found", `<h1>Form not found</h1>`, 404);
  }

  const trigger = (flow.nodes ?? []).find(
    (n) =>
      n.data.kind === "formTrigger" &&
      String(n.data.params?.["path"] ?? "").replace(/^\/+/, "") === path,
  );
  if (!trigger) {
    return wantsJson
      ? Response.json({ error: `No form trigger for "${path}"` }, { status: 404 })
      : pageShell("Not found", `<h1>Form not found</h1>`, 404);
  }

  if (!flow.active) {
    return wantsJson
      ? Response.json({ error: "Workflow is not active" }, { status: 409 })
      : pageShell(
          "Inactive",
          `<h1 class="err">Form not accepting submissions</h1><p class="sub">This workflow is inactive. Activate it in the builder to accept real submissions.</p>`,
          409,
        );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) payload[k] = typeof v === "string" ? v : v.name;
  }

  const result = await runWorkflow({
    workflowId: flow.id,
    mode: "webhook",
    trigger: [{ ...payload, receivedAt: new Date().toISOString() }],
    startNodeId: trigger.id,
  });

  if (wantsJson) {
    return Response.json(
      { ok: result.ok, executionId: result.executionId, error: result.error ?? null },
      { status: result.ok ? 200 : 500 },
    );
  }

  const body = result.ok
    ? `<h1 class="ok">Thanks — submitted</h1><p class="sub">Your response was received and the workflow ran for real. Execution <code>${escapeHtml(result.executionId ?? "")}</code>.</p>`
    : `<h1 class="err">Something went wrong</h1><p class="sub">${escapeHtml(result.error ?? "The workflow failed to run.")}</p>`;
  return pageShell("Submitted", body, result.ok ? 200 : 500);
}

export const Route = createFileRoute("/api/public/forms/$")({
  server: {
    handlers: {
      GET: ({ params }) => {
        const [workflowId, ...rest] = (params._splat ?? "").split("/").filter(Boolean);
        if (!workflowId) return pageShell("Missing workflow", `<h1>Missing workflow id</h1>`, 400);
        return handleGet(workflowId, rest.join("/"));
      },
      POST: ({ request, params }) => {
        const [workflowId, ...rest] = (params._splat ?? "").split("/").filter(Boolean);
        if (!workflowId) return Response.json({ error: "Missing workflow id" }, { status: 400 });
        return handlePost(request, workflowId, rest.join("/"));
      },
    },
  },
});
