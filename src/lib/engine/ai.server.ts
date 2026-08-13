import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/lib/flow/types";
import type { ChatMessage, ChatRequest, ChatResponse, SubNodeRef } from "@/lib/nodes/types";
import { httpFetch } from "./http.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Provider config produced by an `ai_languageModel` sub-node. */
export interface ModelConfig {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  /** Anthropic uses x-api-key + anthropic-version instead of a bearer token. */
  style: "openai" | "anthropic";
}

export function modelConfigFrom(sub: SubNodeRef | undefined): ModelConfig | null {
  if (!sub) return null;
  const p = (sub.params ?? {}) as Record<string, Json>;
  const cred = (sub.credential ?? {}) as Record<string, string>;
  const cfg = (p['__config'] ?? {}) as Record<string, Json>;
  const provider = String(cfg['provider'] ?? sub.kind);
  return {
    provider,
    model: String(p['model'] ?? cfg['model'] ?? ""),
    baseUrl: String(p['baseUrl'] || cfg['baseUrl'] || GATEWAY),
    apiKey: String(cred['apiKey'] ?? cred['token'] ?? ""),
    temperature: Number(p['temperature'] ?? 0.7),
    style: cfg['style'] === "anthropic" ? "anthropic" : "openai",
  };
}

/** Calls a chat model. Uses Lovable AI when the sub-node has no own credential. */
export async function callChat(cfg: ModelConfig, req: ChatRequest): Promise<ChatResponse> {
  const useGateway = cfg.baseUrl === GATEWAY;
  const key = useGateway ? (process.env['LOVABLE_API_KEY'] ?? "") : cfg.apiKey;
  if (!key) throw new Error(`Missing API key for ${cfg.provider} — attach a credential`);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.style === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${key}`;
  }

  const body: Record<string, Json> = {
    model: cfg.model,
    messages: req.messages,
    temperature: req.temperature ?? cfg.temperature,
  };
  if (cfg.model.startsWith("openai/gpt-5.6")) body['reasoning_effort'] = "none";
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
