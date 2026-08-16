import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { apiKeyHeaders, mergeExtraHeaders } from "@/lib/flow/auth";
import type { Json } from "@/lib/flow/types";
import type { ChatMessage, ChatRequest, ChatResponse, SubNodeRef } from "@/lib/nodes/types";
import { httpFetch } from "./http.server";

/** Provider config produced by an `ai_languageModel` sub-node. */
export interface ModelConfig {
  provider: string;
  model: string;
  baseUrl: string;
  /** Full decrypted credential fields — apiKey/token, optional headerName, extraHeaders, ... */
  credential: Record<string, string>;
  temperature: number;
  /** Anthropic uses its own Messages API shape, not OpenAI chat/completions. */
  style: "openai" | "anthropic";
  /** Per-model system prompt, prepended ahead of the caller's own messages. */
  systemPrompt: string;
  /** Output token cap. Required by Anthropic; sent when set for every provider. */
  maxTokens?: number;
}

/** Header name each built-in provider expects when the user hasn't overridden it. */
const DEFAULT_HEADER_NAME: Record<string, string> = {
  anthropicModel: "x-api-key",
  azureOpenAiModel: "api-key",
};

export function modelConfigFrom(sub: SubNodeRef | undefined): ModelConfig | null {
  if (!sub) return null;
  const p = (sub.params ?? {}) as Record<string, Json>;
  const cred = (sub.credential ?? {}) as Record<string, string>;
  const cfg = (p['__config'] ?? {}) as Record<string, Json>;
  const provider = String(cfg['provider'] ?? sub.kind);
  return {
    provider,
    model: String(p['model'] ?? cfg['model'] ?? ""),
    baseUrl: String(p['baseUrl'] || cfg['baseUrl'] || ""),
    credential: cred,
    temperature: Number(p['temperature'] ?? 0.7),
    style: cfg['style'] === "anthropic" ? "anthropic" : "openai",
    systemPrompt: String(p['systemPrompt'] ?? ""),
    maxTokens: p['maxTokens'] ? Number(p['maxTokens']) : undefined,
  };
}

/** Builds the auth header(s) for a model call, honoring a custom headerName/extraHeaders. */
function authHeadersFor(cfg: ModelConfig): Record<string, string> {
  const key = cfg.credential['apiKey'] ?? cfg.credential['token'] ?? "";
  const defaultHeaderName = DEFAULT_HEADER_NAME[cfg.provider] ?? "Authorization";
  const headers: Record<string, string> = {};
  if (key) {
    Object.assign(
      headers,
      apiKeyHeaders(cfg.credential, {
        defaultHeaderName,
        // Vendor headers other than Authorization (x-api-key, api-key, ...) are
        // always sent raw — only Authorization gets an automatic Bearer prefix.
        bearerByDefault: defaultHeaderName.toLowerCase() === "authorization",
      }),
    );
  }
  if (cfg.style === "anthropic" && !("anthropic-version" in headers)) {
    headers["anthropic-version"] = "2023-06-01";
  }
  return mergeExtraHeaders(cfg.credential, headers);
}

/** Calls a chat model directly against the provider endpoint using its credential. */
export async function callChat(cfg: ModelConfig, req: ChatRequest): Promise<ChatResponse> {
  if (!cfg.baseUrl) {
    throw new Error(
      `No endpoint configured for ${cfg.provider} — set the model node's base URL`,
    );
  }
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(cfg.baseUrl);
  const key = cfg.credential['apiKey'] ?? cfg.credential['token'] ?? "";
  if (!key && !isLocal) throw new Error(`Missing API key for ${cfg.provider} — attach a credential`);

  return cfg.style === "anthropic" ? callAnthropic(cfg, req) : callOpenAiCompatible(cfg, req);
}

