import type { NodeGroup, NodeModule } from "./types";
import { APP_KEYS, buildCatalog, type Entry } from "./apps-catalog";

/**
 * Catalog expansion pack.
 *
 * Same engine as `apps-catalog.ts`: every line below becomes a real REST node
 * (list / get / create / update / delete + Custom Request) that signs requests
 * with the credential the user stores in the Credentials screen. Declared in a
 * compact pipe format so hundreds of integrations stay readable:
 *
 *   Name | Group | icon slug | base URL | auth | /resource | Resource label
 *
 * auth: bearer | basic | header:X-Name | token:Prefix | query:param
 */
const RAW = `
Discourse|Communication|discourse|https://your-forum.example.com|header:Api-Key|/posts|Posts
Twilio Conversations|Communication|twilio|https://conversations.twilio.com/v1|basic|/Conversations|Conversations
Bandwidth|Communication|bandwidth|https://messaging.bandwidth.com/api/v2|basic|/messages|Messages
Telnyx|Communication|telnyx|https://api.telnyx.com/v2|bearer|/messages|Messages
Infobip|Communication|infobip|https://api.infobip.com|token:App|/sms/2/text/advanced|SMS
Kaleyra|Communication|kaleyra|https://api.kaleyra.io/v1|header:api-key|/messages|Messages
46elks|Communication|elks|https://api.46elks.com/a1|basic|/sms|SMS
Textlocal|Communication|textlocal|https://api.textlocal.in|query:apikey|/send|SMS
Smsapi|Communication|smsapi|https://api.smsapi.com|bearer|/sms.do|SMS
Slack Workflows|Communication|slack|https://slack.com/api|bearer|/chat.postMessage|Messages
Discord Webhooks|Communication|discord|https://discord.com/api/v10|token:Bot|/channels|Channels
Guilded|Communication|guilded|https://www.guilded.gg/api/v1|bearer|/channels|Channels
Revolt|Communication|revolt|https://api.revolt.chat|header:X-Session-Token|/channels|Channels
Tawk.to|Communication|tawkto|https://api.tawk.to/v1|bearer|/chats|Chats
LiveChat|Communication|livechat|https://api.livechatinc.com/v3.5|bearer|/chats|Chats
Olark|Communication|olark|https://api.olark.com/api/v1|bearer|/transcripts|Transcripts
Drift|Communication|drift|https://driftapi.com|bearer|/conversations|Conversations
Kustomer|Communication|kustomer|https://api.kustomerapp.com/v1|bearer|/conversations|Conversations
Freshchat|Communication|freshworks|https://your-org.freshchat.com/v2|bearer|/conversations|Conversations
Zoho Desk|Communication|zoho|https://desk.zoho.com/api/v1|token:Zoho-oauthtoken|/tickets|Tickets
Jira Service Desk|Communication|jira|https://your-org.atlassian.net/rest/servicedeskapi|basic|/request|Requests
HappyFox|Communication|happyfox|https://your-org.happyfox.com/api/1.1/json|basic|/tickets|Tickets
Groove|Communication|groove|https://api.groovehq.com/v1|bearer|/tickets|Tickets
Re:amaze|Communication|reamaze|https://your-brand.reamaze.io/api/v1|basic|/conversations|Conversations
Trengo|Communication|trengo|https://app.trengo.com/api/v2|bearer|/tickets|Tickets
Missive|Communication|missive|https://public.missiveapp.com/v1|bearer|/conversations|Conversations
Loops|Communication|loops|https://app.loops.so/api/v1|bearer|/contacts|Contacts
Customer.io|Communication|customerio|https://api.customer.io/v1|bearer|/customers|Customers
SendPulse|Communication|sendpulse|https://api.sendpulse.com|bearer|/smtp/emails|Emails
Elastic Email|Communication|elasticemail|https://api.elasticemail.com/v4|header:X-ElasticEmail-ApiKey|/emails|Emails
SMTP2GO|Communication|smtp2go|https://api.smtp2go.com/v3|header:X-Smtp2go-Api-Key|/email/send|Emails
Mailtrap|Communication|mailtrap|https://send.api.mailtrap.io/api|bearer|/send|Emails
MailerSend|Communication|mailersend|https://api.mailersend.com/v1|bearer|/email|Emails
Mailpit|Communication|mailpit|http://localhost:8025/api/v1|bearer|/messages|Messages
Mailchimp Transactional|Communication|mailchimp|https://mandrillapp.com/api/1.0|bearer|/messages/send.json|Messages
Sendinblue SMS|Communication|brevo|https://api.brevo.com/v3|header:api-key|/transactionalSMS/sms|SMS
Gmail API|Communication|gmail|https://gmail.googleapis.com/gmail/v1/users/me|bearer|/messages|Messages
Outlook Mail|Communication|microsoftoutlook|https://graph.microsoft.com/v1.0/me|bearer|/messages|Messages
Fastmail JMAP|Communication|fastmail|https://api.fastmail.com/jmap|bearer|/session|Sessions
Zoho Mail|Communication|zoho|https://mail.zoho.com/api|token:Zoho-oauthtoken|/accounts|Accounts
Twilio Verify|Communication|twilio|https://verify.twilio.com/v2|basic|/Services|Services
Authy|Communication|authy|https://api.authy.com|header:X-Authy-API-Key|/protected/json/users|Users
Knock|Communication|knock|https://api.knock.app/v1|bearer|/workflows|Workflows
Courier|Communication|courier|https://api.courier.com|bearer|/send|Messages
MagicBell|Communication|magicbell|https://api.magicbell.com|header:X-MAGICBELL-API-KEY|/notifications|Notifications
Novu|Communication|novu|https://api.novu.co/v1|token:ApiKey|/events/trigger|Events
Bird|Communication|bird|https://api.bird.com|bearer|/messages|Messages
SuperChat|Communication|superchat|https://api.superchat.com/v1|bearer|/messages|Messages
Zapier NLA|Productivity|zapier|https://nla.zapier.com/api/v1|bearer|/exposed|Actions
Make.com|Productivity|make|https://eu1.make.com/api/v2|token:Token|/scenarios|Scenarios
n8n Cloud|Productivity|n8n|https://your-n8n.app/api/v1|header:X-N8N-API-KEY|/workflows|Workflows
Pipedream|Productivity|pipedream|https://api.pipedream.com/v1|bearer|/workflows|Workflows
Retool|Productivity|retool|https://your-org.retool.com/api/v2|bearer|/apps|Apps
Coda|Productivity|coda|https://coda.io/apis/v1|bearer|/docs|Docs
Notion Databases|Productivity|notion|https://api.notion.com/v1|bearer|/databases|Databases
Slite|Productivity|slite|https://api.slite.com/v1|header:x-slite-api-key|/notes|Notes
Nuclino|Productivity|nuclino|https://api.nuclino.com/v0|header:Authorization|/items|Items
Craft Docs|Productivity|craft|https://api.craft.do/v1|bearer|/documents|Documents
Confluence|Productivity|confluence|https://your-org.atlassian.net/wiki/rest/api|basic|/content|Content
Basecamp|Productivity|basecamp|https://3.basecampapi.com/ACCOUNT|bearer|/projects|Projects
Wrike|Productivity|wrike|https://www.wrike.com/api/v4|bearer|/tasks|Tasks
Teamwork|Productivity|teamwork|https://your-org.teamwork.com|basic|/projects.json|Projects
Smartsheet|Productivity|smartsheet|https://api.smartsheet.com/2.0|bearer|/sheets|Sheets
Height|Productivity|height|https://api.height.app|bearer|/tasks|Tasks
Shortcut|Productivity|shortcut|https://api.app.shortcut.com/api/v3|header:Shortcut-Token|/stories|Stories
Zenhub|Productivity|zenhub|https://api.zenhub.com/public|header:X-Authentication-Token|/repositories|Repositories
Taiga|Productivity|taiga|https://api.taiga.io/api/v1|bearer|/tasks|Tasks
Redmine|Productivity|redmine|https://your-redmine.example.com|header:X-Redmine-API-Key|/issues.json|Issues
YouTrack|Productivity|jetbrains|https://your-org.youtrack.cloud/api|bearer|/issues|Issues
OpenProject|Productivity|openproject|https://your-op.example.com/api/v3|basic|/work_packages|Work Packages
Vikunja|Productivity|vikunja|https://try.vikunja.io/api/v1|bearer|/tasks|Tasks
Nifty|Productivity|nifty|https://openapi.niftypm.com/api/v1.0|bearer|/tasks|Tasks
Hive|Productivity|hive|https://app.hive.com/api/v1|bearer|/actions|Actions
Quire|Productivity|quire|https://quire.io/api|bearer|/task|Tasks
Any.do|Productivity|anydo|https://sm-prod2.any.do/api/v2|bearer|/tasks|Tasks
TickTick|Productivity|ticktick|https://api.ticktick.com/open/v1|bearer|/task|Tasks
Microsoft To Do|Productivity|microsoft|https://graph.microsoft.com/v1.0/me/todo|bearer|/lists|Lists
Google Tasks|Productivity|googletasks|https://tasks.googleapis.com/tasks/v1|bearer|/users/@me/lists|Lists
Google Calendar|Productivity|googlecalendar|https://www.googleapis.com/calendar/v3|bearer|/calendars/primary/events|Events
Outlook Calendar|Productivity|microsoftoutlook|https://graph.microsoft.com/v1.0/me|bearer|/events|Events
Cal.com|Productivity|caldotcom|https://api.cal.com/v2|bearer|/bookings|Bookings
Calendly|Productivity|calendly|https://api.calendly.com|bearer|/scheduled_events|Events
SavvyCal|Productivity|savvycal|https://api.savvycal.com/v1|bearer|/events|Events
Acuity Scheduling|Productivity|acuityscheduling|https://acuityscheduling.com/api/v1|basic|/appointments|Appointments
YouCanBookMe|Productivity|youcanbookme|https://api.youcanbook.me/v1|bearer|/bookings|Bookings
Doodle|Productivity|doodle|https://api.doodle.com/v2.1|bearer|/polls|Polls
Motion|Productivity|motion|https://api.usemotion.com/v1|header:X-API-Key|/tasks|Tasks
Reclaim.ai|Productivity|reclaim|https://api.app.reclaim.ai/api|bearer|/tasks|Tasks
Clockify|HR & Finance|clockify|https://api.clockify.me/api/v1|header:X-Api-Key|/workspaces|Workspaces
Toggl Track|HR & Finance|toggltrack|https://api.track.toggl.com/api/v9|basic|/me/time_entries|Time Entries
Harvest|HR & Finance|harvest|https://api.harvestapp.com/v2|bearer|/time_entries|Time Entries
Everhour|HR & Finance|everhour|https://api.everhour.com|header:X-Api-Key|/tasks|Tasks
TimeCamp|HR & Finance|timecamp|https://app.timecamp.com/third_party/api|bearer|/entries|Entries
Hubstaff|HR & Finance|hubstaff|https://api.hubstaff.com/v2|bearer|/activities|Activities
Deel|HR & Finance|deel|https://api.letsdeel.com/rest/v2|bearer|/contracts|Contracts
Remote.com|HR & Finance|remote|https://gateway.remote.com/v1|bearer|/employments|Employments
Gusto|HR & Finance|gusto|https://api.gusto.com/v1|bearer|/employees|Employees
Rippling|HR & Finance|rippling|https://api.rippling.com/platform/api|bearer|/employees|Employees
Personio|HR & Finance|personio|https://api.personio.de/v1|bearer|/company/employees|Employees
BambooHR|HR & Finance|bamboohr|https://api.bamboohr.com/api/gateway.php/COMPANY/v1|basic|/employees/directory|Employees
Factorial|HR & Finance|factorial|https://api.factorialhr.com/api/v1|header:x-api-key|/employees|Employees
HiBob|HR & Finance|hibob|https://api.hibob.com/v1|basic|/people|People
Workable|HR & Finance|workable|https://your-org.workable.com/spi/v3|bearer|/candidates|Candidates
Greenhouse|HR & Finance|greenhouse|https://harvest.greenhouse.io/v1|basic|/candidates|Candidates
Lever|HR & Finance|lever|https://api.lever.co/v1|basic|/opportunities|Opportunities
Ashby|HR & Finance|ashby|https://api.ashbyhq.com|basic|/candidate.list|Candidates
Recruitee|HR & Finance|recruitee|https://api.recruitee.com/c/COMPANY|bearer|/candidates|Candidates
Teamtailor|HR & Finance|teamtailor|https://api.teamtailor.com/v1|token:Token token=|/candidates|Candidates
SmartRecruiters|HR & Finance|smartrecruiters|https://api.smartrecruiters.com|header:X-SmartToken|/candidates|Candidates
Xero|HR & Finance|xero|https://api.xero.com/api.xro/2.0|bearer|/Invoices|Invoices
QuickBooks|HR & Finance|quickbooks|https://quickbooks.api.intuit.com/v3/company/REALM|bearer|/invoice|Invoices
FreshBooks|HR & Finance|freshbooks|https://api.freshbooks.com/accounting/account/ACC|bearer|/invoices/invoices|Invoices
Wave|HR & Finance|wave|https://gql.waveapps.com/graphql/public|bearer|/|Business
Zoho Books|HR & Finance|zoho|https://www.zohoapis.com/books/v3|token:Zoho-oauthtoken|/invoices|Invoices
Invoice Ninja|HR & Finance|invoiceninja|https://invoicing.co/api/v1|header:X-API-TOKEN|/invoices|Invoices
Bill.com|HR & Finance|bill|https://api.bill.com/api/v2|bearer|/List/Bill.json|Bills
Ramp|HR & Finance|ramp|https://api.ramp.com/developer/v1|bearer|/transactions|Transactions
Brex|HR & Finance|brex|https://platform.brexapis.com/v2|bearer|/transactions/card/primary|Transactions
Expensify|HR & Finance|expensify|https://integrations.expensify.com/Integration-Server|basic|/ExpensifyIntegrations|Reports
Pleo|HR & Finance|pleo|https://external.pleo.io/v1|bearer|/expenses|Expenses
Spendesk|HR & Finance|spendesk|https://public-api.spendesk.com/v1|bearer|/payments|Payments
Payoneer|HR & Finance|payoneer|https://api.payoneer.com/v4|basic|/payouts|Payouts
Wise|HR & Finance|wise|https://api.wise.com/v1|bearer|/transfers|Transfers
Revolut Business|HR & Finance|revolut|https://b2b.revolut.com/api/1.0|bearer|/transactions|Transactions
Plaid|HR & Finance|plaid|https://production.plaid.com|bearer|/transactions/get|Transactions
Yodlee|HR & Finance|yodlee|https://production.api.yodlee.com/ysl|bearer|/transactions|Transactions
Nordigen|HR & Finance|gocardless|https://bankaccountdata.gocardless.com/api/v2|token:Bearer|/accounts|Accounts
GoCardless|HR & Finance|gocardless|https://api.gocardless.com|bearer|/payments|Payments
Adyen|HR & Finance|adyen|https://checkout-live.adyen.com/v71|header:X-API-Key|/payments|Payments
Braintree|HR & Finance|braintree|https://payments.braintree-api.com|bearer|/graphql|Transactions
Klarna|HR & Finance|klarna|https://api.klarna.com|basic|/payments/v1/sessions|Sessions
Afterpay|HR & Finance|afterpay|https://global-api.afterpay.com/v2|basic|/payments|Payments
Coinbase Commerce|HR & Finance|coinbase|https://api.commerce.coinbase.com|header:X-CC-Api-Key|/charges|Charges
BTCPay Server|HR & Finance|bitcoin|https://your-btcpay.example.com/api/v1|token:token|/stores|Stores
Stripe Billing|HR & Finance|stripe|https://api.stripe.com/v1|bearer|/subscriptions|Subscriptions
Avalara|HR & Finance|avalara|https://rest.avatax.com/api/v2|basic|/transactions|Transactions
TaxJar|HR & Finance|taxjar|https://api.taxjar.com/v2|bearer|/transactions/orders|Orders
Vertex|HR & Finance|vertex|https://api.vertexcloud.com/vertex-ws/v1|bearer|/sale|Sales
Sage|HR & Finance|sage|https://api.accounting.sage.com/v3.1|bearer|/sales_invoices|Invoices
NetSuite|HR & Finance|oracle|https://ACCOUNT.suitetalk.api.netsuite.com/services/rest/record/v1|bearer|/invoice|Invoices
Odoo|HR & Finance|odoo|https://your-odoo.example.com/api/v1|bearer|/res.partner|Partners
Snowflake SQL API|Databases|snowflake|https://ACCOUNT.snowflakecomputing.com/api/v2|bearer|/statements|Statements
Databricks SQL|Databases|databricks|https://your-workspace.cloud.databricks.com/api/2.0|bearer|/sql/statements|Statements
BigQuery|Databases|googlebigquery|https://bigquery.googleapis.com/bigquery/v2/projects/PROJECT|bearer|/queries|Queries
ClickHouse Cloud|Databases|clickhouse|https://your-instance.clickhouse.cloud|basic|/|Queries
Neon|Databases|neon|https://console.neon.tech/api/v2|bearer|/projects|Projects
PlanetScale|Databases|planetscale|https://api.planetscale.com/v1|token:|/organizations|Organizations
Turso|Databases|turso|https://api.turso.tech/v1|bearer|/organizations|Organizations
Xata|Databases|xata|https://api.xata.io|bearer|/workspaces|Workspaces
Fauna|Databases|fauna|https://db.fauna.com|bearer|/|Queries
SurrealDB|Databases|surrealdb|https://your-surreal.example.com|basic|/sql|Queries
CockroachDB Cloud|Databases|cockroachlabs|https://cockroachlabs.cloud/api/v1|bearer|/clusters|Clusters
Timescale|Databases|timescale|https://console.cloud.timescale.com/api|bearer|/services|Services
InfluxDB|Databases|influxdb|https://your-influx.example.com/api/v2|token:Token|/buckets|Buckets
QuestDB|Databases|questdb|https://your-questdb.example.com|basic|/exec|Queries
Elasticsearch|Databases|elasticsearch|https://your-es.example.com|basic|/_search|Search
OpenSearch|Databases|opensearch|https://your-opensearch.example.com|basic|/_search|Search
Meilisearch|Databases|meilisearch|https://your-meili.example.com|bearer|/indexes|Indexes
Typesense|Databases|typesense|https://your-typesense.example.com|header:X-TYPESENSE-API-KEY|/collections|Collections
Algolia Search|Databases|algolia|https://APPID-dsn.algolia.net/1|header:X-Algolia-API-Key|/indexes|Indexes
Redis Cloud|Databases|redis|https://api.redislabs.com/v1|header:x-api-key|/subscriptions|Subscriptions
Upstash Redis|Databases|upstash|https://your-db.upstash.io|bearer|/get|Keys
Upstash Kafka|Databases|upstash|https://your-kafka.upstash.io|basic|/produce|Messages
MongoDB Atlas Data API|Databases|mongodb|https://data.mongodb-api.com/app/APPID/endpoint/data/v1|header:api-key|/action/find|Documents
Couchbase Capella|Databases|couchbase|https://cloudapi.cloud.couchbase.com/v4|bearer|/organizations|Organizations
CouchDB|Databases|apachecouchdb|https://your-couch.example.com|basic|/_all_dbs|Databases
RethinkDB HTTP|Databases|rethinkdb|https://your-rethink.example.com|bearer|/|Tables
Firebase Firestore|Databases|firebase|https://firestore.googleapis.com/v1/projects/PROJECT/databases/(default)/documents|bearer|/|Documents
Firebase Realtime DB|Databases|firebase|https://your-app.firebaseio.com|query:auth|/data.json|Data
Realm|Databases|mongodb|https://realm.mongodb.com/api/admin/v3.0|bearer|/groups|Groups
Directus|Databases|directus|https://your-directus.example.com|bearer|/items|Items
Strapi|Databases|strapi|https://your-strapi.example.com/api|bearer|/articles|Articles
Hasura|Databases|hasura|https://your-hasura.example.com/v1|header:x-hasura-admin-secret|/graphql|GraphQL
PostgREST|Databases|postgresql|https://your-postgrest.example.com|bearer|/|Tables
Prisma Data Proxy|Databases|prisma|https://api.prisma.io|bearer|/projects|Projects
Nhost|Databases|nhost|https://your-app.nhost.run/v1|bearer|/graphql|GraphQL
Appwrite|Databases|appwrite|https://cloud.appwrite.io/v1|header:X-Appwrite-Key|/databases|Databases
PocketBase|Databases|pocketbase|https://your-pb.example.com/api|bearer|/collections|Collections
Baserow|Databases|baserow|https://api.baserow.io/api|token:Token|/database/rows|Rows
NocoDB|Databases|nocodb|https://your-nocodb.example.com/api/v2|header:xc-token|/tables|Tables
SeaTable|Databases|seatable|https://cloud.seatable.io/api/v2.1|token:Token|/dtables|Tables
Grist|Databases|grist|https://docs.getgrist.com/api|bearer|/docs|Docs
Rowy|Databases|rowy|https://api.rowy.io/v1|bearer|/tables|Tables
Weaviate|AI Retrieval|weaviate|https://your-cluster.weaviate.network/v1|bearer|/objects|Objects
Qdrant|AI Retrieval|qdrant|https://your-cluster.qdrant.io|header:api-key|/collections|Collections
Milvus|AI Retrieval|milvus|https://your-cluster.zillizcloud.com/v1|bearer|/vector/collections|Collections
Chroma|AI Retrieval|chroma|https://your-chroma.example.com/api/v1|bearer|/collections|Collections
Vectara|AI Retrieval|vectara|https://api.vectara.io/v1|header:x-api-key|/query|Queries
Marqo|AI Retrieval|marqo|https://api.marqo.ai/api/v2|header:x-api-key|/indexes|Indexes
LanceDB|AI Retrieval|lancedb|https://your-db.us-east-1.api.lancedb.com/v1|header:x-api-key|/table|Tables
Turbopuffer|AI Retrieval|turbopuffer|https://api.turbopuffer.com/v1|bearer|/vectors|Vectors
SingleStore|AI Retrieval|singlestore|https://api.singlestore.com/v1|bearer|/workspaces|Workspaces
Unstructured.io|AI Retrieval|unstructured|https://api.unstructured.io|header:unstructured-api-key|/general/v0/general|Documents
LlamaParse|AI Retrieval|llamaindex|https://api.cloud.llamaindex.ai/api/parsing|bearer|/upload|Jobs
Jina Reader|AI Retrieval|jina|https://r.jina.ai|bearer|/|Pages
Firecrawl|AI Retrieval|firecrawl|https://api.firecrawl.dev/v1|bearer|/scrape|Pages
Exa|AI Retrieval|exa|https://api.exa.ai|header:x-api-key|/search|Results
Tavily|AI Retrieval|tavily|https://api.tavily.com|bearer|/search|Results
SerpApi|AI Retrieval|serpapi|https://serpapi.com|query:api_key|/search|Results
Serper|AI Retrieval|serper|https://google.serper.dev|header:X-API-KEY|/search|Results
Brave Search|AI Retrieval|brave|https://api.search.brave.com/res/v1|header:X-Subscription-Token|/web/search|Results
You.com|AI Retrieval|you|https://api.ydc-index.io|header:X-API-Key|/search|Results
Kagi|AI Retrieval|kagi|https://kagi.com/api/v0|token:Bot|/search|Results
Metaphor|AI Retrieval|exa|https://api.metaphor.systems|header:x-api-key|/search|Results
Diffbot|AI Retrieval|diffbot|https://api.diffbot.com/v3|query:token|/article|Articles
ScrapingBee|AI Retrieval|scrapingbee|https://app.scrapingbee.com/api/v1|query:api_key|/|Pages
ScraperAPI|AI Retrieval|scraperapi|https://api.scraperapi.com|query:api_key|/|Pages
Zyte|AI Retrieval|zyte|https://api.zyte.com/v1|basic|/extract|Extractions
Apify|AI Retrieval|apify|https://api.apify.com/v2|bearer|/acts|Actors
Browserless|AI Retrieval|browserless|https://chrome.browserless.io|query:token|/content|Pages
Browserbase|AI Retrieval|browserbase|https://api.browserbase.com/v1|header:x-bb-api-key|/sessions|Sessions
Bright Data|AI Retrieval|brightdata|https://api.brightdata.com|bearer|/datasets|Datasets
Oxylabs|AI Retrieval|oxylabs|https://realtime.oxylabs.io/v1|basic|/queries|Queries
LangSmith|Dev & Ops|langchain|https://api.smith.langchain.com|header:x-api-key|/runs|Runs
Langfuse|Dev & Ops|langfuse|https://cloud.langfuse.com/api/public|basic|/traces|Traces
Helicone|Dev & Ops|helicone|https://api.helicone.ai/v1|bearer|/request|Requests
Weights & Biases|Dev & Ops|weightsandbiases|https://api.wandb.ai|bearer|/runs|Runs
Comet ML|Dev & Ops|cometml|https://www.comet.com/api/rest/v2|header:Authorization|/experiments|Experiments
MLflow|Dev & Ops|mlflow|https://your-mlflow.example.com/api/2.0/mlflow|bearer|/runs/search|Runs
Modal|Dev & Ops|modal|https://api.modal.com/v1|bearer|/apps|Apps
Replicate|Dev & Ops|replicate|https://api.replicate.com/v1|token:Token|/predictions|Predictions
Hugging Face|Dev & Ops|huggingface|https://huggingface.co/api|bearer|/models|Models
RunPod|Dev & Ops|runpod|https://api.runpod.io/v2|bearer|/pods|Pods
Banana|Dev & Ops|banana|https://api.banana.dev|bearer|/start/v4|Jobs
Baseten|Dev & Ops|baseten|https://app.baseten.co/api/v1|token:Api-Key|/models|Models
Beam Cloud|Dev & Ops|beam|https://api.beam.cloud/v1|bearer|/tasks|Tasks
Fly.io|Dev & Ops|flydotio|https://api.machines.dev/v1|bearer|/apps|Apps
Railway|Dev & Ops|railway|https://backboard.railway.app/graphql/v2|bearer|/|Projects
Render|Dev & Ops|render|https://api.render.com/v1|bearer|/services|Services
Vercel|Dev & Ops|vercel|https://api.vercel.com|bearer|/v9/projects|Projects
Netlify|Dev & Ops|netlify|https://api.netlify.com/api/v1|bearer|/sites|Sites
Cloudflare|Dev & Ops|cloudflare|https://api.cloudflare.com/client/v4|bearer|/zones|Zones
Cloudflare Pages|Dev & Ops|cloudflarepages|https://api.cloudflare.com/client/v4/accounts/ACCOUNT/pages|bearer|/projects|Projects
Cloudflare R2|Cloud & Storage|cloudflare|https://api.cloudflare.com/client/v4/accounts/ACCOUNT/r2|bearer|/buckets|Buckets
Cloudflare KV|Databases|cloudflare|https://api.cloudflare.com/client/v4/accounts/ACCOUNT/storage/kv|bearer|/namespaces|Namespaces
DigitalOcean|Dev & Ops|digitalocean|https://api.digitalocean.com/v2|bearer|/droplets|Droplets
Linode|Dev & Ops|linode|https://api.linode.com/v4|bearer|/linode/instances|Instances
Vultr|Dev & Ops|vultr|https://api.vultr.com/v2|bearer|/instances|Instances
Hetzner Cloud|Dev & Ops|hetzner|https://api.hetzner.cloud/v1|bearer|/servers|Servers
Scaleway|Dev & Ops|scaleway|https://api.scaleway.com/instance/v1|header:X-Auth-Token|/zones|Zones
OVH|Dev & Ops|ovh|https://eu.api.ovh.com/1.0|header:X-Ovh-Application|/cloud/project|Projects
Heroku|Dev & Ops|heroku|https://api.heroku.com|bearer|/apps|Apps
Koyeb|Dev & Ops|koyeb|https://app.koyeb.com/v1|bearer|/services|Services
Northflank|Dev & Ops|northflank|https://api.northflank.com/v1|bearer|/projects|Projects
Porter|Dev & Ops|porter|https://api.porter.run/v1|bearer|/projects|Projects
Coolify|Dev & Ops|coolify|https://your-coolify.example.com/api/v1|bearer|/applications|Applications
Dokku|Dev & Ops|dokku|https://your-dokku.example.com/api|bearer|/apps|Apps
Portainer|Dev & Ops|portainer|https://your-portainer.example.com/api|bearer|/endpoints|Endpoints
Docker Hub|Dev & Ops|docker|https://hub.docker.com/v2|token:JWT|/repositories|Repositories
GitHub Actions|Dev & Ops|githubactions|https://api.github.com|bearer|/repos|Workflows
GitHub Packages|Dev & Ops|github|https://api.github.com/user/packages|bearer|/container|Packages
Bitbucket|Dev & Ops|bitbucket|https://api.bitbucket.org/2.0|basic|/repositories|Repositories
Gitea|Dev & Ops|gitea|https://your-gitea.example.com/api/v1|token:token|/repos|Repositories
Codeberg|Dev & Ops|codeberg|https://codeberg.org/api/v1|token:token|/repos|Repositories
Azure DevOps|Dev & Ops|azuredevops|https://dev.azure.com/ORG/_apis|basic|/build/builds|Builds
CircleCI|Dev & Ops|circleci|https://circleci.com/api/v2|header:Circle-Token|/pipeline|Pipelines
Travis CI|Dev & Ops|travisci|https://api.travis-ci.com|token:token|/repos|Repositories
Drone CI|Dev & Ops|drone|https://your-drone.example.com/api|bearer|/repos|Repositories
Buildkite|Dev & Ops|buildkite|https://api.buildkite.com/v2|bearer|/organizations|Organizations
TeamCity|Dev & Ops|teamcity|https://your-teamcity.example.com/app/rest|bearer|/builds|Builds
Jenkins|Dev & Ops|jenkins|https://your-jenkins.example.com|basic|/api/json|Jobs
Argo CD|Dev & Ops|argo|https://your-argocd.example.com/api/v1|bearer|/applications|Applications
Spinnaker|Dev & Ops|spinnaker|https://your-spinnaker.example.com|bearer|/pipelines|Pipelines
Terraform Cloud|Dev & Ops|terraform|https://app.terraform.io/api/v2|bearer|/organizations|Organizations
Pulumi|Dev & Ops|pulumi|https://api.pulumi.com/api|token:token|/stacks|Stacks
Ansible Tower|Dev & Ops|ansible|https://your-tower.example.com/api/v2|bearer|/jobs|Jobs
Chef|Dev & Ops|chef|https://your-chef.example.com/organizations/ORG|bearer|/nodes|Nodes
Puppet|Dev & Ops|puppet|https://your-puppet.example.com:8081/pdb/query/v4|bearer|/nodes|Nodes
Consul|Dev & Ops|consul|https://your-consul.example.com/v1|header:X-Consul-Token|/kv|Keys
Vault|Dev & Ops|vault|https://your-vault.example.com/v1|header:X-Vault-Token|/secret/data|Secrets
Doppler|Dev & Ops|doppler|https://api.doppler.com/v3|bearer|/configs/config/secrets|Secrets
Infisical|Dev & Ops|infisical|https://app.infisical.com/api/v3|bearer|/secrets/raw|Secrets
1Password Connect|Dev & Ops|1password|https://your-connect.example.com/v1|bearer|/vaults|Vaults
Bitwarden|Dev & Ops|bitwarden|https://api.bitwarden.com|bearer|/organizations|Organizations
Snyk|Dev & Ops|snyk|https://api.snyk.io/rest|token:token|/orgs|Organizations
Sonarqube|Dev & Ops|sonarqube|https://sonarcloud.io/api|basic|/issues/search|Issues
Semgrep|Dev & Ops|semgrep|https://semgrep.dev/api/v1|bearer|/deployments|Deployments
Dependabot|Dev & Ops|dependabot|https://api.github.com|bearer|/repos|Alerts
Checkmarx|Dev & Ops|checkmarx|https://api.checkmarx.net/v1|bearer|/scans|Scans
Datadog|Analytics|datadog|https://api.datadoghq.com/api/v1|header:DD-API-KEY|/events|Events
New Relic|Analytics|newrelic|https://api.newrelic.com/v2|header:Api-Key|/applications.json|Applications
Grafana Cloud|Analytics|grafana|https://your-org.grafana.net/api|bearer|/dashboards/home|Dashboards
Prometheus|Analytics|prometheus|https://your-prometheus.example.com/api/v1|bearer|/query|Queries
Loki|Analytics|grafana|https://your-loki.example.com/loki/api/v1|bearer|/query|Logs
Honeycomb|Analytics|honeycomb|https://api.honeycomb.io/1|header:X-Honeycomb-Team|/events|Events
Lightstep|Analytics|lightstep|https://api.lightstep.com/public/v0.2|bearer|/projects|Projects
Sentry|Analytics|sentry|https://sentry.io/api/0|bearer|/projects|Projects
Rollbar|Analytics|rollbar|https://api.rollbar.com/api/1|header:X-Rollbar-Access-Token|/items|Items
Bugsnag|Analytics|bugsnag|https://api.bugsnag.com|token:token|/organizations|Organizations
Airbrake|Analytics|airbrake|https://api.airbrake.io/api/v4|bearer|/projects|Projects
LogRocket|Analytics|logrocket|https://api.logrocket.com/v1|bearer|/sessions|Sessions
FullStory|Analytics|fullstory|https://api.fullstory.com/v2|token:Basic|/sessions|Sessions
Hotjar|Analytics|hotjar|https://api.hotjar.io/v1|bearer|/sites|Sites
Mixpanel|Analytics|mixpanel|https://api.mixpanel.com|basic|/track|Events
Amplitude|Analytics|amplitude|https://api2.amplitude.com/2|bearer|/httpapi|Events
Heap|Analytics|heap|https://heapanalytics.com/api|basic|/track|Events
PostHog|Analytics|posthog|https://app.posthog.com/api|bearer|/projects|Projects
Segment|Analytics|segment|https://api.segment.io/v1|basic|/track|Events
RudderStack|Analytics|rudderstack|https://hosted.rudderlabs.com/v1|basic|/track|Events
Snowplow|Analytics|snowplow|https://your-collector.example.com|bearer|/com.snowplowanalytics.snowplow/tp2|Events
Plausible|Analytics|plausible|https://plausible.io/api/v1|bearer|/stats/aggregate|Stats
Fathom|Analytics|fathom|https://api.usefathom.com/v1|bearer|/aggregations|Aggregations
Matomo|Analytics|matomo|https://your-matomo.example.com|query:token_auth|/index.php|Reports
Simple Analytics|Analytics|simpleanalytics|https://simpleanalytics.com/api|header:Api-Key|/stats|Stats
Umami|Analytics|umami|https://your-umami.example.com/api|bearer|/websites|Websites
Google Analytics Data|Analytics|googleanalytics|https://analyticsdata.googleapis.com/v1beta|bearer|/properties|Properties
Google Search Console|Analytics|google|https://searchconsole.googleapis.com/webmasters/v3|bearer|/sites|Sites
Bing Webmaster|Analytics|bing|https://ssl.bing.com/webmaster/api.svc/json|query:apikey|/GetUrlTrafficInfo|Traffic
Ahrefs|Marketing|ahrefs|https://api.ahrefs.com/v3|bearer|/site-explorer/metrics|Metrics
Semrush|Marketing|semrush|https://api.semrush.com|query:key|/|Reports
Moz|Marketing|moz|https://lsapi.seomoz.com/v2|basic|/url_metrics|Metrics
Majestic|Marketing|majestic|https://api.majestic.com/api/json|query:app_api_key|/|Reports
SERPWatcher|Marketing|mangools|https://api.mangools.com/v3|header:X-Access-Token|/serpwatcher|Trackings
Screaming Frog|Marketing|screamingfrog|https://your-crawler.example.com/api|bearer|/crawls|Crawls
Klaviyo|Marketing|klaviyo|https://a.klaviyo.com/api|token:Klaviyo-API-Key|/profiles|Profiles
Iterable|Marketing|iterable|https://api.iterable.com/api|header:Api-Key|/users|Users
Braze|Marketing|braze|https://rest.iad-01.braze.com|bearer|/users/track|Users
OneSignal Journeys|Marketing|onesignal|https://api.onesignal.com|token:Basic|/notifications|Notifications
Attentive|Marketing|attentive|https://api.attentivemobile.com/v1|bearer|/subscribers|Subscribers
Postscript|Marketing|postscript|https://api.postscript.io/api/v2|bearer|/subscribers|Subscribers
Omnisend|Marketing|omnisend|https://api.omnisend.com/v3|header:X-API-KEY|/contacts|Contacts
Drip|Marketing|drip|https://api.getdrip.com/v2|basic|/subscribers|Subscribers
MailerLite|Marketing|mailerlite|https://connect.mailerlite.com/api|bearer|/subscribers|Subscribers
Moosend|Marketing|moosend|https://api.moosend.com/v3|query:apikey|/subscribers|Subscribers
Beehiiv|Marketing|beehiiv|https://api.beehiiv.com/v2|bearer|/publications|Publications
Substack|Marketing|substack|https://api.substack.com/api/v1|bearer|/posts|Posts
Ghost|Marketing|ghost|https://your-site.ghost.io/ghost/api/admin|bearer|/posts|Posts
Kit|Marketing|kit|https://api.kit.com/v4|header:X-Kit-Api-Key|/subscribers|Subscribers
Encharge|Marketing|encharge|https://api.encharge.io/v1|header:X-Encharge-Token|/people|People
Customerly|Marketing|customerly|https://api.customerly.io/v1|header:AUTHORIZATION|/users|Users
Vero|Marketing|vero|https://api.getvero.com/api/v2|bearer|/users/track|Users
Autopilot|Marketing|autopilot|https://api2.autopilothq.com/v1|header:autopilotapikey|/contact|Contacts
Marketo|Marketing|marketo|https://ACCOUNT.mktorest.com/rest/v1|bearer|/leads.json|Leads
Pardot|Marketing|salesforce|https://pi.pardot.com/api/v5|bearer|/objects/prospects|Prospects
Eloqua|Marketing|oracle|https://secure.eloqua.com/API/REST/2.0|basic|/data/contacts|Contacts
Unbounce|Marketing|unbounce|https://api.unbounce.com|bearer|/pages|Pages
Instapage|Marketing|instapage|https://api.instapage.com/v1|bearer|/pages|Pages
Leadpages|Marketing|leadpages|https://api.leadpages.io/v4|bearer|/pages|Pages
Webflow|Marketing|webflow|https://api.webflow.com/v2|bearer|/sites|Sites
Framer|Marketing|framer|https://api.framer.com/v1|bearer|/projects|Projects
Wix|Marketing|wix|https://www.wixapis.com|bearer|/site-list/v2/sites|Sites
WordPress|Marketing|wordpress|https://your-site.com/wp-json/wp/v2|basic|/posts|Posts
Contentful|Marketing|contentful|https://api.contentful.com/spaces/SPACE|bearer|/entries|Entries
Sanity|Marketing|sanity|https://PROJECT.api.sanity.io/v2024-01-01|bearer|/data/query/production|Documents
Storyblok|Marketing|storyblok|https://mapi.storyblok.com/v1|bearer|/spaces|Spaces
Prismic|Marketing|prismic|https://your-repo.cdn.prismic.io/api/v2|bearer|/documents|Documents
Hygraph|Marketing|hygraph|https://api.hygraph.com/v2|bearer|/content|Content
DatoCMS|Marketing|datocms|https://site-api.datocms.com|bearer|/items|Items
Payload CMS|Marketing|payloadcms|https://your-payload.example.com/api|bearer|/posts|Posts
Buttercms|Marketing|buttercms|https://api.buttercms.com/v2|query:auth_token|/pages|Pages
Kontent.ai|Marketing|kontent|https://manage.kontent.ai/v2/projects/PROJECT|bearer|/items|Items
Buffer|Social Media|buffer|https://api.bufferapp.com/1|bearer|/updates|Updates
Hootsuite|Social Media|hootsuite|https://platform.hootsuite.com/v1|bearer|/messages|Messages
Later|Social Media|later|https://api.later.com/v1|bearer|/posts|Posts
Sprout Social|Social Media|sproutsocial|https://api.sproutsocial.com/v1|bearer|/messages|Messages
Publer|Social Media|publer|https://app.publer.io/api/v1|bearer|/posts|Posts
Typefully|Social Media|typefully|https://api.typefully.com/v1|token:Bearer|/drafts|Drafts
Postiz|Social Media|postiz|https://api.postiz.com/public/v1|bearer|/posts|Posts
Ayrshare|Social Media|ayrshare|https://api.ayrshare.com/api|bearer|/post|Posts
Bluesky|Social Media|bluesky|https://bsky.social/xrpc|bearer|/com.atproto.repo.createRecord|Records
Mastodon|Social Media|mastodon|https://mastodon.social/api/v1|bearer|/statuses|Statuses
Threads|Social Media|threads|https://graph.threads.net/v1.0|bearer|/me/threads|Threads
Instagram Graph|Social Media|instagram|https://graph.facebook.com/v20.0|bearer|/me/media|Media
Facebook Pages|Social Media|facebook|https://graph.facebook.com/v20.0|bearer|/me/feed|Posts
LinkedIn|Social Media|linkedin|https://api.linkedin.com/v2|bearer|/ugcPosts|Posts
X (Twitter)|Social Media|x|https://api.twitter.com/2|bearer|/tweets|Tweets
TikTok|Social Media|tiktok|https://open.tiktokapis.com/v2|bearer|/post/publish/content/init|Posts
YouTube Data|Social Media|youtube|https://www.googleapis.com/youtube/v3|bearer|/videos|Videos
Vimeo|Social Media|vimeo|https://api.vimeo.com|bearer|/me/videos|Videos
Twitch|Social Media|twitch|https://api.twitch.tv/helix|bearer|/streams|Streams
Kick|Social Media|kick|https://kick.com/api/v2|bearer|/channels|Channels
Reddit|Social Media|reddit|https://oauth.reddit.com/api/v1|bearer|/me|Account
Pinterest|Social Media|pinterest|https://api.pinterest.com/v5|bearer|/pins|Pins
Tumblr|Social Media|tumblr|https://api.tumblr.com/v2|bearer|/user/info|Blogs
Snapchat Marketing|Social Media|snapchat|https://adsapi.snapchat.com/v1|bearer|/me|Account
Google Ads|Marketing|googleads|https://googleads.googleapis.com/v17|bearer|/customers|Customers
Meta Ads|Marketing|meta|https://graph.facebook.com/v20.0|bearer|/act_ACCOUNT/campaigns|Campaigns
LinkedIn Ads|Marketing|linkedin|https://api.linkedin.com/rest|bearer|/adAccounts|Ad Accounts
TikTok Ads|Marketing|tiktok|https://business-api.tiktok.com/open_api/v1.3|header:Access-Token|/campaign/get|Campaigns
Reddit Ads|Marketing|reddit|https://ads-api.reddit.com/api/v3|bearer|/campaigns|Campaigns
Microsoft Ads|Marketing|microsoft|https://campaign.api.bingads.microsoft.com/CampaignManagement/v13|bearer|/campaigns|Campaigns
Criteo|Marketing|criteo|https://api.criteo.com/2024-01|bearer|/campaigns|Campaigns
Taboola|Marketing|taboola|https://backstage.taboola.com/backstage/api/1.0|bearer|/campaigns|Campaigns
Outbrain|Marketing|outbrain|https://api.outbrain.com/amplify/v0.1|bearer|/campaigns|Campaigns
Shopify Admin|CRM & Commerce|shopify|https://your-store.myshopify.com/admin/api/2024-10|header:X-Shopify-Access-Token|/orders.json|Orders
Shopify Storefront|CRM & Commerce|shopify|https://your-store.myshopify.com/api/2024-10|header:X-Shopify-Storefront-Access-Token|/graphql.json|GraphQL
Shopware|CRM & Commerce|shopware|https://your-shop.example.com/api|bearer|/order|Orders
PrestaShop|CRM & Commerce|prestashop|https://your-shop.example.com/api|basic|/orders|Orders
Ecwid|CRM & Commerce|ecwid|https://app.ecwid.com/api/v3/STORE|bearer|/orders|Orders
Snipcart|CRM & Commerce|snipcart|https://app.snipcart.com/api|basic|/orders|Orders
Medusa|CRM & Commerce|medusa|https://your-medusa.example.com/admin|bearer|/orders|Orders
Saleor|CRM & Commerce|saleor|https://your-saleor.example.com/graphql|bearer|/|GraphQL
Commercetools|CRM & Commerce|commercetools|https://api.europe-west1.gcp.commercetools.com/PROJECT|bearer|/orders|Orders
Vtex|CRM & Commerce|vtex|https://ACCOUNT.vtexcommercestable.com.br/api|header:X-VTEX-API-AppKey|/oms/pvt/orders|Orders
Salesla|CRM & Commerce|salesforce|https://your-org.my.salesforce.com/services/data/v60.0|bearer|/sobjects/Opportunity|Opportunities
HubSpot CRM|CRM & Commerce|hubspot|https://api.hubapi.com/crm/v3|bearer|/objects/contacts|Contacts
Salesflare|CRM & Commerce|salesflare|https://api.salesflare.com|header:Authorization|/contacts|Contacts
Nutshell|CRM & Commerce|nutshell|https://app.nutshell.com/api/v1|basic|/json|Leads
Capsule CRM|CRM & Commerce|capsule|https://api.capsulecrm.com/api/v2|bearer|/parties|Parties
Streak|CRM & Commerce|streak|https://www.streak.com/api/v1|basic|/pipelines|Pipelines
Folk|CRM & Commerce|folk|https://api.folk.app/v1|bearer|/people|People
Twenty CRM|CRM & Commerce|twenty|https://api.twenty.com/rest|bearer|/people|People
EspoCRM|CRM & Commerce|espocrm|https://your-espo.example.com/api/v1|basic|/Contact|Contacts
SuiteCRM|CRM & Commerce|suitecrm|https://your-suite.example.com/Api/V8|bearer|/module/Contacts|Contacts
Vtiger|CRM & Commerce|vtiger|https://your-org.od2.vtiger.com/restapi/v1/vtiger/default|basic|/query|Records
Apollo.io|CRM & Commerce|apollo|https://api.apollo.io/v1|header:X-Api-Key|/contacts|Contacts
Clearbit|CRM & Commerce|clearbit|https://person.clearbit.com/v2|bearer|/people/find|People
ZoomInfo|CRM & Commerce|zoominfo|https://api.zoominfo.com|bearer|/search/contact|Contacts
Lusha|CRM & Commerce|lusha|https://api.lusha.com|header:api_key|/person|People
Cognism|CRM & Commerce|cognism|https://app.cognism.com/api/v1|bearer|/contacts|Contacts
Dropcontact|CRM & Commerce|dropcontact|https://api.dropcontact.io/v1|header:X-Access-Token|/enrich/all|Enrichments
Snov.io|CRM & Commerce|snov|https://api.snov.io/v1|bearer|/get-profile-by-email|Profiles
Outreach|CRM & Commerce|outreach|https://api.outreach.io/api/v2|bearer|/prospects|Prospects
Salesloft|CRM & Commerce|salesloft|https://api.salesloft.com/v2|bearer|/people|People
Reply.io|CRM & Commerce|reply|https://api.reply.io/v1|header:X-Api-Key|/people|People
Lemlist|CRM & Commerce|lemlist|https://api.lemlist.com/api|basic|/campaigns|Campaigns
Instantly|CRM & Commerce|instantly|https://api.instantly.ai/api/v2|bearer|/campaigns|Campaigns
Smartlead|CRM & Commerce|smartlead|https://server.smartlead.ai/api/v1|query:api_key|/campaigns|Campaigns
PandaDoc|CRM & Commerce|pandadoc|https://api.pandadoc.com/public/v1|token:API-Key|/documents|Documents
DocuSign|CRM & Commerce|docusign|https://demo.docusign.net/restapi/v2.1|bearer|/accounts|Envelopes
Dropbox Sign|CRM & Commerce|dropbox|https://api.hellosign.com/v3|basic|/signature_request/list|Signature Requests
SignNow|CRM & Commerce|signnow|https://api.signnow.com|bearer|/document|Documents
Adobe Sign|CRM & Commerce|adobe|https://api.na1.adobesign.com/api/rest/v6|bearer|/agreements|Agreements
Proposify|CRM & Commerce|proposify|https://api.proposify.com/v1|header:Authorization|/documents|Documents
Qwilr|CRM & Commerce|qwilr|https://api.qwilr.com/v1|bearer|/projects|Projects
Better Proposals|CRM & Commerce|betterproposals|https://api.betterproposals.io/v1|bearer|/proposals|Proposals
Typeform|Forms & Surveys|typeform|https://api.typeform.com|bearer|/forms|Forms
Tally|Forms & Surveys|tally|https://api.tally.so|bearer|/forms|Forms
Fillout|Forms & Surveys|fillout|https://api.fillout.com/v1/api|bearer|/forms|Forms
Formstack|Forms & Surveys|formstack|https://www.formstack.com/api/v2|bearer|/form.json|Forms
Wufoo|Forms & Surveys|wufoo|https://YOURNAME.wufoo.com/api/v3|basic|/forms.json|Forms
Cognito Forms|Forms & Surveys|cognitoforms|https://www.cognitoforms.com/api/forms|bearer|/|Forms
Paperform|Forms & Surveys|paperform|https://api.paperform.co/v1|bearer|/forms|Forms
Formbricks|Forms & Surveys|formbricks|https://app.formbricks.com/api/v1|header:x-api-key|/management/surveys|Surveys
SurveySparrow|Forms & Surveys|surveysparrow|https://api.surveysparrow.com/v3|bearer|/surveys|Surveys
Qualtrics|Forms & Surveys|qualtrics|https://YOURDC.qualtrics.com/API/v3|header:X-API-TOKEN|/surveys|Surveys
Alchemer|Forms & Surveys|alchemer|https://api.alchemer.com/v5|query:api_token|/survey|Surveys
Delighted|Forms & Surveys|delighted|https://api.delighted.com/v1|basic|/survey_responses.json|Responses
Refiner|Forms & Surveys|refiner|https://api.refiner.io/v1|bearer|/responses|Responses
Sprig|Forms & Surveys|sprig|https://api.sprig.com/v2|bearer|/surveys|Surveys
Canny|Forms & Surveys|canny|https://canny.io/api/v1|bearer|/posts/list|Posts
Featurebase|Forms & Surveys|featurebase|https://do.featurebase.app/v2|header:X-API-Key|/posts|Posts
Productboard|Forms & Surveys|productboard|https://api.productboard.com|bearer|/notes|Notes
Nolt|Forms & Surveys|nolt|https://api.nolt.io/v1|bearer|/boards|Boards
Frill|Forms & Surveys|frill|https://api.frill.co/v1|bearer|/ideas|Ideas
Upvoty|Forms & Surveys|upvoty|https://api.upvoty.com/v1|bearer|/posts|Posts
Google Drive|Cloud & Storage|googledrive|https://www.googleapis.com/drive/v3|bearer|/files|Files
Dropbox|Cloud & Storage|dropbox|https://api.dropboxapi.com/2|bearer|/files/list_folder|Files
Box|Cloud & Storage|box|https://api.box.com/2.0|bearer|/folders|Folders
OneDrive|Cloud & Storage|microsoftonedrive|https://graph.microsoft.com/v1.0/me/drive|bearer|/root/children|Files
pCloud|Cloud & Storage|pcloud|https://api.pcloud.com|query:access_token|/listfolder|Folders
Backblaze B2|Cloud & Storage|backblaze|https://api.backblazeb2.com/b2api/v3|bearer|/b2_list_buckets|Buckets
Wasabi|Cloud & Storage|wasabi|https://s3.wasabisys.com|bearer|/|Buckets
Storj|Cloud & Storage|storj|https://gateway.storjshare.io|bearer|/|Buckets
Filebase|Cloud & Storage|filebase|https://api.filebase.io/v1|bearer|/buckets|Buckets
Uploadcare|Cloud & Storage|uploadcare|https://api.uploadcare.com|token:Uploadcare.Simple|/files|Files
Cloudinary|Cloud & Storage|cloudinary|https://api.cloudinary.com/v1_1/CLOUD|basic|/resources/image|Assets
imgix|Cloud & Storage|imgix|https://api.imgix.com/api/v1|bearer|/sources|Sources
Bunny.net|Cloud & Storage|bunny|https://api.bunny.net|header:AccessKey|/storagezone|Storage Zones
UploadThing|Cloud & Storage|uploadthing|https://api.uploadthing.com/v6|header:X-Uploadthing-Api-Key|/listFiles|Files
Mux|Cloud & Storage|mux|https://api.mux.com/video/v1|basic|/assets|Assets
Cloudflare Stream|Cloud & Storage|cloudflare|https://api.cloudflare.com/client/v4/accounts/ACCOUNT/stream|bearer|/|Videos
api.video|Cloud & Storage|apivideo|https://ws.api.video|bearer|/videos|Videos
Bannerbear|Utilities|bannerbear|https://api.bannerbear.com/v2|bearer|/images|Images
Placid|Utilities|placid|https://api.placid.app/api/rest|bearer|/images|Images
Abyssale|Utilities|abyssale|https://api.abyssale.com|header:x-api-key|/banner-builder|Banners
HTMLCSStoImage|Utilities|html5|https://hcti.io/v1|basic|/image|Images
PDFMonkey|Utilities|pdfmonkey|https://api.pdfmonkey.io/api/v1|bearer|/documents|Documents
DocRaptor|Utilities|docraptor|https://docraptor.com|basic|/docs|Documents
PDFShift|Utilities|pdfshift|https://api.pdfshift.io/v3|basic|/convert/pdf|Conversions
Api2Pdf|Utilities|adobeacrobatreader|https://v2.api2pdf.com|header:Authorization|/chrome/pdf/url|Conversions
CloudConvert|Utilities|cloudconvert|https://api.cloudconvert.com/v2|bearer|/jobs|Jobs
ConvertAPI|Utilities|convertapi|https://v2.convertapi.com|bearer|/convert|Conversions
Zamzar|Utilities|zamzar|https://sandbox.zamzar.com/v1|basic|/jobs|Jobs
Documenso|Utilities|documenso|https://app.documenso.com/api/v1|header:Authorization|/documents|Documents
Stirling PDF|Utilities|stirling|https://your-stirling.example.com/api/v1|bearer|/general/merge-pdfs|Documents
Deepgram|Utilities|deepgram|https://api.deepgram.com/v1|token:Token|/listen|Transcripts
AssemblyAI|Utilities|assemblyai|https://api.assemblyai.com/v2|header:Authorization|/transcript|Transcripts
Rev.ai|Utilities|rev|https://api.rev.ai/speechtotext/v1|bearer|/jobs|Jobs
Speechmatics|Utilities|speechmatics|https://asr.api.speechmatics.com/v2|bearer|/jobs|Jobs
ElevenLabs|Utilities|elevenlabs|https://api.elevenlabs.io/v1|header:xi-api-key|/text-to-speech|Speech
PlayHT|Utilities|playht|https://api.play.ht/api/v2|bearer|/tts|Speech
Cartesia|Utilities|cartesia|https://api.cartesia.ai|header:X-API-Key|/tts/bytes|Speech
Resemble AI|Utilities|resemble|https://app.resemble.ai/api/v2|bearer|/projects|Projects
Murf|Utilities|murf|https://api.murf.ai/v1|header:api-key|/speech/generate|Speech
LMNT|Utilities|lmnt|https://api.lmnt.com/v1|header:X-API-Key|/ai/speech|Speech
Stability AI|Utilities|stabilityai|https://api.stability.ai/v2beta|bearer|/stable-image/generate/core|Images
Leonardo AI|Utilities|leonardo|https://cloud.leonardo.ai/api/rest/v1|bearer|/generations|Generations
Ideogram|Utilities|ideogram|https://api.ideogram.ai|header:Api-Key|/generate|Generations
Fal.ai|Utilities|fal|https://fal.run|token:Key|/fal-ai/flux|Generations
Recraft|Utilities|recraft|https://external.api.recraft.ai/v1|bearer|/images/generations|Images
Clipdrop|Utilities|clipdrop|https://clipdrop-api.co|header:x-api-key|/remove-background/v1|Images
Photoroom|Utilities|photoroom|https://sdk.photoroom.com/v1|header:x-api-key|/segment|Images
Runway|Utilities|runway|https://api.dev.runwayml.com/v1|bearer|/image_to_video|Videos
Luma AI|Utilities|luma|https://api.lumalabs.ai/dream-machine/v1|bearer|/generations|Generations
HeyGen|Utilities|heygen|https://api.heygen.com/v2|header:X-Api-Key|/video/generate|Videos
Synthesia|Utilities|synthesia|https://api.synthesia.io/v2|header:Authorization|/videos|Videos
D-ID|Utilities|did|https://api.d-id.com|basic|/talks|Talks
Tavus|Utilities|tavus|https://tavusapi.com/v2|header:x-api-key|/videos|Videos
Creatomate|Utilities|creatomate|https://api.creatomate.com/v1|bearer|/renders|Renders
Shotstack|Utilities|shotstack|https://api.shotstack.io/edit/v1|header:x-api-key|/render|Renders
JSON2Video|Utilities|json|https://api.json2video.com/v2|header:x-api-key|/movies|Movies
Descript|Utilities|descript|https://api.descript.com/v1|bearer|/projects|Projects
Vizard|Utilities|vizard|https://elb-api.vizard.ai/hvng/v1|header:VIZARDAI_API_KEY|/project|Projects
OpenCage Geocoding|Utilities|opencage|https://api.opencagedata.com/geocode/v1|query:key|/json|Locations
Mapbox|Utilities|mapbox|https://api.mapbox.com|query:access_token|/geocoding/v5/mapbox.places|Places
Google Maps|Utilities|googlemaps|https://maps.googleapis.com/maps/api|query:key|/geocode/json|Locations
HERE Maps|Utilities|here|https://geocode.search.hereapi.com/v1|query:apiKey|/geocode|Locations
TomTom|Utilities|tomtom|https://api.tomtom.com/search/2|query:key|/geocode|Locations
Positionstack|Utilities|positionstack|http://api.positionstack.com/v1|query:access_key|/forward|Locations
IPinfo|Utilities|ipinfo|https://ipinfo.io|bearer|/json|Lookups
IPStack|Utilities|ipstack|http://api.ipstack.com|query:access_key|/check|Lookups
AbstractAPI|Utilities|abstract|https://ipgeolocation.abstractapi.com/v1|query:api_key|/|Lookups
NumVerify|Utilities|numverify|http://apilayer.net/api|query:access_key|/validate|Validations
Twilio Lookup|Utilities|twilio|https://lookups.twilio.com/v2|basic|/PhoneNumbers|Lookups
OpenWeather|Utilities|openweather|https://api.openweathermap.org/data/2.5|query:appid|/weather|Weather
WeatherAPI|Utilities|weatherapi|https://api.weatherapi.com/v1|query:key|/current.json|Weather
Tomorrow.io|Utilities|tomorrow|https://api.tomorrow.io/v4|query:apikey|/weather/realtime|Weather
Visual Crossing|Utilities|visualcrossing|https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services|query:key|/timeline|Weather
AirVisual|Utilities|iqair|https://api.airvisual.com/v2|query:key|/nearest_city|Air Quality
NASA APIs|Utilities|nasa|https://api.nasa.gov|query:api_key|/planetary/apod|Data
Alpha Vantage|Utilities|alphavantage|https://www.alphavantage.co|query:apikey|/query|Series
Finnhub|Utilities|finnhub|https://finnhub.io/api/v1|header:X-Finnhub-Token|/quote|Quotes
Polygon.io|Utilities|polygon|https://api.polygon.io/v2|bearer|/aggs/ticker|Aggregates
Twelve Data|Utilities|twelvedata|https://api.twelvedata.com|query:apikey|/time_series|Series
Marketstack|Utilities|marketstack|http://api.marketstack.com/v1|query:access_key|/eod|Prices
Financial Modeling Prep|Utilities|fmp|https://financialmodelingprep.com/api/v3|query:apikey|/quote|Quotes
CoinMarketCap|Utilities|coinmarketcap|https://pro-api.coinmarketcap.com/v1|header:X-CMC_PRO_API_KEY|/cryptocurrency/quotes/latest|Quotes
CoinGecko Pro|Utilities|coingecko|https://pro-api.coingecko.com/api/v3|header:x-cg-pro-api-key|/coins/markets|Markets
Binance|Utilities|binance|https://api.binance.com/api/v3|header:X-MBX-APIKEY|/ticker/price|Prices
Kraken|Utilities|kraken|https://api.kraken.com/0/public|header:API-Key|/Ticker|Tickers
Coinbase|Utilities|coinbase|https://api.coinbase.com/v2|bearer|/accounts|Accounts
Etherscan|Utilities|ethereum|https://api.etherscan.io/api|query:apikey|/|Transactions
Alchemy Web3|Utilities|alchemy|https://eth-mainnet.g.alchemy.com/v2|bearer|/|RPC
Infura|Utilities|infura|https://mainnet.infura.io/v3|bearer|/|RPC
Moralis|Utilities|moralis|https://deep-index.moralis.io/api/v2.2|header:X-API-Key|/wallets|Wallets
Thirdweb|Utilities|thirdweb|https://api.thirdweb.com/v1|header:x-secret-key|/contracts|Contracts
QuickNode|Utilities|quicknode|https://your-endpoint.quiknode.pro|bearer|/|RPC
Helius|Utilities|solana|https://api.helius.xyz/v0|query:api-key|/addresses|Addresses
OpenSea|Utilities|opensea|https://api.opensea.io/api/v2|header:X-API-KEY|/collections|Collections
DeepL|Utilities|deepl|https://api-free.deepl.com/v2|token:DeepL-Auth-Key|/translate|Translations
Google Translate|Utilities|googletranslate|https://translation.googleapis.com/language/translate/v2|bearer|/|Translations
Lokalise|Utilities|lokalise|https://api.lokalise.com/api2|header:X-Api-Token|/projects|Projects
Crowdin|Utilities|crowdin|https://api.crowdin.com/api/v2|bearer|/projects|Projects
Phrase|Utilities|phrase|https://api.phrase.com/v2|token:token|/projects|Projects
Weglot|Utilities|weglot|https://api.weglot.com|query:api_key|/translate|Translations
LanguageTool|Utilities|languagetool|https://api.languagetoolplus.com/v2|bearer|/check|Checks
Grammarly Business|Utilities|grammarly|https://api.grammarly.com/v1|bearer|/checks|Checks
Copyleaks|Utilities|copyleaks|https://api.copyleaks.com/v3|bearer|/scans|Scans
Originality.ai|Utilities|originality|https://api.originality.ai/api/v1|header:X-OAI-API-KEY|/scan/ai|Scans
GPTZero|Utilities|gptzero|https://api.gptzero.me/v2|header:x-api-key|/predict/text|Predictions
Perspective API|Utilities|google|https://commentanalyzer.googleapis.com/v1alpha1|query:key|/comments:analyze|Analyses
Sightengine|Utilities|sightengine|https://api.sightengine.com/1.0|query:api_user|/check.json|Checks
Hive Moderation|Utilities|hive|https://api.thehive.ai/api/v2|token:Token|/task/sync|Tasks
Cloudmersive|Utilities|cloudmersive|https://api.cloudmersive.com|header:Apikey|/validate/email/address/full|Validations
Have I Been Pwned|Utilities|haveibeenpwned|https://haveibeenpwned.com/api/v3|header:hibp-api-key|/breachedaccount|Breaches
VirusTotal|Utilities|virustotal|https://www.virustotal.com/api/v3|header:x-apikey|/urls|Scans
URLScan.io|Utilities|urlscan|https://urlscan.io/api/v1|header:API-Key|/scan|Scans
Shodan|Utilities|shodan|https://api.shodan.io|query:key|/shodan/host/search|Hosts
Censys|Utilities|censys|https://search.censys.io/api/v2|basic|/hosts/search|Hosts
SecurityTrails|Utilities|securitytrails|https://api.securitytrails.com/v1|header:APIKEY|/domain|Domains
WhoisXML|Utilities|whois|https://www.whoisxmlapi.com/whoisserver|query:apiKey|/WhoisService|Records
DNSimple|Utilities|dnsimple|https://api.dnsimple.com/v2|bearer|/domains|Domains
Namecheap|Utilities|namecheap|https://api.namecheap.com/xml.response|query:ApiKey|/|Domains
Porkbun|Utilities|porkbun|https://api.porkbun.com/api/json/v3|bearer|/domain/listAll|Domains
GoDaddy|Utilities|godaddy|https://api.godaddy.com/v1|token:sso-key|/domains|Domains
Gandi|Utilities|gandi|https://api.gandi.net/v5|token:Apikey|/domain/domains|Domains
Route 53|Utilities|amazonroute53|https://route53.amazonaws.com/2013-04-01|bearer|/hostedzone|Hosted Zones
UptimeRobot|Analytics|uptimerobot|https://api.uptimerobot.com/v2|bearer|/getMonitors|Monitors
Better Stack|Analytics|betterstack|https://uptime.betterstack.com/api/v2|bearer|/monitors|Monitors
Pingdom|Analytics|pingdom|https://api.pingdom.com/api/3.1|bearer|/checks|Checks
StatusCake|Analytics|statuscake|https://api.statuscake.com/v1|bearer|/uptime|Tests
Checkly|Analytics|checkly|https://api.checklyhq.com/v1|bearer|/checks|Checks
Cronitor|Analytics|cronitor|https://cronitor.io/api|basic|/monitors|Monitors
Healthchecks.io|Analytics|healthchecks|https://healthchecks.io/api/v3|header:X-Api-Key|/checks|Checks
Statuspage|Analytics|atlassian|https://api.statuspage.io/v1|token:OAuth|/pages|Pages
Instatus|Analytics|instatus|https://api.instatus.com/v1|bearer|/pages|Pages
Opsgenie|Dev & Ops|opsgenie|https://api.opsgenie.com/v2|token:GenieKey|/alerts|Alerts
Splunk On-Call|Dev & Ops|splunk|https://api.victorops.com/api-public/v1|header:X-VO-Api-Key|/incidents|Incidents
FireHydrant|Dev & Ops|firehydrant|https://api.firehydrant.io/v1|bearer|/incidents|Incidents
incident.io|Dev & Ops|incidentdotio|https://api.incident.io/v2|bearer|/incidents|Incidents
Rootly|Dev & Ops|rootly|https://api.rootly.com/v1|bearer|/incidents|Incidents
Blameless|Dev & Ops|blameless|https://your-org.blameless.io/api/v1|bearer|/incidents|Incidents
Squadcast|Dev & Ops|squadcast|https://api.squadcast.com/v3|bearer|/incidents|Incidents
Grafana OnCall|Dev & Ops|grafana|https://oncall-prod.grafana.net/oncall/api/v1|header:Authorization|/alert_groups|Alerts
Airtable Web API|Data|airtable|https://api.airtable.com/v0|bearer|/BASE/TABLE|Records
Google Sheets|Data|googlesheets|https://sheets.googleapis.com/v4/spreadsheets|bearer|/SHEETID/values/A1:Z1000|Values
Excel Online|Data|microsoftexcel|https://graph.microsoft.com/v1.0/me/drive/items/ITEM/workbook|bearer|/worksheets|Worksheets
Quickbase|Data|quickbase|https://api.quickbase.com/v1|token:QB-USER-TOKEN|/records|Records
Knack|Data|knack|https://api.knack.com/v1|header:X-Knack-REST-API-Key|/objects|Objects
Fibery|Data|fibery|https://your-org.fibery.io/api|bearer|/commands|Entities
Stackby|Data|stackby|https://stackby.com/api/betav1|header:api-key|/rowlist|Rows
Teable|Data|teable|https://app.teable.io/api|bearer|/table|Tables
Softr|Data|softr|https://studio-api.softr.io/v1|header:Softr-Api-Key|/applications|Applications
Glide|Data|glide|https://api.glideapps.com|bearer|/tables|Tables
Bubble|Data|bubble|https://your-app.bubbleapps.io/api/1.1|bearer|/obj|Objects
Xano|Data|xano|https://your-instance.xano.io/api:v1|bearer|/records|Records
Supabase REST|Data|supabase|https://your-project.supabase.co/rest/v1|bearer|/table|Rows
JSONBin|Data|json|https://api.jsonbin.io/v3|header:X-Master-Key|/b|Bins
Restdb.io|Data|restdb|https://your-db.restdb.io/rest|header:x-apikey|/collection|Documents
Sheety|Data|json|https://api.sheety.co|bearer|/project|Rows
SheetDB|Data|json|https://sheetdb.io/api/v1|bearer|/ID|Rows
Cloudflare D1|Data|cloudflare|https://api.cloudflare.com/client/v4/accounts/ACCOUNT/d1|bearer|/database|Databases
Tinybird|Data|tinybird|https://api.tinybird.co/v0|bearer|/pipes|Pipes
Estuary Flow|Data|estuary|https://api.estuary.dev/v1|bearer|/catalog|Collections
Fivetran|Data|fivetran|https://api.fivetran.com/v1|basic|/connectors|Connectors
Airbyte|Data|airbyte|https://api.airbyte.com/v1|bearer|/connections|Connections
Stitch|Data|stitch|https://api.stitchdata.com/v4|bearer|/sources|Sources
Hevo|Data|hevodata|https://us.hevodata.com/api/public/v2.0|basic|/pipelines|Pipelines
Meltano|Data|meltano|https://your-meltano.example.com/api/v1|bearer|/pipelines|Pipelines
dbt Cloud|Data|dbt|https://cloud.getdbt.com/api/v2|token:Token|/accounts|Accounts
Dagster Cloud|Data|dagster|https://your-org.dagster.cloud/prod/graphql|bearer|/|Runs
Prefect Cloud|Data|prefect|https://api.prefect.cloud/api|bearer|/flow_runs|Flow Runs
Airflow|Data|apacheairflow|https://your-airflow.example.com/api/v1|basic|/dags|DAGs
Temporal Cloud|Data|temporal|https://your-ns.tmprl.cloud/api/v1|bearer|/workflows|Workflows
Inngest|Data|inngest|https://api.inngest.com/v1|bearer|/events|Events
Trigger.dev|Data|triggerdotdev|https://api.trigger.dev/api/v1|bearer|/runs|Runs
Defer|Data|defer|https://api.defer.run/public/v2|bearer|/executions|Executions
Hookdeck|Data|hookdeck|https://api.hookdeck.com/2024-03-01|bearer|/events|Events
Svix|Data|svix|https://api.svix.com/api/v1|bearer|/app|Applications
Convoy|Data|convoy|https://dashboard.getconvoy.io/api/v1|bearer|/events|Events
Webhook Relay|Data|webhookrelay|https://my.webhookrelay.com/v1|bearer|/buckets|Buckets
Pipedream Sources|Data|pipedream|https://api.pipedream.com/v1|bearer|/sources|Sources
Ably|Data|ably|https://rest.ably.io|basic|/channels|Channels
Pusher|Data|pusher|https://api-eu.pusher.com/apps/APPID|bearer|/events|Events
PubNub|Data|pubnub|https://ps.pndsn.com/publish|bearer|/|Messages
Centrifugo|Data|centrifugo|https://your-centrifugo.example.com/api|token:apikey|/publish|Messages
Liveblocks|Data|liveblocks|https://api.liveblocks.io/v2|bearer|/rooms|Rooms
PartyKit|Data|partykit|https://your-party.partykit.dev/party|bearer|/main|Rooms
Soketi|Data|soketi|https://your-soketi.example.com/apps/APPID|bearer|/events|Events
`;

const slug = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join("");

const APPS2: Record<string, Entry> = {};

for (const line of RAW.split("\n")) {
  const row = line.trim();
  if (!row) continue;
  const [name, group, icon, baseUrl, auth, resource, label] = row.split("|");
  if (!name || !group || !baseUrl) continue;
  let kind = slug(name);
  if (APP_KEYS.has(kind) || APPS2[kind]) kind = `${kind}Api`;
  if (APP_KEYS.has(kind) || APPS2[kind]) continue;
  APPS2[kind] = [
    name,
    group as NodeGroup,
    icon ?? "globe",
    baseUrl,
    auth ?? "bearer",
    resource ?? "/",
    label ?? "Records",
  ];
}

export const catalogAppNodes2: NodeModule[] = buildCatalog(APPS2);
