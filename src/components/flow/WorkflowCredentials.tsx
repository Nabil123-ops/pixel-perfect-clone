import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CredentialsDialog } from "@/components/flow/CredentialsDialog";
import { Hint } from "@/components/flow/Hint";
import { listCredentials } from "@/lib/api/credentials.functions";
import { specOf } from "@/lib/flow/catalog";
import type { StoredNode } from "@/lib/flow/types";

/**
 * Credentials zone scoped to ONE workflow: only the credentials actually
 * attached to this graph's nodes, with which node uses them and their last
 * connection test — instead of the whole account-wide list.
 */
export function WorkflowCredentials({
  nodes,
  onSelectNode,
}: {
  nodes: StoredNode[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const listCreds = useServerFn(listCredentials);
  const { data: all = [] } = useQuery({ queryKey: ["credentials"], queryFn: () => listCreds() });

  const usage = new Map<string, { nodeId: string; label: string; kind: string }[]>();
  for (const node of nodes) {
    const names = node.data.credentials?.length
      ? node.data.credentials
      : node.data.credential
        ? [node.data.credential]
        : [];
    for (const name of names) {
      const list = usage.get(name) ?? [];
      list.push({ nodeId: node.id, label: node.data.label, kind: node.data.kind });
      usage.set(name, list);
    }
  }

  const used = [...usage.entries()];
  const missing = used.filter(([name]) => !all.some((c) => c.name === name));
  const nodesNeedingAuth = nodes.filter(
    (n) =>
      specOf(n.data.kind).credentialType &&
      !(n.data.credentials?.length || n.data.credential),
  );

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Hint
          title="Workflow credentials"
          text="Every credential this workflow actually uses, and the node it is attached to. Add or edit them here — they stay encrypted on the server."
          side="left"
        >
          <p className="flex cursor-help items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="size-3.5" /> Credentials used by this workflow
          </p>
        </Hint>
        <div className="ml-auto">
          <CredentialsDialog />
        </div>
      </div>

      {used.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No credentials are attached to this workflow yet. Select a node and add one from its
          inspector — it will show up here.
        </p>
      )}

      <div className="space-y-2">
        {used.map(([name, consumers]) => {
          const cred = all.find((c) => c.name === name);
          return (
            <div key={name} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold">{name}</span>
                {cred ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {cred.type}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    missing
                  </Badge>
                )}
                {cred?.lastTestOk === true && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-500">
                    <CheckCircle2 className="size-3" /> connection ok
                  </span>
                )}
                {cred?.lastTestOk === false && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-destructive">
                    <XCircle className="size-3" /> {cred.lastTestMessage ?? "test failed"}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {consumers.map((c) => (
                  <button
                    key={c.nodeId}
                    onClick={() => onSelectNode?.(c.nodeId)}
                    className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="text-[11px] text-destructive">
          {missing.length} credential(s) referenced by nodes no longer exist — create them with the
          same name, or re-attach a new one.
        </p>
      )}

      {nodesNeedingAuth.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">
            Nodes that still need a credential
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nodesNeedingAuth.map((n) => (
              <button
                key={n.id}
                onClick={() => onSelectNode?.(n.id)}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-secondary"
              >
                {n.data.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
