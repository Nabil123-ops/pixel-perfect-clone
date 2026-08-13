import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "./types";
import { getPath, main, parseJson } from "./types";

/**
 * Core / logic nodes that close the gaps against n8n's built-in set:
 * key renaming, type coercion, randomness, HTML/Markdown/XML handling,
 * cron helpers, looping and JSON-schema validation.
 */

const setPath = (obj: Record<string, Json>, path: string, value: Json) => {
  const parts = path.split(".").filter(Boolean);
  let cursor: Record<string, Json> = obj;
  parts.forEach((part, i) => {
    if (i === parts.length - 1) cursor[part] = value;
    else {
      if (typeof cursor[part] !== "object" || cursor[part] === null) cursor[part] = {};
      cursor = cursor[part] as Record<string, Json>;
    }
  });
  return obj;
};

const deletePath = (obj: Record<string, Json>, path: string) => {
  const parts = path.split(".").filter(Boolean);
  let cursor: Json = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = (cursor as Record<string, Json>)?.[parts[i]!] as Json;
    if (typeof cursor !== "object" || cursor === null) return;
  }
  delete (cursor as Record<string, Json>)[parts.at(-1)!];
};

export const renameKeys: NodeModule = {
  kind: "renameKeys",
  name: "Rename Keys",
  group: "Data",
  description: "Rename or drop fields on every item.",
  icon: "key",
  keywords: ["rename", "key", "field", "map", "drop"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "pairs",
      label: "Renames (oldKey=newKey, one per line)",
      type: "code",
      placeholder: "user.name=name\nemail_address=email",
    },
    { key: "remove", label: "Fields to remove (comma separated)", type: "text" },
  ],
  defaults: { pairs: "", remove: "" },
  execute: (ctx) => {
    const pairs = String(ctx.params.pairs ?? "")
      .split("\n")
      .map((line) => line.split("="))
      .filter((parts) => parts.length === 2)
      .map(([from, to]) => [from!.trim(), to!.trim()] as const);
    const remove = String(ctx.params.remove ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return main(
      ctx.items.map((item) => {
        const next = JSON.parse(JSON.stringify(item ?? {})) as Record<string, Json>;
        for (const [from, to] of pairs) {
          const value = getPath(next as Json, from);
          if (value === undefined) continue;
          deletePath(next, from);
          setPath(next, to, value);
        }
        remove.forEach((path) => deletePath(next, path));
        return next as Json;
      }),
    );
  },
};

export const typeConverter: NodeModule = {
  kind: "typeConverter",
  name: "Type Converter",
  group: "Data",
  description: "Coerce fields to string, number, boolean, date or JSON.",
  icon: "type",
  keywords: ["cast", "convert", "type", "number", "boolean", "date"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "field", label: "Field (dot path)", type: "text", placeholder: "amount" },
    {
      key: "to",
      label: "Convert to",
      type: "select",
      options: ["string", "number", "boolean", "date", "json", "array"],
    },
    { key: "target", label: "Write to field (blank = in place)", type: "text" },
  ],
  defaults: { field: "value", to: "number", target: "" },
  execute: (ctx) => {
    const to = String(ctx.params.to ?? "string");
    const field = String(ctx.params.field ?? "");
    const target = String(ctx.params.target || field);
    return main(
      ctx.items.map((item) => {
        const raw = getPath(item, field);
        let value: Json = raw as Json;
        switch (to) {
          case "string":
            value = typeof raw === "object" && raw !== null ? JSON.stringify(raw) : String(raw ?? "");
            break;
          case "number": {
            const num = Number(String(raw ?? "").replace(/[^0-9.\-eE]/g, ""));
            value = Number.isFinite(num) ? num : null;
            break;
          }
          case "boolean":
            value = ["true", "1", "yes", "y", "on"].includes(String(raw ?? "").toLowerCase());
            break;
          case "date": {
            const date = new Date(String(raw ?? ""));
            value = Number.isNaN(date.getTime()) ? null : date.toISOString();
            break;
          }
          case "json":
            value = parseJson(raw, null);
            break;
          case "array":
            value = Array.isArray(raw)
              ? raw
              : String(raw ?? "")
                  .split(",")
                  .map((s) => s.trim());
            break;
        }
        const next = JSON.parse(JSON.stringify(item ?? {})) as Record<string, Json>;
        setPath(next, target, value);
        return next as Json;
      }),
    );
  },
};

