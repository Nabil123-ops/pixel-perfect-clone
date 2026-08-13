import { createFileRoute } from "@tanstack/react-router";

const startedAt = Date.now();

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        let database: "ok" | "degraded" = "degraded";
        let latencyMs = -1;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const began = Date.now();
          const { error } = await supabaseAdmin
            .from("workflows")
            .select("id", { count: "exact", head: true })
            .limit(1);
          latencyMs = Date.now() - began;
          if (!error) database = "ok";
        } catch {
          database = "degraded";
        }

        return Response.json(
          {
            status: database === "ok" ? "ok" : "degraded",
            service: "n9n",
            database,
            databaseLatencyMs: latencyMs,
            uptimeMs: Date.now() - startedAt,
            time: new Date().toISOString(),
          },
          {
            status: database === "ok" ? 200 : 503,
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
