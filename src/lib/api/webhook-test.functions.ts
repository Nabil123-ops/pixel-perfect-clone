import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WebhookTestResult {
  url: string;
  method: string;
  status: number;
  ok: boolean;
  ms: number;
  body: string;
  headers: Record<string, string>;
  error: string | null;
}

/**
 * Fires a real HTTP request at one of this app's own webhook endpoints
 * (test origin or the eweblb.com production origin) and returns the raw
 * response so the console can show exactly what an external caller sees.
 */
export const sendWebhookTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      url: string;
      method: string;
      body?: string;
      secret?: string;
      headers?: Record<string, string>;
    }) =>
      z
        .object({
          url: z.string().url().max(2000),
          method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
          body: z.string().max(100_000).optional(),
          secret: z.string().max(500).optional(),
          headers: z.record(z.string(), z.string()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<WebhookTestResult> => {
    const started = Date.now();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "n9n-webhook-console/1.0",
      ...(data.headers ?? {}),
    };
    if (data.secret) headers["x-webhook-secret"] = data.secret;

    try {
      const init: RequestInit = { method: data.method, headers };
      if (data.body && !["GET", "HEAD"].includes(data.method)) init.body = data.body;
      const res = await fetch(data.url, init);
      const text = await res.text();
      return {
        url: data.url,
        method: data.method,
        status: res.status,
        ok: res.ok,
        ms: Date.now() - started,
        body: text.slice(0, 20_000),
        headers: Object.fromEntries(res.headers.entries()),
        error: null,
      };
    } catch (err) {
      return {
        url: data.url,
        method: data.method,
        status: 0,
        ok: false,
        ms: Date.now() - started,
        body: "",
        headers: {},
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
