import type { Json } from "@/lib/flow/types";
import type { NodeContext, NodeModule } from "./types";
import { getPath, main, parseJson } from "./types";

/**
 * Retrieval-augmented generation building blocks: text splitting, embeddings
 * providers, vector stores and a reranker. Every provider call is a real HTTP
 * request made with the credential attached to the node.
 */

const credKey = (ctx: NodeContext) => {
  const cred = (ctx.credential ?? {}) as Record<string, string>;
  return cred['apiKey'] ?? cred['token'] ?? "";
};

interface EmbeddingProvider {
  kind: string;
  name: string;
  icon: string;
  url: string;
  models: string[];
  description: string;
}

/** POST an OpenAI-shaped embeddings request and return one vector per input. */
async function embedTexts(
  ctx: NodeContext,
  url: string,
  model: string,
  texts: string[],
): Promise<number[][]> {
  const key = credKey(ctx);
  if (!key) throw new Error("Missing API key — attach a credential to the embeddings node");
  const res = await ctx.http({
    url,
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`Embeddings request failed (${res.status}): ${JSON.stringify(res.body)}`);
  const data = getPath(res.body, "data");
  if (!Array.isArray(data)) throw new Error("Unexpected embeddings response shape");
  return data.map((entry) => (getPath(entry as Json, "embedding") ?? []) as number[]);
}

function embeddingNode(provider: EmbeddingProvider): NodeModule {
  return {
    kind: provider.kind,
    name: provider.name,
    group: "AI Retrieval",
    description: provider.description,
    icon: provider.icon,
    subType: "ai_embedding",
    credentialType: "apiKey",
    keywords: ["embedding", "vector", "rag", provider.name.toLowerCase()],
    outputs: [{ handle: "ai_embedding", label: "Embedding" }],
    fields: [
      { key: "model", label: "Model", type: "select", options: provider.models },
      { key: "textField", label: "Text field", type: "text", placeholder: "text" },
      { key: "target", label: "Write vector to field", type: "text" },
      { key: "baseUrl", label: "Custom endpoint (optional)", type: "text" },
    ],
    defaults: { model: provider.models[0]!, textField: "text", target: "embedding", baseUrl: "" },
    execute: async (ctx) => {
      const url = String(ctx.params.baseUrl || provider.url);
      const model = String(ctx.params.model ?? provider.models[0]);
      const field = String(ctx.params.textField || "text");
      const target = String(ctx.params.target || "embedding");
      if (!ctx.items.length) return main([{ provider: provider.kind, model }]);
      const texts = ctx.items.map((item) => String(getPath(item, field) ?? ""));
      const vectors = await embedTexts(ctx, url, model, texts);
      ctx.log(`Embedded ${texts.length} text(s) with ${model}`);
      return main(
        ctx.items.map((item, i) => ({ ...(item as Record<string, Json>), [target]: vectors[i] ?? [] }) as Json),
      );
    },
  };
}

export const openAiEmbeddings = embeddingNode({
  kind: "openAiEmbeddings",
  name: "OpenAI Embeddings",
  icon: "openai",
  url: "https://api.openai.com/v1/embeddings",
  models: ["text-embedding-3-small", "text-embedding-3-large"],
  description: "Create OpenAI embedding vectors for text.",
});

export const mistralEmbeddings = embeddingNode({
  kind: "mistralEmbeddings",
  name: "Mistral Embeddings",
  icon: "mistralai",
  url: "https://api.mistral.ai/v1/embeddings",
  models: ["mistral-embed"],
  description: "Mistral embedding vectors.",
});

export const voyageEmbeddings = embeddingNode({
  kind: "voyageEmbeddings",
  name: "Voyage Embeddings",
  icon: "voyage",
  url: "https://api.voyageai.com/v1/embeddings",
  models: ["voyage-3", "voyage-3-lite", "voyage-code-3"],
  description: "Voyage AI embeddings, strong for code and retrieval.",
});

export const jinaEmbeddings = embeddingNode({
  kind: "jinaEmbeddings",
  name: "Jina Embeddings",
  icon: "jinaai",
  url: "https://api.jina.ai/v1/embeddings",
  models: ["jina-embeddings-v3", "jina-clip-v2"],
  description: "Jina AI multilingual and multimodal embeddings.",
});

export const cohereEmbeddings: NodeModule = {
  kind: "cohereEmbeddings",
  name: "Cohere Embeddings",
  group: "AI Retrieval",
  description: "Cohere embed-v4 vectors for search and classification.",
  icon: "cohere",
  subType: "ai_embedding",
  credentialType: "apiKey",
  keywords: ["embedding", "cohere", "vector", "rag"],
  outputs: [{ handle: "ai_embedding", label: "Embedding" }],
  fields: [
    { key: "model", label: "Model", type: "select", options: ["embed-v4.0", "embed-multilingual-v3.0"] },
    { key: "inputType", label: "Input type", type: "select", options: ["search_document", "search_query", "classification"] },
    { key: "textField", label: "Text field", type: "text" },
    { key: "target", label: "Write vector to field", type: "text" },
  ],
  defaults: { model: "embed-v4.0", inputType: "search_document", textField: "text", target: "embedding" },
  execute: async (ctx) => {
    const key = credKey(ctx);
    if (!key) throw new Error("Missing Cohere API key");
    const texts = ctx.items.map((item) => String(getPath(item, String(ctx.params.textField || "text")) ?? ""));
    const res = await ctx.http({
      url: "https://api.cohere.com/v2/embed",
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ctx.params.model,
        input_type: ctx.params.inputType,
        embedding_types: ["float"],
        texts,
      }),
    });
    if (!res.ok) throw new Error(`Cohere embed failed (${res.status})`);
    const vectors = (getPath(res.body, "embeddings.float") ?? []) as number[][];
    const target = String(ctx.params.target || "embedding");
    return main(
      ctx.items.map((item, i) => ({ ...(item as Record<string, Json>), [target]: vectors[i] ?? [] }) as Json),
    );
  },
};

