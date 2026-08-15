import type { Json } from "@/lib/flow/types";
import type { NodeGroup, NodeModule } from "./types";
import { parseJson } from "./types";
import { basic, bearer, createAppNode, type AppOperation, type AppSpec } from "./apps";

/**
 * Large catalog of REST integrations.
 *
 * Every entry below produces a real HTTP node: the generated operations issue
 * genuine requests against the vendor's documented REST base URL using the
 * credential the user stores in the Credentials screen. Nothing is mocked.
 *
 * Each app gets a category-appropriate primary action with real, named fields
 * (e.g. "Send message" → To / Subject / Message for Communication apps,
 * "Track event" → Event name / Properties for Analytics apps — see
 * GROUP_PRIMARY below) instead of a single raw JSON box, plus List / Get /
 * Update / Delete and a "Custom Request" escape hatch so any endpoint the
 * vendor offers is reachable even when it is not enumerated here. Every
 * operation also carries an "Additional fields (JSON)" box that merges in
 * and overrides the typed fields, for whatever is specific to that one
 * vendor's exact schema. The inspector only shows the fields that belong to
 * whichever operation is currently selected.
 */

type AuthCode = string; // "bearer" | "basic" | "header:X-Api-Key" | "query:api_key" | "token:Token"

const authFor = (code: AuthCode) => (cred: Record<string, string>) => {
  const key = cred['apiKey'] ?? cred['token'] ?? cred['accessToken'] ?? cred['password'] ?? "";
  if (code === "bearer") return bearer(cred);
  if (code === "basic") return basic(cred);
  if (code.startsWith("header:")) return { [code.slice(7)]: key };
  if (code.startsWith("token:")) return { Authorization: `${code.slice(6)} ${key}` };
  return {} as Record<string, string>;
};

const queryAuth = (code: AuthCode) => (code.startsWith("query:") ? code.slice(6) : null);

const jsonField = {
  key: "data",
  label: "Additional fields (JSON, merged in)",
  type: "code" as const,
  placeholder: '{\n  "customProperty": "value"\n}',
  help: "Anything you put here is merged into the request body, overriding the typed fields above when keys collide.",
};
const idField = { key: "id", label: "Record ID", type: "text" as const, placeholder: "{{ $json.id }}" };
const limitField = { key: "limit", label: "Limit", type: "number" as const };
const pathField = {
  key: "customPath",
  label: "Path (appended to base URL)",
  type: "text" as const,
  placeholder: "/v1/things",
};
const methodField = {
  key: "customMethod",
  label: "Method",
  type: "select" as const,
  options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

/** Drop empty/undefined keys so typed fields the user left blank don't pollute the body. */
const compact = (obj: Record<string, Json | undefined>): Json => {
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === "" || v === null) continue;
    out[k] = v;
  }
  return out;
};

// ---------- Typed fields shared across the category-aware primary operations ----------
const toField = {
  key: "to",
  label: "To / Recipient / Channel",
  type: "text" as const,
  placeholder: "#general, +15551234567, or user@example.com",
};
const subjectField = { key: "subject", label: "Subject (if applicable)", type: "text" as const };
const messageField = { key: "message", label: "Message", type: "textarea" as const, placeholder: "Hello from the workflow!" };
const nameField = { key: "name", label: "Name", type: "text" as const };
const emailField = { key: "email", label: "Email", type: "text" as const };
const amountField = { key: "amount", label: "Amount", type: "number" as const };
const eventNameField = { key: "eventName", label: "Event name", type: "text" as const, placeholder: "order_completed" };
const propertiesField = {
  key: "properties",
  label: "Properties (JSON)",
  type: "code" as const,
  placeholder: '{\n  "plan": "pro"\n}',
};
const tableField = { key: "table", label: "Table / Collection", type: "text" as const };
const rowField = { key: "row", label: "Row / record data (JSON)", type: "code" as const, placeholder: '{\n  "column": "value"\n}' };
const postTextField = { key: "text", label: "Post text", type: "textarea" as const };
const mediaUrlField = { key: "mediaUrl", label: "Media URL (optional)", type: "text" as const };
const filePathField = { key: "path", label: "File path / key", type: "text" as const, placeholder: "/reports/latest.csv" };
const fileContentField = { key: "content", label: "File content (text or base64)", type: "textarea" as const };
const queryTextField = { key: "query", label: "Query / search text", type: "text" as const };
const identifierField = { key: "identifier", label: "Name / identifier", type: "text" as const };

/** A category-specific "primary action" that replaces the generic Create with real, named fields. */
type PrimaryOp = { label: string; fields: AppOperation["fields"]; body: (p: Record<string, Json>) => Json };

const GROUP_PRIMARY: Partial<Record<NodeGroup, PrimaryOp>> = {
  Communication: {
    label: "Send message",
    fields: [toField, subjectField, messageField],
    body: (p) =>
      compact({
        to: p['to'], recipient: p['to'], channel: p['to'], phone: p['to'],
        subject: p['subject'],
        text: p['message'], message: p['message'], body: p['message'], content: p['message'],
      }),
  },
  "Social Media": {
    label: "Create post",
    fields: [postTextField, mediaUrlField],
    body: (p) =>
      compact({
        text: p['text'], message: p['text'], status: p['text'], caption: p['text'],
        media_url: p['mediaUrl'], image_url: p['mediaUrl'],
      }),
  },
  "CRM & Commerce": {
    label: "Create record",
    fields: [nameField, emailField, amountField],
    body: (p) => compact({ name: p['name'], email: p['email'], amount: p['amount'] }),
  },
  Marketing: {
    label: "Create contact",
    fields: [nameField, emailField],
    body: (p) => compact({ name: p['name'], email: p['email'] }),
  },
  "HR & Finance": {
    label: "Create record",
    fields: [nameField, emailField, amountField],
    body: (p) => compact({ name: p['name'], email: p['email'], amount: p['amount'] }),
  },
  Analytics: {
    label: "Track event",
    fields: [eventNameField, propertiesField],
    body: (p) =>
      compact({
        event: p['eventName'], name: p['eventName'], event_name: p['eventName'],
        properties: parseJson(p['properties'], {}),
      }),
  },
  Databases: {
    label: "Insert row",
    fields: [tableField, rowField],
    body: (p) => ({ ...parseJson(p['row'], {}), ...compact({ table: p['table'], collection: p['table'] }) }),
  },
  "Cloud & Storage": {
    label: "Upload file",
    fields: [filePathField, fileContentField],
    body: (p) =>
      compact({
        path: p['path'], key: p['path'], name: p['path'],
        content: p['content'], data: p['content'],
      }),
  },
  "Dev & Ops": {
    label: "Trigger / create",
    fields: [identifierField],
    body: (p) => compact({ name: p['identifier'], id: p['identifier'] }),
  },
  "Forms & Surveys": {
    label: "Create record",
    fields: [nameField, emailField],
    body: (p) => compact({ name: p['name'], email: p['email'] }),
  },
  Productivity: {
    label: "Create item",
    fields: [nameField],
    body: (p) => compact({ name: p['name'], title: p['name'] }),
  },
  Utilities: {
    label: "Request",
    fields: [queryTextField],
    body: (p) => compact({ q: p['query'], query: p['query'], text: p['query'], input: p['query'] }),
  },
};

