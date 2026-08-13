import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "./types";
import { getPath, main, parseJson } from "./types";

/**
 * Extra agent tools and AI utility nodes. Tool sub-nodes attach to an Agent
 * through the `ai_tool` connection; utility nodes run inline in the data flow.
 */

function toolNode(opts: {
  kind: string;
  name: string;
  icon: string;
  description: string;
  fields: NodeModule["fields"];
  defaults: NodeModule["defaults"];
  credentialType?: NonNullable<NodeModule["credentialType"]>;
  run: NodeModule["execute"];
}): NodeModule {
  return {
    kind: opts.kind,
    name: opts.name,
    group: "AI Tools",
    description: opts.description,
    icon: opts.icon,
    subType: "ai_tool",
    ...(opts.credentialType ? { credentialType: opts.credentialType } : {}),
    keywords: ["tool", "agent", opts.name.toLowerCase()],
    outputs: [{ handle: "ai_tool", label: "Tool" }],
    fields: [
      { key: "toolName", label: "Tool name (shown to the model)", type: "text" },
      { key: "toolDescription", label: "Tool description", type: "textarea" },
      ...opts.fields,
    ],
    defaults: { toolName: opts.kind, toolDescription: opts.description, ...opts.defaults },
    execute: opts.run,
  };
}

const key = (ctx: { credential: Json }) => {
  const cred = (ctx.credential ?? {}) as Record<string, string>;
  return cred['apiKey'] ?? cred['token'] ?? "";
};

