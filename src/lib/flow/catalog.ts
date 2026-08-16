import { allNodes, getNode } from "@/lib/nodes/registry";
import type { ConnType, NodeModule, ParamField } from "@/lib/nodes/types";
import type { Json } from "./types";

export type { ParamField };
export type { ConnType } from "@/lib/nodes/types";

/** Editor-facing view of a registered node module. */
export interface NodeSpec {
  kind: string;
  name: string;
  group: NodeModule["group"];
  description: string;
  icon: string;
  /** Extra typed inputs beyond the implicit `main` one (AI capability wiring). */
  inputs: { type: ConnType; label?: string; required?: boolean }[];
  /** Set when this node plugs INTO a root node instead of the main data flow. */
  subType?: Exclude<ConnType, "main">;
  outputs: { handle: string; label: string }[];
  fields: ParamField[];
  defaults: Record<string, Json>;
  isTrigger: boolean;
  credentialType?: NodeModule["credentialType"];
  /** True when this node cannot do real work without a credential attached. */
  credentialRequired?: boolean;
  keywords: string[];
}

const toSpec = (mod: NodeModule): NodeSpec => ({
  kind: mod.kind,
  name: mod.name,
  group: mod.group,
  description: mod.description,
  icon: mod.icon,
  inputs: mod.inputs ?? [],
  ...(mod.subType ? { subType: mod.subType } : {}),
  outputs: mod.outputs,
  fields: mod.fields,
  defaults: mod.defaults,
  isTrigger: Boolean(mod.isTrigger),
  ...(mod.credentialType ? { credentialType: mod.credentialType } : {}),
  ...(mod.credentialRequired ? { credentialRequired: true } : {}),
  keywords: mod.keywords ?? [],
});

export const CATALOG: NodeSpec[] = allNodes().map(toSpec);

export function specOf(kind: string): NodeSpec {
  const mod = getNode(kind);
  return mod
    ? toSpec(mod)
    : {
        kind,
        name: kind,
        group: "Core",
        description: "Unknown node",
        icon: "circle",
        inputs: [],
        outputs: [{ handle: "main", label: "" }],
        fields: [],
        defaults: {},
        isTrigger: false,
        keywords: [],
      };
}

/** Search the catalog by name, description, group or keyword. */
export function searchCatalog(query: string, group?: string): NodeSpec[] {
  const q = query.trim().toLowerCase();
  return CATALOG.filter((spec) => {
    if (group && group !== "All" && spec.group !== group) return false;
    if (!q) return true;
    return [spec.name, spec.description, spec.group, ...spec.keywords]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

/**
 * Nodes that can plug into a given typed AI slot (e.g. every "Chat Model"
 * node for an `ai_languageModel` slot). Used by the "+" picker on a root
 * node's AI sub-inputs so only compatible nodes are offered.
 */
export function catalogForSubType(subType: ConnType, query = ""): NodeSpec[] {
  const q = query.trim().toLowerCase();
  return CATALOG.filter((spec) => {
    if (spec.subType !== subType) return false;
    if (!q) return true;
    return [spec.name, spec.description, ...spec.keywords].join(" ").toLowerCase().includes(q);
  });
}
