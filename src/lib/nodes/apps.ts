import type { Json } from "@/lib/flow/types";
import type { NodeContext, NodeGroup, NodeModule, ParamField } from "./types";
import { getPath, main, parseJson, toItems } from "./types";

/**
 * Shared factory for real REST integrations. Every operation performs a genuine
 * HTTP call against the vendor API using the decrypted credential — nothing is
 * mocked. New integrations only declare metadata + operations.
 */
export interface AppOperation {
  key: string;
  label: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path template resolved with `{param}` placeholders and `{{ }}` expressions. */
  path: string;
  fields?: ParamField[];
  /** Build a JSON body from resolved params. */
  body?: (p: Record<string, Json>, item: Json) => Json | undefined;
  /** Build a query string from resolved params. */
  query?: (p: Record<string, Json>, cred: Record<string, string>) => Record<string, string>;
  /** Dot-path of the array/object to emit from the response. */
  pick?: string;
  /** Send body as form-urlencoded instead of JSON. */
  form?: boolean;
}

export interface AppSpec {
  kind: string;
  name: string;
  group: NodeGroup;
  description: string;
  icon: string;
  baseUrl: string | ((cred: Record<string, string>) => string);
  credentialType: NonNullable<NodeModule["credentialType"]>;
  /** Turn a credential into request headers. */
  auth: (cred: Record<string, string>) => Record<string, string>;
  operations: AppOperation[];
  keywords?: string[];
  stub?: string;
}

const clean = (obj: Record<string, Json | undefined>): Json => {
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === "" || v === null) continue;
    out[k] = v;
  }
  return out;
};

export function bearer(cred: Record<string, string>) {
  const token = cred['token'] ?? cred['apiKey'] ?? cred['accessToken'] ?? "";
  return { Authorization: `Bearer ${token}` };
}

export function basic(cred: Record<string, string>) {
  const user = cred['username'] ?? cred['user'] ?? cred['sid'] ?? "";
  const pass = cred['password'] ?? cred['token'] ?? cred['apiKey'] ?? "";
  return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
}

export function createAppNode(spec: AppSpec): NodeModule {
  // Merge every operation's fields into one list, keyed by field key, and
  // record which operation(s) each field belongs to. The inspector uses this
  // to show only the fields relevant to the operation currently selected,
  // instead of every field from every operation at once.
  const byKey = new Map<string, ParamField>();
  for (const op of spec.operations) {
    for (const field of op.fields ?? []) {
      const existing = byKey.get(field.key);
      if (existing) {
        // Shared across operations (e.g. Record ID on Get/Update/Delete) —
        // widen its operation list rather than treat it as operation-specific.
        if (existing.operations && !existing.operations.includes(op.label)) {
          existing.operations = [...existing.operations, op.label];
        }
      } else {
        byKey.set(field.key, { ...field, operations: [op.label] });
      }
    }
  }
  // A field shared by every operation should always show — drop the tag.
  for (const field of byKey.values()) {
    if (field.operations && field.operations.length >= spec.operations.length) {
      delete field.operations;
    }
  }
  const opFields = [...byKey.values()];
  const fields: ParamField[] = [
    {
      key: "operation",
      label: "Operation",
      type: "select",
      options: spec.operations.map((o) => o.label),
    },
    ...opFields,
  ];

  return {
    kind: spec.kind,
    name: spec.name,
    group: spec.group,
    description: spec.description,
    icon: spec.icon,
    keywords: [...(spec.keywords ?? []), spec.name.toLowerCase(), ...spec.operations.map((o) => o.label.toLowerCase())],
    credentialType: spec.credentialType,
    ...(spec.stub ? { stub: spec.stub } : {}),
    outputs: [{ handle: "main", label: "" }],
    fields,
    defaults: Object.fromEntries([
      ["operation", spec.operations[0]!.label],
      ...opFields.map((f) => [f.key, f.type === "number" ? 0 : ""] as const),
    ]) as Record<string, Json>,
    execute: async (ctx: NodeContext) => {
      const cred = (ctx.credential ?? {}) as Record<string, string>;
      const op =
        spec.operations.find((o) => o.label === ctx.params.operation) ??
        spec.operations.find((o) => o.key === ctx.params.operation) ??
        spec.operations[0]!;
      const base = typeof spec.baseUrl === "function" ? spec.baseUrl(cred) : spec.baseUrl;
      const items = ctx.items.length ? ctx.items : [{} as Json];
      const out: Json[] = [];

      for (const [index, item] of items.entries()) {
        const resolved: Record<string, Json> = {};
        for (const field of op.fields ?? [])
          resolved[field.key] = ctx.expr(ctx.params[field.key], item, index);

        const path = op.path.replace(/\{(\w+)\}/g, (_, key: string) =>
          encodeURIComponent(String(resolved[key] ?? ctx.expr(ctx.params[key], item, index) ?? "")),
        );
        const query = op.query?.(resolved, cred) ?? {};
        const qs = new URLSearchParams(
          Object.entries(query).filter(([, v]) => v !== "" && v !== "undefined"),
        ).toString();
        const url = `${base}${path}${qs ? `?${qs}` : ""}`;
        const bodyValue = op.body?.(resolved, item);

        const headers: Record<string, string> = { ...spec.auth(cred) };
        let body: string | undefined;
        if (bodyValue !== undefined && op.method !== "GET") {
          if (op.form) {
            headers['Content-Type'] = "application/x-www-form-urlencoded";
            body = new URLSearchParams(
              Object.entries(bodyValue as Record<string, Json>).map(([k, v]) => [
                k,
                typeof v === "string" ? v : JSON.stringify(v),
              ]),
            ).toString();
          } else {
            headers['Content-Type'] = "application/json";
            body = JSON.stringify(bodyValue);
          }
        }

        ctx.log(`${op.method} ${url}`);
        const res = await ctx.http({ url, method: op.method, headers, ...(body ? { body } : {}) });
        if (res.status >= 400)
          throw new Error(
            `${spec.name} ${op.label} failed (${res.status}): ${
              typeof res.body === "string" ? res.body.slice(0, 300) : JSON.stringify(res.body).slice(0, 300)
            }`,
          );
        const payload = op.pick ? getPath(res.body as Json, op.pick) : (res.body as Json);
        out.push(...toItems(payload ?? { ok: true, status: res.status }));
      }
      return main(out);
    },
  };
}

