import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, KeyRound, Plug, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteCredential,
  listCredentials,
  saveCredential,
  startOauth,
  testCredential,
} from "@/lib/api/credentials.functions";
import { CREDENTIAL_TYPES, credentialTypeSpec } from "@/lib/flow/credentials";
import { authGuideFor, HEADER_NAME_OPTIONS, HEADER_PRESETS } from "@/lib/flow/provider-auth";
import type { Credential, CredentialType } from "@/lib/flow/types";
import { allNodes } from "@/lib/nodes/registry";
import { NodeIcon } from "@/components/flow/NodeIcon";

export const Route = createFileRoute("/_authenticated/credentials")({
  head: () => ({
    meta: [
      { title: "Credentials — n9n" },
      {
        name: "description",
        content:
          "Store API keys, bearer tokens, basic auth and OAuth2 connections encrypted on the server and reference them from any node.",
      },
      { property: "og:title", content: "Credentials — n9n" },
      {
        property: "og:description",
        content: "Encrypted credential vault with connection testing and OAuth2 flows.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CredentialsPage,
});

function CredentialsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCredentials);
  const save = useServerFn(saveCredential);
  const remove = useServerFn(deleteCredential);
  const test = useServerFn(testCredential);
  const oauth = useServerFn(startOauth);

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn: () => list(),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["credentials"] });

  const saveMutation = useMutation({
    mutationFn: (input: {
      id?: string;
      name: string;
      type: CredentialType;
      fields: Record<string, string>;
    }) => save({ data: input }),
    onSuccess: () => {
      toast.success("Credential saved — values encrypted at rest");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("oauth");
    if (!status) return;
    const message = params.get("message") ?? "";
    if (status === "success") toast.success(message || "Connected");
    else toast.error(message || "OAuth failed");
    window.history.replaceState({}, "", "/credentials");
  }, []);

  const [draftType, setDraftType] = useState<CredentialType>("apiKey");
  const [nodeQuery, setNodeQuery] = useState("");

  const nodeMatches = useMemo(() => {
    const q = nodeQuery.trim().toLowerCase();
    if (!q) return [];
    return allNodes()
      .filter((n) => n.credentialType)
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.kind.toLowerCase().includes(q) ||
          (n.keywords ?? []).some((k) => k.includes(q)),
      )
      .slice(0, 8);
  }, [nodeQuery]);

  const addNew = () =>
    saveMutation.mutate({
      name: `Credential_${(creds.length + 1).toString().padStart(2, "0")}`,
      type: draftType,
      fields: {},
    });

  const addForNode = (node: { name: string; credentialType?: CredentialType }) => {
    const base = node.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/, "");
    const taken = new Set(creds.map((c) => c.name));
    let name = base;
    let i = 2;
    while (taken.has(name)) name = `${base}_${i++}`;
    setNodeQuery("");
    saveMutation.mutate({ name, type: node.credentialType ?? "apiKey", fields: {} });
  };

  return (
    <Shell>
      <PageHeader
        title="Credentials"
        subtitle="Encrypted with AES-GCM on the server. Secrets are never sent back to the browser."
        action={
          <div className="flex items-center gap-2">
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as CredentialType)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Credential type"
            >
              {CREDENTIAL_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={addNew}>
              <Plus className="mr-1.5 size-4" /> Add credential
            </Button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <Label htmlFor="node-search" className="text-xs">
            Search a node to add its API key
          </Label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="node-search"
              value={nodeQuery}
              onChange={(e) => setNodeQuery(e.target.value)}
              placeholder="Slack, OpenAI, Claude, DeepSeek, Kimi, Notion…"
              className="h-9 pl-9"
              autoComplete="off"
            />
          </div>
          {nodeMatches.length > 0 && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {nodeMatches.map((n) => {
                const guide = authGuideFor(n.kind);
                return (
                  <li key={n.kind}>
                    <button
                      type="button"
                      onClick={() => addForNode(n)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <NodeIcon icon={n.icon} className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{n.name}</span>
                      <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {credentialTypeSpec(n.credentialType as CredentialType).name}
                      </span>
                    </button>
                    {guide && (
                      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 border-t border-border bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
                        <dt>Header name</dt>
                        <dd className="font-mono text-foreground">{guide.headerName}</dd>
                        <dt>Value format</dt>
                        <dd className="font-mono break-all text-foreground">{guide.valueFormat}</dd>
                        <dt>Endpoint</dt>
                        <dd className="break-all font-mono">{guide.endpoint}</dd>
                        {guide.testUrl ? (
                          <>
                            <dt>Test URL</dt>
                            <dd className="break-all font-mono">{guide.testUrl}</dd>
                          </>
                        ) : null}
                        <dt>Get the key</dt>
                        <dd>{guide.getKeyAt}</dd>
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Picking a node creates a credential already named and typed for it — just paste the key
            and hit Save. The header name and value format shown above are exactly what the engine
            sends.
          </p>

        </div>

        <section className="mb-5 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-sm font-semibold">How to add a header</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick the credential type, paste the key, and set <span className="font-mono">Header name</span>{" "}
            to one of the schemes below. Only <span className="font-mono">Authorization</span> gets an
            automatic <span className="font-mono">Bearer</span> prefix — every other header is sent exactly
            as typed. Need several headers at once? Use the "Custom header(s)" credential type below, or
            the "Extra headers (JSON)" field on any credential.
          </p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {HEADER_PRESETS.map((p) => (
              <li
                key={p.id}
                className={`rounded-lg border p-3 text-[11px] ${
                  p.recommended ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs text-foreground">{p.headerName}</code>
                  {p.recommended && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-1 break-all font-mono text-foreground">{p.valueFormat}</p>
                <p className="mt-1 text-muted-foreground">{p.description}</p>
                <p className="mt-1 text-muted-foreground">Used by: {p.usedBy}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="mb-5 rounded-lg border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
          Attach a credential to a node in the inspector, or reference a value directly with{" "}
          <code className="font-mono text-foreground">{"{{ $cred.Name.key }}"}</code>.
        </p>



        {isLoading && <p className="text-sm text-muted-foreground">Loading vault…</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {creds.map((c) => (
            <CredentialCard
              key={c.id}
              credential={c}
              onSave={(name, fields) =>
                saveMutation.mutate({ id: c.id, name, type: c.type, fields })
              }
              onTest={() => testMutation.mutate(c.id)}
              onDelete={async () => {
                await remove({ data: { id: c.id } });
                toast.success("Credential deleted");
                invalidate();
              }}
              onConnect={async () => {
                try {
                  const { url } = await oauth({
                    data: {
                      id: c.id,
                      redirectUri: `${window.location.origin}/api/public/oauth/callback`,
                    },
                  });
                  window.location.href = url;
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          ))}
        </div>

        {!isLoading && creds.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="font-display font-semibold">No credentials stored</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a Slack, Discord, Telegram or any API credential to get started.
            </p>
            <Button size="sm" className="mt-4" onClick={addNew}>
              <Plus className="mr-1.5 size-4" /> Add credential
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function CredentialCard({
  credential,
  onSave,
  onTest,
  onDelete,
  onConnect,
}: {
  credential: Credential;
  onSave: (name: string, fields: Record<string, string>) => void;
  onTest: () => void;
  onDelete: () => void;
  onConnect: () => void;
}) {
  const spec = credentialTypeSpec(credential.type);
  const [name, setName] = useState(credential.name);
  const [fields, setFields] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="size-4" />
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
          className="h-9 font-display text-sm"
          aria-label="Credential name"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${credential.name}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{spec.description}</p>

      <div className="space-y-2">
        {spec.fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`${credential.id}-${f.key}`} className="text-xs">
              {f.label}
            </Label>
            <Input
              id={`${credential.id}-${f.key}`}
              className="h-8 font-mono text-xs"
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              {...(f.key === "headerName" ? { list: "n9n-header-names" } : {})}
              placeholder={credential.fields[f.key] || f.placeholder || "Not set"}
              value={fields[f.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            {f.key === "headerName" && (
              <p className="text-[10px] text-muted-foreground">
                Recommended: <span className="font-mono text-foreground">Authorization</span> — the
                engine adds the <span className="font-mono text-foreground">Bearer</span> prefix
                automatically, so just paste the raw key above. Other common headers (x-api-key,
                api-key, apikey) are sent exactly as typed, with no prefix.
              </p>
            )}
          </div>

        ))}
        {credential.type === "apiKey" && !fields["headerName"] && !credential.fields["headerName"] && (
          <p className="-mt-2 text-[10px] text-muted-foreground">
            Need more than one header? Use the{" "}
            <span className="font-mono text-foreground">Extra headers (JSON)</span> field above, or
            switch to the <span className="font-mono text-foreground">Custom header(s)</span> credential
            type for several arbitrary headers with no assumed scheme.
          </p>
        )}
        <datalist id="n9n-header-names">
          {HEADER_NAME_OPTIONS.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
      </div>


      {credential.lastTestMessage && (
        <p
          className={`flex items-center gap-1.5 text-xs ${
            credential.lastTestOk ? "text-primary" : "text-destructive"
          }`}
        >
          {credential.lastTestOk ? (
            <CircleCheck className="size-3.5" />
          ) : (
            <CircleX className="size-3.5" />
          )}
          {credential.lastTestMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            onSave(name, fields);
            setFields({});
          }}
        >
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={onTest}>
          Test connection
        </Button>
        {credential.type === "oauth2" && (
          <Button variant="outline" size="sm" onClick={onConnect}>
            <Plug className="mr-1.5 size-4" /> Connect
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Blank fields keep the stored value. Existing values show masked previews only.
      </p>
    </div>
  );
}
