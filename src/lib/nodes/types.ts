import type { Json } from "@/lib/flow/types";

export const NODE_GROUPS = [
  "Triggers",
  "Core",
  "Logic",
  "Data",
  "Files",
  "Flow",
  "AI",
  "AI Models",
  "AI Memory",
  "AI Tools",
  "AI Retrieval",
  "Communication",
  "Databases",
  "Dev & Ops",
  "CRM & Commerce",
  "Marketing",
  "Social Media",
  "Productivity",
  "Forms & Surveys",
  "Analytics",
  "HR & Finance",
  "Cloud & Storage",
  "Utilities",
] as const;

export type NodeGroup = (typeof NODE_GROUPS)[number];

/**
 * Typed connections. `main` carries item arrays (data flow); every `ai_*` type
 * wires a capability sub-node into a root node (Agent / Chain / Vector store).
 */
export const CONN_TYPES = [
  "main",
  "ai_languageModel",
  "ai_memory",
  "ai_tool",
  "ai_embedding",
  "ai_vectorStore",
  "ai_outputParser",
] as const;

export type ConnType = (typeof CONN_TYPES)[number];

export const CONN_LABEL: Record<ConnType, string> = {
  main: "Main",
  ai_languageModel: "Chat Model",
  ai_memory: "Memory",
  ai_tool: "Tool",
  ai_embedding: "Embedding",
  ai_vectorStore: "Vector Store",
  ai_outputParser: "Output Parser",
};

export interface ParamField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "code";
  options?: string[];
  placeholder?: string;
  help?: string;
  /**
   * Operation label(s) this field applies to (e.g. "Send Message", "List Contacts").
   * When set, the inspector only shows the field while one of these operations
   * is selected. Omitted entirely on fields shared by every operation.
   */
  operations?: string[];
}

export interface HttpRequestInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResult {
  ok: boolean;
  status: number;
  ms: number;
  headers: Record<string, string>;
  body: Json;
  error: string | null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

export interface ChatToolDef {
  name: string;
  description: string;
  parameters: Json;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ChatToolDef[];
  temperature?: number;
  jsonSchema?: Json;
}

export interface ChatResponse {
  text: string;
  toolCalls: { id: string; name: string; arguments: Json }[];
  raw: Json;
}

/** A sub-node attached to a root node through a typed connection. */
export interface SubNodeRef {
  kind: string;
  label: string;
  params: Json;
  /** Merged fields of every credential attached to this sub-node (back-compat: single object). */
  credential: Json;
  /** Every credential attached to this sub-node, decrypted, keyed by credential name. */
  credentials: Record<string, Record<string, string>>;
  /** Execute the sub-node as a callable unit (tools, retrievers, embeddings). */
  invoke: (items: Json[]) => Promise<Json[]>;
}

export interface NodeContext {
  /** Items flowing into this node. */
  items: Json[];
  /** Raw node parameters (unresolved). Typed loose so nodes can read p.foo. */
  params: Json;
  /**
   * Credential values attached to this node (decrypted, server-side only).
   * When several credentials are attached, their fields are merged into one
   * object (later-attached credentials win on key clashes) so existing node
   * code that reads e.g. `ctx.credential.token` keeps working unmodified.
   */
  credential: Json;
  /** Every credential attached to this node, decrypted, keyed by credential name. */
  credentials: Record<string, Record<string, string>>;
  /** All credentials in the account keyed by name — powers {{ $cred.Name.key }}. */
  creds: Record<string, Record<string, string>>;
  /** Payload supplied by the trigger (webhook body, schedule tick, ...). */
  trigger: Json[];
  /** Outputs of already-executed nodes, keyed by node label. */
  nodeOutputs: Record<string, Json[]>;
  /** Sub-nodes wired in through typed connections, keyed by connection type. */
  subNodes: Partial<Record<ConnType, SubNodeRef[]>>;
  /** Chat session id — stable across turns of a Chat Trigger conversation. */
  sessionId: string;
  /** Resolve a value containing {{ expressions }} against one item. */
  expr: (value: unknown, item: Json, index: number) => Json;
  /** Append a line to the execution log for this node. */
  log: (message: string) => void;
  /** Server-side HTTP fetch (no CORS limits). */
  http: (input: HttpRequestInput) => Promise<HttpResult>;
  /** Execute another workflow and return its final items. */
  callWorkflow: (workflowIdOrName: string, items: Json[]) => Promise<Json[]>;
  /**
   * Call the chat model wired into this node (`ai_languageModel`). Throws when
   * no model sub-node is connected.
   */
  chat: (req: ChatRequest) => Promise<ChatResponse>;
  /** Persistent chat memory helpers used by memory sub-nodes and agents. */
  memory: {
    load: (sessionId: string, limit: number) => Promise<ChatMessage[]>;
    append: (sessionId: string, messages: ChatMessage[]) => Promise<void>;
  };
}

/** Result: one array of items per output handle. */
export type NodeOutput = Record<string, Json[]>;

export interface NodeModule {
  kind: string;
  name: string;
  group: NodeGroup;
  description: string;
  icon: string;
  /** Extra inputs beyond `main`; required ones are validated before a run. */
  inputs?: { type: ConnType; label?: string; required?: boolean }[];
  /** Set when this node plugs INTO a root node instead of the data flow. */
  subType?: Exclude<ConnType, "main">;
  outputs: { handle: string; label: string }[];
  fields: ParamField[];
  defaults: Record<string, Json>;
  /** Trigger nodes start a workflow and are not executed mid-graph. */
  isTrigger?: boolean;
  /** Credential type this node expects, if any. */
  credentialType?: "apiKey" | "bearer" | "basicAuth" | "oauth2" | "webhookUrl" | "customHeader";
  /**
   * True when the node cannot do real work without a credential attached
   * (e.g. a model or API node that always calls an authenticated endpoint).
   * Left unset/false for general-purpose nodes like HTTP Request, where a
   * credential is often optional (public endpoints). Enforced by
   * `validateGraph` before a run starts, and surfaced in the inspector.
   */
  credentialRequired?: boolean;
  /** Docs/keywords used by node-panel search. */
  keywords?: string[];
  /** Marked incomplete on purpose — surfaced in the editor, never faked. */
  stub?: string;
  execute: (ctx: NodeContext) => Promise<NodeOutput> | NodeOutput;
  /** Poll triggers: return only new items given previously seen keys. */
  poll?: (ctx: NodeContext & { seen: string[] }) => Promise<{ items: Json[]; seen: string[] }>;
}

export const main = (items: Json[]): NodeOutput => ({ main: items });

export const parseJson = (value: unknown, fallback: Json): Json => {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const toItems = (value: Json): Json[] => {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [typeof value === "object" ? value : { value }];
};

export const getPath = (obj: Json, path: string): Json =>
  path
    .split(".")
    .filter(Boolean)
    .reduce((acc: Json, key) => (acc == null ? acc : acc[key]), obj);

export const compare = (op: string, left: Json, right: Json): boolean => {
  switch (op) {
    case "equals":
      return String(left) === String(right);
    case "notEquals":
      return String(left) !== String(right);
    case "contains":
      return String(left).includes(String(right));
    case "notContains":
      return !String(left).includes(String(right));
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "isEmpty":
      return left == null || String(left) === "";
    case "isNotEmpty":
      return !(left == null || String(left) === "");
    default:
      return Boolean(left);
  }
};

export const OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "gt",
  "gte",
  "lt",
  "lte",
  "isEmpty",
  "isNotEmpty",
  "isTruthy",
];
