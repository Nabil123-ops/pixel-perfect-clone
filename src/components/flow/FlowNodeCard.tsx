import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CircleCheck, CircleX, CircleDashed, Loader2, Plus } from "lucide-react";
import { specOf } from "@/lib/flow/catalog";
import { NodeIcon } from "./NodeIcon";
import { NodePicker } from "@/components/flow/NodePicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONN_LABEL, type ConnType } from "@/lib/nodes/types";
import type { FlowNodeData, FlowNodeKind } from "@/lib/flow/types";
import { Hint } from "@/components/flow/Hint";

export type NodeStatus = "idle" | "running" | "success" | "error" | "skipped";

const STATUS_ICON: Record<string, typeof CircleCheck> = {
  success: CircleCheck,
  error: CircleX,
  skipped: CircleDashed,
};

/** A sub-node currently wired into one of this node's typed AI inputs. */
export type ConnectedSubNode = { id: string; label: string };

export type FlowNodeCardData = FlowNodeData & {
  status?: NodeStatus;
  itemCount?: number;
  /** Sub-nodes wired into each typed AI input, keyed by connection type. */
  connectedSubNodes?: Partial<Record<string, ConnectedSubNode[]>>;
  /** Adds a brand-new node of `kind` and wires it into `rootId`'s `connType` input. */
  onAddSubNode?: (rootId: string, connType: ConnType, kind: FlowNodeKind) => void;
  /** Focuses/selects a node — used when clicking a connected sub-node chip. */
  onSelectNode?: (id: string) => void;
};

/**
 * One typed AI input "slot" rendered along the bottom edge of a root node
 * (Agent, Basic LLM Chain, Vector Store, ...) — mirrors n8n's bottom
 * sub-input sockets. Empty slots show a dashed "+" button that opens a
 * NodePicker already filtered to compatible nodes (e.g. only Chat Model
 * nodes for `ai_languageModel`); filled slots show the connected node's
 * name as a clickable chip. Handles still allow plain drag-and-drop wiring
 * too — the "+" button is just a faster path to the same typed connection.
 */
function SubInputSlot({
  rootId,
  input,
  connected,
  onAdd,
  onSelect,
}: {
  rootId: string;
  input: { type: ConnType; label?: string; required?: boolean };
  connected: ConnectedSubNode[];
  onAdd?: FlowNodeCardData["onAddSubNode"];
  onSelect?: FlowNodeCardData["onSelectNode"];
}) {
  const [open, setOpen] = useState(false);
  const allowsMultiple = input.type === "ai_tool";
  const label = input.label ?? CONN_LABEL[input.type] ?? input.type;
  const missing = Boolean(input.required) && connected.length === 0;
  const showAddButton = connected.length === 0 || allowsMultiple;

  return (
    <div className="nodrag relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-3 pt-1">
      <Handle
        type="target"
        id={input.type}
        position={Position.Bottom}
        style={{ position: "absolute", left: "50%", bottom: -8, transform: "translateX(-50%)" }}
        className={missing ? "!border-destructive" : undefined}
      />

      {connected.map((c) => (
        <button
          key={c.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(c.id);
          }}
          className="max-w-full truncate rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
          title={c.label}
        >
          {c.label}
        </button>
      ))}

      {showAddButton && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              aria-label={`Add ${label}`}
              className={[
                "grid size-5 shrink-0 place-items-center rounded-full border bg-card shadow-sm transition-all hover:scale-110",
                missing
                  ? "border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  : "border-primary/50 text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground",
              ].join(" ")}
            >
              <Plus className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto border-border p-0"
            side="bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <NodePicker
              subType={input.type}
              onPick={(kind) => {
                setOpen(false);
                onAdd?.(rootId, input.type, kind);
              }}
            />
          </PopoverContent>
        </Popover>
      )}

      <span
        className={[
          "whitespace-nowrap text-[9px] font-mono uppercase tracking-wide",
          missing ? "text-destructive" : "text-muted-foreground",
        ].join(" ")}
      >
        {label}
        {input.required ? " *" : ""}
      </span>
    </div>
  );
}

export function FlowNodeCard({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeCardData;
  const spec = specOf(nodeData.kind);
  const status = nodeData.status ?? "idle";
  const StatusIcon = status !== "idle" && status !== "running" ? STATUS_ICON[status] : null;

  const isSubNode = Boolean(spec.subType);
  const subInputs = spec.inputs.filter((i) => i.type !== "main");
  const hasMainInput = !spec.isTrigger && !isSubNode;

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

  // AI sub-nodes (Chat Model / Memory / Tool / Embedding / ...) plug UPWARD
  // into a root node, so they render as a compact card with a single output
  // handle on TOP and no main in/out handles at all — matching n8n.
  if (isSubNode) {
    return (
      <Hint
        side="top"
        title={spec.name}
        text={`${spec.description} This node plugs into a root node's ${CONN_LABEL[spec.subType!] ?? spec.subType} input — it has no data flow of its own.`}
      >
        <div
          className={[
            "w-[170px] rounded-xl border bg-card transition-all",
            selected ? "border-primary ff-glow" : "border-border",
            status === "running" ? "ff-running border-primary" : "",
            status === "error" ? "border-destructive" : "",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 px-2.5 py-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent/15 text-accent">
              <NodeIcon icon={spec.icon} className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{nodeData.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {CONN_LABEL[spec.subType!] ?? spec.subType}
              </p>
            </div>
            {status === "running" && (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
            )}
            {StatusIcon && (
              <StatusIcon
                className={[
                  "size-3.5 shrink-0",
                  status === "success"
                    ? "text-primary"
                    : status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground",
                ].join(" ")}
              />
            )}
          </div>
          {spec.outputs.map((out, i) => (
            <Handle
              key={out.handle}
              type="source"
              id={out.handle}
              position={Position.Top}
              style={{
                top: -6,
                left: spec.outputs.length === 1 ? "50%" : `${28 + i * 44}%`,
              }}
            />
          ))}
        </div>
      </Hint>
    );
  }

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
              spec.isTrigger ? "bg-primary/20 text-primary" : "bg-accent/15 text-accent",
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
                status === "success"
                  ? "text-primary"
                  : status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
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

        {/* Typed AI sub-inputs (Chat Model / Memory / Tool / Embedding / ...)
          run along the bottom edge, each its own "+" slot. */}
        {subInputs.length > 0 && (
          <div className="flex items-start gap-0.5 border-t border-dashed border-border/70 px-1">
            {subInputs.map((input) => (
              <SubInputSlot
                key={input.type}
                rootId={id}
                input={input}
                connected={nodeData.connectedSubNodes?.[input.type] ?? []}
                onAdd={nodeData.onAddSubNode}
                onSelect={nodeData.onSelectNode}
              />
            ))}
          </div>
        )}

        {hasMainInput && (
          <Handle type="target" position={Position.Left} id="main" style={{ left: -6 }} />
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
