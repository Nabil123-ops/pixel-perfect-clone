import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withWorkspace } from "@/integrations/supabase/workspace-middleware";
import type { StoredEdge, StoredNode } from "@/lib/flow/types";

/* ------------------------------------------------------------------ */
/* Ask AI — general assistant chat, powered by Groq                    */
/* ------------------------------------------------------------------ */

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const askAiSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
});

const ASSISTANT_SYSTEM_PROMPT = `You are the "Ask AI" assistant built into n9n, a self-hosted visual workflow
automation studio (think n8n): users wire together trigger nodes (Manual, Webhook, Schedule,
Chat, Form, RSS) and action nodes (HTTP Request, Code, If/Switch, Set, AI Agent, Slack, Discord,
Telegram, databases, and more) on a canvas, then run them server-side with full execution history.

Be concise, practical and friendly. Prefer short paragraphs or tight bullet lists over long essays.
When a user describes an automation they want, briefly explain how you'd build it as nodes, and
mention they can click "Create with AI" to have it generated and saved automatically. You cannot
directly click buttons or see their screen — only chat.`;

export const askAI = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: unknown) => askAiSchema.parse(d))
  .handler(async ({ data }) => {
    const { callGroq } = await import("@/lib/ai/groq.server");
    try {
      const result = await callGroq({
        messages: [
          { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.6,
        maxTokens: 700,
      });
      return { reply: result.text.trim() || "I didn't get a response — try asking again." };
    } catch (err) {
      return {
        reply: "",
        error: err instanceof Error ? err.message : "The AI assistant is unavailable right now.",
      };
    }
  });

/* ------------------------------------------------------------------ */
/* Create with AI — natural language -> real, saved workflow           */
/* ------------------------------------------------------------------ */

const generateSchema = z.object({
  prompt: z.string().min(3).max(1500),
});

interface AiNode {
  id: string;
  kind: string;
  label?: string;
  params?: Record<string, unknown>;
  x?: number;
  y?: number;
}

interface AiEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface AiWorkflowPayload {
  name?: string;
  summary?: string;
  nodes?: AiNode[];
  edges?: AiEdge[];
}

const uid = () => crypto.randomUUID().slice(0, 8);

async function buildCatalogPrompt(): Promise<string> {
  // Lazy import so this module stays tree-shakeable from client bundles that
  // never call generateWorkflowWithAI.
  const { CATALOG } = await import("@/lib/flow/catalog");
  return CATALOG.map((s) => {
    const fields = s.fields.map((f) => `${f.key}:${f.type}`).join(",") || "none";
    return `- ${s.kind} | group=${s.group} | ${s.name}${s.isTrigger ? " | TRIGGER" : ""} | ${s.description} | fields: ${fields}`;
  }).join("\n");
}

const WORKFLOW_SYSTEM_PROMPT = (catalog: string) => `You design automation workflows for n9n by emitting ONE JSON object — nothing else, no markdown fences, no commentary outside the JSON.

Available node kinds (use ONLY these "kind" values, exactly as spelled):
${catalog}

Output JSON shape:
{
  "name": "short workflow name",
  "summary": "one sentence describing what you built, for the user",
  "nodes": [
    { "id": "n1", "kind": "manualTrigger", "label": "Start", "params": { ... }, "x": 80, "y": 200 }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "sourceHandle": "main", "targetHandle": "main" }
  ]
}

Rules:
- The graph MUST start with exactly one trigger node (a kind marked TRIGGER above) chosen to match the request (chatTrigger for chat/assistant use cases, webhookTrigger for external calls, schedule for recurring jobs, manualTrigger otherwise).
- Use 3 to 9 nodes total — enough to be genuinely useful, not padded.
- Only set "params" keys that are listed in that node's "fields" above; fill in real, sensible values (real URLs, JS expressions, JSON) — never leave placeholders like "TODO".
- Data-flow connections use sourceHandle/targetHandle "main". AI capability wiring (a Chat Model / Memory / Tool feeding an AI Agent node) uses matching handles like "ai_languageModel", "ai_memory", "ai_tool" on both ends instead of "main".
- Every node id you invent must be referenced consistently between "nodes" and "edges".
- Lay nodes out left to right: x increasing by roughly 260-300 per step, y varying slightly (160-360) for branches.
- Return JSON only.`;

async function sanitizeWorkflow(
  payload: AiWorkflowPayload,
  prompt: string,
): Promise<{ name: string; summary: string; nodes: StoredNode[]; edges: StoredEdge[] }> {
  const { CATALOG } = await import("@/lib/flow/catalog");
  const specByKind = new Map(CATALOG.map((s) => [s.kind, s]));

  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const idMap = new Map<string, string>();
  const nodes: StoredNode[] = [];

  rawNodes.forEach((n, i) => {
    if (!n || typeof n.kind !== "string") return;
    const spec = specByKind.get(n.kind);
    if (!spec) return; // drop unknown node kinds rather than crash the canvas
    const newId = uid();
    idMap.set(String(n.id ?? i), newId);

    const allowedKeys = new Set(spec.fields.map((f) => f.key));
    const rawParams = n.params && typeof n.params === "object" ? n.params : {};
    const params: Record<string, unknown> = { ...spec.defaults };
    for (const [k, v] of Object.entries(rawParams)) {
      if (allowedKeys.has(k) && v !== undefined && v !== null) params[k] = v;
    }

    nodes.push({
      id: newId,
      position: {
        x: Number.isFinite(n.x) ? Number(n.x) : 80 + i * 280,
        y: Number.isFinite(n.y) ? Number(n.y) : 200 + (i % 3) * 90,
      },
      data: { kind: n.kind, label: String(n.label || spec.name), params },
    });
  });

  if (nodes.length === 0) {
    throw new Error(
      "The AI response didn't map to any known node types — try rephrasing your request.",
    );
  }

  // Guarantee exactly one trigger, at the front.
  const hasTrigger = nodes.some((n) => specByKind.get(n.data.kind)?.isTrigger);
  if (!hasTrigger) {
    const triggerId = uid();
    nodes.unshift({
      id: triggerId,
      position: { x: -260, y: nodes[0]?.position.y ?? 200 },
      data: {
        kind: "manualTrigger",
        label: "Start",
        params: { payload: '[{ "hello": "world" }]' },
      },
    });
  }

  const rawEdges = Array.isArray(payload.edges) ? payload.edges : [];
  const edges: StoredEdge[] = [];
  for (const e of rawEdges) {
    if (!e) continue;
    const source = idMap.get(String(e.source));
    const target = idMap.get(String(e.target));
    if (!source || !target) continue;
    edges.push({
      id: uid(),
      source,
      target,
      sourceHandle: e.sourceHandle || "main",
      targetHandle: e.targetHandle || "main",
    });
  }

  // If the model produced nodes but forgot edges (or we injected a trigger),
  // fall back to a straight chain over the main handle so the graph is never
  // a disconnected pile of nodes.
  if (edges.length === 0 && nodes.length > 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: uid(),
        source: nodes[i]!.id,
        target: nodes[i + 1]!.id,
        sourceHandle: "main",
        targetHandle: "main",
      });
    }
  } else if (!hasTrigger && nodes.length > 1) {
    // Trigger was injected after edges were built off the AI's ids — wire it in.
    edges.unshift({
      id: uid(),
      source: nodes[0]!.id,
      target: nodes[1]!.id,
      sourceHandle: "main",
      targetHandle: "main",
    });
  }

  const name = (payload.name || `AI: ${prompt}`).slice(0, 120);
  const summary = (payload.summary || "Workflow generated from your prompt.").slice(0, 400);
  return { name, summary, nodes, edges };
}

