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

/** Shared by every type below: extra headers merged in on top of the type's own auth header. */
const extraHeadersField: CredentialFieldSpec = {
  key: "extraHeaders",
  label: "Extra headers (JSON, optional)",
  placeholder: '{ "X-Org-Id": "acme", "X-Client-Version": "1.0" }',
};

export const CREDENTIAL_TYPES: CredentialTypeSpec[] = [
  {
    type: "apiKey",
    name: "API key",
    description:
      "A single secret sent in one header. Paste the raw key only — the engine adds \"Bearer \" automatically when the header is Authorization, and sends it raw otherwise.",
    fields: [
      { key: "apiKey", label: "API key", secret: true, placeholder: "sk-…  (no \"Bearer \" prefix)" },
      { key: "headerName", label: "Header name", placeholder: "Authorization" },
      extraHeadersField,
      { key: "testUrl", label: "Test URL (optional)", placeholder: "https://api.example.com/me" },
    ],
    test: (f) => {
      if (!f["testUrl"]) return null;
      const headerName = f["headerName"] || "Authorization";
      const value =
        headerName.toLowerCase() === "authorization" ? `Bearer ${f["apiKey"] ?? ""}` : f["apiKey"] ?? "";
      return { url: f["testUrl"], headers: { [headerName]: value } };
    },
  },
  {
    type: "bearer",
    name: "Bearer token",
    description: "Sent as Authorization: Bearer <token>.",
    fields: [
      { key: "token", label: "Token", secret: true },
      extraHeadersField,
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
      extraHeadersField,
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
      extraHeadersField,
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
  {
    type: "customHeader",
    name: "Custom header(s)",
    description:
      "Send whatever headers an API needs — no assumed scheme. Fill in as many name/value pairs as you need and leave the rest blank.",
    fields: [
      { key: "header1Name", label: "Header 1 name", placeholder: "X-Api-Key" },
      { key: "header1Value", label: "Header 1 value", secret: true },
      { key: "header2Name", label: "Header 2 name (optional)" },
      { key: "header2Value", label: "Header 2 value (optional)", secret: true },
      { key: "header3Name", label: "Header 3 name (optional)" },
      { key: "header3Value", label: "Header 3 value (optional)", secret: true },
      { key: "header4Name", label: "Header 4 name (optional)" },
      { key: "header4Value", label: "Header 4 value (optional)", secret: true },
      { key: "header5Name", label: "Header 5 name (optional)" },
      { key: "header5Value", label: "Header 5 value (optional)", secret: true },
      { key: "testUrl", label: "Test URL (optional)" },
    ],
    test: (f) => {
      if (!f["testUrl"]) return null;
      const headers: Record<string, string> = {};
      for (let i = 1; i <= 5; i++) {
        const name = f[`header${i}Name`];
        const value = f[`header${i}Value`];
        if (name && value) headers[name] = value;
      }
      return { url: f["testUrl"], headers };
    },
  },
];

export const credentialTypeSpec = (type: CredentialType): CredentialTypeSpec =>
  CREDENTIAL_TYPES.find((t) => t.type === type) ?? (CREDENTIAL_TYPES[0] as CredentialTypeSpec);

export const emptyFields = (type: CredentialType): Record<string, string> =>
  Object.fromEntries(credentialTypeSpec(type).fields.map((f) => [f.key, ""]));
