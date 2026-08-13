import { createFileRoute } from "@tanstack/react-router";

/**
 * Trigger worker. Called every minute by a database cron job; runs due
 * schedule triggers and polls polling triggers server-side.
 */
async function tick(request: Request) {
  const key = request.headers.get("apikey") ?? "";
  const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
  if (expected && key !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tickTriggers } = await import("@/lib/engine/scheduler.server");
  const result = await tickTriggers();
  return Response.json(result);
}

export const Route = createFileRoute("/api/public/hooks/tick")({
  server: {
    handlers: {
      POST: ({ request }) => tick(request),
      GET: ({ request }) => tick(request),
    },
  },
});