// ------------------------------------------------------------- Text splitting

export const textSplitter: NodeModule = {
  kind: "textSplitter",
  name: "Text Splitter",
  group: "AI Retrieval",
  description: "Chunk long text into overlapping pieces ready for embedding.",
  icon: "layers",
  keywords: ["chunk", "split", "rag", "tokens", "documents"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "textField", label: "Text field", type: "text" },
    { key: "chunkSize", label: "Chunk size (characters)", type: "number" },
    { key: "overlap", label: "Overlap (characters)", type: "number" },
    { key: "strategy", label: "Strategy", type: "select", options: ["recursive", "paragraph", "sentence", "fixed"] },
  ],
  defaults: { textField: "text", chunkSize: 1000, overlap: 150, strategy: "recursive" },
  execute: (ctx) => {
    const size = Math.max(50, Number(ctx.params.chunkSize ?? 1000));
    const overlap = Math.min(size - 1, Math.max(0, Number(ctx.params.overlap ?? 150)));
    const strategy = String(ctx.params.strategy ?? "recursive");
    const field = String(ctx.params.textField || "text");
    const out: Json[] = [];
    for (const item of ctx.items) {
      const text = String(getPath(item, field) ?? "");
      let pieces: string[] = [];
      if (strategy === "paragraph") pieces = text.split(/\n{2,}/);
      else if (strategy === "sentence") pieces = text.split(/(?<=[.!?])\s+/);
      else pieces = [text];
      const chunks: string[] = [];
      for (const piece of pieces) {
        if (strategy !== "fixed" && piece.length <= size && strategy !== "recursive") {
          chunks.push(piece.trim());
          continue;
        }
        for (let i = 0; i < piece.length; i += size - overlap) {
          const chunk = piece.slice(i, i + size).trim();
          if (chunk) chunks.push(chunk);
          if (i + size >= piece.length) break;
        }
      }
      chunks
        .filter(Boolean)
        .forEach((chunk, index) =>
          out.push({ ...(item as Record<string, Json>), chunkIndex: index, chunkCount: chunks.length, text: chunk }),
        );
    }
    ctx.log(`Produced ${out.length} chunk(s)`);
    return main(out);
  },
};

