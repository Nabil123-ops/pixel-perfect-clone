import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  CircleCheck,
  CircleX,
  CircleDashed,
  Loader2,
} from "lucide-react";
import { specOf } from "@/lib/flow/catalog";
import { NodeIcon } from "./NodeIcon";
import type { FlowNodeData } from "@/lib/flow/types";
import { Hint } from "@/components/flow/Hint";

export type NodeStatus = "idle" | "running" | "success" | "error" | "skipped";

const STATUS_ICON: Record<string, typeof CircleCheck> = {
  success: CircleCheck,
  error: CircleX,
  skipped: CircleDashed,
};

export function FlowNodeCard({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData & { status?: NodeStatus; itemCount?: number };
  const spec = specOf(nodeData.kind);
  const status = nodeData.status ?? "idle";
  const StatusIcon = status !== "idle" && status !== "running" ? STATUS_ICON[status] : null;

  const statusText =
    status === "idle"
      ? "Not run yet."
      : status === "running"
        ? "Running on the server right now."
        : status === "success"
          ? `Last run succeeded with ${nodeData.itemCount ?? 0} item(s).`
          : status === "error"
            ? "Last run failed — open the execution panel for the error."
            : "Skipped on the last run.";

  return (
    <Hint
      side="top"
      title={spec.name}
      text={`${spec.description} ${statusText} Click to open its settings, test URL and production URL.`}
    >
    <div
      className={[
        "w-[228px] rounded-xl border bg-card transition-all",
        selected ? "border-primary ff-glow" : "border-border",
        status === "running" ? "ff-running border-primary" : "",
        status === "error" ? "border-destructive" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5 border-b border-border/70 px-3 py-2.5">
        <span
          className={[
            "grid size-8 shrink-0 place-items-center rounded-lg",
            spec.group === "Triggers" ? "bg-primary/20 text-primary" : "bg-accent/15 text-accent",
          ].join(" ")}
        >
          <NodeIcon icon={spec.icon} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{nodeData.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{spec.name}</p>
        </div>
        {status === "running" && <Loader2 className="size-4 animate-spin text-primary" />}
        {StatusIcon && (
          <StatusIcon
            className={[
              "size-4",
              status === "success" ? "text-primary" : status === "error" ? "text-destructive" : "text-muted-foreground",
            ].join(" ")}
          />
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <span className="truncate">
          {nodeData.kind === "http"
            ? String(nodeData.params?.["url"] ?? "")
            : nodeData.kind === "if"
              ? `${nodeData.params?.["left"] ?? ""} ${nodeData.params?.["op"] ?? ""}`
              : spec.group}
        </span>
        {typeof nodeData.itemCount === "number" && (
          <span className="ml-2 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-foreground">
            {nodeData.itemCount} items
          </span>
        )}
      </div>

      {spec.group !== "Triggers" && (
        <Handle type="target" position={Position.Left} id="in" style={{ left: -6 }} />
      )}
      {spec.outputs.map((out, i) => (
        <Handle
          key={out.handle}
          type="source"
          id={out.handle}
          position={Position.Right}
          style={{
            right: -6,
            top: spec.outputs.length === 1 ? "50%" : `${34 + i * 30}%`,
          }}
        />
      ))}
      {spec.outputs.length > 1 && (
        <div className="pointer-events-none absolute -right-11 top-[26%] flex flex-col gap-[14px] font-mono text-[10px] text-muted-foreground">
          {spec.outputs.map((o) => (
            <span key={o.handle}>{o.label}</span>
          ))}
        </div>
      )}
    </div>
    </Hint>
  );
}
