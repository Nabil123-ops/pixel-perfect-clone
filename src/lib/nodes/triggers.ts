import type { NodeModule } from "./types";
import { main, parseJson, toItems } from "./types";

export const manualTrigger: NodeModule = {
  kind: "manualTrigger",
  name: "Manual Trigger",
  group: "Triggers",
  description: "Starts the workflow when you press Run.",
  icon: "play",
  isTrigger: true,
  keywords: ["start", "run", "test"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "payload", label: "Seed JSON items", type: "code", placeholder: '[{ "hello": "world" }]' },
  ],
  defaults: { payload: '[{ "hello": "world" }]' },
  execute: ({ params, trigger }) =>
    main(trigger.length ? trigger : toItems(parseJson(params.payload, [{}]))),
};

export const scheduleTrigger: NodeModule = {
  kind: "schedule",
  name: "Schedule",
  group: "Triggers",
  description: "Runs on a real server-side schedule while the workflow is active.",
  icon: "clock",
  isTrigger: true,
  keywords: ["cron", "interval", "timer", "every"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "seconds",
      label: "Every N seconds",
      type: "number",
      help: "The scheduler checks active workflows every minute, so 60 is the smallest reliable interval.",
    },
    { key: "payload", label: "Seed JSON items", type: "code" },
  ],
  defaults: { seconds: 300, payload: "[{}]" },
  execute: ({ params, trigger }) =>
    main(trigger.length ? trigger : toItems(parseJson(params.payload, [{}]))),
};

export const webhookTrigger: NodeModule = {
  kind: "webhookTrigger",
  name: "Webhook",
  group: "Triggers",
  description: "Exposes a real public URL that runs this workflow when called.",
  icon: "webhook",
  isTrigger: true,
  keywords: ["http", "inbound", "post", "url"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "path", label: "Path", type: "text", placeholder: "orders" },
    {
      key: "method",
      label: "HTTP method",
      type: "select",
      options: ["POST", "GET", "PUT", "PATCH", "DELETE", "ANY"],
    },
    {
      key: "respond",
      label: "Respond",
      type: "select",
      options: ["onReceived", "whenFinished"],
    },
    {
      key: "secret",
      label: "Shared secret (sent as x-webhook-secret)",
      type: "text",
      placeholder: "optional",
    },
    { key: "payload", label: "Sample body (used for manual tests)", type: "code" },
  ],
  defaults: {
    path: "hook",
    method: "POST",
    respond: "onReceived",
    secret: "",
    payload: '[{ "event": "order.created", "amount": 42 }]',
  },

  execute: ({ params, trigger }) =>
    main(trigger.length ? trigger : toItems(parseJson(params.payload, [{}]))),
};

export const errorTrigger: NodeModule = {
  kind: "errorTrigger",
  name: "Error Trigger",
  group: "Triggers",
  description: "Runs this workflow when another workflow fails.",
  icon: "alert",
  isTrigger: true,
  keywords: ["failure", "catch", "alert"],
  outputs: [{ handle: "main", label: "" }],
  fields: [],
  defaults: {},
  execute: ({ trigger }) => main(trigger.length ? trigger : [{ error: "sample failure" }]),
};

export const rssPollTrigger: NodeModule = {
  kind: "rssPoll",
  name: "RSS Poll Trigger",
  group: "Triggers",
  description: "Polls an RSS/Atom feed on a schedule and emits only new entries.",
  icon: "rss",
  isTrigger: true,
  keywords: ["feed", "atom", "poll", "news"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "url", label: "Feed URL", type: "text", placeholder: "https://news.ycombinator.com/rss" },
    { key: "seconds", label: "Poll every N seconds", type: "number" },
  ],
  defaults: { url: "https://news.ycombinator.com/rss", seconds: 300 },
  execute: async (ctx) => {
    const res = await ctx.http({ url: String(ctx.params.url ?? "") });
    return main(parseFeed(typeof res.body === "string" ? res.body : String(res.body ?? "")));
  },
  poll: async (ctx) => {
    const res = await ctx.http({ url: String(ctx.params.url ?? "") });
    const entries = parseFeed(typeof res.body === "string" ? res.body : String(res.body ?? ""));
    const seen = new Set(ctx.seen);
    const fresh = entries.filter((e) => !seen.has(String(e.id)));
    ctx.log(`Feed returned ${entries.length} entries, ${fresh.length} new`);
    const nextSeen = [...entries.map((e) => String(e.id)), ...ctx.seen].slice(0, 300);
    return { items: fresh, seen: nextSeen };
  },
};

const tag = (block: string, name: string): string => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  const raw = m?.[1] ?? "";
  return raw
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
};

export function parseFeed(xml: string) {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  return blocks.map((block) => {
    const link = tag(block, "link") || (block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "");
    const title = tag(block, "title");
    return {
      id: tag(block, "guid") || tag(block, "id") || link || title,
      title,
      link,
      publishedAt: tag(block, "pubDate") || tag(block, "updated") || null,
      summary: tag(block, "description") || tag(block, "summary"),
    };
  });
}

export const triggerNodes = [
  manualTrigger,
  scheduleTrigger,
  webhookTrigger,
  rssPollTrigger,
  errorTrigger,
];

/**
 * Chat Trigger — a real hosted endpoint. Posting `{ message, sessionId }` to
 * /api/public/chat/:workflowId runs the workflow and returns the last output.
 */
export const chatTrigger: NodeModule = {
  kind: "chatTrigger",
  name: "Chat Trigger",
  group: "Triggers",
  description: "Starts the workflow from a chat message posted to its public endpoint.",
  icon: "chat",
  keywords: ["chat", "message", "agent", "conversation"],
  isTrigger: true,
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "greeting", label: "Greeting shown in the chat widget", type: "text" },
    { key: "sample", label: "Test message", type: "code" },
  ],
  defaults: {
    greeting: "Hi! How can I help?",
    sample: '{ "message": "Hello", "sessionId": "demo" }',
  },
  execute: (ctx) =>
    main(ctx.trigger.length ? ctx.trigger : toItems(parseJson(ctx.params.sample, [{}]))),
};

export const formTrigger: NodeModule = {
  kind: "formTrigger",
  name: "Form Trigger",
  group: "Triggers",
  description: "Starts the workflow when a hosted form is submitted (same endpoint as webhook).",
  icon: "form",
  keywords: ["form", "submit", "input"],
  isTrigger: true,
  outputs: [{ handle: "main", label: "" }],
  fields: [
    { key: "path", label: "Form path", type: "text", placeholder: "signup" },
    { key: "formFields", label: "Fields (comma separated)", type: "text" },
    { key: "sample", label: "Test submission (JSON)", type: "code" },
  ],
  defaults: { path: "signup", formFields: "name, email", sample: '{ "name": "Ada", "email": "ada@example.com" }' },
  execute: (ctx) =>
    main(ctx.trigger.length ? ctx.trigger : toItems(parseJson(ctx.params.sample, [{}]))),
};

export const extraTriggerNodes = [chatTrigger, formTrigger];
