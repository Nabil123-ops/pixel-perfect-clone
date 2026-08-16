/**
 * Puter.js integration — 100% client-side AI.
 *
 * Puter runs on the "user pays" model: the browser talks to Puter directly, so
 * there is no API key, no server function and no extra setup on Cloudflare
 * Pages. We lazily inject the SDK the first time an AI feature is used.
 */

export interface PuterChatOptions {
  model?: string;
  stream?: boolean;
}

interface PuterApi {
  ai: {
    chat: (
      prompt: string | { role: string; content: string }[],
      testMode?: boolean | PuterChatOptions,
      options?: PuterChatOptions,
    ) => Promise<unknown>;
  };
  print?: unknown;
}

declare global {
  interface Window {
    puter?: PuterApi;
  }
}

export const PUTER_MODELS = [
  { id: "deepseek-chat", label: "DeepSeek Chat" },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

export const DEFAULT_PUTER_MODEL = "google/gemini-2.5-flash";

const SRC = "https://js.puter.com/v2/";
let loading: Promise<PuterApi> | null = null;

/** Loads (once) and returns the Puter SDK. Browser only. */
export function loadPuter(): Promise<PuterApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Puter is only available in the browser"));
  }
  if (window.puter?.ai) return Promise.resolve(window.puter);
  if (loading) return loading;

  loading = new Promise<PuterApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const script = existing ?? document.createElement("script");
    const done = () => {
      if (window.puter?.ai) resolve(window.puter);
      else reject(new Error("Puter loaded but the AI module is unavailable"));
    };
    script.addEventListener("load", done);
    script.addEventListener("error", () => reject(new Error("Could not load Puter.js")));
    if (!existing) {
      script.src = SRC;
      script.async = true;
      document.head.appendChild(script);
    } else if (window.puter?.ai) {
      done();
    }
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Pulls plain text out of whatever shape Puter returns for a given model. */
function textOf(res: unknown): string {
  if (typeof res === "string") return res;
  const r = res as {
    message?: { content?: unknown };
    text?: string;
    content?: unknown;
    result?: { message?: { content?: unknown } };
  };
  const content = r?.message?.content ?? r?.result?.message?.content ?? r?.content ?? r?.text;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : String((part as { text?: string })?.text ?? "")))
      .join("");
  }
  return content ? String(content) : "";
}

export interface PuterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** One chat completion through Puter — no key, no backend. */
export async function puterChat(
  messages: PuterMessage[],
  model: string = DEFAULT_PUTER_MODEL,
): Promise<string> {
  const puter = await loadPuter();
  const res = await puter.ai.chat(messages, { model });
  const text = textOf(res).trim();
  if (!text) throw new Error("The model returned an empty response");
  return text;
}

/** Extracts the first JSON object/array from a model reply (handles ``` fences). */
export function extractJson<T = unknown>(reply: string): T {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? reply).trim();
  const start = raw.search(/[{[]/);
  if (start === -1) throw new Error("The model did not return JSON");
  const open = raw[start] as "{" | "[";
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(raw.slice(start, i + 1)) as T;
    }
  }
  throw new Error("The model returned malformed JSON");
}