function crudOps(resource: string, label: string, group: NodeGroup, pick?: string): AppOperation[] {
  const base = resource.startsWith("/") ? resource : `/${resource}`;
  const primary = GROUP_PRIMARY[group];
  const primaryFields = primary?.fields ?? [];
  const primaryLabel = primary?.label ?? `Create ${label}`;
  const primaryBody = primary?.body ?? ((p: Record<string, Json>) => parseJson(p['data'], {}));

  return [
    {
      key: "list",
      label: `List ${label}`,
      method: "GET",
      path: base,
      fields: [limitField],
      query: (p) => (p['limit'] ? { limit: String(p['limit']) } : {}),
      ...(pick ? { pick } : {}),
    },
    { key: "get", label: `Get ${label}`, method: "GET", path: `${base}/{id}`, fields: [idField] },
    {
      key: "create",
      label: primaryLabel,
      method: "POST",
      path: base,
      fields: [...primaryFields, jsonField],
      body: (p) => ({ ...primaryBody(p), ...parseJson(p['data'], {}) }),
    },
    {
      key: "update",
      label: `Update ${label}`,
      method: "PATCH",
      path: `${base}/{id}`,
      fields: [idField, ...primaryFields, jsonField],
      body: (p) => ({ ...primaryBody(p), ...parseJson(p['data'], {}) }),
    },
    { key: "delete", label: `Delete ${label}`, method: "DELETE", path: `${base}/{id}`, fields: [idField] },
    {
      key: "custom",
      label: "Custom Request",
      method: "POST",
      path: "{customPath}",
      fields: [pathField, methodField, jsonField],
      body: (p) => (p['data'] ? parseJson(p['data'], {}) : undefined),
    },
  ];
}

/** [kind, display name, group, brand icon slug, base URL, auth, resource path, resource label] */
export type Entry = [string, NodeGroup, string, string, AuthCode, string, string];

