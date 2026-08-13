import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "./types";
import { OPERATORS, compare, getPath, main, parseJson, toItems } from "./types";

export const switchNode: NodeModule = {
  kind: "switch",
  name: "Switch",
  group: "Logic",
  description: "Route items into up to four branches by matching rules.",
  icon: "switch",
  keywords: ["route", "branch", "case", "multi"],
  outputs: [0, 1, 2, 3].map((i) => ({ handle: `out${i}`, label: `Branch ${i + 1}` })),
  fields: [
    { key: "field", label: "Field to test", type: "text", placeholder: "status" },
    {
      key: "rules",
      label: "Rules (JSON array, in branch order)",
      type: "code",
      placeholder: '[{ "op": "equals", "value": "open" }]',
    },
    { key: "fallback", label: "Unmatched items", type: "select", options: ["drop", "branch 4"] },
  ],
  defaults: {
    field: "status",
    rules: '[{ "op": "equals", "value": "open" }, { "op": "equals", "value": "closed" }]',
    fallback: "drop",
  },
  execute: (ctx) => {
    const rules = (parseJson(ctx.params.rules, []) as { op: string; value: Json }[]) ?? [];
    const out: Record<string, Json[]> = { out0: [], out1: [], out2: [], out3: [] };
    for (const item of ctx.items) {
      const left = getPath(item, String(ctx.params.field ?? ""));
      const idx = rules.findIndex((r) => compare(r.op, left, r.value));
      if (idx >= 0 && idx < 4) out[`out${idx}`]!.push(item);
      else if (ctx.params.fallback === "branch 4") out['out3']!.push(item);
    }
    ctx.log(
      Object.entries(out)
        .map(([k, v]) => `${k}: ${v.length}`)
        .join(", "),
    );
    return out;
  },
};

export const splitInBatches: NodeModule = {
  kind: "splitInBatches",
  name: "Split In Batches",
  group: "Flow",
  description: "Chunks items into batches and emits one batch per loop pass.",
  icon: "layers",
  keywords: ["loop", "chunk", "batch", "iterate"],
  outputs: [
    { handle: "main", label: "Batch" },
    { handle: "done", label: "Done" },
  ],
  fields: [
    { key: "size", label: "Batch size", type: "number" },
    {
      key: "mode",
      label: "Emit",
      type: "select",
      options: ["all batches sequentially", "first batch only"],
    },
  ],
  defaults: { size: 10, mode: "all batches sequentially" },
  execute: (ctx) => {
    const size = Math.max(1, Number(ctx.params.size ?? 10));
    const batches: Json[][] = [];
    for (let i = 0; i < ctx.items.length; i += size) batches.push(ctx.items.slice(i, i + size));
    ctx.log(`${ctx.items.length} items → ${batches.length} batch(es) of ${size}`);
    if (ctx.params.mode === "first batch only")
      return { main: batches[0] ?? [], done: ctx.items };
    // Downstream nodes receive every batch as a `batch` wrapper item so a loop
    // subgraph can process them one at a time without re-entering the engine.
    return {
      main: batches.flatMap((batch, index) =>
        batch.map((item) => ({ ...item, $batchIndex: index, $batchSize: batch.length })),
      ),
      done: ctx.items,
    };
  },
};

export const stopAndError: NodeModule = {
  kind: "stopAndError",
  name: "Stop and Error",
  group: "Logic",
  description: "Fails the execution on purpose with a custom message.",
  icon: "alert",
  keywords: ["throw", "fail", "abort"],
  outputs: [{ handle: "main", label: "" }],
  fields: [{ key: "message", label: "Error message", type: "text" }],
  defaults: { message: "Stopped by workflow" },
  execute: (ctx) => {
    throw new Error(String(ctx.expr(ctx.params.message, ctx.items[0] ?? {}, 0)));
  },
};