export const randomNode: NodeModule = {
  kind: "random",
  name: "Random",
  group: "Core",
  description: "Random number, UUID, string or pick from a list.",
  icon: "shuffle",
  keywords: ["random", "uuid", "sample", "dice", "token"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "mode", label: "Mode", type: "select", options: ["number", "uuid", "string", "choice"] },
    { key: "min", label: "Min (number mode)", type: "number" },
    { key: "max", label: "Max (number mode)", type: "number" },
    { key: "length", label: "Length (string mode)", type: "number" },
    { key: "choices", label: "Choices (comma separated)", type: "text" },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: { mode: "number", min: 0, max: 100, length: 16, choices: "", target: "random" },
  execute: (ctx) => {
    const mode = String(ctx.params.mode ?? "number");
    const target = String(ctx.params.target || "random");
    const items = ctx.items.length ? ctx.items : [{} as Json];
    return main(
      items.map((item) => {
        let value: Json;
        if (mode === "uuid") value = crypto.randomUUID();
        else if (mode === "string") {
          const length = Math.max(1, Number(ctx.params.length ?? 16));
          const bytes = crypto.getRandomValues(new Uint8Array(length));
          value = Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
        } else if (mode === "choice") {
          const choices = String(ctx.params.choices ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          value = choices.length ? choices[Math.floor(Math.random() * choices.length)]! : null;
        } else {
          const min = Number(ctx.params.min ?? 0);
          const max = Number(ctx.params.max ?? 100);
          value = Math.floor(Math.random() * (max - min + 1)) + min;
        }
        return { ...(item as Record<string, Json>), [target]: value } as Json;
      }),
    );
  },
};

const stripTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

export const htmlExtract: NodeModule = {
  kind: "htmlExtract",
  name: "HTML Extract",
  group: "Data",
  description: "Pull text, links, images or tag contents out of HTML.",
  icon: "code",
  keywords: ["html", "scrape", "parse", "extract", "links"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "HTML field or expression", type: "code", placeholder: "{{ $json.body }}" },
    {
      key: "mode",
      label: "Extract",
      type: "select",
      options: ["text", "links", "images", "tag", "title", "meta"],
    },
    { key: "tag", label: "Tag name (tag mode)", type: "text", placeholder: "h2" },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: { source: "{{ $json.body }}", mode: "text", tag: "h2", target: "extracted" },
  execute: (ctx) => {
    const mode = String(ctx.params.mode ?? "text");
    const tag = String(ctx.params.tag ?? "p");
    const target = String(ctx.params.target || "extracted");
    return main(
      ctx.items.map((item, index) => {
        const html = String(ctx.expr(ctx.params.source, item, index) ?? "");
        let value: Json;
        if (mode === "links")
          value = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(
            (m) => ({ href: m[1]!, text: stripTags(m[2] ?? "") }),
          );
        else if (mode === "images")
          value = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]!);
        else if (mode === "title")
          value = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
        else if (mode === "meta")
          value = Object.fromEntries(
            [...html.matchAll(/<meta[^>]+name=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi)].map(
              (m) => [m[1]!, m[2]!],
            ),
          );
        else if (mode === "tag")
          value = [
            ...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi")),
          ].map((m) => stripTags(m[1] ?? ""));
        else value = stripTags(html);
        return { ...(item as Record<string, Json>), [target]: value } as Json;
      }),
    );
  },
};

const mdToHtml = (md: string) =>
  md
    .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .split(/\n{2,}/)
    .map((block) => (/^\s*<(h\d|ul|pre|img|a)/.test(block) ? block : `<p>${block.trim()}</p>`))
    .join("\n");