// --------------------------------------------------------------- Vector stores

/** Resolve a query vector: use the item's vector field, or the wired embedding sub-node. */
async function resolveVector(ctx: NodeContext, item: Json, field: string): Promise<number[]> {
  const existing = getPath(item, field);
  if (Array.isArray(existing) && existing.length) return existing as number[];
  const embedder = ctx.subNodes.ai_embedding?.[0];
  if (!embedder) throw new Error(`No vector in "${field}" and no Embedding sub-node connected`);
  const [result] = await embedder.invoke([item]);
  const vector = getPath(result ?? null, "embedding");
  if (!Array.isArray(vector)) throw new Error("Embedding sub-node returned no vector");
  return vector as number[];
}

const vectorFields = [
  { key: "operation", label: "Operation", type: "select" as const, options: ["insert", "query", "delete"] },
  { key: "vectorField", label: "Vector field on item", type: "text" as const },
  { key: "textField", label: "Text field", type: "text" as const },
  { key: "topK", label: "Top K (query)", type: "number" as const },
  { key: "metadata", label: "Metadata (JSON)", type: "code" as const },
];

export const pineconeStore: NodeModule = {
  kind: "pineconeVectorStore",
  name: "Pinecone Vector Store",
  group: "AI Retrieval",
  description: "Upsert and query vectors in a Pinecone index.",
  icon: "pinecone",
  credentialType: "apiKey",
  inputs: [{ type: "ai_embedding", label: "Embedding" }],
  keywords: ["vector", "pinecone", "rag", "similarity"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "indexHost", label: "Index host (https://index-xxx.svc.region.pinecone.io)", type: "text" },
    { key: "namespace", label: "Namespace", type: "text" },
    ...vectorFields,
  ],
  defaults: {
    indexHost: "",
    namespace: "",
    operation: "query",
    vectorField: "embedding",
    textField: "text",
    topK: 5,
    metadata: "{}",
  },
  execute: async (ctx) => {
    const key = credKey(ctx);
    const host = String(ctx.params.indexHost ?? "").replace(/\/$/, "");
    if (!host) throw new Error("Pinecone index host is required");
    const op = String(ctx.params.operation ?? "query");
    const namespace = String(ctx.params.namespace ?? "");
    const headers = { "Api-Key": key, "Content-Type": "application/json" };
    const vectorField = String(ctx.params.vectorField || "embedding");

    if (op === "insert") {
      const vectors = [] as Json[];
      for (const [i, item] of ctx.items.entries()) {
        const values = await resolveVector(ctx, item, vectorField);
        vectors.push({
          id: String(getPath(item, "id") ?? `${Date.now()}-${i}`),
          values,
          metadata: {
            text: String(getPath(item, String(ctx.params.textField || "text")) ?? ""),
            ...(parseJson(ctx.expr(ctx.params.metadata, item, i), {}) as Record<string, Json>),
          },
        });
      }
      const res = await ctx.http({
        url: `${host}/vectors/upsert`,
        method: "POST",
        headers,
        body: JSON.stringify({ vectors, namespace }),
      });
      if (!res.ok) throw new Error(`Pinecone upsert failed (${res.status})`);
      return main([{ upserted: vectors.length, response: res.body }]);
    }

    if (op === "delete") {
      const ids = ctx.items.map((item) => String(getPath(item, "id") ?? ""));
      const res = await ctx.http({
        url: `${host}/vectors/delete`,
        method: "POST",
        headers,
        body: JSON.stringify({ ids, namespace }),
      });
      return main([{ deleted: ids.length, ok: res.ok }]);
    }

    const out: Json[] = [];
    for (const item of ctx.items.length ? ctx.items : [{} as Json]) {
      const vector = await resolveVector(ctx, item, vectorField);
      const res = await ctx.http({
        url: `${host}/query`,
        method: "POST",
        headers,
        body: JSON.stringify({
          vector,
          topK: Number(ctx.params.topK ?? 5),
          includeMetadata: true,
          namespace,
        }),
      });
      if (!res.ok) throw new Error(`Pinecone query failed (${res.status})`);
      for (const match of (getPath(res.body, "matches") ?? []) as Json[])
        out.push({
          id: getPath(match, "id"),
          score: getPath(match, "score"),
          text: getPath(match, "metadata.text"),
          metadata: getPath(match, "metadata"),
        });
    }
    return main(out);
  },
};

