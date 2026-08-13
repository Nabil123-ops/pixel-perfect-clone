import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "../types";
import { main } from "../types";

const API = "https://discord.com/api/v10";

export const discord: NodeModule = {
  kind: "discord",
  name: "Discord",
  group: "Communication",
  description: "Send channel messages via bot token, or post to a channel webhook.",
  icon: "discord",
  credentialType: "bearer",
  keywords: ["chat", "message", "guild", "notify"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "operation",
      label: "Operation",
      type: "select",
      options: ["sendMessage", "listMessages", "webhook"],
    },
    { key: "channelId", label: "Channel ID", type: "text", placeholder: "123456789012345678" },
    { key: "text", label: "Message", type: "textarea", placeholder: "{{ $json.title }}" },
    { key: "url", label: "Webhook URL", type: "text" },
  ],
  defaults: { operation: "sendMessage", channelId: "", text: "Hello from Unlimited", url: "" },
  execute: async (ctx) => {
    const p = ctx.params;
    const op = String(p.operation ?? "sendMessage");
    const token = ctx.credential.token ?? "";
    const out: Json[] = [];

    if (op === "listMessages") {
      if (!token) throw new Error("Attach a Discord bot token credential");
      const res = await ctx.http({
        url: `${API}/channels/${String(p.channelId)}/messages?limit=50`,
        headers: { Authorization: `Bot ${token}` },
      });
      if (!res.ok) throw new Error(`Discord error: HTTP ${res.status}`);
      return main(Array.isArray(res.body) ? res.body : []);
    }

    for (const [i, item] of (ctx.items.length ? ctx.items : [{}]).entries()) {
      const content = String(ctx.expr(p.text, item, i));
      if (op === "webhook") {
        const url = String(ctx.expr(p.url, item, i));
        if (!url.startsWith("http")) throw new Error("Missing Discord webhook URL");
        const res = await ctx.http({
          url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error(`Discord webhook failed: HTTP ${res.status}`);
        out.push({ ok: true });
        continue;
      }
      if (!token) throw new Error("Attach a Discord bot token credential");
      const res = await ctx.http({
        url: `${API}/channels/${String(ctx.expr(p.channelId, item, i))}/messages`,
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(`Discord error: HTTP ${res.status}`);
      ctx.log(`Sent message ${res.body?.id ?? ""}`);
      out.push(res.body ?? { ok: true });
    }
    return main(out);
  },
};
