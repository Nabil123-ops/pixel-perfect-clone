import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Clock, Loader2, Trash2, X } from "lucide-react";

import { PageHeader, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { deleteExecutions, getExecution, listExecutions } from "@/lib/api/executions.functions";
import { Hint } from "@/components/flow/Hint";
import { executionLink } from "@/lib/flow/endpoints";

export const Route = createFileRoute("/_authenticated/executions")({
  head: () => ({
    meta: [
      { title: "Executions — n9n" },
      {
        name: "description",
        content:
          "Full server-side history of every workflow run with per-node input, output, retries, logs and timings.",
      },
      { property: "og:title", content: "Executions — n9n" },
      {
        property: "og:description",
        content: "Persistent execution history for all your automations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutionsPage,
});

const MODE_LABEL: Record<string, string> = {
  manual: "Manual",
  webhook: "Webhook",
  schedule: "Schedule",
  poll: "Polling",
  sub: "Sub-workflow",
  error: "Error handler",
};

function ExecutionsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listExecutions);
  const clear = useServerFn(deleteExecutions);
  const [openId, setOpenId] = useState<string | null>(null);

  // Deep link support: /executions?run=<executionId> opens that run directly.
  useEffect(() => {
    const run = new URLSearchParams(window.location.search).get("run");
    if (run) setOpenId(run);
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["executions"],
    queryFn: () => list({ data: {} }).catch(() => []),
    retry: false,
    refetchInterval: 5000,
  });

  return (
    <Shell>
      <PageHeader
        title="Executions"
        subtitle="Every run is stored on the server — history survives refreshes and closed tabs."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await clear({ data: {} });
              void qc.invalidateQueries({ queryKey: ["executions"] });
            }}
          >
            <Trash2 className="mr-1.5 size-4" /> Clear history
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_auto] gap-3 border-b border-border bg-secondary/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Workflow</span>
            <span>Status</span>
            <span>Mode</span>
            <span>Duration</span>
            <span>Started</span>
          </div>

          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenId(r.id)}
              className="grid w-full grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_auto] items-center gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-0 hover:bg-secondary/40"
            >
              <span className="truncate font-medium">{r.workflowName || "Untitled"}</span>
              <span
                className={`flex items-center gap-1.5 text-xs ${
                  r.status === "success"
                    ? "text-primary"
                    : r.status === "running"
                      ? "text-muted-foreground"
                      : "text-destructive"
                }`}
              >
                {r.status === "success" ? (
                  <CircleCheck className="size-3.5" />
                ) : r.status === "running" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CircleX className="size-3.5" />
                )}
                {r.status === "success" ? "Success" : r.status === "running" ? "Running" : "Failed"}
              </span>
              <span className="text-xs text-muted-foreground">{MODE_LABEL[r.mode] ?? r.mode}</span>
              <span className="font-mono text-xs text-muted-foreground">{r.ms}ms</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="size-3.5" /> {new Date(r.startedAt).toLocaleString()}
              </span>
            </button>
          ))}

          {!isLoading && rows.length === 0 && (
            <p className="p-12 text-center text-sm text-muted-foreground">
              No executions yet — open a workflow and press Run, or activate a trigger.
            </p>
          )}
          {isLoading && <p className="p-12 text-center text-sm text-muted-foreground">Loading…</p>}
        </div>
      </div>

      {openId && <ExecutionDrawer id={openId} onClose={() => setOpenId(null)} />}
    </Shell>
  );
}

function ExecutionDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(getExecution);
  const [step, setStep] = useState(0);
  const { data: run } = useQuery({
    queryKey: ["execution", id],
    queryFn: () => get({ data: { id } }),
    refetchInterval: (query) => query.state.data?.status === "running" ? 750 : false,
  });
  const current = run?.steps[step];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-sm">
      <button className="flex-1" aria-label="Close" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[720px] flex-col border-l border-border bg-card">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-display font-semibold">{run?.workflowName ?? "Execution"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {run
                ? `${MODE_LABEL[run.mode] ?? run.mode} · ${run.steps.length} nodes · ${run.ms}ms · ${new Date(run.startedAt).toLocaleString()}`
                : "Loading…"}
            </p>
            {run?.status === "running" && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="size-3 animate-spin" /> Live logs update as each node finishes
              </p>
            )}
            {run?.error && <p className="mt-1 text-xs text-destructive">{run.error}</p>}
          </div>
          <div className="flex items-center gap-2">
            {run && (
              <Hint text="Permanent link to this execution. Share it or open it from any other system.">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(executionLink("production", id))}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Copy execution link
                </button>
              </Hint>
            )}
            {run?.workflowId && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/workflow/$id" params={{ id: run.workflowId }}>
                  Open workflow
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
          <div className="overflow-y-auto border-r border-border">
            {(run?.steps ?? []).map((s, i) => (
              <button
                key={`${s.nodeId}-${i}`}
                onClick={() => setStep(i)}
                className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-xs ${
                  i === step ? "bg-secondary" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.ms}ms · {s.attempts} try{s.attempts > 1 ? "s" : ""}
                  </span>
                </span>
                <span className={s.status === "error" ? "text-destructive" : "text-primary"}>
                  {s.status === "error" ? "err" : s.items.length}
                </span>
              </button>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto p-4 text-xs">
            {current ? (
              <div className="space-y-4">
                {current.error && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
                    {current.error}
                  </p>
                )}
                {current.logs.length > 0 && (
                  <section>
                    <h3 className="mb-1 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Logs
                    </h3>
                    <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
                      {current.logs.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <section>
                  <h3 className="mb-1 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Input ({current.input.length})
                  </h3>
                  <pre className="overflow-auto rounded-md bg-secondary/50 p-2 font-mono text-[11px]">
                    {JSON.stringify(current.input, null, 2)}
                  </pre>
                </section>
                <section>
                  <h3 className="mb-1 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Output ({current.items.length})
                  </h3>
                  <pre className="overflow-auto rounded-md bg-secondary/50 p-2 font-mono text-[11px]">
                    {JSON.stringify(current.items, null, 2)}
                  </pre>
                </section>
              </div>
            ) : (
              <p className="text-muted-foreground">Select a node to inspect its data.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