/** OpenAI-shaped chat/completions call — used by every provider except native Anthropic. */
async function callOpenAiCompatible(cfg: ModelConfig, req: ChatRequest): Promise<ChatResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...authHeadersFor(cfg) };

  const messages: ChatMessage[] = cfg.systemPrompt
    ? [{ role: "system", content: cfg.systemPrompt }, ...req.messages]
    : req.messages;

  const body: Record<string, Json> = {
    model: cfg.model,
    messages,
    temperature: req.temperature ?? cfg.temperature,
  };
  if (cfg.maxTokens) body['max_tokens'] = cfg.maxTokens;
  if (cfg.model.startsWith("gpt-5.6")) body['reasoning_effort'] = "none";
  if (req.tools?.length) {
    body['tools'] = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  if (req.jsonSchema) {
    body['response_format'] = {
      type: "json_schema",
      json_schema: { name: "result", schema: req.jsonSchema },
    };
  }

  const res = await httpFetch({
    url: cfg.baseUrl,
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (res.error) throw new Error(res.error);
  if (res.status === 429) throw new Error("Model rate limit reached — try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace");
  if (!res.ok) {
    const detail =
      (res.body as Json)?.error?.message ?? (typeof res.body === "string" ? res.body : "");
    throw new Error(`Model error ${res.status}${detail ? `: ${String(detail).slice(0, 300)}` : ""}`);
  }

  const choice = (res.body as Json)?.choices?.[0]?.message ?? {};
  const toolCalls = (choice.tool_calls ?? []).map((c: Json) => ({
    id: String(c.id ?? ""),
    name: String(c.function?.name ?? ""),
    arguments: safeJson(c.function?.arguments),
  }));
  return { text: String(choice.content ?? ""), toolCalls, raw: res.body };
}

/**
 * Native Anthropic Messages API — a different shape from OpenAI's chat/completions:
 * system prompt is a top-level field (not a message), `max_tokens` is mandatory,
 * tool calls/results are content blocks rather than a parallel `tool_calls` array,
 * and the response text lives in a `content` array instead of `choices[0].message`.
 */
async function callAnthropic(cfg: ModelConfig, req: ChatRequest): Promise<ChatResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...authHeadersFor(cfg) };

  const system = [cfg.systemPrompt, ...req.messages.filter((m) => m.role === "system").map((m) => m.content)]
    .filter(Boolean)
    .join("\n\n");

  // Anthropic keeps tool calls/results as content blocks on user/assistant
  // turns rather than a separate "tool" role — translate as we go.
  const messages: Json[] = [];
  for (const m of req.messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.tool_call_id ?? "",
            content: m.content ?? "",
          },
        ],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      const blocks: Json[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const call of m.tool_calls) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.function.name,
          input: safeJson(call.function.arguments),
        });
      }
      messages.push({ role: "assistant", content: blocks });
      continue;
    }
    messages.push({ role: m.role, content: m.content ?? "" });
  }

  const body: Record<string, Json> = {
    model: cfg.model,
    max_tokens: cfg.maxTokens ?? 4096,
    messages,
    temperature: req.temperature ?? cfg.temperature,
  };
  if (system) body['system'] = system;
  if (req.tools?.length) {
    body['tools'] = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const res = await httpFetch({ url: cfg.baseUrl, method: "POST", headers, body: JSON.stringify(body) });
  if (res.error) throw new Error(res.error);
  if (res.status === 429) throw new Error("Model rate limit reached — try again shortly");
  if (!res.ok) {
    const detail =
      (res.body as Json)?.error?.message ?? (typeof res.body === "string" ? res.body : "");
    throw new Error(`Model error ${res.status}${detail ? `: ${String(detail).slice(0, 300)}` : ""}`);
  }

  const blocks = ((res.body as Json)?.content ?? []) as Json[];
  const text = blocks
    .filter((b) => b?.type === "text")
    .map((b) => String(b.text ?? ""))
    .join("");
  const toolCalls = blocks
    .filter((b) => b?.type === "tool_use")
    .map((b) => ({ id: String(b.id ?? ""), name: String(b.name ?? ""), arguments: (b.input ?? {}) as Json }));

  return { text, toolCalls, raw: res.body };
}

const safeJson = (value: unknown): Json => {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
};

/** Durable chat memory used by memory sub-nodes and the Chat Trigger. */
export const chatMemory = {
  async load(sessionId: string, limit = 20): Promise<ChatMessage[]> {
    if (!sessionId) return [];
    const { data } = await supabaseAdmin
      .from("chat_memory")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as { role: string; content: string }[])
      .reverse()
      .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content }));
  },
  async append(sessionId: string, messages: ChatMessage[], workflowId?: string): Promise<void> {
    if (!sessionId || !messages.length) return;
    await supabaseAdmin.from("chat_memory").insert(
      messages.map((m) => ({
        session_id: sessionId,
        workflow_id: workflowId ?? null,
        role: m.role,
        content: m.content ?? "",
      })),
    );
  },
};