export const dateTime: NodeModule = {
  kind: "dateTime",
  name: "Date & Time",
  group: "Data",
  description: "Format, shift or diff dates into a new field.",
  icon: "calendar",
  keywords: ["date", "time", "format", "timezone", "add"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "Source value", type: "text", placeholder: "{{ $json.created_at }}" },
    {
      key: "action",
      label: "Action",
      type: "select",
      options: ["format", "add", "subtract", "diff from now"],
    },
    { key: "amount", label: "Amount (for add/subtract)", type: "number" },
    {
      key: "unit",
      label: "Unit",
      type: "select",
      options: ["seconds", "minutes", "hours", "days"],
    },
    {
      key: "format",
      label: "Output format",
      type: "select",
      options: ["iso", "date", "time", "locale", "unix"],
    },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: {
    source: "{{ $now }}",
    action: "format",
    amount: 1,
    unit: "days",
    format: "iso",
    target: "date",
  },
  execute: (ctx) => {
    const unitMs: Record<string, number> = {
      seconds: 1000,
      minutes: 60000,
      hours: 3600000,
      days: 86400000,
    };
    return main(
      ctx.items.map((item, i) => {
        const raw = String(ctx.expr(ctx.params.source, item, i));
        const base = new Date(raw);
        if (Number.isNaN(base.getTime())) throw new Error(`"${raw}" is not a date`);
        const step = Number(ctx.params.amount ?? 0) * (unitMs[String(ctx.params.unit)] ?? 0);
        let value: Json;
        if (ctx.params.action === "add") value = new Date(base.getTime() + step).toISOString();
        else if (ctx.params.action === "subtract")
          value = new Date(base.getTime() - step).toISOString();
        else if (ctx.params.action === "diff from now")
          value = Math.round((Date.now() - base.getTime()) / 1000);
        else {
          const fmt = String(ctx.params.format ?? "iso");
          value =
            fmt === "date"
              ? base.toISOString().slice(0, 10)
              : fmt === "time"
                ? base.toISOString().slice(11, 19)
                : fmt === "locale"
                  ? base.toUTCString()
                  : fmt === "unix"
                    ? Math.floor(base.getTime() / 1000)
                    : base.toISOString();
        }
        return { ...item, [String(ctx.params.target || "date")]: value };
      }),
    );
  },
};

