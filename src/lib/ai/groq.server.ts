/**
 * Server-only Groq client.
 *
 * Groq exposes an OpenAI-compatible `/openai/v1/chat/completions` endpoint,
 * so this is a thin, dependency-free fetch wrapper — same shape as the
 * per-node `ai.server.ts` model caller, but for the app's own "Ask AI" and
 * "Create with AI" features (not tied to a workflow's model credential).
 *
 * SECURITY: never import this from a route file or `*.functions.ts` that
 * ships to the client bundle — only from other `*.server.ts` modules or
 * inside a server function's `.handler()` (which is stripped from the
 * client build). The API key never leaves the server.
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

/** General conversation model — fast, good instruction following. */
const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";
/** Structured JSON generation (workflow graphs) — strongest reasoning on Groq. */
const DEFAULT_WORKFLOW_MODEL = "openai/gpt-oss-120b";

export function groqApiKey(): string {
  const key = process.env["GROQ_API_KEY"];
  if (!key) {
    throw new Error(
      "Missing GROQ_API_KEY. Set it in wrangler.toml [vars] for local/preview, and with " +
        "`wrangler pages secret put GROQ_API_KEY` (or the Cloudflare Pages dashboard) for production.",
    );
  }
  return key;
}

export function groqChatModel(): string {
  return process.env["GROQ_CHAT_MODEL"] || DEFAULT_CHAT_MODEL;
}

export function groqWorkflowModel(): string {
  return process.env["GROQ_WORKFLOW_MODEL"] || DEFAULT_WORKFLOW_MODEL;
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqCallOptions {
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask Groq to return a raw JSON object (no markdown fences). */
  jsonMode?: boolean;
}

export interface GroqResult {
  text: string;
  model: string;
  finishReason: string | null;
}

/** Calls Groq's chat completions endpoint once and returns the assistant text. */
export async function callGroq(opts: GroqCallOptions): Promise<GroqResult> {
  const model = opts.model || groqChatModel();
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 2000,
  };
  if (opts.jsonMode) body["response_format"] = { type: "json_object" };

  let res: Response;
  try {
    res = await fetch(GROQ_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey()}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Could not reach Groq: ${err instanceof Error ? err.message : String(err)}`);
  }

  const raw = await res.text();
  let json: Record<string, unknown>;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const message =
      (json["error"] as Record<string, unknown> | undefined)?.["message"] ??
      raw.slice(0, 300) ??
      `HTTP ${res.status}`;
    if (res.status === 401) throw new Error("Groq rejected the API key — check GROQ_API_KEY.");
    if (res.status === 429) throw new Error("Groq rate limit reached — try again in a moment.");
    throw new Error(`Groq error ${res.status}: ${String(message)}`);
  }

  const choice = (json["choices"] as Array<Record<string, unknown>> | undefined)?.[0];
  const message = choice?.["message"] as Record<string, unknown> | undefined;
  const text = String(message?.["content"] ?? "");
  const finishReason = (choice?.["finish_reason"] as string | undefined) ?? null;

  return { text, model, finishReason };
}

/** Extracts the first JSON object/array from a model response, tolerant of ```json fences. */
export function extractJson<T = unknown>(text: string): T {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.search(/[[{]/);
  if (start === -1) throw new Error("Model did not return JSON");
  // Walk from the first brace/bracket and balance to the matching close,
  // in case the model added trailing prose after the JSON payload.
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const slice = end === -1 ? s.slice(start) : s.slice(start, end + 1);
  return JSON.parse(slice) as T;
}
