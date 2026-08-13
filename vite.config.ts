/**
 * Vite config for n9n — TanStack Start + Nitro targeting **Cloudflare Pages**.
 *
 * The Lovable sandbox wrapper (`@lovable.dev/vite-tanstack-config`) is used when
 * it is installed (local/Lovable dev). On external CI such as Cloudflare Pages the
 * package may not be installed at all — in that case we fall back to an equivalent
 * plain-Vite config so `npm run build` never fails with UNRESOLVED_IMPORT.
 */
import type { UserConfig } from "vite";

const tanstackStartOptions = {
  // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
  server: { entry: "server" },
} as const;

const nitroOptions = {
  // Cloudflare PAGES (not Workers): ./dist with `_worker.js/`, `_routes.json`, `_headers`.
  preset: "cloudflare-pages",
} as const;

async function loadLovableConfig(env: any): Promise<UserConfig | undefined> {
  if (process.env["CF_PAGES"] || process.env["SKIP_LOVABLE_VITE_CONFIG"]) return undefined;
  try {
    const mod = await import(
      /* @vite-ignore */ "@lovable.dev/vite-tanstack-config"
    );
    const cfg = mod.defineConfig({
      tanstackStart: tanstackStartOptions,
      nitro: nitroOptions,
    }) as unknown;
    const resolved = typeof cfg === "function" ? await (cfg as any)(env) : await cfg;
    return resolved as UserConfig;
  } catch {
    return undefined;
  }
}

async function standaloneConfig(command: string): Promise<UserConfig> {
  const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");
  const viteReact = (await import("@vitejs/plugin-react")).default;
  const tailwindcss = (await import("@tailwindcss/vite")).default;
  const tsConfigPaths = (await import("vite-tsconfig-paths")).default;

  const plugins: any[] = [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(tanstackStartOptions as any),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro(nitroOptions as any));
  }

  plugins.push(viteReact());

  return {
    plugins,
    server: { host: "::", port: 8080 },
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
    },
  };
}

export default async (env: { command: string; mode: string }): Promise<UserConfig> => {
  const lovable = await loadLovableConfig(env);
  if (lovable) return lovable;
  return standaloneConfig(env.command);
};