export const cryptoNode: NodeModule = {
  kind: "crypto",
  name: "Crypto",
  group: "Data",
  description: "Hash, HMAC or base64 a value using Web Crypto.",
  icon: "lock",
  keywords: ["hash", "sha256", "hmac", "base64", "sign"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "value", label: "Value", type: "text", placeholder: "{{ $json.body }}" },
    {
      key: "action",
      label: "Action",
      type: "select",
      options: ["sha256", "sha1", "sha512", "hmac-sha256", "base64", "base64decode"],
    },
    { key: "secret", label: "HMAC secret", type: "text" },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: { value: "{{ $json.id }}", action: "sha256", secret: "", target: "hash" },
  execute: async (ctx) => {
    const enc = new TextEncoder();
    const hex = (buf: ArrayBuffer) =>
      [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const action = String(ctx.params.action ?? "sha256");
    const out: Json[] = [];
    for (const [i, item] of ctx.items.entries()) {
      const value = String(ctx.expr(ctx.params.value, item, i));
      let result: string;
      if (action === "base64") result = btoa(value);
      else if (action === "base64decode") result = atob(value);
      else if (action === "hmac-sha256") {
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(String(ctx.expr(ctx.params.secret, item, i))),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        result = hex(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
      } else {
        const algo = action === "sha1" ? "SHA-1" : action === "sha512" ? "SHA-512" : "SHA-256";
        result = hex(await crypto.subtle.digest(algo, enc.encode(value)));
      }
      out.push({ ...item, [String(ctx.params.target || "hash")]: result });
    }
    return main(out);
  },
};

export const compareDatasets: NodeModule = {
  kind: "compareDatasets",
  name: "Compare Datasets",
  group: "Data",
  description: "Diffs incoming items against another node's output by key.",
  icon: "diff",
  keywords: ["diff", "compare", "match", "changed"],
  outputs: [
    { handle: "main", label: "Same" },
    { handle: "added", label: "Added" },
    { handle: "removed", label: "Removed" },
    { handle: "changed", label: "Changed" },
  ],
  fields: [
    { key: "other", label: "Compare against node (name)", type: "text" },
    { key: "key", label: "Match on field", type: "text", placeholder: "id" },
  ],
  defaults: { other: "", key: "id" },
  execute: (ctx) => {
    const other = ctx.nodeOutputs[String(ctx.params.other ?? "")] ?? [];
    const key = String(ctx.params.key || "id");
    const otherMap = new Map(other.map((o) => [String(getPath(o, key)), o]));
    const same: Json[] = [];
    const added: Json[] = [];
    const changed: Json[] = [];
    for (const item of ctx.items) {
      const match = otherMap.get(String(getPath(item, key)));
      if (!match) added.push(item);
      else if (JSON.stringify(match) === JSON.stringify(item)) same.push(item);
      else changed.push({ current: item, other: match });
      otherMap.delete(String(getPath(item, key)));
    }
    const removed = [...otherMap.values()];
    ctx.log(
      `same ${same.length}, added ${added.length}, removed ${removed.length}, changed ${changed.length}`,
    );
    return { main: same, added, removed, changed };
  },
};

export const editFields: NodeModule = {
  kind: "editFields",
  name: "Edit Fields",
  group: "Data",
  description: "Rename fields, convert types and drop keys.",
  icon: "pencil",
  keywords: ["rename", "cast", "convert", "drop", "keys"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "rename", label: "Rename (JSON: from → to)", type: "code", placeholder: '{ "id": "userId" }' },
    {
      key: "convert",
      label: "Convert types (JSON: field → number|string|boolean|json)",
      type: "code",
      placeholder: '{ "age": "number" }',
    },
    { key: "remove", label: "Remove fields (comma separated)", type: "text" },
  ],
  defaults: { rename: "{}", convert: "{}", remove: "" },
  execute: (ctx) => {
    const rename = parseJson(ctx.params.rename, {}) as Record<string, string>;
    const convert = parseJson(ctx.params.convert, {}) as Record<string, string>;
    const remove = String(ctx.params.remove ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return main(
      ctx.items.map((item) => {
        const next: Record<string, Json> = { ...item };
        for (const [from, to] of Object.entries(rename)) {
          if (from in next) {
            next[to] = next[from];
            delete next[from];
          }
        }
        for (const [field, type] of Object.entries(convert)) {
          if (!(field in next)) continue;
          const v = next[field];
          next[field] =
            type === "number"
              ? Number(v)
              : type === "boolean"
                ? Boolean(v) && v !== "false" && v !== "0"
                : type === "json"
                  ? parseJson(v, v)
                  : String(v);
        }
        for (const field of remove) delete next[field];
        return next;
      }),
    );
  },
};

export const extractFromFile: NodeModule = {
  kind: "extractFromFile",
  name: "Extract from File",
  group: "Files",
  description: "Parses CSV, JSON, XML or HTML text into items.",
  icon: "file",
  keywords: ["csv", "json", "xml", "html", "parse", "file"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "Text field or expression", type: "text", placeholder: "{{ $json.data }}" },
    { key: "format", label: "Format", type: "select", options: ["csv", "json", "xml", "html-text"] },
    { key: "delimiter", label: "CSV delimiter", type: "text" },
  ],
  defaults: { source: "{{ $json.data }}", format: "csv", delimiter: "," },
  execute: (ctx) => {
    const out: Json[] = [];
    for (const [i, item] of (ctx.items.length ? ctx.items : [{}]).entries()) {
      const text = String(ctx.expr(ctx.params.source, item, i) ?? "");
      const format = String(ctx.params.format ?? "csv");
      if (format === "json") out.push(...toItems(parseJson(text, [])));
      else if (format === "csv") {
        const delim = String(ctx.params.delimiter || ",");
        const [head, ...rows] = text.trim().split(/\r?\n/);
        const cols = (head ?? "").split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
        for (const row of rows) {
          const cells = row.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
          out.push(Object.fromEntries(cols.map((c, idx) => [c, cells[idx] ?? null])));
        }
      } else if (format === "xml") {
        const found: Json[] = [];
        for (const m of text.matchAll(/<(\w[\w:-]*)>([^<]*)<\/\1>/g))
          found.push({ tag: m[1], value: m[2] });
        out.push(...found);
      } else {
        out.push({
          text: text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        });
      }
    }
    ctx.log(`Parsed ${out.length} row(s)`);
    return main(out);
  },
};

export const convertToFile: NodeModule = {
  kind: "convertToFile",
  name: "Convert to File",
  group: "Files",
  description: "Serialises items to CSV, JSON or plain text content.",
  icon: "file",
  keywords: ["csv", "json", "export", "download", "file"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "format", label: "Format", type: "select", options: ["csv", "json", "text"] },
    { key: "fileName", label: "File name", type: "text" },
    { key: "textField", label: "Field for text mode", type: "text" },
  ],
  defaults: { format: "csv", fileName: "export.csv", textField: "text" },
  execute: (ctx) => {
    const format = String(ctx.params.format ?? "csv");
    let content: string;
    if (format === "json") content = JSON.stringify(ctx.items, null, 2);
    else if (format === "text")
      content = ctx.items.map((i) => String(getPath(i, String(ctx.params.textField)))).join("\n");
    else {
      const cols = [...new Set(ctx.items.flatMap((i) => Object.keys(i ?? {})))];
      content = [
        cols.join(","),
        ...ctx.items.map((i) =>
          cols.map((c) => JSON.stringify(i?.[c] ?? "").replace(/^"|"$/g, "")).join(","),
        ),
      ].join("\n");
    }
    ctx.log(`Built ${content.length} bytes of ${format}`);
    return main([
      {
        fileName: String(ctx.params.fileName ?? "export.txt"),
        mimeType:
          format === "json" ? "application/json" : format === "csv" ? "text/csv" : "text/plain",
        size: content.length,
        content,
      },
    ]);
  },
};