const text = (key: string, label: string, placeholder?: string): ParamField => ({
  key,
  label,
  type: "text",
  ...(placeholder ? { placeholder } : {}),
});
const code = (key: string, label: string, placeholder?: string): ParamField => ({
  key,
  label,
  type: "code",
  ...(placeholder ? { placeholder } : {}),
});

// ---------------------------------------------------------------- Dev & Ops

export const github = createAppNode({
  kind: "github",
  name: "GitHub",
  group: "Dev & Ops",
  description: "Issues, pull requests, releases and repo files.",
  icon: "github",
  baseUrl: "https://api.github.com",
  credentialType: "bearer",
  auth: (c) => ({ ...bearer(c), Accept: "application/vnd.github+json", "User-Agent": "flow-engine" }),
  keywords: ["git", "issue", "pr", "repo"],
  operations: [
    {
      key: "createIssue",
      label: "Create issue",
      method: "POST",
      path: "/repos/{owner}/{repo}/issues",
      fields: [
        text("owner", "Owner"),
        text("repo", "Repository"),
        text("title", "Title"),
        code("bodyText", "Body"),
        text("labels", "Labels (comma separated)"),
      ],
      body: (p) =>
        clean({
          title: p['title'] as Json,
          body: p['bodyText'] as Json,
          labels: String(p['labels'] ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
    },
    {
      key: "listIssues",
      label: "List issues",
      method: "GET",
      path: "/repos/{owner}/{repo}/issues",
      fields: [text("state", "State (open/closed/all)")],
      query: (p) => ({ state: String(p['state'] || "open"), per_page: "50" }),
    },
    {
      key: "createComment",
      label: "Comment on issue",
      method: "POST",
      path: "/repos/{owner}/{repo}/issues/{issueNumber}/comments",
      fields: [text("issueNumber", "Issue number"), code("commentBody", "Comment")],
      body: (p) => ({ body: String(p['commentBody'] ?? "") }),
    },
    {
      key: "getFile",
      label: "Get file content",
      method: "GET",
      path: "/repos/{owner}/{repo}/contents/{filePath}",
      fields: [text("filePath", "File path")],
    },
    {
      key: "dispatch",
      label: "Trigger workflow dispatch",
      method: "POST",
      path: "/repos/{owner}/{repo}/actions/workflows/{workflowFile}/dispatches",
      fields: [text("workflowFile", "Workflow file"), text("ref", "Ref")],
      body: (p) => ({ ref: String(p['ref'] || "main") }),
    },
  ],
});

export const gitlab = createAppNode({
  kind: "gitlab",
  name: "GitLab",
  group: "Dev & Ops",
  description: "Create and list GitLab issues and pipelines.",
  icon: "gitlab",
  baseUrl: (c) => c['baseUrl'] || "https://gitlab.com/api/v4",
  credentialType: "apiKey",
  auth: (c) => ({ "PRIVATE-TOKEN": c['apiKey'] ?? c['token'] ?? "" }),
  operations: [
    {
      key: "createIssue",
      label: "Create issue",
      method: "POST",
      path: "/projects/{projectId}/issues",
      fields: [text("projectId", "Project ID"), text("title", "Title"), code("descr", "Description")],
      body: (p) => clean({ title: p['title'] as Json, description: p['descr'] as Json }),
    },
    {
      key: "listIssues",
      label: "List issues",
      method: "GET",
      path: "/projects/{projectId}/issues",
      query: () => ({ per_page: "50" }),
    },
    {
      key: "runPipeline",
      label: "Run pipeline",
      method: "POST",
      path: "/projects/{projectId}/pipeline",
      fields: [text("ref", "Ref")],
      body: (p) => ({ ref: String(p['ref'] || "main") }),
    },
  ],
});

export const jira = createAppNode({
  kind: "jira",
  name: "Jira",
  group: "Dev & Ops",
  description: "Create, search and transition Jira issues.",
  icon: "jira",
  baseUrl: (c) => `${(c['baseUrl'] ?? "").replace(/\/$/, "")}/rest/api/3`,
  credentialType: "basicAuth",
  auth: (c) => ({ ...basic(c), Accept: "application/json" }),
  operations: [
    {
      key: "createIssue",
      label: "Create issue",
      method: "POST",
      path: "/issue",
      fields: [
        text("projectKey", "Project key"),
        text("summary", "Summary"),
        text("issueType", "Issue type"),
        code("descr", "Description"),
      ],
      body: (p) => ({
        fields: {
          project: { key: String(p['projectKey'] ?? "") },
          summary: String(p['summary'] ?? ""),
          issuetype: { name: String(p['issueType'] || "Task") },
          description: {
            type: "doc",
            version: 1,
            content: [
              { type: "paragraph", content: [{ type: "text", text: String(p['descr'] ?? " ") }] },
            ],
          },
        },
      }),
    },
    {
      key: "search",
      label: "Search issues (JQL)",
      method: "GET",
      path: "/search",
      fields: [text("jql", "JQL")],
      query: (p) => ({ jql: String(p['jql'] ?? ""), maxResults: "50" }),
      pick: "issues",
    },
    {
      key: "transition",
      label: "Transition issue",
      method: "POST",
      path: "/issue/{issueKey}/transitions",
      fields: [text("issueKey", "Issue key"), text("transitionId", "Transition ID")],
      body: (p) => ({ transition: { id: String(p['transitionId'] ?? "") } }),
    },
  ],
});

export const linear = createAppNode({
  kind: "linear",
  name: "Linear",
  group: "Dev & Ops",
  description: "Create issues and run GraphQL queries against Linear.",
  icon: "linear",
  baseUrl: "https://api.linear.app",
  credentialType: "apiKey",
  auth: (c) => ({ Authorization: c['apiKey'] ?? c['token'] ?? "" }),
  operations: [
    {
      key: "createIssue",
      label: "Create issue",
      method: "POST",
      path: "/graphql",
      fields: [text("teamId", "Team ID"), text("title", "Title"), code("descr", "Description")],
      body: (p) => ({
        query:
          "mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue { id identifier url title } } }",
        variables: {
          input: clean({
            teamId: p['teamId'] as Json,
            title: p['title'] as Json,
            description: p['descr'] as Json,
          }),
        },
      }),
      pick: "data.issueCreate.issue",
    },
    {
      key: "query",
      label: "Run GraphQL query",
      method: "POST",
      path: "/graphql",
      fields: [code("graphql", "GraphQL query"), code("variables", "Variables (JSON)")],
      body: (p) => ({
        query: String(p['graphql'] ?? ""),
        variables: parseJson(p['variables'], {}),
      }),
      pick: "data",
    },
  ],
});

export const pagerduty = createAppNode({
  kind: "pagerduty",
  name: "PagerDuty",
  group: "Dev & Ops",
  description: "Trigger and resolve incidents through Events API v2.",
  icon: "pagerduty",
  baseUrl: "https://events.pagerduty.com",
  credentialType: "apiKey",
  auth: () => ({}),
  operations: [
    {
      key: "trigger",
      label: "Trigger incident",
      method: "POST",
      path: "/v2/enqueue",
      fields: [
        text("routingKey", "Routing key"),
        text("summary", "Summary"),
        text("severity", "Severity (critical/error/warning/info)"),
        text("source", "Source"),
      ],
      body: (p) => ({
        routing_key: String(p['routingKey'] ?? ""),
        event_action: "trigger",
        payload: {
          summary: String(p['summary'] ?? ""),
          severity: String(p['severity'] || "error"),
          source: String(p['source'] || "workflow"),
        },
      }),
    },
    {
      key: "resolve",
      label: "Resolve incident",
      method: "POST",
      path: "/v2/enqueue",
      fields: [text("dedupKey", "Dedup key")],
      body: (p) => ({
        routing_key: String(p['routingKey'] ?? ""),
        event_action: "resolve",
        dedup_key: String(p['dedupKey'] ?? ""),
      }),
    },
  ],
});

// -------------------------------------------------------------- Productivity

export const notion = createAppNode({
  kind: "notion",
  name: "Notion",
  group: "Data",
  description: "Query databases, create pages and append blocks.",
  icon: "notion",
  baseUrl: "https://api.notion.com/v1",
  credentialType: "bearer",
  auth: (c) => ({ ...bearer(c), "Notion-Version": "2022-06-28" }),
  operations: [
    {
      key: "queryDatabase",
      label: "Query database",
      method: "POST",
      path: "/databases/{databaseId}/query",
      fields: [text("databaseId", "Database ID"), code("filter", "Filter (JSON)")],
      body: (p) => clean({ filter: parseJson(p['filter'], undefined as unknown as Json) }),
      pick: "results",
    },
    {
      key: "createPage",
      label: "Create page",
      method: "POST",
      path: "/pages",
      fields: [text("databaseId", "Database ID"), code("properties", "Properties (JSON)")],
      body: (p) => ({
        parent: { database_id: String(p['databaseId'] ?? "") },
        properties: parseJson(p['properties'], {}),
      }),
    },
    {
      key: "appendBlock",
      label: "Append block",
      method: "PATCH",
      path: "/blocks/{blockId}/children",
      fields: [text("blockId", "Block/Page ID"), code("blockText", "Text")],
      body: (p) => ({
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: String(p['blockText'] ?? "") } }],
            },
          },
        ],
      }),
    },
  ],
});

