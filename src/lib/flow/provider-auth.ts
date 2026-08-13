/**
 * Exact wiring instructions per provider: which credential type to pick, which
 * header the key is sent in, the value format, the endpoint that gets called and
 * a safe URL to use as "Test URL" when saving the credential.
 */
export interface ProviderAuthGuide {
  /** Node kinds this guide applies to. */
  kinds: string[];
  label: string;
  credentialType: "apiKey" | "bearer" | "basicAuth" | "oauth2" | "webhookUrl";
  headerName: string;
  valueFormat: string;
  endpoint: string;
  testUrl?: string;
  getKeyAt: string;
}

export const PROVIDER_AUTH: ProviderAuthGuide[] = [
  {
    kinds: ["openAiModel", "openAiCodexModel", "openAiEmbeddings"],
    label: "OpenAI (ChatGPT / Codex)",
    credentialType: "apiKey",
    headerName: "Authorization",
    valueFormat: "Bearer sk-…",
    endpoint: "https://api.openai.com/v1/chat/completions",
    testUrl: "https://api.openai.com/v1/models",
    getKeyAt: "platform.openai.com → API keys",
  },
  {
    kinds: ["moonshotModel"],
    label: "Kimi K3 (Moonshot AI)",
    credentialType: "apiKey",
    headerName: "Authorization",
    valueFormat: "Bearer sk-…",
    endpoint: "https://api.moonshot.ai/v1/chat/completions",
    testUrl: "https://api.moonshot.ai/v1/models",
    getKeyAt: "platform.moonshot.ai → API keys",
  },
  {
    kinds: ["anthropicModel"],
    label: "Anthropic Claude",
    credentialType: "apiKey",
    headerName: "x-api-key",
    valueFormat: "sk-ant-… (plus anthropic-version: 2023-06-01)",
    endpoint: "https://api.anthropic.com/v1/messages",
    testUrl: "https://api.anthropic.com/v1/models",
    getKeyAt: "console.anthropic.com → API keys",
  },
  {
    kinds: ["googleGeminiModel"],
    label: "Google Gemini",
    credentialType: "apiKey",
    headerName: "Authorization",
    valueFormat: "Bearer <Gemini API key>",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    testUrl: "https://generativelanguage.googleapis.com/v1beta/openai/models",
    getKeyAt: "aistudio.google.com → Get API key",
  },
  {
    kinds: ["deepseekModel"],
    label: "DeepSeek",
    credentialType: "apiKey",
    headerName: "Authorization",
    valueFormat: "Bearer sk-…",
    endpoint: "https://api.deepseek.com/chat/completions",
    testUrl: "https://api.deepseek.com/models",
    getKeyAt: "platform.deepseek.com → API keys",
  },
  {
    kinds: ["groqModel"],
    label: "Groq",
    credentialType: "apiKey",
    headerName: "Authorization",
    valueFormat: "Bearer gsk_…",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    testUrl: "https://api.groq.com/openai/v1/models",
    getKeyAt: "console.groq.com → API keys",
  },
  {
    kinds: ["openRouterModel"],
    label: "OpenRouter",
    credentialType: "apiKey",
    headerName: "Authorization",
    valueFormat: "Bearer sk-or-…",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    testUrl: "https://openrouter.ai/api/v1/models",
    getKeyAt: "openrouter.ai → Keys",
  },
  {
    kinds: ["azureOpenAiModel"],
    label: "Azure OpenAI",
    credentialType: "apiKey",
    headerName: "api-key",
    valueFormat: "<resource key> (no Bearer prefix)",
    endpoint: "https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions",
    getKeyAt: "Azure portal → your OpenAI resource → Keys and Endpoint",
  },
  {
    kinds: ["slack"],
    label: "Slack",
    credentialType: "bearer",
    headerName: "Authorization",
    valueFormat: "Bearer xoxb-…",
    endpoint: "https://slack.com/api/chat.postMessage",
    testUrl: "https://slack.com/api/auth.test",
    getKeyAt: "api.slack.com/apps → OAuth & Permissions → Bot token",
  },
  {
    kinds: ["discord"],
    label: "Discord (incoming webhook)",
    credentialType: "webhookUrl",
    headerName: "—",
    valueFormat: "https://discord.com/api/webhooks/<id>/<token>",
    endpoint: "the webhook URL itself",
    getKeyAt: "Channel → Edit Channel → Integrations → Webhooks",
  },
  {
    kinds: ["telegram"],
    label: "Telegram Bot",
    credentialType: "apiKey",
    headerName: "— (token goes in the URL path)",
    valueFormat: "123456:ABC-DEF…",
    endpoint: "https://api.telegram.org/bot<token>/sendMessage",
    getKeyAt: "Talk to @BotFather → /newbot",
  },
  {
    kinds: ["notion"],
    label: "Notion",
    credentialType: "bearer",
    headerName: "Authorization",
    valueFormat: "Bearer secret_… (plus Notion-Version: 2022-06-28)",
    endpoint: "https://api.notion.com/v1",
    testUrl: "https://api.notion.com/v1/users/me",
    getKeyAt: "notion.so/my-integrations",
  },
];