export const qdrantStore: NodeModule = {
  kind: "qdrantVectorStore",
  name: "Qdrant Vector Store",
  group: "AI Retrieval",
  description: "Upsert and search points in a Qdrant collection.",
  icon: "qdrant",
  credentialType: "apiKey",
  inputs: [{ type: "ai_embedding", label: "Embedding" }],
  keywords: ["vector", "qdrant", "rag", "similarity"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "baseUrl", label: "Qdrant URL", type: "text", placeholder: "https://your-cluster.qdrant.io" },
    { key: "collection", label: "Collection", type: "text" },
    ...vectorFields,
  ],
  defaults: {
    baseUrl: "",
    collection: "documents",
    operation: "query",
    vectorField: "embedding",
    textField: "text",
    topK: 5,
    metadata: "{}",
  },
  execute: async (ctx) => {
    const base = String(ctx.params.baseUrl ?? "").replace(/\/$/, "");
    const collection = String(ctx.params.collection || "documents");
    const headers = { "api-key": credKey(ctx), "Content-Type": "application/json" };
    const op = String(ctx.params.operation ?? "query");
    const vectorField = String(ctx.params.vectorField || "embedding");

    if (op === "insert") {
      const points: Json[] = [];
      for (const [i, item] of ctx.items.entries()) {
        points.push({
          id: getPath(item, "id") ?? crypto.randomUUID(),
          vector: await resolveVector(ctx, item, vectorField),
          payload: {
            text: String(getPath(item, String(ctx.params.textField || "text")) ?? ""),
            ...(parseJson(ctx.expr(ctx.params.metadata, item, i), {}) as Record<string, Json>),
          },
        });
      }
      const res = await ctx.http({
        url: `${base}/collections/${collection}/points?wait=true`,
        method: "PUT",
        headers,
        body: JSON.stringify({ points }),
      });
      if (!res.ok) throw new Error(`Qdrant upsert failed (${res.status})`);
      return main([{ upserted: points.length }]);
    }

    if (op === "delete") {
      const ids = ctx.items.map((item) => getPath(item, "id"));
      const res = await ctx.http({
        url: `${base}/collections/${collection}/points/delete?wait=true`,
        method: "POST",
        headers,
        body: JSON.stringify({ points: ids }),
      });
      return main([{ deleted: ids.length, ok: res.ok }]);
    }

    const out: Json[] = [];
    for (const item of ctx.items.length ? ctx.items : [{} as Json]) {
      const res = await ctx.http({
        url: `${base}/collections/${collection}/points/search`,
        method: "POST",
        headers,
        body: JSON.stringify({
          vector: await resolveVector(ctx, item, vectorField),
          limit: Number(ctx.params.topK ?? 5),
          with_payload: true,
        }),
      });
      if (!res.ok) throw new Error(`Qdrant search failed (${res.status})`);
      for (const hit of (getPath(res.body, "result") ?? []) as Json[])
        out.push({
          id: getPath(hit, "id"),
          score: getPath(hit, "score"),
          text: getPath(hit, "payload.text"),
          metadata: getPath(hit, "payload"),
        });
    }
    return main(out);
  },
};

