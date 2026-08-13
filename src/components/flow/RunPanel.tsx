import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { RunResult } from "@/lib/flow/types";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/flow/Hint";
import { executionLink } from "@/lib/flow/endpoints";

type ExecSummary = { id: string; status: string; ms: number; startedAt: string };

export function RunPanel({
  run,
  open,
  onToggle,
  runs = [],
  onSelectRun,
}: {
  run: RunResult | null;
  open: boolean;
  onToggle: () => void;
  runs?: ExecSummary[];
  onSelectRun?: (id: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"data" | "terminal">("data");
  const step = run?.steps[selected];

  const terminal = (run?.steps ?? []).flatMap((s) => [
    `[${s.status.toUpperCase()}] ${s.label} · ${s.ms}ms · ${s.attempts} attempt(s) · ${s.items.length} item(s)`,
    ...s.logs.map((l) => `    ${l}`),
    ...(s.error ? [`    ! ${s.error}`] : []),
  ]);

  return (
    <div className="ff-panel rounded-none border-x-0 border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-3 text-sm">
          <span className="font-display font-semibold">Execution</span>
          {run ? (
            <span className={run.ok ? "text-primary" : "text-destructive"}>
              {run.ok ? "success" : "error"} · {run.steps.length} nodes · {run.ms}ms
            </span>
          ) : (
            <span className="text-muted-foreground">no runs yet — press Run</span>
          )}
        </span>
        {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>

      {run?.executionId && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Execution link
          </span>
          <Hint text="Permanent link to this run. Open or share it to inspect every node's input, output and logs.">
            <a
              href={executionLink("test", run.executionId)}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-[11px] text-primary hover:underline"
            >
              {executionLink("test", run.executionId)}
            </a>
          </Hint>
          <Hint text="Copies the shareable execution link.">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(executionLink("production", run.executionId))}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Copy production link
            </button>
          </Hint>
        </div>
      )}

      {open && runs.length > 0 && onSelectRun && (
        <div className="flex items-center gap-2 overflow-x-auto border-t border-border px-4 py-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Past runs
          </span>
          {runs.slice(0, 12).map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRun(r.id)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
                r.status === "error"
                  ? "border-destructive/40 text-destructive"
                  : "border-primary/40 text-primary"
              }`}
            >
              {new Date(r.startedAt).toLocaleTimeString()} · {r.ms}ms
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="grid h-[240px] grid-cols-[220px_1fr] border-t border-border">
          <div className="overflow-y-auto border-r border-border">
            {(run?.steps ?? []).map((s, i) => (
              <Button
                key={`${s.nodeId}-${i}`}
                variant="ghost"
                onClick={() => setSelected(i)}
                className={`h-auto w-full justify-between rounded-none px-3 py-2 text-left text-xs ${
                  i === selected ? "bg-secondary" : ""
                }`}
              >
                <span className="truncate">{s.label}</span>
                <span
                  className={
                    s.status === "success"
                      ? "text-primary"
                      : s.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {s.status === "error" ? "err" : `${s.items.length}`}
                </span>
              </Button>
            ))}
            {!run && <p className="p-3 text-xs text-muted-foreground">Run the workflow to inspect data.</p>}
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1 border-b border-border px-2 py-1">
              {(["data", "terminal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-2.5 py-1 text-[11px] capitalize ${
                    tab === t ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "data" ? (
              <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {step
                  ? step.error
                    ? `Error: ${step.error}`
                    : JSON.stringify(step.items, null, 2)
                  : "// output data appears here"}
              </pre>
            ) : (
              <pre className="flex-1 overflow-auto bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                {terminal.length
                  ? terminal.join("\n")
                  : "$ waiting for an execution…"}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