export function authGuideFor(kind: string): ProviderAuthGuide | undefined {
  return PROVIDER_AUTH.find((g) => g.kinds.includes(kind));
}

/** Common ways APIs expect a key to be sent — surfaced in the credentials UI. */
export interface HeaderPreset {
  id: string;
  headerName: string;
  valueFormat: string;
  description: string;
  usedBy: string;
  recommended?: boolean;
}

export const HEADER_PRESETS: HeaderPreset[] = [
  {
    id: "bearer",
    headerName: "Authorization",
    valueFormat: "Bearer <token>",
    description: "The industry standard. Works with almost every modern REST API.",
    usedBy: "OpenAI, Kimi K3, Groq, DeepSeek, OpenRouter, Slack, Notion, Stripe",
    recommended: true,
  },
  {
    id: "x-api-key",
    headerName: "x-api-key",
    valueFormat: "<raw key>",
    description: "Raw key with no prefix, sent in a vendor header.",
    usedBy: "Anthropic Claude, SendGrid v2, many internal APIs",
  },
  {
    id: "api-key",
    headerName: "api-key",
    valueFormat: "<raw key>",
    description: "Azure-style header, no Bearer prefix.",
    usedBy: "Azure OpenAI, Azure Cognitive Services",
  },
  {
    id: "x-auth-token",
    headerName: "X-Auth-Token",
    valueFormat: "<raw token>",
    description: "Session-style token header.",
    usedBy: "Zendesk-style and legacy SaaS APIs",
  },
  {
    id: "basic",
    headerName: "Authorization",
    valueFormat: "Basic base64(user:pass)",
    description: "Username and password encoded per request — pick the Basic auth type.",
    usedBy: "Jira, Twilio, Mailgun, legacy endpoints",
  },
  {
    id: "token",
    headerName: "Authorization",
    valueFormat: "token <key>",
    description: "GitHub's classic personal-access-token scheme.",
    usedBy: "GitHub (classic PAT), Gitea",
  },
  {
    id: "apikey-plain",
    headerName: "apikey",
    valueFormat: "<raw key>",
    description: "Lowercase apikey header used by Postgres-backed APIs.",
    usedBy: "Supabase / PostgREST",
  },
  {
    id: "query",
    headerName: "— (query string)",
    valueFormat: "?api_key=<key> appended to the URL",
    description: "No header at all: the key travels in the URL. Least safe — avoid if possible.",
    usedBy: "Google Maps, OpenWeather, some legacy APIs",
  },
  {
    id: "path",
    headerName: "— (URL path)",
    valueFormat: "https://api.telegram.org/bot<token>/…",
    description: "The token is part of the endpoint path.",
    usedBy: "Telegram Bot API",
  },
  {
    id: "webhook",
    headerName: "— (webhook URL)",
    valueFormat: "The full secret URL is the credential",
    description: "Incoming webhooks carry their own secret in the URL.",
    usedBy: "Discord, Slack incoming webhooks, Microsoft Teams",
  },
];

export const HEADER_NAME_OPTIONS = Array.from(
  new Set(HEADER_PRESETS.map((p) => p.headerName).filter((h) => !h.startsWith("—"))),
);
