import type { Json } from "@/lib/flow/types";
import type { ChatMessage, ChatToolDef, NodeModule } from "./types";
import { getPath, main, parseJson, toItems } from "./types";
import { headersFromCredentialFields } from "@/lib/flow/auth";
import { PUTER_MODELS, PUTER_OPENAI_CHAT_URL } from "@/lib/puter";

/**
 * AI sub-nodes carry no execution of their own — they publish provider config
 * that a root node (Agent / Chain) reads through the typed `ai_*` connection.
 */
export function modelNode(opts: {
  kind: string;
  name: string;
  icon: string;
  models: string[];
  baseUrl?: string;
  style?: "openai" | "anthropic";
  credentialType?: NonNullable<NodeModule["credentialType"]>;
  description: string;
}): NodeModule {
  const config: Json = {
    provider: opts.kind,
    style: opts.style ?? "openai",
    ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
  };
  return {
    kind: opts.kind,
    name: opts.name,
    group: "AI Models",
    description: opts.description,
    icon: opts.icon,
    subType: "ai_languageModel",
    keywords: ["model", "llm", "chat", opts.name.toLowerCase()],
    outputs: [{ handle: "ai_languageModel", label: "Model" }],
    ...(opts.credentialType ? { credentialType: opts.credentialType, credentialRequired: !opts.baseUrl?.startsWith("http://localhost") } : {}),
    fields: [
      { key: "model", label: "Model", type: "select", options: opts.models },
      { key: "temperature", label: "Temperature", type: "number" },
      { key: "maxTokens", label: "Max output tokens (optional)", type: "number", placeholder: "4096" },
      { key: "baseUrl", label: "Custom base URL (optional)", type: "text" },
      {
        key: "systemPrompt",
        label: "System prompt (optional)",
        type: "code",
        placeholder: "Prepended to every request made with this model.",
      },
    ],
    defaults: {
      model: opts.models[0]!,
      temperature: 0.7,
      maxTokens: "",
      baseUrl: "",
      systemPrompt: "",
      __config: config,
    },
    execute: (ctx) => main([{ provider: opts.kind, model: String(ctx.params.model ?? "") }]),
  };
}

export const openAiModel = modelNode({
  kind: "openAiModel",
  name: "OpenAI ChatGPT Model",
  icon: "openai",
  description: "ChatGPT models (GPT-5.1 / GPT-4o) via the OpenAI API with your own key. Header: Authorization: Bearer sk-…",
  models: ["gpt-5.1", "gpt-5.1-mini", "gpt-5", "gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3-mini"],
  baseUrl: "https://api.openai.com/v1/chat/completions",
  credentialType: "apiKey",
});



export const anthropicModel = modelNode({
  kind: "anthropicModel",
  name: "Anthropic Chat Model",
  icon: "anthropic",
  description: "Calls Claude models directly with your Anthropic key.",
  models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"],
  baseUrl: "https://api.anthropic.com/v1/messages",
  style: "anthropic",
  credentialType: "apiKey",
});

/**
 * Puter.js — one free token, 500+ models (GPT, Claude, Gemini, DeepSeek…),
 * no OpenAI/Anthropic/Groq/... billing account needed. Puter exposes an
 * OpenAI-compatible endpoint (`PUTER_OPENAI_CHAT_URL`), so this reuses the
 * exact same `callOpenAiCompatible()` path every other "openai style" model
 * above uses — no engine changes required for this to actually run.
 *
 * Get the token free at https://puter.com/dashboard → API Tokens → Create
 * token, then paste it into this node's credential (still using the "API
 * key" credential type — Puter's token *is* the bearer token).
 *
 * For pure client-side use with **zero token at all** (the browser's own
 * Puter session covers it), see `src/lib/puter.ts` (`puterChat`) — that's
 * what the in-app AI Builder chat panel already uses.
 */
export const puterModel = modelNode({
  kind: "puterModel",
  name: "Puter AI Model (No API Key)",
  icon: "sparkles",
  description:
    "GPT, Claude, Gemini, DeepSeek & 500+ more via Puter.js — one free Puter token instead of separate paid provider keys. Get one at puter.com/dashboard.",
  models: PUTER_MODELS.map((m) => m.id),
  baseUrl: PUTER_OPENAI_CHAT_URL,
  credentialType: "apiKey",
});

export const groqModel = modelNode({
  kind: "groqModel",
  name: "Groq Chat Model",
  icon: "groq",
  description: "Low-latency open models hosted on Groq.",
  models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  credentialType: "apiKey",
});