export const webSearchTool = toolNode({
  kind: "webSearchTool",
  name: "Web Search Tool",
  icon: "search",
  description: "Lets the agent search the live web (Tavily).",
  credentialType: "apiKey",
  fields: [{ key: "maxResults", label: "Max results", type: "number" }],
  defaults: { maxResults: 5 },
  run: async (ctx) => {
    const query = String(getPath(ctx.items[0] ?? {}, "query") ?? ctx.expr("{{ $json.query }}", ctx.items[0] ?? {}, 0) ?? "");
    const res = await ctx.http({
      url: "https://api.tavily.com/search",
      method: "POST",
      headers: { Authorization: `Bearer ${key(ctx)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: Number(ctx.params.maxResults ?? 5) }),
    });
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    return main(((getPath(res.body, "results") ?? []) as Json[]).slice(0, Number(ctx.params.maxResults ?? 5)));
  },
});

export const scrapeTool = toolNode({
  kind: "webScrapeTool",
  name: "Web Page Tool",
  icon: "globe",
  description: "Fetches a URL and returns its readable text to the agent.",
  fields: [{ key: "url", label: "URL", type: "text", placeholder: "{{ $json.url }}" }],
  defaults: { url: "{{ $json.url }}" },
  run: async (ctx) => {
    const url = String(ctx.expr(ctx.params.url, ctx.items[0] ?? {}, 0) ?? "");
    const res = await ctx.http({ url, method: "GET" });
    const html = typeof res.body === "string" ? res.body : JSON.stringify(res.body);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return main([{ url, status: res.status, text: text.slice(0, 20000) }]);
  },
});

export const codeTool = toolNode({
  kind: "codeTool",
  name: "Code Tool",
  icon: "terminal",
  description: "Runs a sandboxed JavaScript snippet the agent can call with arguments.",
  fields: [{ key: "code", label: "JavaScript (receives `args`, returns a value)", type: "code" }],
  defaults: { code: "return args.a + args.b;" },
  run: (ctx) => {
    const args = (ctx.items[0] ?? {}) as Json;
    const fn = new Function("args", String(ctx.params.code ?? "return null;"));
    return main([{ result: fn(args) as Json }]);
  },
});

export const vectorStoreTool = toolNode({
  kind: "vectorStoreTool",
  name: "Knowledge Base Tool",
  icon: "book",
  description: "Lets the agent search a connected vector store for context.",
  fields: [
    { key: "topK", label: "Top K", type: "number" },
    { key: "textField", label: "Text field", type: "text" },
  ],
  defaults: { topK: 4, textField: "text" },
  run: async (ctx) => {
    const store = ctx.subNodes.ai_vectorStore?.[0];
    if (!store) throw new Error("Connect a vector store to this tool");
    const results = await store.invoke(ctx.items);
    return main(results.slice(0, Number(ctx.params.topK ?? 4)));
  },
});

export const sentimentAnalysis: NodeModule = {
  kind: "sentimentAnalysis",
  name: "Sentiment Analysis",
  group: "AI",
  description: "Classify each item's text as positive, neutral or negative with a score.",
  icon: "brain",
  inputs: [{ type: "ai_languageModel", label: "Model", required: true }],
  keywords: ["sentiment", "tone", "classify", "nlp"],
  outputs: [
    { handle: "main", label: "positive" },
    { handle: "neutral", label: "neutral" },
    { handle: "negative", label: "negative" },
  ],
  fields: [
    { key: "textField", label: "Text field", type: "text" },
    { key: "systemPrompt", label: "System prompt", type: "textarea" },
  ],
  defaults: {
    textField: "text",
    systemPrompt: "You classify sentiment. Reply with JSON only.",
  },
  execute: async (ctx) => {
    const out: Record<string, Json[]> = { main: [], neutral: [], negative: [] };
    for (const item of ctx.items) {
      const text = String(getPath(item, String(ctx.params.textField || "text")) ?? "");
      const res = await ctx.chat({
        messages: [
          { role: "system", content: String(ctx.params.systemPrompt ?? "") },
          {
            role: "user",
            content: `Classify the sentiment of this text. Respond as {"sentiment":"positive|neutral|negative","score":0-1}.\n\n${text}`,
          },
        ],
        jsonSchema: {
          type: "object",
          required: ["sentiment", "score"],
          properties: {
            sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
            score: { type: "number" },
          },
        },
      });
      const parsed = parseJson(res.text, { sentiment: "neutral", score: 0 }) as Record<string, Json>;
      const label = String(parsed['sentiment'] ?? "neutral");
      const enriched = { ...(item as Record<string, Json>), sentiment: label, sentimentScore: parsed['score'] ?? null };
      out[label === "positive" ? "main" : label === "negative" ? "negative" : "neutral"]!.push(enriched);
    }
    return out;
  },
};

export const summarizeChain: NodeModule = {
  kind: "summarizeChain",
  name: "Summarization Chain",
  group: "AI",
  description: "Summarize long text by mapping over chunks and reducing to one summary.",
  icon: "sparkles",
  inputs: [{ type: "ai_languageModel", label: "Model", required: true }],
  keywords: ["summary", "summarize", "map reduce", "condense"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "textField", label: "Text field", type: "text" },
    { key: "chunkSize", label: "Chunk size (characters)", type: "number" },
    { key: "instruction", label: "Instruction", type: "textarea" },
  ],
  defaults: {
    textField: "text",
    chunkSize: 6000,
    instruction: "Write a concise summary capturing the key points.",
  },
  execute: async (ctx) => {
    const size = Math.max(500, Number(ctx.params.chunkSize ?? 6000));
    const out: Json[] = [];
    for (const item of ctx.items) {
      const text = String(getPath(item, String(ctx.params.textField || "text")) ?? "");
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
      const partials: string[] = [];
      for (const chunk of chunks) {
        const res = await ctx.chat({
          messages: [
            { role: "system", content: String(ctx.params.instruction ?? "") },
            { role: "user", content: chunk },
          ],
        });
        partials.push(res.text);
      }
      const summary =
        partials.length > 1
          ? (
              await ctx.chat({
                messages: [
                  { role: "system", content: String(ctx.params.instruction ?? "") },
                  { role: "user", content: `Combine these partial summaries into one:\n\n${partials.join("\n\n")}` },
                ],
              })
            ).text
          : (partials[0] ?? "");
      ctx.log(`Summarized ${chunks.length} chunk(s)`);
      out.push({ ...(item as Record<string, Json>), summary });
    }
    return main(out);
  },
};

export const questionAnswer: NodeModule = {
  kind: "questionAnswerChain",
  name: "Question & Answer Chain",
  group: "AI",
  description: "Answer a question strictly from retrieved context items.",
  icon: "book",
  inputs: [
    { type: "ai_languageModel", label: "Model", required: true },
    { type: "ai_vectorStore", label: "Vector Store" },
  ],
  keywords: ["rag", "qa", "answer", "context", "retrieval"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "question", label: "Question", type: "text", placeholder: "{{ $json.question }}" },
    { key: "contextField", label: "Context field on items", type: "text" },
    { key: "systemPrompt", label: "System prompt", type: "textarea" },
  ],
  defaults: {
    question: "{{ $json.question }}",
    contextField: "text",
    systemPrompt: "Answer using only the provided context. If the answer is not there, say you don't know.",
  },
  execute: async (ctx) => {
    const question = String(ctx.expr(ctx.params.question, ctx.items[0] ?? {}, 0) ?? "");
    const store = ctx.subNodes.ai_vectorStore?.[0];
    const contextItems = store ? await store.invoke([{ query: question }]) : ctx.items;
    const context = contextItems
      .map((item, i) => `[${i + 1}] ${String(getPath(item, String(ctx.params.contextField || "text")) ?? "")}`)
      .join("\n\n");
    const res = await ctx.chat({
      messages: [
        { role: "system", content: String(ctx.params.systemPrompt ?? "") },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
    });
    return main([{ question, answer: res.text, sources: contextItems.length }]);
  },
};

export const aiTools2Nodes: NodeModule[] = [
  webSearchTool,
  scrapeTool,
  codeTool,
  vectorStoreTool,
  sentimentAnalysis,
  summarizeChain,
  questionAnswer,
];