const htmlToMd = (html: string) =>
  html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l: string, t: string) => `\n${"#".repeat(Number(l))} ${stripTags(t)}\n`)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const markdownNode: NodeModule = {
  kind: "markdown",
  name: "Markdown",
  group: "Data",
  description: "Convert Markdown to HTML or HTML back to Markdown.",
  icon: "markdown",
  keywords: ["markdown", "html", "convert", "md"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "Source", type: "code", placeholder: "{{ $json.text }}" },
    { key: "mode", label: "Direction", type: "select", options: ["markdownToHtml", "htmlToMarkdown"] },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: { source: "{{ $json.text }}", mode: "markdownToHtml", target: "converted" },
  execute: (ctx) => {
    const mode = String(ctx.params.mode ?? "markdownToHtml");
    const target = String(ctx.params.target || "converted");
    return main(
      ctx.items.map((item, index) => {
        const src = String(ctx.expr(ctx.params.source, item, index) ?? "");
        const value = mode === "htmlToMarkdown" ? htmlToMd(src) : mdToHtml(src);
        return { ...(item as Record<string, Json>), [target]: value } as Json;
      }),
    );
  },
};

const parseXml = (xml: string): Json => {
  let cursor = 0;
  const parseNode = (): Json => {
    const open = /<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
    open.lastIndex = cursor;
    const match = open.exec(xml);
    if (!match) return null;
    cursor = open.lastIndex;
    const name = match[1]!;
    const attrs: Record<string, Json> = {};
    for (const a of (match[2] ?? "").matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g))
      attrs[`@${a[1]!}`] = a[2]!;
    if (match[3] === "/") return { [name]: attrs };
    const close = xml.indexOf(`</${name}>`, cursor);
    const inner = xml.slice(cursor, close === -1 ? undefined : close);
    cursor = close === -1 ? xml.length : close + name.length + 3;
    const children: Record<string, Json> = { ...attrs };
    const childMatches = [...inner.matchAll(/<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g)];
    if (!childMatches.length) {
      const text = inner.trim();
      return { [name]: Object.keys(attrs).length ? { ...attrs, "#text": text } : text };
    }
    const saved = cursor;
    cursor = 0;
    const innerSource = inner;
    let guard = 0;
    const localParse = () => {
      const scanner = /<([\w:.-]+)/g;
      scanner.lastIndex = cursor;
      const found = scanner.exec(innerSource);
      if (!found) return null;
      const childName = found[1]!;
      const selfClose = new RegExp(`<${childName}\\b[^>]*/>`, "g");
      selfClose.lastIndex = found.index;
      const sc = selfClose.exec(innerSource);
      if (sc && sc.index === found.index) {
        cursor = selfClose.lastIndex;
        return { name: childName, value: {} as Json };
      }
      const endTag = `</${childName}>`;
      const end = innerSource.indexOf(endTag, found.index);
      const startBody = innerSource.indexOf(">", found.index) + 1;
      const body = innerSource.slice(startBody, end === -1 ? undefined : end);
      cursor = end === -1 ? innerSource.length : end + endTag.length;
      const nested = /<[\w:.-]+/.test(body) ? parseXml(body) : body.trim();
      return { name: childName, value: nested as Json };
    };
    let next = localParse();
    while (next && guard++ < 5000) {
      const existing = children[next.name];
      if (existing === undefined) children[next.name] = next.value;
      else if (Array.isArray(existing)) (existing as Json[]).push(next.value);
      else children[next.name] = [existing, next.value];
      next = localParse();
    }
    cursor = saved;
    return { [name]: children };
  };
  const root = parseNode();
  return root ?? {};
};

const buildXml = (value: Json, name = "root"): string => {
  if (value === null || value === undefined) return `<${name}/>`;
  if (Array.isArray(value)) return value.map((v) => buildXml(v, name)).join("");
  if (typeof value === "object")
    return `<${name}>${Object.entries(value as Record<string, Json>)
      .map(([k, v]) => buildXml(v, k))
      .join("")}</${name}>`;
  return `<${name}>${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</${name}>`;
};

