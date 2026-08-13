import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "./types";
import { OPERATORS, compare, getPath, main, toItems } from "./types";

export const ifNode: NodeModule = {
  kind: "if",
  name: "If",
  group: "Logic",
  description: "Route items down true / false branches.",
  icon: "split",
  keywords: ["condition", "branch", "switch"],
  outputs: [
    { handle: "true", label: "true" },
    { handle: "false", label: "false" },
  ],
  fields: [
    { key: "left", label: "Value", type: "text", placeholder: "{{ $json.count }}" },
    { key: "op", label: "Operator", type: "select", options: OPERATORS },
    { key: "right", label: "Compare to", type: "text" },
  ],
  defaults: { left: "{{ $json.id }}", op: "isTruthy", right: "" },
  execute: (ctx) => {
    const t: Json[] = [];
    const f: Json[] = [];
    ctx.items.forEach((item, i) => {
      const pass = compare(
        String(ctx.params.op),
        ctx.expr(ctx.params.left, item, i),
        ctx.expr(ctx.params.right, item, i),
      );
      (pass ? t : f).push(item);
    });
    ctx.log(`${t.length} true / ${f.length} false`);
    return { true: t, false: f };
  },
};

export const filterNode: NodeModule = {
  kind: "filter",
  name: "Filter",
  group: "Logic",
  description: "Keep only the items that match a condition.",
  icon: "filter",
  keywords: ["where", "condition", "keep"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "left", label: "Value", type: "text", placeholder: "{{ $json.stars }}" },
    { key: "op", label: "Operator", type: "select", options: OPERATORS },
    { key: "right", label: "Compare to", type: "text" },
  ],
  defaults: { left: "{{ $json.id }}", op: "isTruthy", right: "" },
  execute: (ctx) =>
    main(
      ctx.items.filter((item, i) =>
        compare(
          String(ctx.params.op),
          ctx.expr(ctx.params.left, item, i),
          ctx.expr(ctx.params.right, item, i),
        ),
      ),
    ),
};

export const waitNode: NodeModule = {
  kind: "delay",
  name: "Wait",
  group: "Logic",
  description: "Pause the branch before continuing.",
  icon: "hourglass",
  keywords: ["delay", "sleep", "throttle"],
  outputs: [{ handle: "main", label: "" }],
  fields: [{ key: "ms", label: "Milliseconds", type: "number" }],
  defaults: { ms: 500 },
  execute: async (ctx) => {
    const ms = Math.min(20000, Math.max(0, Number(ctx.params.ms ?? 0)));
    await new Promise((r) => setTimeout(r, ms));
    return main(ctx.items);
  },
};

export const mergeNode: NodeModule = {
  kind: "merge",
  name: "Merge",
  group: "Logic",
  description: "Combine items arriving from multiple branches.",
  icon: "merge",
  outputs: [{ handle: "main", label: "" }],
  fields: [],
  defaults: {},
  execute: (ctx) => main(ctx.items),
};

export const aggregateNode: NodeModule = {
  kind: "aggregate",
  name: "Aggregate",
  group: "Data",
  description: "Collapse all items into one summary item.",
  icon: "sigma",
  keywords: ["sum", "count", "avg", "summary"],
  outputs: [{ handle: "main", label: "" }],
  fields: [{ key: "field", label: "Numeric field (optional)", type: "text" }],
  defaults: { field: "" },
  execute: (ctx) => {
    const field = String(ctx.params.field ?? "");
    const numbers = field
      ? ctx.items.map((i) => Number(getPath(i, field))).filter((n) => Number.isFinite(n))
      : [];
    const sum = numbers.reduce((a, b) => a + b, 0);
    return main([
      {
        count: ctx.items.length,
        ...(field ? { sum, avg: numbers.length ? sum / numbers.length : 0 } : {}),
        items: ctx.items,
      },
    ]);
  },
};

export const sortNode: NodeModule = {
  kind: "sort",
  name: "Sort",
  group: "Data",
  description: "Order items by a field.",
  icon: "sort",
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "field", label: "Field", type: "text", placeholder: "stars" },
    { key: "direction", label: "Direction", type: "select", options: ["asc", "desc"] },
  ],
  defaults: { field: "", direction: "asc" },
  execute: (ctx) => {
    const field = String(ctx.params.field ?? "");
    const dir = ctx.params.direction === "desc" ? -1 : 1;
    const sorted = [...ctx.items].sort((a, b) => {
      const av = field ? getPath(a, field) : a;
      const bv = field ? getPath(b, field) : b;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return main(sorted);
  },
};

export const limitNode: NodeModule = {
  kind: "limit",
  name: "Limit",
  group: "Data",
  description: "Keep the first or last N items.",
  icon: "limit",
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "count", label: "Max items", type: "number" },
    { key: "keep", label: "Keep", type: "select", options: ["first", "last"] },
  ],
  defaults: { count: 10, keep: "first" },
  execute: (ctx) => {
    const n = Math.max(0, Number(ctx.params.count ?? 10));
    return main(ctx.params.keep === "last" ? ctx.items.slice(-n) : ctx.items.slice(0, n));
  },
};

export const splitOutNode: NodeModule = {
  kind: "splitOut",
  name: "Split Out",
  group: "Data",
  description: "Turn an array field into one item per element.",
  icon: "split-out",
  keywords: ["explode", "flatten", "array"],
  outputs: [{ handle: "main", label: "" }],
  fields: [{ key: "field", label: "Array field", type: "text", placeholder: "items" }],
  defaults: { field: "items" },
  execute: (ctx) => {
    const field = String(ctx.params.field ?? "");
    const out: Json[] = [];
    for (const item of ctx.items) out.push(...toItems(field ? getPath(item, field) : item));
    return main(out);
  },
};

export const dedupeNode: NodeModule = {
  kind: "dedupe",
  name: "Remove Duplicates",
  group: "Data",
  description: "Drop items sharing the same key value.",
  icon: "dedupe",
  keywords: ["unique", "distinct"],
  outputs: [{ handle: "main", label: "" }],
  fields: [{ key: "field", label: "Key field (blank = whole item)", type: "text" }],
  defaults: { field: "" },
  execute: (ctx) => {
    const field = String(ctx.params.field ?? "");
    const seen = new Set<string>();
    const out: Json[] = [];
    for (const item of ctx.items) {
      const key = JSON.stringify(field ? getPath(item, field) : item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return main(out);
  },
};

export const logicNodes = [ifNode, filterNode, waitNode, mergeNode];
export const dataNodes = [
  aggregateNode,
  sortNode,
  limitNode,
  splitOutNode,
  dedupeNode,
];
