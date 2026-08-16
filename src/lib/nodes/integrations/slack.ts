import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "../types";
import { main, parseJson } from "../types";
import { mergeExtraHeaders } from "@/lib/flow/auth";

const API = "https://slack.com/api";

/**
 * Slack node with real operations. Uses a bot token credential
 * (`token` field) for API calls, or an incoming webhook URL for
 * the legacy webhook operation.
 */
export const slack: NodeModule = {
  kind: "slack",
  name: "Slack",
  group: "Communication",
  description: "Post messages, list channels or upload files with a Slack bot token.",
  icon: "slack",
  credentialType: "bearer",
  keywords: ["chat", "message", "channel", "notify"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "operation",
      label: "Operation",
      type: "select",
      options: ["postMessage", "listChannels", "uploadFile", "incomingWebhook"],
    },
    { key: "channel", label: "Channel (id or #name)", type: "text", placeholder: "#general" },
    { key: "text", label: "Message", type: "textarea", placeholder: "New item: {{ $json.title }}" },
    { key: "blocks", label: "Blocks (JSON, optional)", type: "code" },
    { key: "filename", label: "File name (upload)", type: "text", placeholder: "report.txt" },
    { key: "content", label: "File content (upload)", type: "textarea" },
    { key: "url", label: "Incoming webhook URL", type: "text" },
  ],
  defaults: {
    operation: "postMessage",
    channel: "#general",
    text: "Hello from Unlimited 🚀",
    blocks: "",
    filename: "report.txt",
    content: "",
    url: "",
  },
  execute: async (ctx) => {
    const p = ctx.params;
    const op = String(p.operation ?? "postMessage");
    const token = ctx.credential.token ?? ctx.credential.apiKey ?? "";
    const auth = mergeExtraHeaders(ctx.credential as Record<string, string>, {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    const out: Json[] = [];

    if (op === "listChannels") {
      const res = await ctx.http({ url: `${API}/conversations.list?limit=200`, headers: auth });
      const body = res.body ?? {};
      if (!body.ok) throw new Error(`Slack error: ${body.error ?? res.status}`);
      ctx.log(`Fetched ${body.channels?.length ?? 0} channels`);
      return main(body.channels ?? []);
    }

    const source = ctx.items.length ? ctx.items : [{}];
    for (const [i, item] of source.entries()) {
      if (op === "incomingWebhook") {
        const url = String(ctx.expr(p.url, item, i));
        if (!url.startsWith("http")) throw new Error("Missing Slack incoming webhook URL");
        const res = await ctx.http({
          url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: String(ctx.expr(p.text, item, i)) }),
        });
        if (!res.ok) throw new Error(`Slack webhook failed: HTTP ${res.status}`);
        out.push({ ok: true, delivered: true });
        continue;
      }

      if (!token) throw new Error("Attach a Slack bot token credential to this node");

      if (op === "uploadFile") {
        const content = String(ctx.expr(p.content, item, i) || JSON.stringify(item, null, 2));
        const form = new URLSearchParams({
          channels: String(ctx.expr(p.channel, item, i)),
          filename: String(ctx.expr(p.filename, item, i) || "file.txt"),
          content,
        });
        const res = await ctx.http({
          url: `${API}/files.upload`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        if (!res.body?.ok) throw new Error(`Slack error: ${res.body?.error ?? res.status}`);
        out.push(res.body.file ?? { ok: true });
        continue;
      }

      const payload: Json = {
        channel: String(ctx.expr(p.channel, item, i)),
        text: String(ctx.expr(p.text, item, i)),
      };
      const blocks = parseJson(p.blocks, null);
      if (blocks) payload.blocks = blocks;
      const res = await ctx.http({
        url: `${API}/chat.postMessage`,
        method: "POST",
        headers: auth,
        body: JSON.stringify(payload),
      });
      if (!res.body?.ok) throw new Error(`Slack error: ${res.body?.error ?? res.status}`);
      ctx.log(`Posted to ${payload.channel} (ts ${res.body.ts})`);
      out.push({ ok: true, channel: res.body.channel, ts: res.body.ts });
    }
    return main(out);
  },
};
