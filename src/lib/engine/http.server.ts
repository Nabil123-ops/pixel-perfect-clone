import type { Json } from "@/lib/flow/types";
import type { HttpRequestInput, HttpResult } from "@/lib/nodes/types";

/** Server-side fetch used by every node — no CORS, real status codes. */
export async function httpFetch(input: HttpRequestInput): Promise<HttpResult> {
  const started = Date.now();
  const method = (input.method ?? "GET").toUpperCase();
  try {
    const init: RequestInit = { method };
    if (input.headers) init.headers = input.headers;
    if (input.body && !["GET", "HEAD"].includes(method)) init.body = input.body;
    const res = await fetch(input.url, init);
    const text = await res.text();
    let parsed: Json = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      headers: Object.fromEntries(res.headers.entries()),
      body: parsed,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      headers: {},
      body: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
