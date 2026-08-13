import { Link, useRouterState } from "@tanstack/react-router";
import { Home, User, LayoutTemplate, KeyRound, Activity, Zap, Infinity as InfinityIcon } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/workflows", label: "Personal", icon: User },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/credentials", label: "Credentials", icon: KeyRound },
  { to: "/executions", label: "Executions", icon: Activity },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="flex w-[224px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <Link to="/" className="flex items-center gap-2.5 px-4 py-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Zap className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-bold leading-none tracking-tight">n9n</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              automation cloud
            </span>
          </span>
        </Link>

        <nav className="mt-2 flex flex-col gap-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-3">
          <div className="rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-3">
            <p className="flex items-center gap-1.5 font-display text-xs font-semibold">
              <InfinityIcon className="size-3.5 text-primary" /> Unlimited plan
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Unlimited workflows, executions, active triggers and credentials. Forever.
            </p>
          </div>
          <p className="px-1 text-[10px] text-muted-foreground">Runs on the server — triggers keep firing after you close the tab.</p>
          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
            Created with <span className="text-destructive">♥</span> by Nabil Dahdouh
            <br />© {new Date().getFullYear()} All rights reserved.
          </p>

        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border px-8 pb-5 pt-7">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
