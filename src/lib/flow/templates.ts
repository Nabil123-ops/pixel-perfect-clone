import type { FlowNodeKind, Json, StoredEdge, StoredNode } from "./types";
import { uid } from "./store";

interface Step {
  kind: FlowNodeKind;
  label: string;
  params: Record<string, Json>;
  /** Explicit canvas position (used by graph templates). */
  pos?: { x: number; y: number };
}

interface Link {
  from: number;
  to: number;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Template {
  slug: string;
  name: string;
  description: string;
  category: "Monitoring" | "Data & APIs" | "Notifications" | "Utilities" | "AI";
  steps: Step[];
  /** When set, wires the graph explicitly instead of a straight chain. */
  links?: Link[];
}


const GET = (url: string, path = "") => ({
  method: "GET",
  url,
  headers: '{ "Accept": "application/json" }',
  body: "",
  path,
});

export const TEMPLATES: Template[] = [
  {
    slug: "weather-alert",
    name: "Weather heat alert",
    description: "Reads live weather for a city and branches when it gets too hot.",
    category: "Monitoring",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: '[{ "city": "Beirut", "lat": 33.89, "lon": 35.5 }]' } },
      {
        kind: "http",
        label: "Open-Meteo",
        params: GET("https://api.open-meteo.com/v1/forecast?latitude={{ item.lat }}&longitude={{ item.lon }}&current=temperature_2m,wind_speed_10m"),
      },
      {
        kind: "set",
        label: "Shape reading",
        params: {
          fields: '{ "tempC": "{{ item.current.temperature_2m }}", "wind": "{{ item.current.wind_speed_10m }}", "at": "{{ $now }}" }',
          keepOnlySet: "yes",
        },
      },
      { kind: "if", label: "Too hot?", params: { left: "{{ item.tempC }}", op: "gt", right: "30" } },
    ],
  },
  {
    slug: "crypto-tracker",
    name: "Crypto price tracker",
    description: "Polls Bitcoin and Ethereum prices every minute and formats a digest.",
    category: "Monitoring",
    steps: [
      { kind: "schedule", label: "Every 60s", params: { seconds: 60, payload: "[{}]" } },
      {
        kind: "http",
        label: "CoinGecko",
        params: GET("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"),
      },
      {
        kind: "set",
        label: "Digest",
        params: {
          fields: '{ "btc": "{{ item.bitcoin.usd }}", "eth": "{{ item.ethereum.usd }}", "checkedAt": "{{ $now }}" }',
          keepOnlySet: "yes",
        },
      },
    ],
  },
  {
    slug: "uptime-monitor",
    name: "Website uptime monitor",
    description: "Pings a URL on a schedule and routes failures to a Telegram alert.",
    category: "Monitoring",
    steps: [
      { kind: "schedule", label: "Every 5 min", params: { seconds: 300, payload: '[{ "site": "https://example.com" }]' } },
      { kind: "http", label: "Ping site", params: { ...GET("{{ item.site }}"), headers: "{}" } },
      { kind: "set", label: "Mark up", params: { fields: '{ "status": "up", "at": "{{ $now }}" }', keepOnlySet: "no" } },
      { kind: "telegram", label: "Alert me", params: { token: "{{ $cred.Telegram.token }}", chatId: "", text: "Uptime check: {{ item.status }}" } },
    ],
  },
  {
    slug: "hn-top",
    name: "Hacker News trend digest",
    description: "Fetches top story IDs, limits them and aggregates a daily count.",
    category: "Data & APIs",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: "[{}]" } },
      { kind: "http", label: "Top stories", params: GET("https://hacker-news.firebaseio.com/v0/topstories.json") },
      { kind: "limit", label: "First 10", params: { count: 10, keep: "first" } },
      { kind: "aggregate", label: "Summarise", params: { field: "value" } },
    ],
  },
  {
    slug: "space-launch",
    name: "Space launch watcher",
    description: "Pulls the latest SpaceX launch and posts it to Discord.",
    category: "Notifications",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: "[{}]" } },
      { kind: "http", label: "Latest launch", params: GET("https://api.spacexdata.com/v4/launches/latest") },
      {
        kind: "set",
        label: "Format",
        params: { fields: '{ "mission": "{{ item.name }}", "date": "{{ item.date_utc }}" }', keepOnlySet: "yes" },
      },
      {
        kind: "discord",
        label: "Post to Discord",
        params: { url: "{{ $cred.Discord.webhookUrl }}", text: "🚀 {{ item.mission }} — {{ item.date }}" },
      },
    ],
  },
  {
    slug: "daily-quote",
    name: "Daily quote to Slack",
    description: "Sends an inspiring quote to a Slack channel each morning.",
    category: "Notifications",
    steps: [
      { kind: "schedule", label: "Daily", params: { seconds: 86400, payload: "[{}]" } },
      { kind: "http", label: "Get quote", params: GET("https://api.quotable.io/random") },
      {
        kind: "slack",
        label: "Slack message",
        params: { url: "{{ $cred.Slack.webhookUrl }}", text: "“{{ item.content }}” — {{ item.author }}" },
      },
    ],
  },
  {
    slug: "form-intake",
    name: "Webhook form intake",
    description: "Receives a form payload, validates it and cleans up the fields.",
    category: "Utilities",
    steps: [
      {
        kind: "webhookTrigger",
        label: "Form submitted",
        params: { path: "/contact-form", payload: '[{ "email": "ada@example.com", "message": "Hello!" }]' },
      },
      { kind: "filter", label: "Has email", params: { left: "{{ item.email }}", op: "contains", right: "@" } },
      {
        kind: "code",
        label: "Normalise",
        params: { js: "return items.map((item) => ({\n  email: String(item.email).toLowerCase().trim(),\n  message: String(item.message ?? '').slice(0, 500),\n  receivedAt: new Date().toISOString(),\n}));" },
      },
    ],
  },
  {
    slug: "country-facts",
    name: "Country data enrichment",
    description: "Enriches a list of country codes with population and currency data.",
    category: "Data & APIs",
    steps: [
      { kind: "manualTrigger", label: "Country list", params: { payload: '[{ "code": "LB" }, { "code": "FR" }, { "code": "JP" }]' } },
      { kind: "http", label: "REST Countries", params: GET("https://restcountries.com/v3.1/alpha/{{ item.code }}") },
      {
        kind: "set",
        label: "Pick fields",
        params: { fields: '{ "country": "{{ item.name.common }}", "population": "{{ item.population }}", "region": "{{ item.region }}" }', keepOnlySet: "yes" },
      },
      { kind: "sort", label: "By population", params: { field: "population", direction: "desc" } },
    ],
  },
  {
    slug: "currency-rates",
    name: "Currency rate snapshot",
    description: "Captures USD exchange rates and keeps only the pairs you care about.",
    category: "Data & APIs",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: "[{}]" } },
      { kind: "http", label: "Exchange API", params: GET("https://open.er-api.com/v6/latest/USD") },
      {
        kind: "set",
        label: "Pick pairs",
        params: { fields: '{ "eur": "{{ item.rates.EUR }}", "gbp": "{{ item.rates.GBP }}", "jpy": "{{ item.rates.JPY }}" }', keepOnlySet: "yes" },
      },
    ],
  },
  {
    slug: "iss-tracker",
    name: "ISS position logger",
    description: "Tracks the International Space Station and logs its coordinates.",
    category: "Monitoring",
    steps: [
      { kind: "schedule", label: "Every 30s", params: { seconds: 30, payload: "[{}]" } },
      { kind: "http", label: "Where is ISS", params: GET("https://api.wheretheiss.at/v1/satellites/25544") },
      {
        kind: "set",
        label: "Coordinates",
        params: { fields: '{ "lat": "{{ item.latitude }}", "lon": "{{ item.longitude }}", "altitude": "{{ item.altitude }}" }', keepOnlySet: "yes" },
      },
    ],
  },
  {
    slug: "lead-dedupe",
    name: "Lead list clean-up",
    description: "Generates leads, removes duplicates and produces a summary.",
    category: "Utilities",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: "[{}]" } },
      {
        kind: "code",
        label: "Mock leads",
        params: { js: "const emails = ['a@x.com','b@x.com','a@x.com','c@x.com','b@x.com'];\nreturn emails.map((email, i) => ({ email, score: (i * 7) % 100 }));" },
      },
      { kind: "dedupe", label: "Unique emails", params: { field: "email" } },
      { kind: "aggregate", label: "Score summary", params: { field: "score" } },
    ],
  },
  {
    slug: "holidays",
    name: "Public holiday planner",
    description: "Lists upcoming public holidays and keeps the next five.",
    category: "Data & APIs",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: "[{}]" } },
      { kind: "http", label: "Holiday API", params: GET("https://date.nager.at/api/v3/NextPublicHolidays/US") },
      { kind: "limit", label: "Next 5", params: { count: 5, keep: "first" } },
      { kind: "set", label: "Clean", params: { fields: '{ "holiday": "{{ item.localName }}", "date": "{{ item.date }}" }', keepOnlySet: "yes" } },
    ],
  },
  {
    slug: "cat-facts",
    name: "Fun fact broadcaster",
    description: "Grabs a random fact, waits a beat, then broadcasts it.",
    category: "Notifications",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: "[{}]" } },
      { kind: "http", label: "Random fact", params: GET("https://catfact.ninja/fact") },
      { kind: "delay", label: "Wait 1s", params: { ms: 1000 } },
      { kind: "slack", label: "Broadcast", params: { url: "{{ $cred.Slack.webhookUrl }}", text: "Did you know: {{ item.fact }}" } },
    ],
  },
  {
    slug: "nasa-apod",
    name: "NASA photo of the day",
    description: "Fetches the astronomy picture of the day and formats a caption.",
    category: "Data & APIs",
    steps: [
      { kind: "manualTrigger", label: "Start", params: { payload: "[{}]" } },
      { kind: "http", label: "APOD", params: GET("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY") },
      {
        kind: "set",
        label: "Caption",
        params: { fields: '{ "title": "{{ item.title }}", "image": "{{ item.url }}", "date": "{{ item.date }}" }', keepOnlySet: "yes" },
      },
    ],
  },
  {
    slug: "ai-router-command-center",
    name: "AI Router Command Center",
    description:
      "A chat-driven router agent that dispatches to Claude, Gemini, DeepSeek and Kimi, researches live with Perplexity/web search, writes to an Obsidian knowledge base and fans out to your automation layer.",
    category: "AI",
    steps: [
      {
        kind: "chatTrigger",
        label: "Chat Trigger",
        pos: { x: 40, y: 320 },
        params: {
          greeting: "Ask anything — I route to the best model.",
          sample: '{ "message": "Research the latest on edge AI and save a note", "sessionId": "demo" }',
        },
      },
      {
        kind: "aiAgent",
        label: "AI Router / Agent",
        pos: { x: 380, y: 300 },
        params: {
          systemPrompt:
            "You are an AI router. Classify each request into one domain: reasoning_writing (Claude), research_multimodal (Gemini), engineering_coding (DeepSeek/Codex), long_context (Kimi). Use the web research tool for anything current. Always answer with the final result, and set a 'domain' word on the first line as: DOMAIN: <domain>.",
          userPrompt: "{{ $json.message }}",
          maxSteps: 8,
          sessionKey: "{{ $json.sessionId }}",
        },
      },
      {
        kind: "anthropicModel",
        label: "Claude — Reasoning / Writing",
        pos: { x: 200, y: 620 },
        params: {
          model: "claude-sonnet-4-5",
          temperature: 0.4,
          baseUrl: "",
          __config: {
            provider: "anthropicModel",
            style: "anthropic",
            baseUrl: "https://api.anthropic.com/v1/messages",
          },
        },
      },
      {
        kind: "googleGeminiModel",
        label: "Gemini — Research / Multimodal",
        pos: { x: 440, y: 620 },
        params: {
          model: "gemini-2.5-pro",
          temperature: 0.5,
          baseUrl: "",
          __config: {
            provider: "googleGeminiModel",
            style: "openai",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          },
        },
      },
      {
        kind: "deepseekModel",
        label: "DeepSeek — Engineering / Coding",
        pos: { x: 680, y: 620 },
        params: {
          model: "deepseek-reasoner",
          temperature: 0.2,
          baseUrl: "",
          __config: {
            provider: "deepseekModel",
            style: "openai",
            baseUrl: "https://api.deepseek.com/chat/completions",
          },
        },
      },
      {
        kind: "moonshotModel",
        label: "Kimi K3 — Long Context",
        pos: { x: 920, y: 620 },
        params: {
          model: "kimi-k3",
          temperature: 0.4,
          baseUrl: "",
          __config: {
            provider: "moonshotModel",
            style: "openai",
            baseUrl: "https://api.moonshot.ai/v1/chat/completions",
          },
        },
      },
      {
        kind: "bufferMemory",
        label: "Conversation Memory",
        pos: { x: 1160, y: 620 },
        params: { sessionKey: "{{ $json.sessionId }}", window: 20 },
      },
      {
        kind: "webSearchTool",
        label: "Web Research (Perplexity / Tavily)",
        pos: { x: 1160, y: 760 },
        params: {
          toolName: "web_research",
          toolDescription: "Search the live web for current data before answering.",
          maxResults: 5,
        },
      },
      {
        kind: "switch",
        label: "Route by domain",
        pos: { x: 760, y: 300 },
        params: {
          field: "output",
          rules:
            '[{ "op": "contains", "value": "reasoning_writing" }, { "op": "contains", "value": "research_multimodal" }, { "op": "contains", "value": "engineering_coding" }]',
          fallback: "branch 4",
        },
      },
      {
        kind: "http",
        label: "Obsidian Knowledge Base",
        pos: { x: 1120, y: 220 },
        params: {
          method: "POST",
          url: "http://127.0.0.1:27123/vault/AI%20Router/{{ $now }}.md",
          headers:
            '{ "Authorization": "Bearer {{ $cred.Obsidian.apiKey }}", "Content-Type": "text/markdown" }',
          body: "# AI Router note\n\n{{ item.output }}",
          path: "",
        },
      },
      {
        kind: "http",
        label: "Automation Layer Webhook",
        pos: { x: 1460, y: 220 },
        params: {
          method: "POST",
          url: "{{ $cred.AutomationLayer.url }}",
          headers: '{ "Content-Type": "application/json" }',
          body: '{ "text": "{{ item.output }}", "session": "{{ item.sessionId }}" }',
          path: "",
        },
      },
      {
        kind: "openAiModel",
        label: "ChatGPT (OpenAI) — General",
        pos: { x: 680, y: 760 },
        params: {
          model: "gpt-5.1",
          temperature: 0.4,
          baseUrl: "",
          __config: {
            provider: "openAiModel",
            style: "openai",
            baseUrl: "https://api.openai.com/v1/chat/completions",
          },
        },
      },
      {
        kind: "openAiCodexModel",
        label: "Codex — Code Generation",
        pos: { x: 440, y: 760 },
        params: {
          model: "gpt-5.1-codex",
          temperature: 0.2,
          baseUrl: "",
          __config: {
            provider: "openAiCodexModel",
            style: "openai",
            baseUrl: "https://api.openai.com/v1/chat/completions",
          },
        },
      },
      {
        kind: "webhookTrigger",
        label: "Webhook Trigger (test + production URL)",
        pos: { x: 40, y: 120 },
        params: {
          path: "ai-router",
          method: "POST",
          respond: "whenFinished",
          secret: "",
        },
      },
    ],
    links: [
      { from: 0, to: 1 },
      { from: 11, to: 1, sourceHandle: "ai_languageModel", targetHandle: "ai_languageModel" },
      { from: 12, to: 1, sourceHandle: "ai_languageModel", targetHandle: "ai_languageModel" },
      { from: 13, to: 1 },
      { from: 2, to: 1, sourceHandle: "ai_languageModel", targetHandle: "ai_languageModel" },
      { from: 3, to: 1, sourceHandle: "ai_languageModel", targetHandle: "ai_languageModel" },
      { from: 4, to: 1, sourceHandle: "ai_languageModel", targetHandle: "ai_languageModel" },
      { from: 5, to: 1, sourceHandle: "ai_languageModel", targetHandle: "ai_languageModel" },
      { from: 6, to: 1, sourceHandle: "ai_memory", targetHandle: "ai_memory" },
      { from: 7, to: 1, sourceHandle: "ai_tool", targetHandle: "ai_tool" },
      { from: 1, to: 8 },
      { from: 8, to: 9, sourceHandle: "out0" },
      { from: 9, to: 10 },
    ],
  },
];