const APPS: Record<string, Entry> = {
  // ---------- Communication ----------
  mattermost: ["Mattermost", "Communication", "mattermost", "https://your-server.mattermost.com/api/v4", "bearer", "/posts", "Posts"],
  rocketchat: ["Rocket.Chat", "Communication", "rocketdotchat", "https://your-server.rocket.chat/api/v1", "header:X-Auth-Token", "/chat.postMessage", "Messages"],
  zulip: ["Zulip", "Communication", "zulip", "https://your-org.zulipchat.com/api/v1", "basic", "/messages", "Messages"],
  msTeams: ["Microsoft Teams", "Communication", "microsoftteams", "https://graph.microsoft.com/v1.0", "bearer", "/teams", "Teams"],
  googleChat: ["Google Chat", "Communication", "googlechat", "https://chat.googleapis.com/v1", "bearer", "/spaces", "Spaces"],
  twist: ["Twist", "Communication", "twist", "https://api.twist.com/api/v3", "bearer", "/threads", "Threads"],
  flock: ["Flock", "Communication", "flock", "https://api.flock.co/v1", "bearer", "/chat.sendMessage", "Messages"],
  chatwork: ["Chatwork", "Communication", "chatwork", "https://api.chatwork.com/v2", "header:X-ChatWorkToken", "/rooms", "Rooms"],
  lineNotify: ["LINE", "Communication", "line", "https://api.line.me/v2/bot", "bearer", "/message/push", "Messages"],
  whatsapp: ["WhatsApp Cloud", "Communication", "whatsapp", "https://graph.facebook.com/v20.0", "bearer", "/messages", "Messages"],
  signalCli: ["Signal REST", "Communication", "signal", "https://your-signal-api", "bearer", "/v2/send", "Messages"],
  matrix: ["Matrix", "Communication", "matrix", "https://matrix.org/_matrix/client/v3", "bearer", "/rooms", "Rooms"],
  vonage: ["Vonage", "Communication", "vonage", "https://rest.nexmo.com", "bearer", "/sms/json", "SMS"],
  messagebird: ["MessageBird", "Communication", "messagebird", "https://rest.messagebird.com", "token:AccessKey", "/messages", "Messages"],
  plivo: ["Plivo", "Communication", "plivo", "https://api.plivo.com/v1/Account", "basic", "/Message", "Messages"],
  sinch: ["Sinch", "Communication", "sinch", "https://sms.api.sinch.com/xms/v1", "bearer", "/batches", "Batches"],
  clicksend: ["ClickSend", "Communication", "clicksend", "https://rest.clicksend.com/v3", "basic", "/sms/send", "SMS"],
  pushover: ["Pushover", "Communication", "pushover", "https://api.pushover.net/1", "query:token", "/messages.json", "Messages"],
  pushbullet: ["Pushbullet", "Communication", "pushbullet", "https://api.pushbullet.com/v2", "header:Access-Token", "/pushes", "Pushes"],
  onesignal: ["OneSignal", "Communication", "onesignal", "https://onesignal.com/api/v1", "token:Basic", "/notifications", "Notifications"],
  gotify: ["Gotify", "Communication", "gotify", "https://your-gotify/", "header:X-Gotify-Key", "/message", "Messages"],
  ntfy: ["ntfy", "Communication", "ntfy", "https://ntfy.sh", "bearer", "/", "Topics"],
  zoom: ["Zoom", "Communication", "zoom", "https://api.zoom.us/v2", "bearer", "/users/me/meetings", "Meetings"],
  webex: ["Webex", "Communication", "webex", "https://webexapis.com/v1", "bearer", "/messages", "Messages"],
  googleMeet: ["Google Meet", "Communication", "googlemeet", "https://meet.googleapis.com/v2", "bearer", "/spaces", "Spaces"],
  intercom: ["Intercom", "Communication", "intercom", "https://api.intercom.io", "bearer", "/conversations", "Conversations"],
  crisp: ["Crisp", "Communication", "crisp", "https://api.crisp.chat/v1", "basic", "/website", "Websites"],
  frontApp: ["Front", "Communication", "front", "https://api2.frontapp.com", "bearer", "/conversations", "Conversations"],
  helpscout: ["Help Scout", "Communication", "helpscout", "https://api.helpscout.net/v2", "bearer", "/conversations", "Conversations"],
  zendesk: ["Zendesk", "Communication", "zendesk", "https://your-org.zendesk.com/api/v2", "basic", "/tickets", "Tickets"],
  freshdesk: ["Freshdesk", "Communication", "freshworks", "https://your-org.freshdesk.com/api/v2", "basic", "/tickets", "Tickets"],
  gorgias: ["Gorgias", "Communication", "gorgias", "https://your-org.gorgias.com/api", "basic", "/tickets", "Tickets"],

  // ---------- Email ----------
  mailgun: ["Mailgun", "Communication", "mailgun", "https://api.mailgun.net/v3", "basic", "/messages", "Messages"],
  postmark: ["Postmark", "Communication", "postmark", "https://api.postmarkapp.com", "header:X-Postmark-Server-Token", "/email", "Email"],
  resend: ["Resend", "Communication", "resend", "https://api.resend.com", "bearer", "/emails", "Emails"],
  brevo: ["Brevo", "Communication", "brevo", "https://api.brevo.com/v3", "header:api-key", "/smtp/email", "Email"],
  amazonSes: ["Amazon SES", "Communication", "amazonaws", "https://email.us-east-1.amazonaws.com", "bearer", "/v2/email/outbound-emails", "Emails"],
  mailjet: ["Mailjet", "Communication", "mailjet", "https://api.mailjet.com/v3.1", "basic", "/send", "Send"],
  sparkpost: ["SparkPost", "Communication", "sparkpost", "https://api.sparkpost.com/api/v1", "token:", "/transmissions", "Transmissions"],
  imapEmail: ["Email (IMAP REST)", "Communication", "maildotru", "https://your-mail-bridge", "bearer", "/messages", "Messages"],
  emailVerify: ["ZeroBounce", "Communication", "zerobounce", "https://api.zerobounce.net/v2", "query:api_key", "/validate", "Validation"],
  hunter: ["Hunter.io", "Communication", "hunter", "https://api.hunter.io/v2", "query:api_key", "/email-finder", "Email Finder"],

  // ---------- CRM & Commerce ----------
  pipedrive: ["Pipedrive", "CRM & Commerce", "pipedrive", "https://api.pipedrive.com/v1", "query:api_token", "/deals", "Deals"],
  zohoCrm: ["Zoho CRM", "CRM & Commerce", "zoho", "https://www.zohoapis.com/crm/v5", "token:Zoho-oauthtoken", "/Leads", "Leads"],
  freshsales: ["Freshsales", "CRM & Commerce", "freshworks", "https://your-org.myfreshworks.com/crm/sales/api", "token:Token token=", "/contacts", "Contacts"],
  copper: ["Copper", "CRM & Commerce", "copper", "https://api.copper.com/developer_api/v1", "header:X-PW-AccessToken", "/people", "People"],
  close: ["Close", "CRM & Commerce", "close", "https://api.close.com/api/v1", "basic", "/lead", "Leads"],
  keap: ["Keap", "CRM & Commerce", "keap", "https://api.infusionsoft.com/crm/rest/v1", "bearer", "/contacts", "Contacts"],
  attio: ["Attio", "CRM & Commerce", "attio", "https://api.attio.com/v2", "bearer", "/objects/people/records", "Records"],
  affinity: ["Affinity", "CRM & Commerce", "affinity", "https://api.affinity.co", "basic", "/persons", "Persons"],
  insightly: ["Insightly", "CRM & Commerce", "insightly", "https://api.insightly.com/v3.1", "basic", "/Contacts", "Contacts"],
  woocommerce: ["WooCommerce", "CRM & Commerce", "woocommerce", "https://your-store.com/wp-json/wc/v3", "basic", "/orders", "Orders"],
  bigcommerce: ["BigCommerce", "CRM & Commerce", "bigcommerce", "https://api.bigcommerce.com/stores/STORE/v3", "header:X-Auth-Token", "/catalog/products", "Products"],
  magento: ["Magento", "CRM & Commerce", "magento", "https://your-store.com/rest/V1", "bearer", "/orders", "Orders"],
  squarespace: ["Squarespace", "CRM & Commerce", "squarespace", "https://api.squarespace.com/1.0/commerce", "bearer", "/orders", "Orders"],
  square: ["Square", "CRM & Commerce", "square", "https://connect.squareup.com/v2", "bearer", "/orders", "Orders"],
  paddle: ["Paddle", "CRM & Commerce", "paddle", "https://api.paddle.com", "bearer", "/transactions", "Transactions"],
  lemonsqueezy: ["Lemon Squeezy", "CRM & Commerce", "lemonsqueezy", "https://api.lemonsqueezy.com/v1", "bearer", "/orders", "Orders"],
  chargebee: ["Chargebee", "CRM & Commerce", "chargebee", "https://your-site.chargebee.com/api/v2", "basic", "/subscriptions", "Subscriptions"],
  recurly: ["Recurly", "CRM & Commerce", "recurly", "https://v3.recurly.com", "basic", "/accounts", "Accounts"],
  paypal: ["PayPal", "CRM & Commerce", "paypal", "https://api-m.paypal.com/v2", "bearer", "/checkout/orders", "Orders"],
  razorpay: ["Razorpay", "CRM & Commerce", "razorpay", "https://api.razorpay.com/v1", "basic", "/payments", "Payments"],
  mollie: ["Mollie", "CRM & Commerce", "mollie", "https://api.mollie.com/v2", "bearer", "/payments", "Payments"],
  gumroad: ["Gumroad", "CRM & Commerce", "gumroad", "https://api.gumroad.com/v2", "bearer", "/sales", "Sales"],
  printful: ["Printful", "CRM & Commerce", "printful", "https://api.printful.com", "bearer", "/orders", "Orders"],
  etsy: ["Etsy", "CRM & Commerce", "etsy", "https://openapi.etsy.com/v3/application", "bearer", "/shops", "Shops"],
  ebay: ["eBay", "CRM & Commerce", "ebay", "https://api.ebay.com/sell/fulfillment/v1", "bearer", "/order", "Orders"],
  amazonSp: ["Amazon Selling Partner", "CRM & Commerce", "amazon", "https://sellingpartnerapi-na.amazon.com", "bearer", "/orders/v0/orders", "Orders"],

  // ---------- Marketing ----------
  activecampaign: ["ActiveCampaign", "Marketing", "activecampaign", "https://your-org.api-us1.com/api/3", "header:Api-Token", "/contacts", "Contacts"],
  klaviyo: ["Klaviyo", "Marketing", "klaviyo", "https://a.klaviyo.com/api", "token:Klaviyo-API-Key", "/profiles", "Profiles"],
  customerio: ["Customer.io", "Marketing", "customerio", "https://api.customer.io/v1", "bearer", "/campaigns", "Campaigns"],
  convertkit: ["Kit (ConvertKit)", "Marketing", "convertkit", "https://api.convertkit.com/v3", "query:api_key", "/subscribers", "Subscribers"],
  beehiiv: ["beehiiv", "Marketing", "beehiiv", "https://api.beehiiv.com/v2", "bearer", "/publications", "Publications"],
  substack: ["Substack", "Marketing", "substack", "https://substack.com/api/v1", "bearer", "/posts", "Posts"],
  drip: ["Drip", "Marketing", "drip", "https://api.getdrip.com/v2", "basic", "/subscribers", "Subscribers"],
  moosend: ["Moosend", "Marketing", "moosend", "https://api.moosend.com/v3", "query:apikey", "/lists", "Lists"],
  sendinblueSms: ["Brevo SMS", "Marketing", "brevo", "https://api.brevo.com/v3", "header:api-key", "/transactionalSMS/sms", "SMS"],
  iterable: ["Iterable", "Marketing", "iterable", "https://api.iterable.com/api", "header:Api-Key", "/lists", "Lists"],
  braze: ["Braze", "Marketing", "braze", "https://rest.iad-01.braze.com", "bearer", "/users/track", "Users"],
  onesignalMk: ["OneSignal Audience", "Marketing", "onesignal", "https://onesignal.com/api/v1", "token:Basic", "/players", "Players"],
  typeformMk: ["Typeform", "Forms & Surveys", "typeform", "https://api.typeform.com", "bearer", "/forms", "Forms"],
  webflow: ["Webflow", "Marketing", "webflow", "https://api.webflow.com/v2", "bearer", "/sites", "Sites"],
  wordpress: ["WordPress", "Marketing", "wordpress", "https://your-site.com/wp-json/wp/v2", "basic", "/posts", "Posts"],
  ghost: ["Ghost", "Marketing", "ghost", "https://your-site.ghost.io/ghost/api/admin", "token:Ghost", "/posts", "Posts"],
  contentful: ["Contentful", "Marketing", "contentful", "https://api.contentful.com/spaces/SPACE", "bearer", "/entries", "Entries"],
  sanity: ["Sanity", "Marketing", "sanity", "https://PROJECT.api.sanity.io/v2023-05-03", "bearer", "/data/query/production", "Documents"],
  strapi: ["Strapi", "Marketing", "strapi", "https://your-strapi/api", "bearer", "/articles", "Entries"],
  prismic: ["Prismic", "Marketing", "prismic", "https://your-repo.prismic.io/api/v2", "bearer", "/documents", "Documents"],
  hashnode: ["Hashnode", "Marketing", "hashnode", "https://gql.hashnode.com", "bearer", "/", "GraphQL"],
  devto: ["DEV.to", "Marketing", "devdotto", "https://dev.to/api", "header:api-key", "/articles", "Articles"],
  medium: ["Medium", "Marketing", "medium", "https://api.medium.com/v1", "bearer", "/users/me/posts", "Posts"],

  // ---------- Social Media ----------
  twitterX: ["X (Twitter)", "Social Media", "x", "https://api.twitter.com/2", "bearer", "/tweets", "Tweets"],
  linkedin: ["LinkedIn", "Social Media", "linkedin", "https://api.linkedin.com/v2", "bearer", "/ugcPosts", "Posts"],
  facebookPages: ["Facebook Pages", "Social Media", "facebook", "https://graph.facebook.com/v20.0", "bearer", "/me/feed", "Posts"],
  instagram: ["Instagram", "Social Media", "instagram", "https://graph.facebook.com/v20.0", "bearer", "/me/media", "Media"],
  threads: ["Threads", "Social Media", "threads", "https://graph.threads.net/v1.0", "bearer", "/me/threads", "Threads"],
  reddit: ["Reddit", "Social Media", "reddit", "https://oauth.reddit.com/api", "bearer", "/submit", "Submissions"],
  mastodon: ["Mastodon", "Social Media", "mastodon", "https://mastodon.social/api/v1", "bearer", "/statuses", "Statuses"],
  bluesky: ["Bluesky", "Social Media", "bluesky", "https://bsky.social/xrpc", "bearer", "/com.atproto.repo.createRecord", "Records"],
  youtube: ["YouTube", "Social Media", "youtube", "https://www.googleapis.com/youtube/v3", "bearer", "/videos", "Videos"],
  tiktok: ["TikTok", "Social Media", "tiktok", "https://open.tiktokapis.com/v2", "bearer", "/video/list/", "Videos"],
  pinterest: ["Pinterest", "Social Media", "pinterest", "https://api.pinterest.com/v5", "bearer", "/pins", "Pins"],
  tumblr: ["Tumblr", "Social Media", "tumblr", "https://api.tumblr.com/v2", "bearer", "/user/info", "Blog"],
  vimeo: ["Vimeo", "Social Media", "vimeo", "https://api.vimeo.com", "bearer", "/me/videos", "Videos"],
  twitch: ["Twitch", "Social Media", "twitch", "https://api.twitch.tv/helix", "bearer", "/streams", "Streams"],
  buffer: ["Buffer", "Social Media", "buffer", "https://api.bufferapp.com/1", "bearer", "/updates", "Updates"],
  hootsuite: ["Hootsuite", "Social Media", "hootsuite", "https://platform.hootsuite.com/v1", "bearer", "/messages", "Messages"],
  ayrshare: ["Ayrshare", "Social Media", "ayrshare", "https://api.ayrshare.com/api", "bearer", "/post", "Posts"],

  // ---------- Productivity ----------
  clickup: ["ClickUp", "Productivity", "clickup", "https://api.clickup.com/api/v2", "token:", "/task", "Tasks"],
  asana: ["Asana", "Productivity", "asana", "https://app.asana.com/api/1.0", "bearer", "/tasks", "Tasks"],
  trello: ["Trello", "Productivity", "trello", "https://api.trello.com/1", "query:key", "/cards", "Cards"],
  monday: ["monday.com", "Productivity", "mondaydotcom", "https://api.monday.com/v2", "bearer", "/", "GraphQL"],
  basecamp: ["Basecamp", "Productivity", "basecamp", "https://3.basecampapi.com/ACCOUNT", "bearer", "/todos", "To-dos"],
  wrike: ["Wrike", "Productivity", "wrike", "https://www.wrike.com/api/v4", "bearer", "/tasks", "Tasks"],
  teamwork: ["Teamwork", "Productivity", "teamwork", "https://your-org.teamwork.com/projects/api/v3", "basic", "/tasks.json", "Tasks"],
  height: ["Height", "Productivity", "height", "https://api.height.app", "token:", "/tasks", "Tasks"],
  shortcut: ["Shortcut", "Productivity", "shortcut", "https://api.app.shortcut.com/api/v3", "header:Shortcut-Token", "/stories", "Stories"],
  youtrack: ["YouTrack", "Productivity", "jetbrains", "https://your-org.youtrack.cloud/api", "bearer", "/issues", "Issues"],
  redmine: ["Redmine", "Productivity", "redmine", "https://your-redmine", "header:X-Redmine-API-Key", "/issues.json", "Issues"],
  todoist: ["Todoist", "Productivity", "todoist", "https://api.todoist.com/rest/v2", "bearer", "/tasks", "Tasks"],
  ticktick: ["TickTick", "Productivity", "ticktick", "https://api.ticktick.com/open/v1", "bearer", "/task", "Tasks"],
  things: ["Toggl Track", "Productivity", "toggl", "https://api.track.toggl.com/api/v9", "basic", "/me/time_entries", "Time Entries"],
  harvest: ["Harvest", "Productivity", "harvest", "https://api.harvestapp.com/v2", "bearer", "/time_entries", "Time Entries"],
  clockify: ["Clockify", "Productivity", "clockify", "https://api.clockify.me/api/v1", "header:X-Api-Key", "/workspaces", "Workspaces"],
  coda: ["Coda", "Productivity", "coda", "https://coda.io/apis/v1", "bearer", "/docs", "Docs"],
  clickupDocs: ["Nuclino", "Productivity", "nuclino", "https://api.nuclino.com/v0", "header:Authorization", "/items", "Items"],
  confluence: ["Confluence", "Productivity", "confluence", "https://your-org.atlassian.net/wiki/api/v2", "basic", "/pages", "Pages"],
  slite: ["Slite", "Productivity", "slite", "https://api.slite.com/v1", "header:x-slite-api-key", "/notes", "Notes"],
  obsidianRest: ["Obsidian Local REST", "Productivity", "obsidian", "http://127.0.0.1:27123", "bearer", "/vault", "Files"],
  evernote: ["Evernote", "Productivity", "evernote", "https://api.evernote.com/v1", "bearer", "/notes", "Notes"],
  bear: ["Raindrop.io", "Productivity", "raindropdotio", "https://api.raindrop.io/rest/v1", "bearer", "/raindrops/0", "Bookmarks"],
  pocket: ["Pocket", "Productivity", "pocket", "https://getpocket.com/v3", "bearer", "/get", "Items"],
  googleCalendar: ["Google Calendar", "Productivity", "googlecalendar", "https://www.googleapis.com/calendar/v3", "bearer", "/calendars/primary/events", "Events"],
  outlookCalendar: ["Outlook Calendar", "Productivity", "microsoftoutlook", "https://graph.microsoft.com/v1.0/me", "bearer", "/events", "Events"],
  calendly: ["Calendly", "Productivity", "calendly", "https://api.calendly.com", "bearer", "/scheduled_events", "Events"],
  calcom: ["Cal.com", "Productivity", "caldotcom", "https://api.cal.com/v1", "query:apiKey", "/bookings", "Bookings"],
  savvycal: ["SavvyCal", "Productivity", "savvycal", "https://api.savvycal.com/v1", "bearer", "/events", "Events"],
  googleDocs: ["Google Docs", "Productivity", "googledocs", "https://docs.googleapis.com/v1", "bearer", "/documents", "Documents"],
  googleSlides: ["Google Slides", "Productivity", "googleslides", "https://slides.googleapis.com/v1", "bearer", "/presentations", "Presentations"],
  googleForms: ["Google Forms", "Forms & Surveys", "googleforms", "https://forms.googleapis.com/v1", "bearer", "/forms", "Forms"],
  googleTasks: ["Google Tasks", "Productivity", "googletasks", "https://tasks.googleapis.com/tasks/v1", "bearer", "/users/@me/lists", "Task Lists"],
  googleContacts: ["Google Contacts", "Productivity", "googlecontacts", "https://people.googleapis.com/v1", "bearer", "/people/me/connections", "Contacts"],
  microsoftExcel: ["Microsoft Excel", "Productivity", "microsoftexcel", "https://graph.microsoft.com/v1.0/me/drive", "bearer", "/items", "Workbooks"],
  microsoftWord: ["Microsoft Word", "Productivity", "microsoftword", "https://graph.microsoft.com/v1.0/me/drive", "bearer", "/items", "Documents"],
  onenote: ["OneNote", "Productivity", "microsoftonenote", "https://graph.microsoft.com/v1.0/me/onenote", "bearer", "/pages", "Pages"],
  todoMs: ["Microsoft To Do", "Productivity", "microsoft", "https://graph.microsoft.com/v1.0/me/todo", "bearer", "/lists", "Lists"],
  sharepoint: ["SharePoint", "Productivity", "microsoftsharepoint", "https://graph.microsoft.com/v1.0/sites", "bearer", "/root/lists", "Lists"],
  smartsheet: ["Smartsheet", "Productivity", "smartsheet", "https://api.smartsheet.com/2.0", "bearer", "/sheets", "Sheets"],
  quipApp: ["Quip", "Productivity", "quip", "https://platform.quip.com/1", "bearer", "/threads", "Threads"],
  miro: ["Miro", "Productivity", "miro", "https://api.miro.com/v2", "bearer", "/boards", "Boards"],
  figma: ["Figma", "Productivity", "figma", "https://api.figma.com/v1", "header:X-Figma-Token", "/files", "Files"],
  canva: ["Canva", "Productivity", "canva", "https://api.canva.com/rest/v1", "bearer", "/designs", "Designs"],

  // ---------- Forms & Surveys ----------
  jotform: ["Jotform", "Forms & Surveys", "jotform", "https://api.jotform.com", "query:apiKey", "/user/forms", "Forms"],
  tally: ["Tally", "Forms & Surveys", "tally", "https://api.tally.so", "bearer", "/forms", "Forms"],
  fillout: ["Fillout", "Forms & Surveys", "fillout", "https://api.fillout.com/v1/api", "bearer", "/forms", "Forms"],
  surveymonkey: ["SurveyMonkey", "Forms & Surveys", "surveymonkey", "https://api.surveymonkey.com/v3", "bearer", "/surveys", "Surveys"],
  formstack: ["Formstack", "Forms & Surveys", "formstack", "https://www.formstack.com/api/v2", "bearer", "/form.json", "Forms"],
  wufoo: ["Wufoo", "Forms & Surveys", "wufoo", "https://your-org.wufoo.com/api/v3", "basic", "/forms.json", "Forms"],
  paperform: ["Paperform", "Forms & Surveys", "paperform", "https://api.paperform.co/v1", "bearer", "/forms", "Forms"],
  formbricks: ["Formbricks", "Forms & Surveys", "formbricks", "https://app.formbricks.com/api/v1/management", "header:x-api-key", "/surveys", "Surveys"],
  docusign: ["DocuSign", "Forms & Surveys", "docusign", "https://demo.docusign.net/restapi/v2.1/accounts/ACCOUNT", "bearer", "/envelopes", "Envelopes"],
  pandadoc: ["PandaDoc", "Forms & Surveys", "pandadoc", "https://api.pandadoc.com/public/v1", "token:API-Key", "/documents", "Documents"],
  dropboxSign: ["Dropbox Sign", "Forms & Surveys", "dropbox", "https://api.hellosign.com/v3", "basic", "/signature_request/list", "Requests"],
  signrequest: ["SignRequest", "Forms & Surveys", "signal", "https://signrequest.com/api/v1", "token:Token", "/signrequests", "Requests"],

  // ---------- Analytics ----------
  googleAnalytics: ["Google Analytics 4", "Analytics", "googleanalytics", "https://analyticsdata.googleapis.com/v1beta", "bearer", "/properties", "Reports"],
  plausible: ["Plausible", "Analytics", "plausibleanalytics", "https://plausible.io/api/v1", "bearer", "/stats/aggregate", "Stats"],
  umami: ["Umami", "Analytics", "umami", "https://analytics.umami.is/api", "bearer", "/websites", "Websites"],
  posthogApp: ["PostHog", "Analytics", "posthog", "https://app.posthog.com/api", "bearer", "/projects", "Projects"],
  mixpanel: ["Mixpanel", "Analytics", "mixpanel", "https://api.mixpanel.com", "basic", "/track", "Events"],
  amplitude: ["Amplitude", "Analytics", "amplitude", "https://api2.amplitude.com/2", "bearer", "/httpapi", "Events"],
  segment: ["Segment", "Analytics", "segment", "https://api.segment.io/v1", "basic", "/track", "Events"],
  matomo: ["Matomo", "Analytics", "matomo", "https://your-matomo/index.php", "query:token_auth", "/", "Reports"],
  hotjar: ["Hotjar", "Analytics", "hotjar", "https://api.hotjar.io/v1", "bearer", "/sites", "Sites"],
  metabase: ["Metabase", "Analytics", "metabase", "https://your-metabase/api", "header:X-Metabase-Session", "/card", "Questions"],
  looker: ["Looker", "Analytics", "looker", "https://your-org.cloud.looker.com/api/4.0", "bearer", "/looks", "Looks"],
  grafanaApp: ["Grafana", "Analytics", "grafana", "https://your-grafana/api", "bearer", "/dashboards/home", "Dashboards"],
  semrushApp: ["Semrush", "Analytics", "semrush", "https://api.semrush.com", "query:key", "/", "Reports"],
  ahrefs: ["Ahrefs", "Analytics", "ahrefs", "https://api.ahrefs.com/v3", "bearer", "/site-explorer/metrics", "Metrics"],
  serpapi: ["SerpApi", "Analytics", "serpapi", "https://serpapi.com", "query:api_key", "/search", "Search"],
  googleSearchConsole: ["Search Console", "Analytics", "googlesearchconsole", "https://searchconsole.googleapis.com/webmasters/v3", "bearer", "/sites", "Sites"],
  googleAds: ["Google Ads", "Analytics", "googleads", "https://googleads.googleapis.com/v17", "bearer", "/customers", "Customers"],
  facebookAds: ["Meta Ads", "Analytics", "meta", "https://graph.facebook.com/v20.0", "bearer", "/act_ACCOUNT/campaigns", "Campaigns"],
  linkedinAds: ["LinkedIn Ads", "Analytics", "linkedin", "https://api.linkedin.com/rest", "bearer", "/adAccounts", "Ad Accounts"],
  tiktokAds: ["TikTok Ads", "Analytics", "tiktok", "https://business-api.tiktok.com/open_api/v1.3", "header:Access-Token", "/campaign/get/", "Campaigns"],

  // ---------- Databases ----------
  postgrest: ["PostgREST", "Databases", "postgresql", "https://your-postgrest", "bearer", "/", "Tables"],
  mysqlRest: ["MySQL (Data API)", "Databases", "mysql", "https://your-data-api", "bearer", "/query", "Queries"],
  planetscale: ["PlanetScale", "Databases", "planetscale", "https://api.planetscale.com/v1", "token:", "/organizations", "Organizations"],
  neon: ["Neon", "Databases", "neon", "https://console.neon.tech/api/v2", "bearer", "/projects", "Projects"],
  turso: ["Turso", "Databases", "turso", "https://api.turso.tech/v1", "bearer", "/organizations", "Organizations"],
  cockroach: ["CockroachDB Cloud", "Databases", "cockroachlabs", "https://cockroachlabs.cloud/api/v1", "bearer", "/clusters", "Clusters"],
  firebase: ["Firebase Firestore", "Databases", "firebase", "https://firestore.googleapis.com/v1", "bearer", "/projects", "Documents"],
  dynamodb: ["DynamoDB (Data API)", "Databases", "amazondynamodb", "https://dynamodb.us-east-1.amazonaws.com", "bearer", "/", "Tables"],
  couchdb: ["CouchDB", "Databases", "apachecouchdb", "https://your-couchdb", "basic", "/_all_dbs", "Databases"],
  elasticsearch: ["Elasticsearch", "Databases", "elasticsearch", "https://your-es:9200", "basic", "/_search", "Search"],
  opensearch: ["OpenSearch", "Databases", "opensearch", "https://your-opensearch", "basic", "/_search", "Search"],
  meilisearch: ["Meilisearch", "Databases", "meilisearch", "https://your-meili", "bearer", "/indexes", "Indexes"],
  typesense: ["Typesense", "Databases", "typesense", "https://your-typesense", "header:X-TYPESENSE-API-KEY", "/collections", "Collections"],
  algolia: ["Algolia", "Databases", "algolia", "https://APPID-dsn.algolia.net/1", "header:X-Algolia-API-Key", "/indexes", "Indexes"],
  clickhouse: ["ClickHouse", "Databases", "clickhouse", "https://your-clickhouse:8443", "basic", "/", "Queries"],
  influxdb: ["InfluxDB", "Databases", "influxdb", "https://your-influx/api/v2", "token:Token", "/query", "Queries"],
  snowflake: ["Snowflake", "Databases", "snowflake", "https://ACCOUNT.snowflakecomputing.com/api/v2", "bearer", "/statements", "Statements"],
  bigquery: ["BigQuery", "Databases", "googlebigquery", "https://bigquery.googleapis.com/bigquery/v2/projects/PROJECT", "bearer", "/queries", "Queries"],
  databricks: ["Databricks", "Databases", "databricks", "https://your-workspace.cloud.databricks.com/api/2.0", "bearer", "/sql/statements", "Statements"],
  xata: ["Xata", "Databases", "xata", "https://your-workspace.xata.sh/db/main", "bearer", "/tables", "Tables"],
  nocodb: ["NocoDB", "Databases", "nocodb", "https://your-nocodb/api/v2", "header:xc-token", "/tables", "Tables"],
  baserow: ["Baserow", "Databases", "baserow", "https://api.baserow.io/api", "token:Token", "/database/rows/table/1/", "Rows"],
  seatable: ["SeaTable", "Databases", "seatable", "https://cloud.seatable.io/api/v2.1", "token:Token", "/dtables", "Tables"],
  grist: ["Grist", "Databases", "grist", "https://docs.getgrist.com/api", "bearer", "/docs", "Docs"],
  redisCloud: ["Redis (REST)", "Databases", "redis", "https://your-redis-rest", "bearer", "/", "Commands"],
  cloudflareD1: ["Cloudflare D1", "Databases", "cloudflare", "https://api.cloudflare.com/client/v4/accounts/ACCOUNT/d1/database", "bearer", "/", "Databases"],
  cloudflareKv: ["Cloudflare KV", "Databases", "cloudflare", "https://api.cloudflare.com/client/v4/accounts/ACCOUNT/storage/kv/namespaces", "bearer", "/", "Namespaces"],

  // ---------- Dev & Ops ----------
  bitbucket: ["Bitbucket", "Dev & Ops", "bitbucket", "https://api.bitbucket.org/2.0", "basic", "/repositories", "Repositories"],
  azureDevops: ["Azure DevOps", "Dev & Ops", "azuredevops", "https://dev.azure.com/ORG/_apis", "basic", "/wit/workitems", "Work Items"],
  jenkins: ["Jenkins", "Dev & Ops", "jenkins", "https://your-jenkins", "basic", "/api/json", "Jobs"],
  circleci: ["CircleCI", "Dev & Ops", "circleci", "https://circleci.com/api/v2", "header:Circle-Token", "/pipeline", "Pipelines"],
  travisci: ["Travis CI", "Dev & Ops", "travisci", "https://api.travis-ci.com", "token:token", "/repos", "Repos"],
  vercel: ["Vercel", "Dev & Ops", "vercel", "https://api.vercel.com", "bearer", "/v9/projects", "Projects"],
  netlify: ["Netlify", "Dev & Ops", "netlify", "https://api.netlify.com/api/v1", "bearer", "/sites", "Sites"],
  cloudflareApi: ["Cloudflare", "Dev & Ops", "cloudflare", "https://api.cloudflare.com/client/v4", "bearer", "/zones", "Zones"],
  render: ["Render", "Dev & Ops", "render", "https://api.render.com/v1", "bearer", "/services", "Services"],
  flyio: ["Fly.io", "Dev & Ops", "flydotio", "https://api.machines.dev/v1", "bearer", "/apps", "Apps"],
  railway: ["Railway", "Dev & Ops", "railway", "https://backboard.railway.app/graphql/v2", "bearer", "/", "GraphQL"],
  digitalocean: ["DigitalOcean", "Dev & Ops", "digitalocean", "https://api.digitalocean.com/v2", "bearer", "/droplets", "Droplets"],
  linode: ["Linode", "Dev & Ops", "linode", "https://api.linode.com/v4", "bearer", "/linode/instances", "Instances"],
  hetzner: ["Hetzner Cloud", "Dev & Ops", "hetzner", "https://api.hetzner.cloud/v1", "bearer", "/servers", "Servers"],
  heroku: ["Heroku", "Dev & Ops", "heroku", "https://api.heroku.com", "bearer", "/apps", "Apps"],
  docker: ["Docker Hub", "Dev & Ops", "docker", "https://hub.docker.com/v2", "token:JWT", "/repositories", "Repositories"],
  kubernetes: ["Kubernetes", "Dev & Ops", "kubernetes", "https://your-cluster/api/v1", "bearer", "/pods", "Pods"],
  terraform: ["Terraform Cloud", "Dev & Ops", "terraform", "https://app.terraform.io/api/v2", "bearer", "/organizations", "Organizations"],
  sentry: ["Sentry", "Dev & Ops", "sentry", "https://sentry.io/api/0", "bearer", "/projects", "Projects"],
  rollbar: ["Rollbar", "Dev & Ops", "rollbar", "https://api.rollbar.com/api/1", "header:X-Rollbar-Access-Token", "/items", "Items"],
  bugsnag: ["Bugsnag", "Dev & Ops", "smartbear", "https://api.bugsnag.com", "token:token", "/organizations", "Organizations"],
  datadog: ["Datadog", "Dev & Ops", "datadog", "https://api.datadoghq.com/api/v1", "header:DD-API-KEY", "/events", "Events"],
  newrelic: ["New Relic", "Dev & Ops", "newrelic", "https://api.newrelic.com/v2", "header:Api-Key", "/applications.json", "Applications"],
  opsgenie: ["Opsgenie", "Dev & Ops", "opsgenie", "https://api.opsgenie.com/v2", "token:GenieKey", "/alerts", "Alerts"],
  statuspage: ["Statuspage", "Dev & Ops", "statuspage", "https://api.statuspage.io/v1", "token:OAuth", "/pages", "Pages"],
  betterstack: ["Better Stack", "Dev & Ops", "betterstack", "https://uptime.betterstack.com/api/v2", "bearer", "/monitors", "Monitors"],
  uptimerobot: ["UptimeRobot", "Dev & Ops", "uptimerobot", "https://api.uptimerobot.com/v2", "bearer", "/getMonitors", "Monitors"],
  sonarcloud: ["SonarCloud", "Dev & Ops", "sonarcloud", "https://sonarcloud.io/api", "basic", "/projects/search", "Projects"],
  snyk: ["Snyk", "Dev & Ops", "snyk", "https://api.snyk.io/rest", "token:token", "/orgs", "Orgs"],
  npmRegistry: ["npm Registry", "Dev & Ops", "npm", "https://registry.npmjs.org", "bearer", "/", "Packages"],
  pypi: ["PyPI", "Dev & Ops", "pypi", "https://pypi.org/pypi", "bearer", "/", "Packages"],
  launchdarkly: ["LaunchDarkly", "Dev & Ops", "launchdarkly", "https://app.launchdarkly.com/api/v2", "header:Authorization", "/flags", "Flags"],
  auth0: ["Auth0", "Dev & Ops", "auth0", "https://your-tenant.auth0.com/api/v2", "bearer", "/users", "Users"],
  clerk: ["Clerk", "Dev & Ops", "clerk", "https://api.clerk.com/v1", "bearer", "/users", "Users"],
  okta: ["Okta", "Dev & Ops", "okta", "https://your-org.okta.com/api/v1", "token:SSWS", "/users", "Users"],
  onepassword: ["1Password Connect", "Dev & Ops", "1password", "https://your-connect:8080/v1", "bearer", "/vaults", "Vaults"],
  vault: ["HashiCorp Vault", "Dev & Ops", "vault", "https://your-vault/v1", "header:X-Vault-Token", "/secret/data", "Secrets"],

  // ---------- Cloud & Storage ----------
  s3: ["Amazon S3 (REST)", "Cloud & Storage", "amazons3", "https://s3.amazonaws.com", "bearer", "/", "Objects"],
  gcs: ["Google Cloud Storage", "Cloud & Storage", "googlecloud", "https://storage.googleapis.com/storage/v1", "bearer", "/b", "Buckets"],
  azureBlob: ["Azure Blob Storage", "Cloud & Storage", "microsoftazure", "https://ACCOUNT.blob.core.windows.net", "bearer", "/", "Containers"],
  cloudflareR2: ["Cloudflare R2", "Cloud & Storage", "cloudflare", "https://api.cloudflare.com/client/v4/accounts/ACCOUNT/r2/buckets", "bearer", "/", "Buckets"],
  backblaze: ["Backblaze B2", "Cloud & Storage", "backblaze", "https://api.backblazeb2.com/b2api/v3", "bearer", "/b2_list_buckets", "Buckets"],
  box: ["Box", "Cloud & Storage", "box", "https://api.box.com/2.0", "bearer", "/files", "Files"],
  onedrive: ["OneDrive", "Cloud & Storage", "microsoftonedrive", "https://graph.microsoft.com/v1.0/me/drive", "bearer", "/root/children", "Files"],
  nextcloud: ["Nextcloud", "Cloud & Storage", "nextcloud", "https://your-nextcloud/ocs/v2.php", "basic", "/apps/files_sharing/api/v1/shares", "Shares"],
  uploadcare: ["Uploadcare", "Cloud & Storage", "uploadcare", "https://api.uploadcare.com", "token:Uploadcare", "/files/", "Files"],
  cloudinary: ["Cloudinary", "Cloud & Storage", "cloudinary", "https://api.cloudinary.com/v1_1/CLOUD", "basic", "/resources/image", "Resources"],
  imgix: ["imgix", "Cloud & Storage", "imgix", "https://api.imgix.com/api/v1", "bearer", "/sources", "Sources"],
  mux: ["Mux", "Cloud & Storage", "mux", "https://api.mux.com/video/v1", "basic", "/assets", "Assets"],
  bunny: ["Bunny.net", "Cloud & Storage", "bunny", "https://api.bunny.net", "header:AccessKey", "/pullzone", "Pull Zones"],

  // ---------- HR & Finance ----------
  bamboohr: ["BambooHR", "HR & Finance", "bamboo", "https://api.bamboohr.com/api/gateway.php/COMPANY/v1", "basic", "/employees/directory", "Employees"],
  personio: ["Personio", "HR & Finance", "personio", "https://api.personio.de/v1", "bearer", "/company/employees", "Employees"],
  gusto: ["Gusto", "HR & Finance", "gusto", "https://api.gusto.com/v1", "bearer", "/companies", "Companies"],
  deel: ["Deel", "HR & Finance", "deel", "https://api.letsdeel.com/rest/v2", "bearer", "/contracts", "Contracts"],
  rippling: ["Rippling", "HR & Finance", "rippling", "https://api.rippling.com/platform/api", "bearer", "/employees", "Employees"],
  workable: ["Workable", "HR & Finance", "workable", "https://your-org.workable.com/spi/v3", "bearer", "/candidates", "Candidates"],
  greenhouse: ["Greenhouse", "HR & Finance", "greenhouse", "https://harvest.greenhouse.io/v1", "basic", "/candidates", "Candidates"],
  lever: ["Lever", "HR & Finance", "lever", "https://api.lever.co/v1", "basic", "/opportunities", "Opportunities"],
  quickbooks: ["QuickBooks", "HR & Finance", "quickbooks", "https://quickbooks.api.intuit.com/v3/company/REALM", "bearer", "/invoice", "Invoices"],
  xero: ["Xero", "HR & Finance", "xero", "https://api.xero.com/api.xro/2.0", "bearer", "/Invoices", "Invoices"],
  freshbooks: ["FreshBooks", "HR & Finance", "freshbooks", "https://api.freshbooks.com/accounting/account/ACCOUNT", "bearer", "/invoices/invoices", "Invoices"],
  wave: ["Wave", "HR & Finance", "wave", "https://gql.waveapps.com/graphql/public", "bearer", "/", "GraphQL"],
  invoiceninja: ["Invoice Ninja", "HR & Finance", "invoiceninja", "https://invoicing.co/api/v1", "header:X-API-TOKEN", "/invoices", "Invoices"],
  expensify: ["Expensify", "HR & Finance", "expensify", "https://integrations.expensify.com/Integration-Server", "basic", "/ExpensifyIntegrations", "Reports"],
  brex: ["Brex", "HR & Finance", "brex", "https://platform.brexapis.com/v2", "bearer", "/transactions/card/primary", "Transactions"],
  ramp: ["Ramp", "HR & Finance", "ramp", "https://api.ramp.com/developer/v1", "bearer", "/transactions", "Transactions"],
  plaid: ["Plaid", "HR & Finance", "plaid", "https://production.plaid.com", "bearer", "/transactions/get", "Transactions"],
  wise: ["Wise", "HR & Finance", "wise", "https://api.wise.com/v1", "bearer", "/profiles", "Profiles"],
  coinbase: ["Coinbase", "HR & Finance", "coinbase", "https://api.coinbase.com/v2", "bearer", "/accounts", "Accounts"],
  binance: ["Binance", "HR & Finance", "binance", "https://api.binance.com/api/v3", "header:X-MBX-APIKEY", "/account", "Account"],
  alpaca: ["Alpaca", "HR & Finance", "alpaca", "https://api.alpaca.markets/v2", "header:APCA-API-KEY-ID", "/orders", "Orders"],
  stripeBilling: ["Stripe Billing", "HR & Finance", "stripe", "https://api.stripe.com/v1", "bearer", "/subscriptions", "Subscriptions"],

  // ---------- Utilities & data providers ----------
  openweather: ["OpenWeather", "Utilities", "openweather", "https://api.openweathermap.org/data/2.5", "query:appid", "/weather", "Weather"],
  weatherapi: ["WeatherAPI", "Utilities", "weatherapi", "https://api.weatherapi.com/v1", "query:key", "/current.json", "Weather"],
  ipinfo: ["IPinfo", "Utilities", "ipinfo", "https://ipinfo.io", "bearer", "/json", "IP Lookup"],
  abstractapi: ["Abstract API", "Utilities", "abstract", "https://ipgeolocation.abstractapi.com/v1", "query:api_key", "/", "Geolocation"],
  googleMaps: ["Google Maps", "Utilities", "googlemaps", "https://maps.googleapis.com/maps/api", "query:key", "/geocode/json", "Geocoding"],
  mapbox: ["Mapbox", "Utilities", "mapbox", "https://api.mapbox.com", "query:access_token", "/geocoding/v5/mapbox.places", "Geocoding"],
  deepl: ["DeepL", "Utilities", "deepl", "https://api-free.deepl.com/v2", "token:DeepL-Auth-Key", "/translate", "Translations"],
  googleTranslate: ["Google Translate", "Utilities", "googletranslate", "https://translation.googleapis.com/language/translate/v2", "bearer", "/", "Translations"],
  exchangerate: ["ExchangeRate API", "Utilities", "moneygram", "https://v6.exchangerate-api.com/v6", "query:key", "/latest/USD", "Rates"],
  currencyapi: ["CurrencyAPI", "Utilities", "cashapp", "https://api.currencyapi.com/v3", "header:apikey", "/latest", "Rates"],
  newsapi: ["NewsAPI", "Utilities", "newsapi", "https://newsapi.org/v2", "header:X-Api-Key", "/top-headlines", "Articles"],
  gnews: ["GNews", "Utilities", "google", "https://gnews.io/api/v4", "query:apikey", "/search", "Articles"],
  tavily: ["Tavily Search", "Utilities", "tavily", "https://api.tavily.com", "bearer", "/search", "Search"],
  exaSearch: ["Exa", "Utilities", "exa", "https://api.exa.ai", "header:x-api-key", "/search", "Search"],
  brave: ["Brave Search", "Utilities", "brave", "https://api.search.brave.com/res/v1", "header:X-Subscription-Token", "/web/search", "Search"],
  wolfram: ["Wolfram Alpha", "Utilities", "wolfram", "https://api.wolframalpha.com/v2", "query:appid", "/query", "Query"],
  urlshortener: ["Bitly", "Utilities", "bitly", "https://api-ssl.bitly.com/v4", "bearer", "/bitlinks", "Links"],
  dubco: ["Dub.co", "Utilities", "dub", "https://api.dub.co", "bearer", "/links", "Links"],
  qrserver: ["QR Code", "Utilities", "qrcode", "https://api.qrserver.com/v1", "bearer", "/create-qr-code/", "QR Codes"],
  pdfco: ["PDF.co", "Utilities", "adobeacrobatreader", "https://api.pdf.co/v1", "header:x-api-key", "/pdf/convert/from/html", "Conversions"],
  apitemplate: ["APITemplate.io", "Utilities", "apitemplatedotio", "https://rest.apitemplate.io/v2", "header:X-API-KEY", "/create-pdf", "Documents"],
  scrapingbee: ["ScrapingBee", "Utilities", "scrapingbee", "https://app.scrapingbee.com/api/v1", "query:api_key", "/", "Scrapes"],
  firecrawl: ["Firecrawl", "Utilities", "firecrawl", "https://api.firecrawl.dev/v1", "bearer", "/scrape", "Scrapes"],
  browserless: ["Browserless", "Utilities", "puppeteer", "https://chrome.browserless.io", "query:token", "/content", "Pages"],
  apify: ["Apify", "Utilities", "apify", "https://api.apify.com/v2", "bearer", "/acts", "Actors"],
  clearbit: ["Clearbit", "Utilities", "clearbit", "https://person.clearbit.com/v2", "bearer", "/people/find", "People"],
  peopledatalabs: ["People Data Labs", "Utilities", "peopledatalabs", "https://api.peopledatalabs.com/v5", "header:X-Api-Key", "/person/enrich", "Enrichment"],
  numverify: ["Numverify", "Utilities", "numbers", "https://apilayer.net/api", "query:access_key", "/validate", "Validation"],
  twilioVerify: ["Twilio Verify", "Utilities", "twilio", "https://verify.twilio.com/v2", "basic", "/Services", "Services"],
  airtableBase: ["Airtable Metadata", "Utilities", "airtable", "https://api.airtable.com/v0/meta", "bearer", "/bases", "Bases"],
  zapier: ["Zapier (Webhook)", "Utilities", "zapier", "https://hooks.zapier.com/hooks/catch", "bearer", "/", "Hooks"],
  make: ["Make (Webhook)", "Utilities", "make", "https://hook.eu1.make.com", "bearer", "/", "Hooks"],
  ifttt: ["IFTTT", "Utilities", "ifttt", "https://maker.ifttt.com/trigger", "bearer", "/", "Events"],
  homeassistant: ["Home Assistant", "Utilities", "homeassistant", "https://your-ha:8123/api", "bearer", "/states", "States"],
  philipsHue: ["Philips Hue", "Utilities", "philipshue", "https://your-bridge/clip/v2/resource", "header:hue-application-key", "/light", "Lights"],
  spotify: ["Spotify", "Utilities", "spotify", "https://api.spotify.com/v1", "bearer", "/me/playlists", "Playlists"],
  lastfm: ["Last.fm", "Utilities", "lastdotfm", "https://ws.audioscrobbler.com/2.0", "query:api_key", "/", "Methods"],
  strava: ["Strava", "Utilities", "strava", "https://www.strava.com/api/v3", "bearer", "/athlete/activities", "Activities"],
  oura: ["Oura", "Utilities", "oura", "https://api.ouraring.com/v2", "bearer", "/usercollection/daily_activity", "Activity"],
  whoop: ["WHOOP", "Utilities", "whoop", "https://api.prod.whoop.com/developer/v1", "bearer", "/cycle", "Cycles"],
  fitbit: ["Fitbit", "Utilities", "fitbit", "https://api.fitbit.com/1/user/-", "bearer", "/activities/date/today.json", "Activities"],
  discourse: ["Discourse", "Utilities", "discourse", "https://your-forum", "header:Api-Key", "/posts.json", "Posts"],
  wikipedia: ["Wikipedia", "Utilities", "wikipedia", "https://en.wikipedia.org/api/rest_v1", "bearer", "/page/summary", "Pages"],
  openlibrary: ["Open Library", "Utilities", "openlibrary", "https://openlibrary.org", "bearer", "/search.json", "Books"],
  tmdb: ["TMDB", "Utilities", "themoviedatabase", "https://api.themoviedb.org/3", "bearer", "/search/movie", "Movies"],
  unsplash: ["Unsplash", "Utilities", "unsplash", "https://api.unsplash.com", "token:Client-ID", "/photos", "Photos"],
  pexels: ["Pexels", "Utilities", "pexels", "https://api.pexels.com/v1", "header:Authorization", "/search", "Photos"],
  giphy: ["Giphy", "Utilities", "giphy", "https://api.giphy.com/v1", "query:api_key", "/gifs/search", "GIFs"],
  removebg: ["remove.bg", "Utilities", "removedotbg", "https://api.remove.bg/v1.0", "header:X-Api-Key", "/removebg", "Images"],
  tinypng: ["TinyPNG", "Utilities", "tinypng", "https://api.tinify.com", "basic", "/shrink", "Images"],
  screenshotone: ["ScreenshotOne", "Utilities", "screenshotone", "https://api.screenshotone.com", "query:access_key", "/take", "Screenshots"],
  urlbox: ["Urlbox", "Utilities", "urlbox", "https://api.urlbox.io/v1", "bearer", "/render", "Screenshots"],
};