export const airtable = createAppNode({
  kind: "airtable",
  name: "Airtable",
  group: "Data",
  description: "List, create and update Airtable records.",
  icon: "airtable",
  baseUrl: "https://api.airtable.com/v0",
  credentialType: "bearer",
  auth: bearer,
  operations: [
    {
      key: "list",
      label: "List records",
      method: "GET",
      path: "/{baseId}/{tableName}",
      fields: [text("baseId", "Base ID"), text("tableName", "Table"), text("view", "View")],
      query: (p) => ({ view: String(p['view'] ?? ""), pageSize: "50" }),
      pick: "records",
    },
    {
      key: "create",
      label: "Create record",
      method: "POST",
      path: "/{baseId}/{tableName}",
      fields: [code("recordFields", "Fields (JSON)")],
      body: (p) => ({ fields: parseJson(p['recordFields'], {}) }),
    },
    {
      key: "update",
      label: "Update record",
      method: "PATCH",
      path: "/{baseId}/{tableName}/{recordId}",
      fields: [text("recordId", "Record ID")],
      body: (p) => ({ fields: parseJson(p['recordFields'], {}) }),
    },
  ],
});

export const googleSheets = createAppNode({
  kind: "googleSheets",
  name: "Google Sheets",
  group: "Data",
  description: "Read and append spreadsheet rows (OAuth2).",
  icon: "googlesheets",
  baseUrl: "https://sheets.googleapis.com/v4/spreadsheets",
  credentialType: "oauth2",
  auth: bearer,
  operations: [
    {
      key: "read",
      label: "Read rows",
      method: "GET",
      path: "/{spreadsheetId}/values/{range}",
      fields: [text("spreadsheetId", "Spreadsheet ID"), text("range", "Range", "Sheet1!A1:D50")],
      pick: "values",
    },
    {
      key: "append",
      label: "Append row",
      method: "POST",
      path: "/{spreadsheetId}/values/{range}:append",
      fields: [code("values", "Row values (JSON array)")],
      query: () => ({ valueInputOption: "USER_ENTERED" }),
      body: (p) => ({ values: [toItems(parseJson(p['values'], []))] }),
    },
    {
      key: "clear",
      label: "Clear range",
      method: "POST",
      path: "/{spreadsheetId}/values/{range}:clear",
      body: () => ({}),
    },
  ],
});

