import type { Json } from "@/lib/flow/types";
import type { NodeModule } from "../types";
import { main } from "../types";

export const telegram: NodeModule = {
  kind: "telegram",
  name: "Telegram",
  group: "Communication",
  description: "Send messages or photos through a Telegram bot.",
  icon: "telegram",
  credentialType: "apiKey",
  keywords: ["bot", "chat", "message"],
  outputs: [{ handle: "main", label: "" }],
  fields: [
    {
      key: "operation",
      label: "Operation",
      type: "select",
      options: ["sendMessage", "sendPhoto", "getUpdates"],
    },
    { key: "chatId", label: "Chat ID", type: "text", placeholder: "123456789" },
    { key: "text", label: "Text", type: "textarea", placeholder: "{{ $json.title }}" },
    { key: "photoUrl", label: "Photo URL", type: "text" },
    {
      key: "parseMode",
      label: "Parse mode",
      type: "select",
      options: ["none", "Markdown", "HTML"],
    },
  ],
  defaults: {
    operation: "sendMessage",
    chatId: "",
    text: "Hello from Unlimited",
    photoUrl: "",
    parseMode: "none",
  },
  execute: async (ctx) => {
    const p = ctx.params;
    const token = ctx.credential.apiKey ?? ctx.credential.token ?? "";
    if (!token) throw new Error("Attach a Telegram bot token credential");
    const base = `https://api.telegram.org/bot${token}`;
    const op = String(p.operation ?? "sendMessage");
    const out: Json[] = [];

    if (op === "getUpdates") {
      const res = await ctx.http({ url: `${base}/getUpdates` });
      if (!res.body?.ok) throw new Error(`Telegram error: ${res.body?.description ?? res.status}`);
      return main(res.body.result ?? []);
    }

    for (const [i, item] of (ctx.items.length ? ctx.items : [{}]).entries()) {
      const payload: Json = { chat_id: String(ctx.expr(p.chatId, item, i)) };
      let method = "sendMessage";
      if (op === "sendPhoto") {
        method = "sendPhoto";
        payload.photo = String(ctx.expr(p.photoUrl, item, i));
        payload.caption = String(ctx.expr(p.text, item, i));
      } else {
        payload.text = String(ctx.expr(p.text, item, i));
      }
      if (p.parseMode && p.parseMode !== "none") payload.parse_mode = p.parseMode;
      const res = await ctx.http({
        url: `${base}/${method}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.body?.ok) throw new Error(`Telegram error: ${res.body?.description ?? res.status}`);
      ctx.log(`Telegram ${method} → message ${res.body.result?.message_id}`);
      out.push(res.body.result ?? { ok: true });
    }
    return main(out);
  },
};