export const openRouterModel = modelNode({
  kind: "openRouterModel",
  name: "OpenRouter Chat Model",
  icon: "openrouter",
  description: "Any model available through OpenRouter.",
  models: ["anthropic/claude-sonnet-4.5", "openai/gpt-4.1", "meta-llama/llama-3.3-70b-instruct"],
  baseUrl: "https://openrouter.ai/api/v1/chat/completions",
  credentialType: "apiKey",
});

// ------------------------------------------------------------------- Memory

export const bufferMemory: NodeModule = {
  kind: "bufferMemory",
  name: "Window Buffer Memory",
  group: "AI Memory",
  description: "Keeps the last N messages of a session in the database.",
  icon: "memory",
  subType: "ai_memory",
  keywords: ["memory", "history", "context", "session"],
  outputs: [{ handle: "ai_memory", label: "Memory" }],
  fields: [
    { key: "sessionKey", label: "Session key", type: "text", placeholder: "{{ $json.sessionId }}" },
    { key: "window", label: "Messages to keep", type: "number" },
  ],
  defaults: { sessionKey: "", window: 20 },
  execute: (ctx) => main([{ window: Number(ctx.params.window ?? 20) }]),
};

// -------------------------------------------------------------------- Tools

export const httpTool: NodeModule = {
  kind: "httpTool",
  name: "HTTP Request Tool",
  group: "AI Tools",
  description: "Lets an agent call any HTTP API you describe.",
  icon: "globe",
  subType: "ai_tool",
  keywords: ["tool", "api", "http", "agent"],
  outputs: [{ handle: "ai_tool", label: "Tool" }],
  credentialType: "bearer",
  fields: [
    { key: "toolName", label: "Tool name", type: "text", placeholder: "get_weather" },
    { key: "toolDescription", label: "When should the agent use it?", type: "code" },
    { key: "url", label: "URL (may use {query})", type: "text" },
    { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "DELETE"] },
    { key: "bodyTemplate", label: "Body template (JSON, may use {query})", type: "code" },
  ],
  defaults: {
    toolName: "http_call",
    toolDescription: "Call an external API and return its JSON response.",
    url: "https://api.example.com/search?q={query}",
    method: "GET",
    bodyTemplate: "",
  },
  execute: async (ctx) => {
    const query = String(getPath(ctx.items[0] ?? {}, "query") ?? "");
    const url = String(ctx.params.url ?? "").replace(/\{query\}/g, encodeURIComponent(query));
    const bodyTemplate = String(ctx.params.bodyTemplate ?? "").replace(/\{query\}/g, query);
    const headers = headersFromCredentialFields(ctx.credential as Record<string, string>);
    const res = await ctx.http({
      url,
      method: String(ctx.params.method ?? "GET"),
      headers,
      ...(bodyTemplate ? { body: bodyTemplate } : {}),
    });
    return main(toItems(res.body as Json));
  },
};