export const googleDrive = createAppNode({
  kind: "googleDrive",
  name: "Google Drive",
  group: "Files",
  description: "List, download and delete Drive files (OAuth2).",
  icon: "googledrive",
  baseUrl: "https://www.googleapis.com/drive/v3",
  credentialType: "oauth2",
  auth: bearer,
  operations: [
    {
      key: "list",
      label: "List files",
      method: "GET",
      path: "/files",
      fields: [text("q", "Query", "name contains 'report'")],
      query: (p) => ({ q: String(p['q'] ?? ""), pageSize: "50" }),
      pick: "files",
    },
    {
      key: "get",
      label: "Download file",
      method: "GET",
      path: "/files/{fileId}",
      fields: [text("fileId", "File ID")],
      query: () => ({ alt: "media" }),
    },
    { key: "delete", label: "Delete file", method: "DELETE", path: "/files/{fileId}" },
  ],
});

export const gmail = createAppNode({
  kind: "gmail",
  name: "Gmail",
  group: "Communication",
  description: "Send mail and read messages via the Gmail API (OAuth2).",
  icon: "gmail",
  baseUrl: "https://gmail.googleapis.com/gmail/v1/users/me",
  credentialType: "oauth2",
  auth: bearer,
  operations: [
    {
      key: "send",
      label: "Send email",
      method: "POST",
      path: "/messages/send",
      fields: [text("to", "To"), text("subject", "Subject"), code("bodyText", "Body")],
      body: (p) => {
        const mime = [
          `To: ${String(p['to'] ?? "")}`,
          `Subject: ${String(p['subject'] ?? "")}`,
          "Content-Type: text/plain; charset=UTF-8",
          "",
          String(p['bodyText'] ?? ""),
        ].join("\r\n");
        const raw = btoa(unescape(encodeURIComponent(mime)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
        return { raw };
      },
    },
    {
      key: "list",
      label: "List messages",
      method: "GET",
      path: "/messages",
      fields: [text("q", "Search query", "is:unread")],
      query: (p) => ({ q: String(p['q'] ?? ""), maxResults: "25" }),
      pick: "messages",
    },
    {
      key: "get",
      label: "Get message",
      method: "GET",
      path: "/messages/{messageId}",
      fields: [text("messageId", "Message ID")],
    },
  ],
});

export const outlook = createAppNode({
  kind: "outlook",
  name: "Microsoft Outlook",
  group: "Communication",
  description: "Send and read mail through Microsoft Graph (OAuth2).",
  icon: "outlook",
  baseUrl: "https://graph.microsoft.com/v1.0/me",
  credentialType: "oauth2",
  auth: bearer,
  operations: [
    {
      key: "send",
      label: "Send email",
      method: "POST",
      path: "/sendMail",
      fields: [text("to", "To"), text("subject", "Subject"), code("bodyText", "Body")],
      body: (p) => ({
        message: {
          subject: String(p['subject'] ?? ""),
          body: { contentType: "Text", content: String(p['bodyText'] ?? "") },
          toRecipients: [{ emailAddress: { address: String(p['to'] ?? "") } }],
        },
        saveToSentItems: true,
      }),
    },
    {
      key: "list",
      label: "List messages",
      method: "GET",
      path: "/messages",
      query: () => ({ $top: "25" }),
      pick: "value",
    },
  ],
});

export const dropbox = createAppNode({
  kind: "dropbox",
  name: "Dropbox",
  group: "Files",
  description: "List folders and create shared links.",
  icon: "dropbox",
  baseUrl: "https://api.dropboxapi.com/2",
  credentialType: "oauth2",
  auth: bearer,
  operations: [
    {
      key: "list",
      label: "List folder",
      method: "POST",
      path: "/files/list_folder",
      fields: [text("path", "Folder path", "/reports")],
      body: (p) => ({ path: String(p['path'] ?? "") }),
      pick: "entries",
    },
    {
      key: "share",
      label: "Create shared link",
      method: "POST",
      path: "/sharing/create_shared_link_with_settings",
      body: (p) => ({ path: String(p['path'] ?? "") }),
    },
    {
      key: "delete",
      label: "Delete file",
      method: "POST",
      path: "/files/delete_v2",
      body: (p) => ({ path: String(p['path'] ?? "") }),
    },
  ],
});

// ------------------------------------------------------------ Communication

export const twilio = createAppNode({
  kind: "twilio",
  name: "Twilio",
  group: "Communication",
  description: "Send SMS and WhatsApp messages.",
  icon: "twilio",
  baseUrl: (c) => `https://api.twilio.com/2010-04-01/Accounts/${c['sid'] ?? c['username'] ?? ""}`,
  credentialType: "basicAuth",
  auth: basic,
  operations: [
    {
      key: "sms",
      label: "Send SMS",
      method: "POST",
      path: "/Messages.json",
      form: true,
      fields: [text("from", "From number"), text("to", "To number"), code("bodyText", "Message")],
      body: (p) => ({
        From: String(p['from'] ?? ""),
        To: String(p['to'] ?? ""),
        Body: String(p['bodyText'] ?? ""),
      }),
    },
    {
      key: "whatsapp",
      label: "Send WhatsApp",
      method: "POST",
      path: "/Messages.json",
      form: true,
      body: (p) => ({
        From: `whatsapp:${String(p['from'] ?? "")}`,
        To: `whatsapp:${String(p['to'] ?? "")}`,
        Body: String(p['bodyText'] ?? ""),
      }),
    },
  ],
});

export const sendgrid = createAppNode({
  kind: "sendgrid",
  name: "SendGrid",
  group: "Communication",
  description: "Send transactional email through SendGrid.",
  icon: "sendgrid",
  baseUrl: "https://api.sendgrid.com/v3",
  credentialType: "bearer",
  auth: bearer,
  operations: [
    {
      key: "send",
      label: "Send email",
      method: "POST",
      path: "/mail/send",
      fields: [
        text("to", "To"),
        text("from", "From"),
        text("subject", "Subject"),
        code("bodyText", "Body"),
      ],
      body: (p) => ({
        personalizations: [{ to: [{ email: String(p['to'] ?? "") }] }],
        from: { email: String(p['from'] ?? "") },
        subject: String(p['subject'] ?? ""),
        content: [{ type: "text/plain", value: String(p['bodyText'] ?? "") }],
      }),
    },
  ],
});

export const mailchimp = createAppNode({
  kind: "mailchimp",
  name: "Mailchimp",
  group: "CRM & Commerce",
  description: "Add and update audience members.",
  icon: "mailchimp",
  baseUrl: (c) => `https://${c['dc'] ?? "us1"}.api.mailchimp.com/3.0`,
  credentialType: "apiKey",
  auth: (c) => ({ Authorization: `Basic ${btoa(`anystring:${c['apiKey'] ?? ""}`)}` }),
  operations: [
    {
      key: "addMember",
      label: "Add subscriber",
      method: "POST",
      path: "/lists/{listId}/members",
      fields: [text("listId", "Audience ID"), text("email", "Email"), text("status", "Status")],
      body: (p) => ({
        email_address: String(p['email'] ?? ""),
        status: String(p['status'] || "subscribed"),
      }),
    },
    {
      key: "listMembers",
      label: "List subscribers",
      method: "GET",
      path: "/lists/{listId}/members",
      query: () => ({ count: "50" }),
      pick: "members",
    },
  ],
});

// -------------------------------------------------------- CRM & Commerce

export const stripe = createAppNode({
  kind: "stripe",
  name: "Stripe",
  group: "CRM & Commerce",
  description: "Customers, charges and payment links.",
  icon: "stripe",
  baseUrl: "https://api.stripe.com/v1",
  credentialType: "bearer",
  auth: bearer,
  operations: [
    {
      key: "listCustomers",
      label: "List customers",
      method: "GET",
      path: "/customers",
      query: () => ({ limit: "50" }),
      pick: "data",
    },
    {
      key: "createCustomer",
      label: "Create customer",
      method: "POST",
      path: "/customers",
      form: true,
      fields: [text("email", "Email"), text("nameField", "Name")],
      body: (p) => clean({ email: p['email'] as Json, name: p['nameField'] as Json }),
    },
    {
      key: "listPayments",
      label: "List payment intents",
      method: "GET",
      path: "/payment_intents",
      query: () => ({ limit: "50" }),
      pick: "data",
    },
    {
      key: "refund",
      label: "Refund charge",
      method: "POST",
      path: "/refunds",
      form: true,
      fields: [text("chargeId", "Charge ID")],
      body: (p) => ({ charge: String(p['chargeId'] ?? "") }),
    },
  ],
});

export const hubspot = createAppNode({
  kind: "hubspot",
  name: "HubSpot",
  group: "CRM & Commerce",
  description: "Create and search CRM contacts and deals.",
  icon: "hubspot",
  baseUrl: "https://api.hubapi.com/crm/v3",
  credentialType: "bearer",
  auth: bearer,
  operations: [
    {
      key: "createContact",
      label: "Create contact",
      method: "POST",
      path: "/objects/contacts",
      fields: [code("properties", "Properties (JSON)")],
      body: (p) => ({ properties: parseJson(p['properties'], {}) }),
    },
    {
      key: "searchContacts",
      label: "Search contacts",
      method: "POST",
      path: "/objects/contacts/search",
      fields: [text("query", "Search term")],
      body: (p) => ({ query: String(p['query'] ?? ""), limit: 50 }),
      pick: "results",
    },
    {
      key: "createDeal",
      label: "Create deal",
      method: "POST",
      path: "/objects/deals",
      body: (p) => ({ properties: parseJson(p['properties'], {}) }),
    },
  ],
});

export const salesforce = createAppNode({
  kind: "salesforce",
  name: "Salesforce",
  group: "CRM & Commerce",
  description: "SOQL queries and sObject creation (OAuth2).",
  icon: "salesforce",
  baseUrl: (c) => `${(c['instanceUrl'] ?? "").replace(/\/$/, "")}/services/data/v59.0`,
  credentialType: "oauth2",
  auth: bearer,
  operations: [
    {
      key: "query",
      label: "SOQL query",
      method: "GET",
      path: "/query",
      fields: [text("soql", "SOQL", "SELECT Id, Name FROM Account LIMIT 10")],
      query: (p) => ({ q: String(p['soql'] ?? "") }),
      pick: "records",
    },
    {
      key: "create",
      label: "Create record",
      method: "POST",
      path: "/sobjects/{sobject}",
      fields: [text("sobject", "sObject", "Lead"), code("recordFields", "Fields (JSON)")],
      body: (p) => parseJson(p['recordFields'], {}),
    },
  ],
});

export const shopify = createAppNode({
  kind: "shopify",
  name: "Shopify",
  group: "CRM & Commerce",
  description: "Read orders, products and customers from a shop.",
  icon: "shopify",
  baseUrl: (c) => `https://${c['shop'] ?? ""}.myshopify.com/admin/api/2024-04`,
  credentialType: "apiKey",
  auth: (c) => ({ "X-Shopify-Access-Token": c['apiKey'] ?? c['token'] ?? "" }),
  operations: [
    {
      key: "listOrders",
      label: "List orders",
      method: "GET",
      path: "/orders.json",
      query: () => ({ limit: "50", status: "any" }),
      pick: "orders",
    },
    {
      key: "listProducts",
      label: "List products",
      method: "GET",
      path: "/products.json",
      query: () => ({ limit: "50" }),
      pick: "products",
    },
    {
      key: "createProduct",
      label: "Create product",
      method: "POST",
      path: "/products.json",
      fields: [code("product", "Product (JSON)")],
      body: (p) => ({ product: parseJson(p['product'], {}) }),
      pick: "product",
    },
  ],
});

// ------------------------------------------------------------- Databases

export const supabaseRest = createAppNode({
  kind: "supabaseRest",
  name: "Supabase",
  group: "Databases",
  description: "Select, insert, update and delete rows via PostgREST.",
  icon: "supabase",
  baseUrl: (c) => `${(c['url'] ?? "").replace(/\/$/, "")}/rest/v1`,
  credentialType: "apiKey",
  auth: (c) => ({
    apikey: c['apiKey'] ?? "",
    Authorization: `Bearer ${c['serviceKey'] ?? c['apiKey'] ?? ""}`,
    Prefer: "return=representation",
  }),
  operations: [
    {
      key: "select",
      label: "Select rows",
      method: "GET",
      path: "/{table}",
      fields: [
        text("table", "Table"),
        text("select", "Columns", "*"),
        text("filter", "Filter", "id=eq.1"),
        text("limit", "Limit"),
      ],
      query: (p) => {
        const q: Record<string, string> = {
          select: String(p['select'] || "*"),
          limit: String(p['limit'] || 50),
        };
        const filter = String(p['filter'] ?? "");
        if (filter.includes("=")) {
          const [k, ...rest] = filter.split("=");
          q[k!.trim()] = rest.join("=");
        }
        return q;
      },
    },
    {
      key: "insert",
      label: "Insert row",
      method: "POST",
      path: "/{table}",
      fields: [code("row", "Row (JSON)")],
      body: (p) => parseJson(p['row'], {}),
    },
    {
      key: "update",
      label: "Update rows",
      method: "PATCH",
      path: "/{table}",
      query: (p) => {
        const filter = String(p['filter'] ?? "");
        const [k, ...rest] = filter.split("=");
        return k ? { [k.trim()]: rest.join("=") } : {};
      },
      body: (p) => parseJson(p['row'], {}),
    },
    {
      key: "delete",
      label: "Delete rows",
      method: "DELETE",
      path: "/{table}",
      query: (p) => {
        const filter = String(p['filter'] ?? "");
        const [k, ...rest] = filter.split("=");
        return k ? { [k.trim()]: rest.join("=") } : {};
      },
    },
  ],
});

export const upstashRedis = createAppNode({
  kind: "upstashRedis",
  name: "Redis (Upstash)",
  group: "Databases",
  description: "Get, set and increment keys over the Upstash REST API.",
  icon: "redis",
  baseUrl: (c) => (c['url'] ?? "").replace(/\/$/, ""),
  credentialType: "bearer",
  auth: bearer,
  operations: [
    { key: "get", label: "Get key", method: "GET", path: "/get/{key}", fields: [text("key", "Key")] },
    {
      key: "set",
      label: "Set key",
      method: "POST",
      path: "/set/{key}",
      fields: [code("value", "Value")],
      body: (p) => ({ value: String(p['value'] ?? "") }),
    },
    { key: "incr", label: "Increment key", method: "GET", path: "/incr/{key}" },
    { key: "del", label: "Delete key", method: "GET", path: "/del/{key}" },
  ],
});

export const mongoDataApi = createAppNode({
  kind: "mongoDataApi",
  name: "MongoDB",
  group: "Databases",
  description: "Find, insert and update documents via the Atlas Data API.",
  icon: "mongodb",
  baseUrl: (c) => `${(c['url'] ?? "").replace(/\/$/, "")}/action`,
  credentialType: "apiKey",
  auth: (c) => ({ "api-key": c['apiKey'] ?? "" }),
  operations: [
    {
      key: "find",
      label: "Find documents",
      method: "POST",
      path: "/find",
      fields: [
        text("dataSource", "Cluster"),
        text("database", "Database"),
        text("collection", "Collection"),
        code("filter", "Filter (JSON)"),
      ],
      body: (p) => ({
        dataSource: String(p['dataSource'] ?? ""),
        database: String(p['database'] ?? ""),
        collection: String(p['collection'] ?? ""),
        filter: parseJson(p['filter'], {}),
        limit: 50,
      }),
      pick: "documents",
    },
    {
      key: "insertOne",
      label: "Insert document",
      method: "POST",
      path: "/insertOne",
      fields: [code("document", "Document (JSON)")],
      body: (p) => ({
        dataSource: String(p['dataSource'] ?? ""),
        database: String(p['database'] ?? ""),
        collection: String(p['collection'] ?? ""),
        document: parseJson(p['document'], {}),
      }),
    },
    {
      key: "updateOne",
      label: "Update document",
      method: "POST",
      path: "/updateOne",
      body: (p) => ({
        dataSource: String(p['dataSource'] ?? ""),
        database: String(p['database'] ?? ""),
        collection: String(p['collection'] ?? ""),
        filter: parseJson(p['filter'], {}),
        update: { $set: parseJson(p['document'], {}) },
      }),
    },
  ],
});

export const appNodes = [
  github,
  gitlab,
  jira,
  linear,
  pagerduty,
  notion,
  airtable,
  googleSheets,
  googleDrive,
  gmail,
  outlook,
  dropbox,
  twilio,
  sendgrid,
  mailchimp,
  stripe,
  hubspot,
  salesforce,
  shopify,
  supabaseRest,
  upstashRedis,
  mongoDataApi,
];
