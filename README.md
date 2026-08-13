# Unlimited Workflow Builder

make the website https://github.com/n8n-io/n8n.git   and clone anything and let it work and to have anything unlimited and don't include pticving and rename it and and have anything unlimited and free real working real page not just mockup at all gh repo clone n8n-io/n8n    let anything work high end and real anything

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7b3864a3-3fe2-4af5-902c-db25f1522525).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploying to Cloudflare Pages

This project is configured for **Cloudflare Pages** (not Workers).

Pages project settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 |

What makes the Pages build work:

- `vite.config.ts` pins `nitro: { preset: "cloudflare-pages" }`, so the build emits
  `dist/_worker.js/`, `dist/_routes.json`, `dist/_headers`, `dist/_redirects` and the
  hashed static assets straight into `dist/` (served from the Pages CDN, not the worker).
- `wrangler.toml` is a **Pages** config: it declares `pages_build_output_dir = "dist"`
  and contains no `[assets]` binding, no `[[routes]]`, and no `[triggers]`.
  An `[assets]` block with `binding = "ASSETS"` is what caused
  `The name 'ASSETS' is reserved in Pages projects`.
- `scripts/cf-pages-postbuild.mjs` runs after every build and strips any Workers-only
  key that could sneak back into the generated `dist/_worker.js/wrangler.json`.

Environment:

- Non-secret vars live in `wrangler.toml` under `[vars]`.
- Secrets go in the Pages dashboard (Settings → Variables and Secrets) for both
  Production and Preview: `APP_SUPABASE_SERVICE_ROLE_KEY`,
  `CREDENTIAL_ENCRYPTION_KEY`, `LOVABLE_API_KEY`.
- `VITE_*` values are inlined at build time, so they must also exist as build
  environment variables in the Pages project.

Scheduled workflows: Pages has no cron triggers. Point an external scheduler
(Cloudflare Workers Cron, Supabase `pg_cron`, or any uptime pinger) at
`https://<your-domain>/api/public/hooks/tick` once a minute.

Custom domains (`eweblb.com`, `www.eweblb.com`) are attached in the Pages
dashboard under Custom domains.
