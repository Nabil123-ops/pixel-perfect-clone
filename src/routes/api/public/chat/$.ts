import { createFileRoute } from "@tanstack/react-router";

/**
 * Public chat endpoint: POST /api/public/chat/<workflowId>
 * Body: { message: string, sessionId?: string }
 * Runs the workflow from its Chat Trigger and returns the last node output.
 */
async function handle(request: Request, splat: string) {
  const workflowId = splat.split("/").filter(Boolean)[0];
  if (!workflowId) return Response.json({ error: "Missing workflow id" }, { status: 400 });

  const { fetchWorkflow, runWorkflow } = await import("@/lib/engine/engine.server");
  const flow = await fetchWorkflow(workflowId).catch(() => null);
  if (!flow) return Response.json({ error: "Workflow not found" }, { status: 404 });
  if (!flow.active) return Response.json({ error: "Workflow is not active" }, { status: 409 });

  const trigger = (flow.nodes ?? []).find((n) => n.data.kind === "chatTrigger");
  if (!trigger) return Response.json({ error: "No chat trigger in this workflow" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const message = String(body["message"] ?? "").trim();
  if (!message) return Response.json({ error: "message is required" }, { status: 400 });
  const sessionId = String(body["sessionId"] ?? crypto.randomUUID());

  const result = await runWorkflow({
    workflowId: flow.id,
    mode: "webhook",
    trigger: [{ message, sessionId, receivedAt: new Date().toISOString() }],
    startNodeId: trigger.id,
    sessionId,
  });

  const last = result.steps.at(-1)?.items ?? [];
  return Response.json(
    {
      ok: result.ok,
      executionId: result.executionId,
      sessionId,
      error: result.error ?? null,
      reply:
        (last[0] && typeof last[0] === "object" && "output" in last[0]
          ? String((last[0] as Record<string, unknown>)["output"])
          : null) ?? null,
      data: last,
    },
    { status: result.ok ? 200 : 500 },
  );
}

export const Route = createFileRoute("/api/public/chat/$")({
  server: {
    handlers: {
      POST: ({ request, params }) => handle(request, params._splat ?? ""),
    },
  },
});