export const xmlNode: NodeModule = {
  kind: "xml",
  name: "XML",
  group: "Data",
  description: "Parse XML into JSON, or build XML from JSON.",
  icon: "braces",
  keywords: ["xml", "parse", "convert", "soap", "rss"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "source", label: "Source", type: "code", placeholder: "{{ $json.body }}" },
    { key: "mode", label: "Direction", type: "select", options: ["xmlToJson", "jsonToXml"] },
    { key: "rootName", label: "Root element (jsonToXml)", type: "text" },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: { source: "{{ $json.body }}", mode: "xmlToJson", rootName: "root", target: "xml" },
  execute: (ctx) => {
    const mode = String(ctx.params.mode ?? "xmlToJson");
    const target = String(ctx.params.target || "xml");
    return main(
      ctx.items.map((item, index) => {
        const src = ctx.expr(ctx.params.source, item, index);
        const value =
          mode === "jsonToXml"
            ? buildXml(typeof src === "string" ? parseJson(src, {}) : (src as Json), String(ctx.params.rootName || "root"))
            : parseXml(String(src ?? ""));
        return { ...(item as Record<string, Json>), [target]: value } as Json;
      }),
    );
  },
};

/** Minimal 5-field cron evaluator shared with the scheduler semantics. */
const matchesCron = (expression: string, date: Date): boolean => {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const values = [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCDay(),
  ];
  return parts.every((part, i) => {
    const value = values[i]!;
    return part.split(",").some((chunk) => {
      const [range, stepText] = chunk.split("/");
      const step = stepText ? Number(stepText) : 1;
      if (range === "*") return value % step === 0;
      const [from, to] = range!.split("-").map(Number);
      if (to === undefined) return value === from;
      return value >= from! && value <= to && (value - from!) % step === 0;
    });
  });
};

export const cronHelper: NodeModule = {
  kind: "cronHelper",
  name: "Cron Helper",
  group: "Logic",
  description: "Check a cron expression and compute the next run times.",
  icon: "clock",
  keywords: ["cron", "schedule", "next run", "time"],
  outputs: [
    { handle: "main", label: "match" },
    { handle: "no", label: "no match" },
  ],
  fields: [
    { key: "cron", label: "Cron expression (UTC, 5 fields)", type: "text", placeholder: "*/5 * * * *" },
    { key: "occurrences", label: "Next occurrences to compute", type: "number" },
  ],
  defaults: { cron: "*/5 * * * *", occurrences: 5 },
  execute: (ctx) => {
    const expression = String(ctx.params.cron ?? "*/5 * * * *");
    const wanted = Math.min(50, Math.max(1, Number(ctx.params.occurrences ?? 5)));
    const now = new Date();
    const upcoming: string[] = [];
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()));
    for (let i = 0; i < 60 * 24 * 40 && upcoming.length < wanted; i++) {
      cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
      if (matchesCron(expression, cursor)) upcoming.push(cursor.toISOString());
    }
    const isMatch = matchesCron(expression, now);
    const payload = ctx.items.length ? ctx.items : [{} as Json];
    const enriched = payload.map((item) => ({
      ...(item as Record<string, Json>),
      cron: expression,
      matchesNow: isMatch,
      nextRuns: upcoming,
    })) as Json[];
    return isMatch ? { main: enriched, no: [] } : { main: [], no: enriched };
  },
};

export const loopOverItems: NodeModule = {
  kind: "loopOverItems",
  name: "Loop Over Items",
  group: "Flow",
  description: "Emit items one batch at a time with index metadata for looping.",
  icon: "repeat",
  keywords: ["loop", "batch", "iterate", "foreach"],
  outputs: [
    { handle: "main", label: "loop" },
    { handle: "done", label: "done" },
  ],
  fields: [
    { key: "batchSize", label: "Batch size", type: "number" },
    { key: "maxBatches", label: "Max batches (0 = all)", type: "number" },
  ],
  defaults: { batchSize: 1, maxBatches: 0 },
  execute: (ctx) => {
    const size = Math.max(1, Number(ctx.params.batchSize ?? 1));
    const maxBatches = Number(ctx.params.maxBatches ?? 0);
    const batches: Json[] = [];
    for (let i = 0; i < ctx.items.length; i += size) {
      if (maxBatches > 0 && batches.length >= maxBatches) break;
      batches.push({
        batchIndex: batches.length,
        batchSize: size,
        items: ctx.items.slice(i, i + size),
      });
    }
    return { main: batches, done: [{ totalItems: ctx.items.length, batches: batches.length }] };
  },
};

