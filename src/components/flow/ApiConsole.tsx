import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Terminal, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/flow/Hint";
import { getExecKey } from "@/lib/api/endpoints.functions";
import { sendWebhookTest, type WebhookTestResult } from "@/lib/api/webhook-test.functions";
import { chatUrl, execUrl, type Env } from "@/lib/flow/endpoints";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** Parses "Key: Value" lines (one per row) into a headers object. Blank/invalid lines are skipped. */
function parseHeaderLines(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

/**
 * A free-form "Postman / terminal" style request console: arbitrary method,
 * URL, headers and body against any endpoint, plus one-click fills for this
 * workflow's own exec and chat endpoints. Reuses `sendWebhookTest` so calls
 * are proxied through the server the same way the webhook console fires them.
 */
export function ApiConsole({
  workflowId,
  hasChatTrigger = false,
  customDomain = null,
}: {
  workflowId: string;
  hasChatTrigger?: boolean;
  customDomain?: string | null;
}) {
  const send = useServerFn(sendWebhookTest);
  const fetchKey = useServerFn(getExecKey);

  const { data: keyData } = useQuery({
    queryKey: ["exec-key", workflowId],
    queryFn: () => fetchKey({ data: { workflowId } }).catch(() => ({ key: "" })),
    staleTime: 5 * 60_000,
  });
  const key = keyData?.key ?? "";

  const endpoints = useMemo(() => {
    const build = (env: Env) => ({
      exec: execUrl(env, workflowId, key, undefined, customDomain),
      chat: hasChatTrigger ? chatUrl(env, workflowId, customDomain) : null,
    });
    return { test: build("test"), production: build("production") };
  }, [workflowId, key, hasChatTrigger, customDomain]);

  const [method, setMethod] = useState<Method>("POST");
  const [url, setUrl] = useState(endpoints.test.exec);
  const [headerLines, setHeaderLines] = useState("content-type: application/json");
  const [body, setBody] = useState('{\n  "hello": "world"\n}');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<WebhookTestResult | null>(null);

  const fill = (target: string) => {
    setUrl(target);
    setMethod("POST");
  };

  const fire = async () => {
    if (!url) {
      toast.error("Enter a URL first");
      return;
    }
    setBusy(true);
    setResponse(null);
    try {
      const res = await send({
        data: {
          url,
          method,
          headers: parseHeaderLines(headerLines),
          ...(method !== "GET" ? { body } : {}),
        },
      });
      setResponse(res);
      if (res.ok) toast.success(`${res.status} · ${res.ms}ms`);
      else toast.error(res.error ?? `HTTP ${res.status}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const responseHeaderLines = response
    ? Object.entries(response.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2">
        <span className="flex items-center gap-1.5 font-display text-xs font-semibold">
          <Terminal className="size-3.5 text-primary" /> API console
        </span>

        <Hint text="Fill the URL field with this workflow's test exec endpoint.">
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => fill(endpoints.test.exec)}>
            Exec (test)
          </Button>
        </Hint>
        <Hint text="Fill the URL field with this workflow's production exec endpoint.">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => fill(endpoints.production.exec)}
          >
            Exec (production)
          </Button>
        </Hint>
        {endpoints.test.chat && endpoints.production.chat && (
          <>
            <Hint text="Fill the URL field with this workflow's test chat endpoint.">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => fill(endpoints.test.chat as string)}
              >
                Chat (test)
              </Button>
            </Hint>
            <Hint text="Fill the URL field with this workflow's production chat endpoint.">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => fill(endpoints.production.chat as string)}
              >
                Chat (production)
              </Button>
            </Hint>
          </>
        )}

        <Hint text="Sends the request from the server and shows the exact response, headers included.">
          <Button size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => void fire()}>
            <Zap className="mr-1.5 size-3.5" /> Send
          </Button>
        </Hint>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              aria-label="HTTP method"
              className="h-8 rounded-md border border-input bg-background px-2 text-[11px] font-mono"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              aria-label="Request URL"
              spellCheck={false}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-[11px]"
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Headers (one "Key: Value" per line)
            </p>
            <textarea
              value={headerLines}
              onChange={(e) => setHeaderLines(e.target.value)}
              spellCheck={false}
              rows={3}
              aria-label="Request headers"
              className="w-full rounded-md border border-input bg-background p-2 font-mono text-[11px]"
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Body
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={method === "GET"}
              spellCheck={false}
              rows={7}
              aria-label="Request body"
              className="w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Response
            </p>
            <pre className="h-[120px] overflow-auto rounded-md bg-black/90 p-2 font-mono text-[11px] leading-relaxed text-emerald-300">
              {response
                ? `${response.status || "ERR"} · ${response.ms}ms\n${response.error ?? response.body}`
                : "$ press Send"}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Response headers
            </p>
            <pre className="h-[100px] overflow-auto rounded-md border border-input bg-background p-2 font-mono text-[11px]">
              {responseHeaderLines || "—"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
