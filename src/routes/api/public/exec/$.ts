import { createFileRoute } from "@tanstack/react-router";

/**
 * Real execution endpoint.
 *
 *   POST /api/public/exec/<workflowId>?key=<execKey>            -> runs the whole workflow
 *   POST /api/public/exec/<workflowId>/<nodeId>?key=<execKey>   -> runs one node / trigger
 *
 * The key is an HMAC of the workflow id, shown in the editor for both the
 * test and the production origin. The JSON body (or ?input= query) becomes
 * the trigger payload.
 */
async function handle(request: Request, splat: string) {
  const [workflowId, nodeId] = splat.split("/").filter(Boolean);
  if (!workflowId) return Response.json({ error: "Missing workflow id" }, { status: 400 });

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? request.headers.get("x-exec-key") ?? "";

  const { rateLimit, clientIp, tooManyRequests } = await import("@/lib/rate-limit.server");
  const gate = await rateLimit(`exec:ip:${clientIp(request)}`, 60, 60);
  if (!gate.allowed) return tooManyRequests(gate);

  const { verifyExecKey } = await import("@/lib/exec-key.server");
  if (!(await verifyExecKey(workflowId, key))) {
    return Response.json({ error: "Invalid execution key" }, { status: 401 });
  }

  let trigger: unknown[] = [];
  if (request.method !== "GET" && request.method !== "HEAD") {
    const raw = await request.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        trigger = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        trigger = [{ body: raw }];
      }
    }
  } else {
    const query = Object.fromEntries(url.searchParams.entries());
    delete (query as Record<string, string>)["key"];
    if (Object.keys(query).length) trigger = [query];
  }

  const { fetchWorkflow, runWorkflow } = await import("@/lib/engine/engine.server");
  const flow = await fetchWorkflow(workflowId).catch(() => null);
  if (!flow) return Response.json({ error: "Workflow not found" }, { status: 404 });

  if (nodeId && !(flow.nodes ?? []).some((n) => n.id === nodeId)) {
    return Response.json({ error: "Node not found in this workflow" }, { status: 404 });
  }

  const result = await runWorkflow({
    workflowId: flow.id,
    mode: "webhook",
    trigger: trigger as never,
    ...(nodeId ? { onlyNodeId: nodeId } : {}),
  });

  return Response.json(
    {
      ok: result.ok,
      workflow: { id: flow.id, name: flow.name },
      ...(nodeId ? { nodeId } : {}),
      executionId: result.executionId,
      executionUrl: result.executionId
        ? `${url.origin}/executions?run=${result.executionId}`
        : null,
      ms: result.ms,
      error: result.error ?? null,
      steps: result.steps.map((s) => ({
        nodeId: s.nodeId,
        label: s.label,
        status: s.status,
        ms: s.ms,
        attempts: s.attempts,
        items: s.items.length,
        logs: s.logs,
        error: s.error ?? null,
      })),
      data: result.steps.at(-1)?.items ?? [],
    },
    { status: result.ok ? 200 : 500 },
  );
}

export const Route = createFileRoute("/api/public/exec/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params._splat ?? ""),
      POST: ({ request, params }) => handle(request, params._splat ?? ""),
      PUT: ({ request, params }) => handle(request, params._splat ?? ""),
    },
  },
});
