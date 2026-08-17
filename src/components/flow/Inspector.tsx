import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Play, Plus, X } from "lucide-react";
import { specOf } from "@/lib/flow/catalog";
import { credentialTypeSpec } from "@/lib/flow/credentials";
import type { StoredNode } from "@/lib/flow/types";
import { listCredentials } from "@/lib/api/credentials.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/flow/Hint";
import { EndpointPanel } from "@/components/flow/EndpointPanel";
import { PuterConnectButton } from "@/components/flow/PuterConnectButton";

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
  const isForm = kind === "formTrigger";
  const path = String(node.data.params?.["path"] ?? "").replace(/^\/+/, "");

  const setParam = (key: string, value: unknown) =>
    onChange({ params: { ...node.data.params, [key]: value } });

  // Multi-operation app nodes (REST integrations) tag each field with the
  // operation(s) it belongs to — only show the ones that apply to whichever
  // operation is currently selected, instead of every field from every
  // operation at once.
  const currentOperation = String(node.data.params?.["operation"] ?? "");
  const visibleFields = spec.fields.filter(
    (field) => !field.operations || field.operations.includes(currentOperation),
  );

  const listCreds = useServerFn(listCredentials);
  const { data: allCredentials = [] } = useQuery({
    queryKey: ["credentials"],
    queryFn: () => listCreds(),
  });

  const attachedNames =
    node.data.credentials?.length ? node.data.credentials : node.data.credential ? [node.data.credential] : [];
  const availableToAdd = allCredentials
    .filter((c) => !attachedNames.includes(c.name))
    .sort((a, b) => {
      const aMatch = a.type === spec.credentialType ? 0 : 1;
      const bMatch = b.type === spec.credentialType ? 0 : 1;
      return aMatch - bMatch;
    });

  const setCredentials = (names: string[]) =>
    onChange({
      credentials: names,
      credential: names[0] ?? "",
    });
  const addCredential = (name: string) => {
    if (!name || attachedNames.includes(name)) return;
    setCredentials([...attachedNames, name]);
  };
  const removeCredential = (name: string) =>
    setCredentials(attachedNames.filter((n) => n !== name));

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
          {...(isForm ? { formPath: path } : {})}
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

        <div className="space-y-1.5">
          <Hint
            text="Attach as many stored credentials as this node needs. Their fields are merged for built-in auth, and every attached credential is also reachable individually as {{ $cred.Name.key }}."
            side="left"
          >
            <div className="flex items-center gap-2">
              <Label className="cursor-help">Credentials</Label>
              {spec.credentialRequired && attachedNames.length === 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  Required
                </Badge>
              )}
            </div>
          </Hint>

          {kind === "puterModel" && !attachedNames.includes("Puter") && (
            <PuterConnectButton
              {...(() => {
                const existingId = allCredentials.find((c) => c.name === "Puter")?.id;
                return existingId ? { existingId } : {};
              })()}
              onConnected={addCredential}
            />
          )}


          {attachedNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedNames.map((name) => {
                const cred = allCredentials.find((c) => c.name === name);
                return (
                  <Badge key={name} variant="secondary" className="gap-1.5 py-1 pl-2 pr-1">
                    <KeyRound className="size-3" />
                    {name}
                    {cred && (
                      <span className="text-muted-foreground">· {credentialTypeSpec(cred.type).name}</span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeCredential(name)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {availableToAdd.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <select
                title="Add a credential"
                value=""
                onChange={(e) => addCredential(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="" disabled>
                  {attachedNames.length ? "Add another credential…" : "Attach a credential…"}
                </option>
                {availableToAdd.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} · {credentialTypeSpec(c.type).name}
                  </option>
                ))}
              </select>
              <Plus className="size-4 shrink-0 text-muted-foreground" />
            </div>
          ) : (
            allCredentials.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No credentials saved yet. <Link to="/credentials" className="underline">Add one</Link>.
              </p>
            )
          )}
        </div>

        {visibleFields.map((field) => (
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
