import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NodeIcon } from "@/components/flow/NodeIcon";
import { NODE_GROUPS } from "@/lib/nodes/registry";
import { searchCatalog } from "@/lib/flow/catalog";
import type { FlowNodeKind } from "@/lib/flow/types";

/**
 * Search + grouped list used to pick a node to add.
 * Shared by the sidebar and the "+" button on edges/handles.
 */
export function NodePicker({
  onPick,
  autoFocus = true,
}: {
  onPick: (kind: FlowNodeKind) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("All");

  const groupedNodes = useMemo(() => {
    const specs = searchCatalog(query, group);
    const map = new Map<string, typeof specs>();
    specs.forEach((s) => map.set(s.group, [...(map.get(s.group) ?? []), s]));
    return [...map.entries()];
  }, [query, group]);

  return (
    <div className="flex h-[360px] w-[260px] flex-col">
      <div className="space-y-2 border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes"
            className="h-8 pl-8 text-xs"
            aria-label="Search nodes"
            autoFocus={autoFocus}
          />
        </div>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {NODE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groupedNodes.map(([groupName, specs]) => (
          <div key={groupName} className="mb-3">
            <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {groupName}
            </p>
            {specs.map((s) => (
              <button
                key={s.kind}
                onClick={() => onPick(s.kind as FlowNodeKind)}
                className="group mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
              >
                <NodeIcon icon={s.icon} className="size-3.5 shrink-0" />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        ))}
        {groupedNodes.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">No nodes match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
