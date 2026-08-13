import type { Json } from "./types";

export const getPath = (obj: Json, path: string): Json =>
  path
    .split(".")
    .filter(Boolean)
    .reduce((acc: Json, key) => (acc == null ? acc : acc[key]), obj);

export interface ExprScope {
  item: Json;
  index: number;
  creds?: Record<string, Record<string, string>>;
  nodes?: Record<string, Json[]>;
}

/**
 * Formal expression evaluator for `{{ ... }}` templates.
 *
 * Supported roots: $json, $item, $index, $now, $today, $timestamp, $uuid,
 * $cred.<Name>.<field>, $node["Label"].json.<path>, plus arbitrary JS.
 */
export function evaluateExpression(raw: string, scope: ExprScope): Json {
  const expr = raw.trim();
  const { item, index, creds = {}, nodes = {} } = scope;

  if (expr === "$json" || expr === "$item") return item;
  if (expr === "$index") return index;
  if (expr === "$now") return new Date().toISOString();
  if (expr === "$today") return new Date().toISOString().slice(0, 10);
  if (expr === "$timestamp") return Date.now();
  if (expr === "$uuid") return crypto.randomUUID();
  if (expr.startsWith("$cred.")) return getPath(creds, expr.slice(6));
  if (expr.startsWith("$json.")) return getPath(item, expr.slice(6));
  if (expr.startsWith("item.")) return getPath(item, expr.slice(5));

  const nodeRef = expr.match(/^\$node\[["']([^"']+)["']\](?:\.json)?\.?(.*)$/);
  if (nodeRef) {
    const list = nodes[nodeRef[1] ?? ""] ?? [];
    const first = list[0];
    const rest = nodeRef[2] ?? "";
    return rest ? getPath(first, rest) : list;
  }

  try {
    // eslint-disable-next-line no-new-func
    return new Function(
      "$json",
      "item",
      "$index",
      "$cred",
      "$node",
      "$now",
      `return (${expr});`,
    )(item, item, index, creds, nodes, new Date().toISOString());
  } catch {
    return undefined;
  }
}

/** Resolve a string that may contain one or many {{ }} expressions. */
export function resolveExpr(input: unknown, scope: ExprScope): Json {
  if (typeof input !== "string") return input;
  const whole = input.match(/^\{\{([\s\S]+)\}\}$/);
  if (whole) return evaluateExpression(whole[1] ?? "", scope);
  return input.replace(/\{\{([^}]+)\}\}/g, (_m, raw: string) => {
    const value = evaluateExpression(raw, scope);
    return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

/** Autocomplete tokens shown in the expression editor. */
export function expressionSuggestions(
  itemKeys: string[],
  nodeLabels: string[],
  credNames: string[],
): { token: string; hint: string }[] {
  return [
    { token: "{{ $json }}", hint: "The whole current item" },
    ...itemKeys.map((k) => ({ token: `{{ $json.${k} }}`, hint: "Field of the current item" })),
    { token: "{{ $index }}", hint: "Zero-based item index" },
    { token: "{{ $now }}", hint: "Current ISO timestamp" },
    { token: "{{ $today }}", hint: "Today as YYYY-MM-DD" },
    { token: "{{ $uuid }}", hint: "Random UUID" },
    ...nodeLabels.map((l) => ({
      token: `{{ $node["${l}"].json.field }}`,
      hint: "Output of a previous node",
    })),
    ...credNames.map((c) => ({ token: `{{ $cred.${c}.apiKey }}`, hint: "Credential value" })),
  ];
}