export const supabaseVectorStore: NodeModule = {
  kind: "supabaseVectorStore",
  name: "Supabase Vector Store",
  group: "AI Retrieval",
  description: "Store vectors in a pgvector table and search with a match RPC.",
  icon: "supabase",
  credentialType: "apiKey",
  inputs: [{ type: "ai_embedding", label: "Embedding" }],
  keywords: ["vector", "pgvector", "supabase", "rag"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "projectUrl", label: "Project URL", type: "text", placeholder: "https://xxx.supabase.co" },
    { key: "table", label: "Table", type: "text" },
    { key: "matchFunction", label: "Match RPC name (query)", type: "text" },
    ...vectorFields,
  ],
  defaults: {
    projectUrl: "",
    table: "documents",
    matchFunction: "match_documents",
    operation: "query",
    vectorField: "embedding",
    textField: "text",
    topK: 5,
    metadata: "{}",
  },
  execute: async (ctx) => {
    const key = credKey(ctx);
    const base = String(ctx.params.projectUrl ?? "").replace(/\/$/, "");
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const op = String(ctx.params.operation ?? "query");
    const vectorField = String(ctx.params.vectorField || "embedding");

    if (op === "insert") {
      const rows: Json[] = [];
      for (const [i, item] of ctx.items.entries())
        rows.push({
          content: String(getPath(item, String(ctx.params.textField || "text")) ?? ""),
          embedding: await resolveVector(ctx, item, vectorField),
          metadata: parseJson(ctx.expr(ctx.params.metadata, item, i), {}),
        });
      const res = await ctx.http({
        url: `${base}/rest/v1/${ctx.params.table}`,
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`Supabase insert failed (${res.status}): ${JSON.stringify(res.body)}`);
      return main([{ inserted: rows.length, rows: res.body }]);
    }

    const out: Json[] = [];
    for (const item of ctx.items.length ? ctx.items : [{} as Json]) {
      const res = await ctx.http({
        url: `${base}/rest/v1/rpc/${ctx.params.matchFunction}`,
        method: "POST",
        headers,
        body: JSON.stringify({
          query_embedding: await resolveVector(ctx, item, vectorField),
          match_count: Number(ctx.params.topK ?? 5),
        }),
      });
      if (!res.ok) throw new Error(`Supabase match failed (${res.status})`);
      for (const row of (Array.isArray(res.body) ? res.body : []) as Json[]) out.push(row);
    }
    return main(out);
  },
};