export const itemLists: NodeModule = {
  kind: "itemLists",
  name: "Item Lists",
  group: "Data",
  description: "Concatenate all items into one, or split one item into many.",
  icon: "rows",
  keywords: ["list", "concatenate", "flatten", "items"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "operation",
      label: "Operation",
      type: "select",
      options: ["concatenate into one item", "split field into items", "count"],
    },
    { key: "field", label: "Field", type: "text" },
  ],
  defaults: { operation: "concatenate into one item", field: "items" },
  execute: (ctx) => {
    const field = String(ctx.params.field || "items");
    if (ctx.params.operation === "count") return main([{ count: ctx.items.length }]);
    if (ctx.params.operation === "split field into items")
      return main(ctx.items.flatMap((item) => toItems(getPath(item, field))));
    return main([{ [field]: ctx.items }]);
  },
};

export const respondToWebhook: NodeModule = {
  kind: "respondToWebhook",
  name: "Respond to Webhook",
  group: "Core",
  description: "Sets the HTTP response returned to the webhook caller.",
  icon: "webhook",
  keywords: ["response", "reply", "status", "http"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "status", label: "Status code", type: "number" },
    { key: "body", label: "Response body (JSON or text)", type: "code" },
  ],
  defaults: { status: 200, body: '{ "ok": true }' },
  execute: (ctx) => {
    const body = String(ctx.expr(ctx.params.body, ctx.items[0] ?? {}, 0) ?? "");
    ctx.log(`Responding ${ctx.params.status ?? 200}`);
    return main([
      {
        $webhookResponse: {
          status: Number(ctx.params.status ?? 200),
          body: parseJson(body, body),
        },
      },
    ]);
  },
};

export const filterOperators = OPERATORS;

export const core2Nodes = [
  switchNode,
  splitInBatches,
  stopAndError,
  dateTime,
  cryptoNode,
  compareDatasets,
  editFields,
  extractFromFile,
  convertToFile,
  itemLists,
  respondToWebhook,
];