export interface WorkflowDraft {
  name: string;
  nodes: StoredNode[];
  edges: StoredEdge[];
}

export function workflowFromTemplate(t: Template): WorkflowDraft {
  const ids = t.steps.map(() => uid());
  const nodes: StoredNode[] = t.steps.map((s, i) => ({
    id: ids[i] as string,
    position: s.pos ?? { x: 80 + i * 300, y: 160 + (i % 2 === 0 ? 0 : 40) },
    data: { kind: s.kind, label: s.label, params: s.params },
  }));
  const edges: StoredEdge[] = t.links
    ? t.links.map((l) => ({
        id: uid(),
        source: ids[l.from] as string,
        target: ids[l.to] as string,
        sourceHandle: l.sourceHandle ?? "main",
        targetHandle: l.targetHandle ?? "main",
      }))
    : t.steps.slice(1).map((_, i) => ({
        id: uid(),
        source: ids[i] as string,
        target: ids[i + 1] as string,
        sourceHandle: "main",
      }));
  return { name: t.name, nodes, edges };
}


export function blankWorkflow(): WorkflowDraft {
  return {
    name: "My workflow",
    nodes: [
      {
        id: uid(),
        position: { x: 220, y: 200 },
        data: { kind: "manualTrigger", label: "Manual Trigger", params: { payload: '[{ "hello": "world" }]' } },
      },
    ],
    edges: [],
  };
}
