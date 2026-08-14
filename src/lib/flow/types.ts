export type Json = any;

/** Node kinds are registry driven — any string a registered module declares. */
export type FlowNodeKind = string;

export interface FlowNodeData {
  kind: FlowNodeKind;
  label: string;
  params: Record<string, Json>;
  /** Retry attempts on failure (0 = none). */
  retries?: number;
  /** "stop" halts the branch, "continue" passes input through on error. */
  onError?: "stop" | "continue";
  /** Credential name used by this node. @deprecated kept for back-compat — first entry of `credentials`. */
  credential?: string;
  /** Every credential attached to this node — lets one node call many APIs at once. */
  credentials?: string[];
  /** Pinned output — when set the node returns this instead of executing. */
  pinned?: string;
}

export interface StoredNode {
  id: string;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface StoredEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  /** Connection type: "main" for data flow, "ai_*" for capability wiring. */
  targetHandle?: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: StoredNode[];
  edges: StoredEdge[];
  version: number;
  updatedAt: number;
}

export type CredentialType = "apiKey" | "bearer" | "basicAuth" | "oauth2" | "webhookUrl";

export interface Credential {
  id: string;
  name: string;
  type: CredentialType;
  fields: Record<string, string>;
  lastTestOk?: boolean | null;
  lastTestMessage?: string | null;
  lastTestedAt?: string | null;
  updatedAt?: string;
}

export interface RunStep {
  nodeId: string;
  nodeKind: string;
  label: string;
  status: "success" | "error" | "skipped";
  ms: number;
  attempts: number;
  input: Json[];
  items: Json[];
  logs: string[];
  error?: string | null;
}

export interface RunResult {
  executionId: string;
  workflowId: string;
  workflowName: string;
  mode: string;
  startedAt: string;
  finishedAt?: string | null;
  ms: number;
  ok: boolean;
  status: "success" | "error" | "running";
  error?: string | null;
  steps: RunStep[];
}

export interface ExecutionSummary {
  id: string;
  workflowId: string | null;
  workflowName: string;
  mode: string;
  status: "success" | "error" | "running";
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  ms: number;
  stepCount?: number;
}
