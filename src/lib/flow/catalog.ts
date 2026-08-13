import { allNodes, getNode } from "@/lib/nodes/registry";
import type { NodeModule, ParamField } from "@/lib/nodes/types";
import type { Json } from "./types";

export type { ParamField };

/** Editor-facing view of a registered node module. */
export interface NodeSpec {
  kind: string;
  name: string;
  group: NodeModule["group"];
  description: string;
  icon: string;
  outputs: { handle: string; label: string }[];
  fields: ParamField[];
  defaults: Record<string, Json>;
  isTrigger: boolean;
  credentialType?: NodeModule["credentialType"];
  keywords: string[];
}

const toSpec = (mod: NodeModule): NodeSpec => ({
  kind: mod.kind,
  name: mod.name,
  group: mod.group,
  description: mod.description,
  icon: mod.icon,
  outputs: mod.outputs,
  fields: mod.fields,
  defaults: mod.defaults,
  isTrigger: Boolean(mod.isTrigger),
  ...(mod.credentialType ? { credentialType: mod.credentialType } : {}),
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