export const generateWorkflowWithAI = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: unknown) => generateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { callGroq, extractJson, groqWorkflowModel } = await import("@/lib/ai/groq.server");

    const catalog = await buildCatalogPrompt();
    const result = await callGroq({
      model: groqWorkflowModel(),
      jsonMode: true,
      temperature: 0.35,
      maxTokens: 3500,
      messages: [
        { role: "system", content: WORKFLOW_SYSTEM_PROMPT(catalog) },
        { role: "user", content: data.prompt },
      ],
    });

    let payload: AiWorkflowPayload;
    try {
      payload = extractJson<AiWorkflowPayload>(result.text);
    } catch {
      throw new Error("The AI didn't return valid workflow JSON — try rephrasing your request.");
    }

    const built = await sanitizeWorkflow(payload, data.prompt);

    const db = context.supabase;
    const { data: row, error } = await db
      .from("workflows")
      .insert({
        user_id: context.userId,
        name: built.name,
        active: false,
        nodes: built.nodes as never,
        edges: built.edges as never,
      })
      .select("id, version")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id as string,
      version: row.version as number,
      name: built.name,
      summary: built.summary,
      nodeCount: built.nodes.length,
      edgeCount: built.edges.length,
      nodes: built.nodes.map((n) => ({ kind: n.data.kind, label: n.data.label })),
    };
  });
