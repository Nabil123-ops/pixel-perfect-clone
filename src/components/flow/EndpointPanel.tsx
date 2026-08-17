import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, Link2, Play, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/flow/Hint";
import { getExecKey } from "@/lib/api/endpoints.functions";
import {
  chatUrl,
  curlFor,
  execUrl,
  executionLink,
  formUrl,
  nodeTestUrl,
  webhookUrl,
  type Env,
} from "@/lib/flow/endpoints";

function CopyIcon({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Hint title={`Copy ${label}`} text={`Puts the ${label.toLowerCase()} on your clipboard.`}>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success(`${label} copied`);
          setTimeout(() => setDone(false), 1400);
        }}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </Hint>
  );
}

function UrlRow({
  label,
  url,
  hint,
  method,
}: {
  label: string;
  url: string;
  hint: string;
  method: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Hint title={label} text={hint} side="left">
          <span className="cursor-help text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground underline decoration-dotted underline-offset-2">
            {label}
          </span>
        </Hint>
        <div className="flex items-center gap-1">
          <CopyIcon value={url} label={`${label} URL`} />
          <CopyIcon value={curlFor(url, method)} label={`${label} cURL`} />
          <Hint title="Open in a new tab" text="Calls the endpoint straight from your browser.">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${label} URL`}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </Hint>
        </div>
      </div>
      <p className="break-all rounded-md bg-secondary/60 p-2 font-mono text-[10px] leading-relaxed">
        <span className="text-primary">{method}</span> {url}
      </p>
    </div>
  );
}

/**
 * Test + production execution URLs for a workflow, a node or a trigger,
 * plus a real "call it now" button and the resulting execution link.
 */
export function EndpointPanel({
  workflowId,
  nodeId,
  nodeKind,
  webhookPath,
  formPath,
  title = "Execution endpoints",
  customDomain = null,
}: {
  workflowId: string;
  nodeId?: string;
  nodeKind?: string;
  webhookPath?: string;
  formPath?: string;
  title?: string;
  customDomain?: string | null;
}) {
  const fetchKey = useServerFn(getExecKey);
  const { data } = useQuery({
    queryKey: ["exec-key", workflowId],
    queryFn: () => fetchKey({ data: { workflowId } }).catch(() => ({ key: "" })),
    staleTime: 5 * 60_000,
  });
  const key = data?.key ?? "";

  const [busy, setBusy] = useState(false);
  const [lastExecution, setLastExecution] = useState<{ id: string; url: string } | null>(null);
  const [output, setOutput] = useState<string>("");

  const urls = useMemo(() => {
    const build = (env: Env) => ({
      exec: execUrl(env, workflowId, key, nodeId, customDomain),
      webhook: webhookPath !== undefined ? webhookUrl(env, workflowId, webhookPath, customDomain) : null,
      chat: nodeKind === "chatTrigger" ? chatUrl(env, workflowId, customDomain) : null,
      form: formPath !== undefined ? formUrl(env, workflowId, formPath, customDomain) : null,
    });
    return { test: build("test"), production: build("production") };
  }, [workflowId, key, nodeId, webhookPath, formPath, nodeKind, customDomain]);

  const callNow = async (env: Env) => {
    setBusy(true);
    setOutput("");
    try {
      const res = await fetch(urls[env].exec, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ triggeredFrom: "editor", at: new Date().toISOString() }),
      });
      const json = (await res.json()) as {
        executionId?: string;
        executionUrl?: string;
        error?: string | null;
        ms?: number;
      };
      setOutput(JSON.stringify(json, null, 2));
      if (json.executionId) {
        setLastExecution({
          id: json.executionId,
          url: json.executionUrl ?? executionLink(env, json.executionId, customDomain),
        });
      }
      if (res.ok) toast.success(`HTTP ${res.status} · ${json.ms ?? 0}ms`);
      else toast.error(json.error ?? `HTTP ${res.status}`);
    } catch (e) {
      toast.error((e as Error).message);
      setOutput(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <Hint
        title={title}
        text="Every workflow, node and trigger has its own callable URL. The test URL points at the environment you are looking at right now; the production URL points at the live domain."
        side="left"
      >
        <p className="flex cursor-help items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Link2 className="size-3.5" /> {title}
        </p>
      </Hint>

      <UrlRow
        label="Test"
        method="POST"
        url={urls.test.exec}
        hint="Runs on the environment you are currently using. Safe for experiments — results still show up in the execution history."
      />
      <UrlRow
        label="Production"
        method="POST"
        url={urls.production.exec}
        hint="The live endpoint on the production domain. Use it from other systems, cron jobs or your own backend."
      />

      {nodeId && (
        <a
          href={nodeTestUrl("test", workflowId, nodeId, key, customDomain)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          <ExternalLink className="size-3.5" /> Open real test page for this node
        </a>
      )}

      {/* Embed anywhere — real, working snippets pointing at the production
          origin (the verified custom domain when one is connected). */}
      <div className="space-y-2 rounded-md border border-dashed border-border p-2">
        <Hint
          title="Embed on another website"
          text="Paste these into any site. The iframe renders a real, runnable panel; the script calls this endpoint and returns the real execution result."
          side="left"
        >
          <p className="flex cursor-help items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Code2 className="size-3" /> Embed on another website
          </p>
        </Hint>
        {(() => {
          const uiUrl = nodeId
            ? nodeTestUrl("production", workflowId, nodeId, key, customDomain)
            : (urls.production.form ?? urls.production.exec);
          const snippet = embedIframeSnippet(uiUrl);
          const script = embedScriptSnippet(urls.production.exec);
          return (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">iframe widget</span>
                <CopyIcon value={snippet} label="Embed iframe" />
              </div>
              <pre className="max-h-[70px] overflow-auto rounded bg-secondary/60 p-2 font-mono text-[10px] leading-relaxed">
                {snippet}
              </pre>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">JavaScript call</span>
                <CopyIcon value={script} label="Embed script" />
              </div>
              <pre className="max-h-[110px] overflow-auto rounded bg-secondary/60 p-2 font-mono text-[10px] leading-relaxed">
                {script}
              </pre>
            </>
          );
        })()}
      </div>


      {urls.test.webhook && urls.production.webhook && (
        <>
          <UrlRow
            label="Webhook test"
            method="POST"
            url={urls.test.webhook}
            hint="Public webhook of this trigger on the current environment."
          />
          <UrlRow
            label="Webhook production"
            method="POST"
            url={urls.production.webhook}
            hint="Public webhook on the live domain. Only fires while the workflow is Active."
          />
        </>
      )}

      {urls.test.form && urls.production.form && (
        <>
          <UrlRow
            label="Test form"
            method="GET"
            url={urls.test.form}
            hint="A real, fillable HTML form hosted on this environment — open it and submit real data to test end to end."
          />
          <UrlRow
            label="Production form"
            method="GET"
            url={urls.production.form}
            hint="The live form on the production domain. Share this link with real users. Only accepts submissions while the workflow is Active."
          />
          <a
            href={urls.test.form}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <ExternalLink className="size-3.5" /> Open test form in a new tab
          </a>
        </>
      )}

      {urls.test.chat && urls.production.chat && (
        <>
          <UrlRow
            label="Chat test"
            method="POST"
            url={urls.test.chat}
            hint="Chat endpoint of this trigger on the current environment."
          />
          <UrlRow
            label="Chat production"
            method="POST"
            url={urls.production.chat}
            hint="Live chat endpoint. Send { message, sessionId }."
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Hint text="Sends a real POST to the test URL and streams back the execution result.">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void callNow("test")}>
            <Play className="mr-1.5 size-3.5" /> Run test URL
          </Button>
        </Hint>
        <Hint text="Sends a real POST to the production URL on the live domain.">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void callNow("production")}
          >
            <Play className="mr-1.5 size-3.5" /> Run production
          </Button>
        </Hint>
      </div>

      {lastExecution && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Execution link
          </p>
          <div className="flex items-center gap-1">
            <a
              href={lastExecution.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate rounded-md bg-secondary/60 p-2 font-mono text-[10px] text-primary underline-offset-2 hover:underline"
            >
              {lastExecution.url}
            </a>
            <CopyIcon value={lastExecution.url} label="Execution link" />
          </div>
        </div>
      )}

      {output && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Terminal className="size-3" /> Response
          </p>
          <pre className="max-h-[160px] overflow-auto rounded-md bg-black/90 p-2 font-mono text-[10px] leading-relaxed text-emerald-300">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