export const weaviateStore: NodeModule = {
  kind: "weaviateVectorStore",
  name: "Weaviate Vector Store",
  group: "AI Retrieval",
  description: "Insert objects and run nearVector search in Weaviate.",
  icon: "weaviate",
  credentialType: "bearer",
  inputs: [{ type: "ai_embedding", label: "Embedding" }],
  keywords: ["vector", "weaviate", "rag"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "baseUrl", label: "Weaviate URL", type: "text" },
    { key: "className", label: "Class name", type: "text" },
    ...vectorFields,
  ],
  defaults: {
    baseUrl: "",
    className: "Document",
    operation: "query",
    vectorField: "embedding",
    textField: "text",
    topK: 5,
    metadata: "{}",
  },
  execute: async (ctx) => {
    const base = String(ctx.params.baseUrl ?? "").replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${credKey(ctx)}`, "Content-Type": "application/json" };
    const className = String(ctx.params.className || "Document");
    const vectorField = String(ctx.params.vectorField || "embedding");

    if (String(ctx.params.operation) === "insert") {
      let inserted = 0;
      for (const [i, item] of ctx.items.entries()) {
        const res = await ctx.http({
          url: `${base}/v1/objects`,
          method: "POST",
          headers,
          body: JSON.stringify({
            class: className,
            vector: await resolveVector(ctx, item, vectorField),
            properties: {
              text: String(getPath(item, String(ctx.params.textField || "text")) ?? ""),
              ...(parseJson(ctx.expr(ctx.params.metadata, item, i), {}) as Record<string, Json>),
            },
          }),
        });
        if (res.ok) inserted++;
      }
      return main([{ inserted }]);
    }

    const out: Json[] = [];
    for (const item of ctx.items.length ? ctx.items : [{} as Json]) {
      const vector = await resolveVector(ctx, item, vectorField);
      const query = `{ Get { ${className}(nearVector: {vector: ${JSON.stringify(vector)}}, limit: ${Number(
        ctx.params.topK ?? 5,
      )}) { text _additional { id distance } } } }`;
      const res = await ctx.http({
        url: `${base}/v1/graphql`,
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`Weaviate search failed (${res.status})`);
      for (const hit of (getPath(res.body, `data.Get.${className}`) ?? []) as Json[]) out.push(hit);
    }
    return main(out);
  },
};

export const inMemoryVectorStore: NodeModule = {
  kind: "inMemoryVectorStore",
  name: "In-Memory Vector Store",
  group: "AI Retrieval",
  description: "Rank the incoming items against a query vector with cosine similarity.",
  icon: "memory",
  inputs: [{ type: "ai_embedding", label: "Embedding" }],
  keywords: ["vector", "cosine", "similarity", "rank", "rag"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "vectorField", label: "Vector field on items", type: "text" },
    { key: "queryVector", label: "Query vector (JSON) or expression", type: "code" },
    { key: "topK", label: "Top K", type: "number" },
  ],
  defaults: { vectorField: "embedding", queryVector: "", topK: 5 },
  execute: (ctx) => {
    const field = String(ctx.params.vectorField || "embedding");
    const query = parseJson(ctx.expr(ctx.params.queryVector, ctx.items[0] ?? {}, 0), []) as number[];
    if (!Array.isArray(query) || !query.length) throw new Error("A query vector is required");
    const cosine = (a: number[], b: number[]) => {
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        dot += a[i]! * b[i]!;
        na += a[i]! ** 2;
        nb += b[i]! ** 2;
      }
      return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
    };
    const scored = ctx.items
      .map((item) => ({
        ...(item as Record<string, Json>),
        score: cosine((getPath(item, field) ?? []) as number[], query),
      }))
      .sort((a, b) => (b.score as number) - (a.score as number))
      .slice(0, Math.max(1, Number(ctx.params.topK ?? 5)));
    return main(scored as Json[]);
  },
};

export const reranker: NodeModule = {
  kind: "cohereReranker",
  name: "Reranker (Cohere)",
  group: "AI Retrieval",
  description: "Re-order retrieved documents by relevance to a query.",
  icon: "cohere",
  credentialType: "apiKey",
  keywords: ["rerank", "relevance", "rag", "search"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "query", label: "Query", type: "text", placeholder: "{{ $json.question }}" },
    { key: "textField", label: "Document field", type: "text" },
    { key: "topN", label: "Top N", type: "number" },
    { key: "model", label: "Model", type: "select", options: ["rerank-v3.5", "rerank-multilingual-v3.0"] },
  ],
  defaults: { query: "", textField: "text", topN: 5, model: "rerank-v3.5" },
  execute: async (ctx) => {
    const key = credKey(ctx);
    if (!key) throw new Error("Missing Cohere API key");
    const field = String(ctx.params.textField || "text");
    const documents = ctx.items.map((item) => String(getPath(item, field) ?? ""));
    const res = await ctx.http({
      url: "https://api.cohere.com/v2/rerank",
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ctx.params.model,
        query: String(ctx.expr(ctx.params.query, ctx.items[0] ?? {}, 0) ?? ""),
        documents,
        top_n: Number(ctx.params.topN ?? 5),
      }),
    });
    if (!res.ok) throw new Error(`Rerank failed (${res.status})`);
    const results = (getPath(res.body, "results") ?? []) as Json[];
    return main(
      results.map((entry) => {
        const index = Number(getPath(entry, "index") ?? 0);
        return {
          ...(ctx.items[index] as Record<string, Json>),
          relevanceScore: getPath(entry, "relevance_score"),
        } as Json;
      }),
    );
  },
};

export const retrievalNodes: NodeModule[] = [
  textSplitter,
  openAiEmbeddings,
  cohereEmbeddings,
  mistralEmbeddings,
  voyageEmbeddings,
  jinaEmbeddings,
  pineconeStore,
  qdrantStore,
  supabaseVectorStore,
  weaviateStore,
  inMemoryVectorStore,
  reranker,
];
