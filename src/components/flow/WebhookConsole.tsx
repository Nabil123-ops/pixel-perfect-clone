import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Radio, Send, Terminal, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendWebhookTest, type WebhookTestResult } from "@/lib/api/webhook-test.functions";
import { getExecution, listExecutions, runWorkflowNow } from "@/lib/api/executions.functions";
import type { RunResult, StoredNode } from "@/lib/flow/types";
import { executionLink, webhookUrl } from "@/lib/flow/endpoints";
import { Hint } from "@/components/flow/Hint";

export { PRODUCTION_ORIGIN } from "@/lib/flow/endpoints";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-[11px]"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        toast.success(`${label} copied`);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export function WebhookConsole({
  workflowId,
  triggers,
  active,
  onResult,
  customDomain = null,
}: {
  workflowId: string;
  triggers: StoredNode[];
  active: boolean;
  onResult?: (run: RunResult) => void;
  customDomain?: string | null;
}) {
  const qc = useQueryClient();
  const send = useServerFn(sendWebhookTest);
  const runAll = useServerFn(runWorkflowNow);
  const history = useServerFn(listExecutions);
  const execution = useServerFn(getExecution);

  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<"test" | "production">("test");
  const [body, setBody] = useState('{\n  "hello": "world"\n}');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<WebhookTestResult | null>(null);
  const [logRun, setLogRun] = useState<RunResult | null>(null);

  const trigger = triggers[Math.min(index, triggers.length - 1)];
  const params = (trigger?.data.params ?? {}) as Record<string, unknown>;
  const path = String(params["path"] ?? "");
  const method = String(params["method"] ?? "POST").toUpperCase();
  const secret = String(params["secret"] ?? "");
  const respond = String(params["respond"] ?? "onReceived");

  const url = useMemo(() => webhookUrl(target, workflowId, path, customDomain), [target, workflowId, path, customDomain]);

  const httpMethod = (method === "ANY" ? "POST" : method) as
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE";

  const curl = [
    `curl -i -X ${httpMethod} '${url}' \\`,
    `  -H 'content-type: application/json' \\`,
    ...(secret ? [`  -H 'x-webhook-secret: ${secret}' \\`] : []),
    `  -d '${body.replace(/\n\s*/g, "")}'`,
  ].join("\n");

  const { data: runs = [] } = useQuery({
    queryKey: ["executions", workflowId],
    queryFn: () => history({ data: { workflowId, limit: 10 } }).catch(() => []),
    retry: false,
    refetchInterval: 6000,
  });

  const pullLatestLogs = async () => {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const list = await history({ data: { workflowId, limit: 1 } });
      const latest = list[0];
      if (!latest) continue;
      const full = await execution({ data: { id: latest.id } });
      if (full) {
        setLogRun(full);
        onResult?.(full);
        if (full.status !== "running") break;
      }
    }
    void qc.invalidateQueries({ queryKey: ["executions"] });
  };

  const fire = async () => {
    if (!trigger) return;
    setBusy(true);
    setResponse(null);
    try {
      const res = await send({
        data: {
          url,
          method: httpMethod,
          body,
          ...(secret ? { secret } : {}),
        },
      });
      setResponse(res);
      if (res.ok) toast.success(`${res.status} · ${res.ms}ms`);
      else toast.error(res.error ?? `HTTP ${res.status}`);
      await pullLatestLogs();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const testEveryNode = async () => {
    setBusy(true);
    try {
      const res = await runAll({ data: { workflowId } });
      setLogRun(res);
      onResult?.(res);
      const failed = res.steps.find((s) => s.status === "error");
      if (failed) toast.error(`${failed.label}: ${failed.error}`);
      else toast.success(`All ${res.steps.length} nodes ran in ${res.ms}ms`);
      void qc.invalidateQueries({ queryKey: ["executions"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logLines = (logRun?.steps ?? []).flatMap((s) => [
    `[${s.status.toUpperCase()}] ${s.label} · ${s.ms}ms · ${s.attempts} attempt(s) · ${s.items.length} item(s)`,
    ...s.logs.map((l) => `    ${l}`),
    ...(s.error ? [`    ! ${s.error}`] : []),
  ]);

  return (
    <div className="border-b border-border bg-secondary/30">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <span className="flex items-center gap-1.5 font-display text-xs font-semibold">
          <Radio className="size-3.5 text-primary" /> Webhook console
        </span>
        {triggers.length > 1 && (
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="h-7 rounded-md border border-input bg-background px-2 text-[11px]"
            aria-label="Webhook trigger"
          >
            {triggers.map((t, i) => (
              <option key={t.id} value={i}>
                {t.data.label}
              </option>
            ))}
          </select>
        )}
        <div className="flex overflow-hidden rounded-md border border-border">
          {(["test", "production"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`px-2.5 py-1 text-[11px] capitalize ${
                target === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t} URL
            </button>
          ))}
        </div>
        <Hint text={target === "test" ? "Test URL — points at the environment you are using right now." : "Production URL — the live endpoint on eweblb.com. The workflow must be Active."}>
          <code className="min-w-0 flex-1 cursor-help truncate rounded-md bg-background px-2 py-1 font-mono text-[11px]">
            {httpMethod} {url}
          </code>
        </Hint>
        <CopyButton value={url} label="Webhook URL" />
        <CopyButton value={curl} label="cURL command" />
        <Hint text="Fires a real HTTP request at the selected URL and shows the exact response an external caller would get.">
          <Button size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => void fire()}>
            <Send className="mr-1.5 size-3.5" /> Send test request
          </Button>
        </Hint>
        <Hint text="Runs the entire graph once on the server so you can verify every node end to end.">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={busy}
            onClick={() => void testEveryNode()}
          >
            <Zap className="mr-1.5 size-3.5" /> Test every node
          </Button>
        </Hint>
      </div>

      <div className="grid gap-3 px-4 pb-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Request body (JSON)
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            rows={6}
            aria-label="Test request body"
            className="w-full rounded-md border border-input bg-background p-2 font-mono text-[11px]"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Respond mode: <span className="font-mono">{respond}</span>
            {secret ? " · secret sent as x-webhook-secret" : " · no secret set"}
            {target === "production" && !active ? " · activate the workflow first" : ""}
          </p>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Response
          </p>
          <pre className="h-[136px] overflow-auto rounded-md border border-input bg-background p-2 font-mono text-[11px]">
            {response
              ? `${response.status || "ERR"} · ${response.ms}ms\n${response.error ?? response.body}`
              : "// press Send test request"}
          </pre>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            <Terminal className="size-3" /> Live execution logs
          </p>
          {logRun?.executionId && (
            <a
              href={executionLink(target, logRun.executionId, customDomain)}
              target="_blank"
              rel="noreferrer"
              className="mb-1 block truncate font-mono text-[10px] text-primary hover:underline"
            >
              {executionLink(target, logRun.executionId, customDomain)}
            </a>
          )}
          <pre className="h-[136px] overflow-auto rounded-md bg-black/90 p-2 font-mono text-[11px] leading-relaxed text-emerald-300">
            {logLines.length
              ? logLines.join("\n")
              : runs.length
                ? "$ no logs loaded yet — send a request or press Test every node"
                : "$ waiting for the first execution…"}
          </pre>
        </div>
      </div>
    </div>
  );
}