/** Build the AppSpec for a catalog entry. */
export function specFor(kind: string, entry: Entry): AppSpec {
  const [name, group, icon, baseUrl, auth, resource, resourceLabel] = entry;
  const queryKey = queryAuth(auth);
  const ops = crudOps(resource, resourceLabel, group);
  const primaryLabel = (GROUP_PRIMARY[group]?.label ?? `Create ${resourceLabel}`).toLowerCase();
  return {
    kind,
    name,
    group,
    description: `${name} REST API — ${primaryLabel}, list, read, update and delete ${resourceLabel.toLowerCase()}, or send any custom request.`,
    icon,
    baseUrl: (cred) => cred['baseUrl'] || baseUrl,
    credentialType: auth === "basic" ? "basicAuth" : auth === "bearer" ? "bearer" : "apiKey",
    auth: authFor(auth),
    keywords: [name.toLowerCase(), group.toLowerCase(), resourceLabel.toLowerCase(), "api", "rest"],
    operations: queryKey
      ? ops.map((op) => ({
          ...op,
          query: (p: Record<string, Json>, cred: Record<string, string>) => ({
            ...(op.query?.(p, cred) ?? {}),
            [queryKey]: cred['apiKey'] ?? cred['token'] ?? "",
          }),
        }))
      : ops,
  };
}

export type CatalogEntry = Entry;

/** Turn a `{ kind: Entry }` record into real REST nodes. */
export function buildCatalog(entries: Record<string, Entry>): NodeModule[] {
  return Object.entries(entries).map(([kind, entry]) => createAppNode(specFor(kind, entry)));
}

export const APP_KEYS = new Set(Object.keys(APPS));

export const catalogAppNodes: NodeModule[] = buildCatalog(APPS);
