import type { NodeModule } from "./types";
import { coreNodes } from "./core";
import { dataNodes, logicNodes } from "./logic";
import { extraTriggerNodes, triggerNodes } from "./triggers";
import { core2Nodes } from "./core2";
import { aiNodes } from "./ai";
import { appNodes } from "./apps";
import { catalogAppNodes } from "./apps-catalog";
import { catalogAppNodes2 } from "./apps-catalog2";
import { core3Nodes } from "./core3";
import { files2Nodes } from "./files2";
import { model2Nodes } from "./ai2";
import { retrievalNodes } from "./ai-retrieval";
import { aiTools2Nodes } from "./ai-tools2";
import { slack } from "./integrations/slack";
import { discord } from "./integrations/discord";
import { telegram } from "./integrations/telegram";

/**
 * Plugin registry. New nodes are added by registering a module here (or via
 * `registerNode` at runtime) — the engine, catalog and editor read from this
 * registry and never hardcode node kinds.
 */
const registry = new Map<string, NodeModule>();

export function registerNode(mod: NodeModule) {
  registry.set(mod.kind, mod);
  return mod;
}

export function registerNodes(mods: NodeModule[]) {
  mods.forEach(registerNode);
}

registerNodes([
  ...triggerNodes,
  ...extraTriggerNodes,
  ...coreNodes,
  ...logicNodes,
  ...dataNodes,
  ...core2Nodes,
  ...aiNodes,
  ...appNodes,
  ...core3Nodes,
  ...files2Nodes,
  ...model2Nodes,
  ...retrievalNodes,
  ...aiTools2Nodes,
  ...catalogAppNodes,
  ...catalogAppNodes2,
  slack,
  discord,
  telegram,
]);

export function getNode(kind: string): NodeModule | undefined {
  return registry.get(kind);
}

export function requireNode(kind: string): NodeModule {
  const mod = registry.get(kind);
  if (!mod) throw new Error(`Unknown node type "${kind}"`);
  return mod;
}

export function allNodes(): NodeModule[] {
  return [...registry.values()];
}

export { NODE_GROUPS } from "./types";
export type { NodeGroup } from "./types";
