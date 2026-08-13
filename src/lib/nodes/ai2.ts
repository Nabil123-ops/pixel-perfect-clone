import type { NodeModule } from "./types";
import { modelNode } from "./ai";

/**
 * Additional chat-model sub-nodes. Each one publishes provider config that the
 * Agent / Chain root nodes consume through the `ai_languageModel` connection,
 * and every provider below speaks the OpenAI-compatible chat completions shape
 * unless marked otherwise.
 */

export const googleModel = modelNode({
  kind: "googleGeminiModel",
  name: "Google Gemini Chat Model",
  icon: "googlegemini",
  description: "Gemini models through Google's OpenAI-compatible endpoint.",
  models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  credentialType: "apiKey",
});

export const mistralModel = modelNode({
  kind: "mistralModel",
  name: "Mistral Chat Model",
  icon: "mistralai",
  description: "Mistral Large / Small models.",
  models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"],
  baseUrl: "https://api.mistral.ai/v1/chat/completions",
  credentialType: "apiKey",
});

export const deepseekModel = modelNode({
  kind: "deepseekModel",
  name: "DeepSeek Chat Model",
  icon: "deepseek",
  description: "DeepSeek chat and reasoning models.",
  models: ["deepseek-chat", "deepseek-reasoner"],
  baseUrl: "https://api.deepseek.com/chat/completions",
  credentialType: "apiKey",
});

export const xaiModel = modelNode({
  kind: "xaiModel",
  name: "xAI Grok Chat Model",
  icon: "x",
  description: "Grok models from xAI.",
  models: ["grok-4", "grok-3", "grok-3-mini"],
  baseUrl: "https://api.x.ai/v1/chat/completions",
  credentialType: "apiKey",
});

export const cohereModel = modelNode({
  kind: "cohereModel",
  name: "Cohere Chat Model",
  icon: "cohere",
  description: "Cohere Command models.",
  models: ["command-r-plus", "command-r", "command-a-03-2025"],
  baseUrl: "https://api.cohere.ai/compatibility/v1/chat/completions",
  credentialType: "apiKey",
});

export const perplexityModel = modelNode({
  kind: "perplexityModel",
  name: "Perplexity Chat Model",
  icon: "perplexity",
  description: "Perplexity Sonar models with built-in web search.",
  models: ["sonar", "sonar-pro", "sonar-reasoning"],
  baseUrl: "https://api.perplexity.ai/chat/completions",
  credentialType: "apiKey",
});

export const togetherModel = modelNode({
  kind: "togetherModel",
  name: "Together AI Chat Model",
  icon: "together",
  description: "Open models hosted on Together AI.",
  models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
  baseUrl: "https://api.together.xyz/v1/chat/completions",
  credentialType: "apiKey",
});

export const fireworksModel = modelNode({
  kind: "fireworksModel",
  name: "Fireworks Chat Model",
  icon: "fireworks",
  description: "Fast open-model inference on Fireworks AI.",
  models: ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/qwen2p5-72b-instruct"],
  baseUrl: "https://api.fireworks.ai/inference/v1/chat/completions",
  credentialType: "apiKey",
});

export const ollamaModel = modelNode({
  kind: "ollamaModel",
  name: "Ollama Chat Model",
  icon: "ollama",
  description: "Local models served by Ollama (set the base URL to your host).",
  models: ["llama3.2", "qwen2.5", "mistral", "phi4"],
  baseUrl: "http://localhost:11434/v1/chat/completions",
});

export const azureOpenAiModel = modelNode({
  kind: "azureOpenAiModel",
  name: "Azure OpenAI Chat Model",
  icon: "microsoftazure",
  description: "Azure-hosted OpenAI deployments — set the deployment URL as base URL.",
  models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
  baseUrl: "https://YOUR-RESOURCE.openai.azure.com/openai/deployments/DEPLOYMENT/chat/completions?api-version=2024-10-21",
  credentialType: "apiKey",
});

export const bedrockModel = modelNode({
  kind: "bedrockModel",
  name: "Amazon Bedrock Chat Model",
  icon: "amazonaws",
  description: "Anthropic and Llama models on Bedrock via an OpenAI-compatible proxy URL.",
  models: ["anthropic.claude-sonnet-4-5", "meta.llama3-3-70b-instruct-v1:0"],
  baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1/chat/completions",
  credentialType: "apiKey",
});

export const cerebrasModel = modelNode({
  kind: "cerebrasModel",
  name: "Cerebras Chat Model",
  icon: "cerebras",
  description: "Very high throughput inference on Cerebras.",
  models: ["llama-3.3-70b", "llama3.1-8b"],
  baseUrl: "https://api.cerebras.ai/v1/chat/completions",
  credentialType: "apiKey",
});

export const moonshotModel = modelNode({
  kind: "moonshotModel",
  name: "Kimi K3 (Moonshot) Chat Model",
  icon: "brain",
  description: "Kimi K3 / K2 long-context models from Moonshot AI. Header: Authorization: Bearer sk-…",
  models: ["kimi-k3", "kimi-k2-turbo-preview", "kimi-k2-0905-preview", "moonshot-v1-128k"],
  baseUrl: "https://api.moonshot.ai/v1/chat/completions",
  credentialType: "apiKey",
});

export const openAiCodexModel = modelNode({
  kind: "openAiCodexModel",
  name: "OpenAI Codex (ChatGPT) Model",
  icon: "openai",
  description: "Codex coding models for engineering and refactoring tasks.",
  models: ["gpt-5.1-codex", "gpt-5-codex", "o4-mini"],
  baseUrl: "https://api.openai.com/v1/chat/completions",
  credentialType: "apiKey",
});

export const zhipuModel = modelNode({
  kind: "zhipuModel",
  name: "Zhipu GLM Chat Model",
  icon: "cpu",
  description: "GLM-4 family models from Zhipu AI.",
  models: ["glm-4.6", "glm-4-plus", "glm-4-air"],
  baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  credentialType: "apiKey",
});

export const model2Nodes: NodeModule[] = [
  googleModel,
  mistralModel,
  deepseekModel,
  xaiModel,
  cohereModel,
  perplexityModel,
  togetherModel,
  fireworksModel,
  ollamaModel,
  azureOpenAiModel,
  bedrockModel,
  cerebrasModel,
  moonshotModel,
  openAiCodexModel,
  zhipuModel,
];

