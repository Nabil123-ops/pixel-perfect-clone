import type { CredentialType } from "./types";

export interface CredentialFieldSpec {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
}

export interface CredentialTypeSpec {
  type: CredentialType;
  name: string;
  description: string;
  fields: CredentialFieldSpec[];
  /** Optional connection test: builds the request used by "Test connection". */
  test?: (fields: Record<string, string>) => {
    url: string;
    method?: string;
    headers?: Record<string, string>;
  } | null;
}

export const CREDENTIAL_TYPES: CredentialTypeSpec[] = [
  {
    type: "apiKey",
    name: "API key",
    description: "A single key sent as a header or query parameter.",
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "headerName", label: "Header name", placeholder: "X-API-Key" },
      { key: "testUrl", label: "Test URL (optional)", placeholder: "https://api.example.com/me" },
    ],
    test: (f) =>
      f["testUrl"]
        ? {
            url: f["testUrl"],
            headers: { [f["headerName"] || "X-API-Key"]: f["apiKey"] ?? "" },
          }
        : null,
  },
  {
    type: "bearer",
    name: "Bearer token",
    description: "Sent as Authorization: Bearer <token>.",
    fields: [
      { key: "token", label: "Token", secret: true },
      { key: "testUrl", label: "Test URL (optional)", placeholder: "https://api.example.com/me" },
    ],
    test: (f) =>
      f["testUrl"]
        ? { url: f["testUrl"], headers: { Authorization: `Bearer ${f["token"] ?? ""}` } }
        : null,
  },
  {
    type: "basicAuth",
    name: "Basic auth",
    description: "Username and password, base64 encoded per request.",
    fields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", secret: true },
      { key: "testUrl", label: "Test URL (optional)" },
    ],
    test: (f) =>
      f["testUrl"]
        ? {
            url: f["testUrl"],
            headers: {
              Authorization: `Basic ${btoa(`${f["username"] ?? ""}:${f["password"] ?? ""}`)}`,
            },
          }
        : null,
  },
  {
    type: "oauth2",
    name: "OAuth2",
    description: "Authorization-code flow with automatic refresh.",
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", secret: true },
      { key: "authUrl", label: "Authorization URL" },
      { key: "tokenUrl", label: "Token URL" },
      { key: "scope", label: "Scope" },
      { key: "accessToken", label: "Access token", secret: true },
      { key: "refreshToken", label: "Refresh token", secret: true },
      { key: "testUrl", label: "Test URL (optional)" },
    ],
    test: (f) =>
      f["testUrl"]
        ? { url: f["testUrl"], headers: { Authorization: `Bearer ${f["accessToken"] ?? ""}` } }
        : null,
  },
  {
    type: "webhookUrl",
    name: "Webhook URL",
    description: "An incoming webhook URL such as a Slack or Discord hook.",
    fields: [{ key: "url", label: "Webhook URL", secret: true }],
  },
];

export const credentialTypeSpec = (type: CredentialType): CredentialTypeSpec =>
  CREDENTIAL_TYPES.find((t) => t.type === type) ?? (CREDENTIAL_TYPES[0] as CredentialTypeSpec);

export const emptyFields = (type: CredentialType): Record<string, string> =>
  Object.fromEntries(credentialTypeSpec(type).fields.map((f) => [f.key, ""]));
