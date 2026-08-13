import { createFileRoute } from "@tanstack/react-router";

/**
 * Real webhook entry point: /api/public/webhook/<workflowId>/<path>
 * Loads the workflow, verifies it is active and has a matching webhook trigger,
 * then executes it server-side with the incoming request as trigger data.
 */
async function handle(request: Request, splat: string) {
  const [workflowId, ...rest] = splat.split("/").filter(Boolean);
  const path = rest.join("/");
  if (!workflowId) return Response.json({ error: "Missing workflow id" }, { status: 400 });

  const { rateLimit, clientIp, tooManyRequests } = await import("@/lib/rate-limit.server");

  const ipGate = await rateLimit(`webhook:ip:${clientIp(request)}`, 120, 60);
  if (!ipGate.allowed) return tooManyRequests(ipGate);
  const flowGate = await rateLimit(`webhook:flow:${workflowId}`, 300, 60);
  if (!flowGate.allowed) return tooManyRequests(flowGate);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) {
    return Response.json({ error: "Payload too large (1 MB limit)" }, { status: 413 });
  }

  const { fetchWorkflow, runWorkflow } = await import("@/lib/engine/engine.server");
  const flow = await fetchWorkflow(workflowId).catch(() => null);
  if (!flow) return Response.json({ error: "Workflow not found" }, { status: 404 });
  if (!flow.active) return Response.json({ error: "Workflow is not active" }, { status: 409 });

  const trigger = (flow.nodes ?? []).find(
    (n) =>
      n.data.kind === "webhookTrigger" &&
      String(n.data.params?.["path"] ?? "").replace(/^\/+/, "") === path,
  );
  if (!trigger) return Response.json({ error: `No webhook trigger for "${path}"` }, { status: 404 });

  const expectedMethod = String(trigger.data.params?.["method"] ?? "POST").toUpperCase();
  if (expectedMethod !== "ANY" && request.method !== expectedMethod) {
    return Response.json({ error: `Expected ${expectedMethod}` }, { status: 405 });
  }

  const secret = String(trigger.data.params?.["secret"] ?? "");
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const url = new URL(request.url);
  const raw = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
  let body: unknown = raw;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    /* keep raw text body */
  }

  const payload = {
    method: request.method,
    path,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(request.headers.entries()),
    body,
    receivedAt: new Date().toISOString(),
  };

  const respondMode = String(trigger.data.params?.["respond"] ?? "onReceived");
  if (respondMode === "onReceived") {
    void runWorkflow({
      workflowId: flow.id,
      mode: "webhook",
      trigger: [payload],
      startNodeId: trigger.id,
    }).catch(() => undefined);
    return Response.json({ received: true, workflow: flow.name });
  }

  const result = await runWorkflow({
    workflowId: flow.id,
    mode: "webhook",
    trigger: [payload],
    startNodeId: trigger.id,
  });
  return Response.json(
    {
      ok: result.ok,
      executionId: result.executionId,
      error: result.error ?? null,
      data: result.steps.at(-1)?.items ?? [],
    },
    { status: result.ok ? 200 : 500 },
  );
}

export const Route = createFileRoute("/api/public/webhook/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params._splat ?? ""),
      POST: ({ request, params }) => handle(request, params._splat ?? ""),
      PUT: ({ request, params }) => handle(request, params._splat ?? ""),
      PATCH: ({ request, params }) => handle(request, params._splat ?? ""),
      DELETE: ({ request, params }) => handle(request, params._splat ?? ""),
    },
  },
});
