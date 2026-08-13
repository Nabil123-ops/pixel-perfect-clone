import type { NodeModule } from "./types";
import { getPath, main, parseJson, toItems } from "./types";

export const httpRequest: NodeModule = {
  kind: "http",
  name: "HTTP Request",
  group: "Core",
  description: "Calls any REST API server-side (no CORS limits).",
  icon: "globe",
  keywords: ["rest", "api", "fetch", "get", "post"],
  credentialType: "bearer",
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "method",
      label: "Method",
      type: "select",
      options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
    { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com/items" },
    {
      key: "headers",
      label: "Headers (JSON)",
      type: "code",
      placeholder: '{ "Accept": "application/json" }',
    },
    { key: "body", label: "Body", type: "textarea" },
    {
      key: "path",
      label: "Pick field from response (optional)",
      type: "text",
      placeholder: "data.results",
    },
  ],
  defaults: {
    method: "GET",
    url: "https://api.github.com/repos/n8n-io/n8n",
    headers: '{ "Accept": "application/json" }',
    body: "",
    path: "",
  },
  execute: async (ctx) => {
    const p = ctx.params;
    const out = [];
    const source = ctx.items.length ? ctx.items : [{}];
    for (const [i, item] of source.entries()) {
      const headers = parseJson(
        String(ctx.expr(typeof p.headers === "string" ? p.headers : "{}", item, i) || "{}"),
        {},
      ) as Record<string, string>;
      if (ctx.credential.token) headers["Authorization"] = `Bearer ${ctx.credential.token}`;
      if (ctx.credential.apiKey && ctx.credential.header)
        headers[ctx.credential.header] = ctx.credential.apiKey;
      const url = String(ctx.expr(p.url, item, i));
      const res = await ctx.http({
        url,
        method: String(p.method ?? "GET"),
        headers,
        ...(p.body ? { body: String(ctx.expr(p.body, item, i)) } : {}),
      });
      ctx.log(`${p.method ?? "GET"} ${url} → ${res.status} in ${res.ms}ms`);
      if (res.error) throw new Error(res.error);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      out.push(...toItems(p.path ? getPath(res.body, String(p.path)) : res.body));
    }
    return main(out);
  },
};

export const codeNode: NodeModule = {
  kind: "code",
  name: "Code",
  group: "Core",
  description: "Run JavaScript over the incoming items.",
  icon: "code",
  keywords: ["javascript", "js", "transform", "script"],
  outputs: [{ handle: "main", label: "" }],
  fields: [{ key: "js", label: "JavaScript (return an array)", type: "code" }],
  defaults: {
    js: "// items: array of objects\nreturn items.map((item, i) => ({ ...item, index: i }));",
  },
  execute: async (ctx) => {
    // eslint-disable-next-line no-new-func
    const fn = new Function("items", "$cred", "$json", String(ctx.params.js ?? "return items;"));
    const result = await fn(ctx.items, ctx.creds, ctx.items[0] ?? {});
    return main(toItems(result));
  },
};

export const setNode: NodeModule = {
  kind: "set",
  name: "Set Fields",
  group: "Data",
  description: "Add or overwrite fields using {{ expressions }}.",
  icon: "pencil",
  keywords: ["edit", "map", "assign", "field"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "fields",
      label: "Assignments (JSON)",
      type: "code",
      placeholder: '{ "name": "{{ $json.login }}" }',
    },
    { key: "keepOnlySet", label: "Keep only set fields", type: "select", options: ["no", "yes"] },
  ],
  defaults: { fields: '{ "status": "processed" }', keepOnlySet: "no" },
  execute: (ctx) => {
    const assignments = parseJson(ctx.params.fields, {}) as Record<string, string>;
    return main(
      ctx.items.map((item, i) => {
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(assignments)) patch[k] = ctx.expr(v, item, i);
        return ctx.params.keepOnlySet === "yes" ? patch : { ...item, ...patch };
      }),
    );
  },
};

export const noOp: NodeModule = {
  kind: "noOp",
  name: "No Operation",
  group: "Core",
  description: "Passes items through untouched — handy as a join point.",
  icon: "circle",
  outputs: [{ handle: "main", label: "" }],
  fields: [],
  defaults: {},
  execute: (ctx) => main(ctx.items),
};

export const subWorkflow: NodeModule = {
  kind: "subWorkflow",
  name: "Execute Workflow",
  group: "Flow",
  description: "Runs another workflow with the current items and returns its output.",
  icon: "workflow",
  keywords: ["sub", "child", "call", "reuse"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "workflow", label: "Workflow id or name", type: "text", placeholder: "Enrich contacts" },
  ],
  defaults: { workflow: "" },
  execute: async (ctx) => {
    const target = String(ctx.params.workflow ?? "").trim();
    if (!target) throw new Error("Choose a workflow to execute");
    ctx.log(`Calling sub-workflow "${target}" with ${ctx.items.length} item(s)`);
    return main(await ctx.callWorkflow(target, ctx.items));
  },
};

export const coreNodes = [httpRequest, codeNode, setNode, noOp, subWorkflow];
