import { Play, X } from "lucide-react";
import { specOf } from "@/lib/flow/catalog";
import type { StoredNode } from "@/lib/flow/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/flow/Hint";
import { EndpointPanel } from "@/components/flow/EndpointPanel";

interface Props {
  node: StoredNode;
  workflowId: string;
  onChange: (patch: Partial<StoredNode["data"]>) => void;
  onDelete: () => void;
  onClose: () => void;
  onTestNode: () => void;
  testing?: boolean;
}

export function Inspector({
  node,
  workflowId,
  onChange,
  onDelete,
  onClose,
  onTestNode,
  testing,
}: Props) {
  const spec = specOf(node.data.kind);
  const kind = node.data.kind;
  const isWebhook = kind === "webhookTrigger";
  const path = String(node.data.params?.["path"] ?? "").replace(/^\/+/, "");

  const setParam = (key: string, value: unknown) =>
    onChange({ params: { ...node.data.params, [key]: value } });

  return (
    <aside className="ff-panel flex w-[340px] shrink-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <Hint title={spec.name} text={spec.description} side="left">
            <p className="cursor-help font-display text-sm font-semibold">{spec.name}</p>
          </Hint>
          <p className="mt-0.5 text-xs text-muted-foreground">{spec.description}</p>
        </div>
        <Hint text="Closes this panel. Your changes stay on the canvas.">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector">
            <X className="size-4" />
          </Button>
        </Hint>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Hint text="Executes only this node on the server with the current input, and shows its real output, logs, retries and timing below.">
          <Button variant="outline" className="w-full" onClick={onTestNode} disabled={testing}>
            <Play className="mr-1.5 size-4" /> {testing ? "Testing…" : "Test this node"}
          </Button>
        </Hint>

        <EndpointPanel
          workflowId={workflowId}
          nodeId={node.id}
          nodeKind={kind}
          title="This node's URLs"
          {...(isWebhook ? { webhookPath: path } : {})}
        />

        <div className="space-y-1.5">
          <Hint text="A friendly name for this step. It appears on the canvas, in logs and in the execution history." side="left">
            <Label htmlFor="node-label" className="cursor-help">
              Node name
            </Label>
          </Hint>
          <Input
            id="node-label"
            value={node.data.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>

        {spec.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Hint
              title={field.label}
              side="left"
              text={
                field.placeholder
                  ? `Example: ${field.placeholder}. Supports expressions like {{ item.field }}.`
                  : `Value for "${field.label}". Supports expressions like {{ item.field }}.`
              }
            >
              <Label htmlFor={`f-${field.key}`} className="cursor-help">
                {field.label}
              </Label>
            </Hint>
            {field.type === "select" ? (
              <select
                id={`f-${field.key}`}
                title={field.label}
                value={String(node.data.params?.[field.key] ?? field.options?.[0] ?? "")}
                onChange={(e) => setParam(field.key, e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {field.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.type === "code" || field.type === "textarea" ? (
              <Textarea
                id={`f-${field.key}`}
                rows={field.type === "code" ? 7 : 4}
                spellCheck={false}
                placeholder={field.placeholder}
                title={field.label}
                value={String(node.data.params?.[field.key] ?? "")}
                onChange={(e) => setParam(field.key, e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            ) : (
              <Input
                id={`f-${field.key}`}
                type={field.type === "number" ? "number" : "text"}
                placeholder={field.placeholder}
                title={field.label}
                value={String(node.data.params?.[field.key] ?? "")}
                onChange={(e) =>
                  setParam(
                    field.key,
                    field.type === "number" ? Number(e.target.value) : e.target.value,
                  )
                }
                className="font-mono text-xs"
              />
            )}
          </div>
        ))}

        <div className="space-y-3 rounded-lg border border-border p-3">
          <Hint text="Controls what happens when this node throws — how many times it is retried and whether the branch stops." side="left">
            <p className="cursor-help font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Error handling
            </p>
          </Hint>
          <div className="space-y-1.5">
            <Hint text="How many extra attempts the engine makes before marking the node as failed." side="left">
              <Label htmlFor="node-retries" className="cursor-help">
                Retry attempts on failure
              </Label>
            </Hint>
            <Input
              id="node-retries"
              type="number"
              min={0}
              value={String(node.data.retries ?? 0)}
              onChange={(e) => onChange({ retries: Math.max(0, Number(e.target.value)) })}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Hint text="Stop halts this branch of the workflow. Continue passes the incoming items through so later nodes still run." side="left">
              <Label htmlFor="node-onerror" className="cursor-help">
                When it still fails
              </Label>
            </Hint>
            <select
              id="node-onerror"
              value={node.data.onError ?? "stop"}
              onChange={(e) => onChange({ onError: e.target.value as "stop" | "continue" })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="stop">Stop this branch</option>
              <option value="continue">Continue with input items</option>
            </select>
          </div>
        </div>

        <p className="rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
          Expressions: <code className="font-mono text-foreground">{"{{ item.field }}"}</code>,{" "}
          <code className="font-mono text-foreground">{"{{ $now }}"}</code>,{" "}
          <code className="font-mono text-foreground">{"{{ $index }}"}</code>,{" "}
          <code className="font-mono text-foreground">{"{{ $cred.Name.key }}"}</code>
        </p>
      </div>

      <div className="border-t border-border p-4">
        <Hint text="Removes this node and every connection attached to it. Save afterwards to persist.">
          <Button variant="outline" className="w-full text-destructive" onClick={onDelete}>
            Delete node
          </Button>
        </Hint>
      </div>
    </aside>
  );
}