export const calculatorTool: NodeModule = {
  kind: "calculatorTool",
  name: "Calculator Tool",
  group: "AI Tools",
  description: "Gives an agent exact arithmetic.",
  icon: "calculator",
  subType: "ai_tool",
  keywords: ["tool", "math", "calculate"],
  outputs: [{ handle: "ai_tool", label: "Tool" }],
  fields: [],
  defaults: {},
  execute: (ctx) => {
    const expression = String(getPath(ctx.items[0] ?? {}, "query") ?? "");
    if (!/^[\d\s+\-*/().%]+$/.test(expression))
      throw new Error("Calculator only accepts numbers and + - * / ( ) %");
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${expression});`)() as number;
    return main([{ expression, value }]);
  },
};

export const workflowTool: NodeModule = {
  kind: "workflowTool",
  name: "Call Workflow Tool",
  group: "AI Tools",
  description: "Exposes another workflow as an agent tool.",
  icon: "workflow",
  subType: "ai_tool",
  keywords: ["tool", "workflow", "sub"],
  outputs: [{ handle: "ai_tool", label: "Tool" }],
  fields: [
    { key: "toolName", label: "Tool name", type: "text" },
    { key: "toolDescription", label: "Description", type: "code" },
    { key: "workflow", label: "Workflow name or ID", type: "text" },
  ],
  defaults: { toolName: "run_workflow", toolDescription: "Run a helper workflow.", workflow: "" },
  execute: async (ctx) => {
    const items = await ctx.callWorkflow(String(ctx.params.workflow ?? ""), ctx.items);
    return main(items);
  },
};

const toolDefs = (ctx: Parameters<NodeModule["execute"]>[0]): ChatToolDef[] =>
  (ctx.subNodes['ai_tool'] ?? []).map((tool) => ({
    name: String(
      (tool.params as Record<string, Json>)['toolName'] ??
        tool.label.toLowerCase().replace(/\W+/g, "_"),
    ),
    description: String((tool.params as Record<string, Json>)['toolDescription'] ?? tool.label),
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Input for the tool" } },
      required: ["query"],
    },
  }));

// --------------------------------------------------------------- Root nodes

export const aiAgent: NodeModule = {
  kind: "aiAgent",
  name: "AI Agent",
  group: "AI",
  description: "Tool-calling agent: reasons in a loop, calls tools, keeps memory.",
  icon: "bot",
  keywords: ["agent", "ai", "tools", "reason", "assistant"],
  inputs: [
    { type: "main", label: "Input" },
    { type: "ai_languageModel", label: "Chat Model", required: true },
    { type: "ai_memory", label: "Memory" },
    { type: "ai_tool", label: "Tool" },
  ],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "systemPrompt", label: "System prompt", type: "code" },
    { key: "userPrompt", label: "User message", type: "code", placeholder: "{{ $json.message }}" },
    { key: "maxSteps", label: "Max tool steps", type: "number" },
    { key: "sessionKey", label: "Session key (for memory)", type: "text" },
  ],
  defaults: {
    systemPrompt: "You are a helpful automation assistant.",
    userPrompt: "{{ $json.message }}",
    maxSteps: 6,
    sessionKey: "",
  },
  execute: async (ctx) => {
    const memoryNode = ctx.subNodes['ai_memory']?.[0];
    const out: Json[] = [];
    const items = ctx.items.length ? ctx.items : [{} as Json];

    for (const [index, item] of items.entries()) {
      const sessionId =
        String(ctx.expr(ctx.params.sessionKey, item, index) || "") || ctx.sessionId;
      const window = Number((memoryNode?.params as Record<string, Json>)?.['window'] ?? 20);
      const history = memoryNode ? await ctx.memory.load(sessionId, window) : [];
      const userText = String(ctx.expr(ctx.params.userPrompt, item, index) ?? "");
      const messages: ChatMessage[] = [
        { role: "system", content: String(ctx.expr(ctx.params.systemPrompt, item, index) ?? "") },
        ...history,
        { role: "user", content: userText },
      ];
      const tools = toolDefs(ctx);
      const maxSteps = Math.max(1, Number(ctx.params.maxSteps ?? 6));
      let text = "";
      const steps: Json[] = [];

      for (let step = 0; step < maxSteps; step++) {
        const res = await ctx.chat({ messages, ...(tools.length ? { tools } : {}) });
        text = res.text;
        if (!res.toolCalls?.length) break;
        messages.push({
          role: "assistant",
          content: res.text,
          tool_calls: res.toolCalls.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: { name: c.name, arguments: JSON.stringify(c.arguments) },
          })),
        });
        for (const call of res.toolCalls) {
          const tool = (ctx.subNodes['ai_tool'] ?? []).find(
            (t) =>
              String((t.params as Record<string, Json>)['toolName'] ?? "") === call.name ||
              t.label.toLowerCase().replace(/\W+/g, "_") === call.name,
          );
          if (!tool) {
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: `Unknown tool ${call.name}`,
            });
            continue;
          }
          ctx.log(`Tool ${call.name}(${JSON.stringify(call.arguments).slice(0, 120)})`);
          try {
            const result = await tool.invoke(toItems(call.arguments));
            steps.push({ tool: call.name, arguments: call.arguments, result });
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result).slice(0, 4000),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            steps.push({ tool: call.name, error: message });
            messages.push({ role: "tool", tool_call_id: call.id, content: `Error: ${message}` });
          }
        }
      }

      if (memoryNode)
        await ctx.memory.append(sessionId, [
          { role: "user", content: userText },
          { role: "assistant", content: text },
        ]);
      out.push({ ...item, output: text, sessionId, toolSteps: steps });
    }
    return main(out);
  },
};

export const basicLlmChain: NodeModule = {
  kind: "basicLlmChain",
  name: "Basic LLM Chain",
  group: "AI",
  description: "One prompt in, text (or JSON) out.",
  icon: "brain",
  keywords: ["llm", "prompt", "chain", "generate", "summarize"],
  inputs: [
    { type: "main", label: "Input" },
    { type: "ai_languageModel", label: "Chat Model", required: true },
  ],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "prompt", label: "Prompt", type: "code", placeholder: "Summarise: {{ $json.text }}" },
    { key: "systemPrompt", label: "System prompt", type: "code" },
    { key: "jsonSchema", label: "JSON schema (optional)", type: "code" },
    { key: "target", label: "Write result to field", type: "text" },
  ],
  defaults: {
    prompt: "Summarise this in one sentence: {{ $json.text }}",
    systemPrompt: "",
    jsonSchema: "",
    target: "output",
  },
  execute: async (ctx) => {
    const schemaText = String(ctx.params.jsonSchema ?? "").trim();
    const schema = schemaText ? parseJson(schemaText, null) : null;
    const out: Json[] = [];
    for (const [index, item] of (ctx.items.length ? ctx.items : [{} as Json]).entries()) {
      const system = String(ctx.expr(ctx.params.systemPrompt, item, index) ?? "");
      const messages: ChatMessage[] = [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user", content: String(ctx.expr(ctx.params.prompt, item, index) ?? "") },
      ];
      const res = await ctx.chat({ messages, ...(schema ? { jsonSchema: schema } : {}) });
      const value = schema ? parseJson(res.text, res.text) : res.text;
      out.push({ ...item, [String(ctx.params.target || "output")]: value });
    }
    return main(out);
  },
};

export const informationExtractor: NodeModule = {
  kind: "informationExtractor",
  name: "Information Extractor",
  group: "AI",
  description: "Pulls structured fields out of free text using a schema.",
  icon: "scan",
  keywords: ["extract", "structured", "parse", "schema", "ai"],
  inputs: [
    { type: "main", label: "Input" },
    { type: "ai_languageModel", label: "Chat Model", required: true },
  ],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "Text", type: "code", placeholder: "{{ $json.text }}" },
    { key: "attributes", label: "Fields to extract (comma separated)", type: "text" },
  ],
  defaults: { source: "{{ $json.text }}", attributes: "name, email, intent" },
  execute: async (ctx) => {
    const attrs = String(ctx.params.attributes ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const schema: Json = {
      type: "object",
      properties: Object.fromEntries(attrs.map((a) => [a, { type: "string" }])),
    };
    const out: Json[] = [];
    for (const [index, item] of ctx.items.entries()) {
      const res = await ctx.chat({
        messages: [
          {
            role: "system",
            content: `Extract these fields as JSON: ${attrs.join(", ")}. Use null when absent.`,
          },
          { role: "user", content: String(ctx.expr(ctx.params.source, item, index) ?? "") },
        ],
        jsonSchema: schema,
      });
      out.push({ ...item, ...(parseJson(res.text, {}) as Record<string, Json>) });
    }
    return main(out);
  },
};

export const textClassifier: NodeModule = {
  kind: "textClassifier",
  name: "Text Classifier",
  group: "AI",
  description: "Routes each item into one of your categories.",
  icon: "tags",
  keywords: ["classify", "category", "route", "sentiment", "ai"],
  inputs: [
    { type: "main", label: "Input" },
    { type: "ai_languageModel", label: "Chat Model", required: true },
  ],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "Text", type: "code" },
    { key: "categories", label: "Categories (comma separated)", type: "text" },
    { key: "target", label: "Write category to field", type: "text" },
  ],
  defaults: {
    source: "{{ $json.text }}",
    categories: "bug, feature request, question, spam",
    target: "category",
  },
  execute: async (ctx) => {
    const categories = String(ctx.params.categories ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const out: Json[] = [];
    for (const [index, item] of ctx.items.entries()) {
      const res = await ctx.chat({
        messages: [
          {
            role: "system",
            content: `Classify the text into exactly one of: ${categories.join(", ")}. Reply with the category only.`,
          },
          { role: "user", content: String(ctx.expr(ctx.params.source, item, index) ?? "") },
        ],
        temperature: 0,
      });
      const answer = res.text.trim().toLowerCase();
      const matched = categories.find((c) => answer.includes(c.toLowerCase())) ?? categories.at(-1);
      out.push({ ...item, [String(ctx.params.target || "category")]: matched ?? null });
    }
    return main(out);
  },
};

export const aiNodes = [
  puterModel,
  openAiModel,
  anthropicModel,
  groqModel,
  openRouterModel,
  bufferMemory,
  httpTool,
  calculatorTool,
  workflowTool,
  aiAgent,
  basicLlmChain,
  informationExtractor,
  textClassifier,
];