const validateSchema = (schema: Json, value: Json, path = "$"): string[] => {
  if (!schema || typeof schema !== "object") return [];
  const s = schema as Record<string, Json>;
  const errors: string[] = [];
  const type = s['type'] as string | undefined;
  const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (type && type !== actual && !(type === "integer" && actual === "number"))
    errors.push(`${path}: expected ${type}, got ${actual}`);
  if (type === "integer" && typeof value === "number" && !Number.isInteger(value))
    errors.push(`${path}: expected integer`);
  if (Array.isArray(s['enum']) && !(s['enum'] as Json[]).some((v) => v === value))
    errors.push(`${path}: value not in enum`);
  if (type === "object" && value && typeof value === "object") {
    const props = (s['properties'] ?? {}) as Record<string, Json>;
    for (const req of (s['required'] ?? []) as string[])
      if ((value as Record<string, Json>)[req] === undefined) errors.push(`${path}.${req}: required`);
    for (const [key, sub] of Object.entries(props))
      if ((value as Record<string, Json>)[key] !== undefined)
        errors.push(...validateSchema(sub, (value as Record<string, Json>)[key]!, `${path}.${key}`));
  }
  if (type === "array" && Array.isArray(value) && s['items'])
    value.forEach((entry, i) => errors.push(...validateSchema(s['items']!, entry, `${path}[${i}]`)));
  return errors;
};

export const jsonSchemaValidate: NodeModule = {
  kind: "jsonSchemaValidate",
  name: "JSON Schema Validate",
  group: "Data",
  description: "Validate each item against a JSON schema and route valid/invalid.",
  icon: "shield",
  keywords: ["validate", "schema", "json", "guard", "contract"],
  outputs: [
    { handle: "main", label: "valid" },
    { handle: "invalid", label: "invalid" },
  ],
  fields: [
    { key: "schema", label: "JSON schema", type: "code" },
    { key: "failOnError", label: "Fail run on invalid", type: "select", options: ["no", "yes"] },
  ],
  defaults: {
    schema: '{\n  "type": "object",\n  "required": ["id"],\n  "properties": { "id": { "type": "string" } }\n}',
    failOnError: "no",
  },
  execute: (ctx) => {
    const schema = parseJson(ctx.params.schema, {});
    const valid: Json[] = [];
    const invalid: Json[] = [];
    for (const item of ctx.items) {
      const errors = validateSchema(schema, item);
      if (errors.length) invalid.push({ ...(item as Record<string, Json>), __errors: errors });
      else valid.push(item);
    }
    if (invalid.length && String(ctx.params.failOnError) === "yes")
      throw new Error(`${invalid.length} item(s) failed schema validation`);
    return { main: valid, invalid };
  },
};

export const urlParse: NodeModule = {
  kind: "urlParse",
  name: "URL Parse & Build",
  group: "Data",
  description: "Split a URL into parts, or build one from parts and query params.",
  icon: "link",
  keywords: ["url", "query", "params", "encode", "parse"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "mode", label: "Mode", type: "select", options: ["parse", "build"] },
    { key: "url", label: "URL", type: "text", placeholder: "{{ $json.url }}" },
    { key: "query", label: "Query params (JSON, build mode)", type: "code" },
    { key: "target", label: "Write to field", type: "text" },
  ],
  defaults: { mode: "parse", url: "{{ $json.url }}", query: "{}", target: "url" },
  execute: (ctx) => {
    const mode = String(ctx.params.mode ?? "parse");
    const target = String(ctx.params.target || "url");
    return main(
      ctx.items.map((item, index) => {
        const raw = String(ctx.expr(ctx.params.url, item, index) ?? "");
        let value: Json;
        if (mode === "build") {
          const url = new URL(raw);
          const query = parseJson(ctx.expr(ctx.params.query, item, index), {}) as Record<string, Json>;
          Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
          value = url.toString();
        } else {
          const url = new URL(raw);
          value = {
            protocol: url.protocol.replace(":", ""),
            host: url.host,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            hash: url.hash,
            query: Object.fromEntries(url.searchParams.entries()),
          };
        }
        return { ...(item as Record<string, Json>), [target]: value } as Json;
      }),
    );
  },
};

export const core3Nodes: NodeModule[] = [
  renameKeys,
  typeConverter,
  randomNode,
  htmlExtract,
  markdownNode,
  xmlNode,
  cronHelper,
  loopOverItems,
  jsonSchemaValidate,
  urlParse,
];
