/**
 * Cloudflare Pages post-build guard.
 *
 * Nitro writes `dist/_worker.js/wrangler.json` after the build and merges any
 * root wrangler config into it. Cloudflare Pages rejects a few Workers-only
 * keys — most notably an assets binding named `ASSETS`:
 *
 *   ✘ [ERROR] The name 'ASSETS' is reserved in Pages projects.
 *
 * This script sanitises the generated file so a Pages deploy can never fail on
 * that class of error. It is intentionally defensive: if the file is missing
 * (e.g. a Workers build), it just exits quietly.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), "dist/_worker.js/wrangler.json");

if (!existsSync(target)) {
  console.log("[cf-pages] no dist/_worker.js/wrangler.json — nothing to sanitise");
  process.exit(0);
}

const config = JSON.parse(readFileSync(target, "utf8"));

// Workers-only keys that are invalid or reserved in a Pages project.
const FORBIDDEN = [
  "assets",
  "main",
  "routes",
  "route",
  "triggers",
  "workers_dev",
  "site",
  "durable_objects",
  "migrations",
];

const removed = [];
for (const key of FORBIDDEN) {
  if (key in config) {
    delete config[key];
    removed.push(key);
  }
}

// Pages requires this and expects it relative to the wrangler.json location.
config.pages_build_output_dir = "..";

writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);

console.log(
  removed.length
    ? `[cf-pages] sanitised wrangler.json (removed: ${removed.join(", ")})`
    : "[cf-pages] wrangler.json already Pages-safe",
);
