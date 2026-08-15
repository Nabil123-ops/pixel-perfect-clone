import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NodePicker } from "@/components/flow/NodePicker";
import type { FlowNodeKind } from "@/lib/flow/types";

export type AddNodeEdgeData = {
  onInsert: (edgeId: string, kind: FlowNodeKind) => void;
  onRemove: (edgeId: string) => void;
};

/**
 * Plain (non-animated, non-dashed) connector with a "+" button on its
 * midpoint. Clicking it opens a node picker to insert a new node right
 * on that connection, splitting it into source -> new -> target.
 */
export function AddNodeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [open, setOpen] = useState(false);
  const edgeData = data as unknown as AddNodeEdgeData | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan group flex items-center gap-1"
        >
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                aria-label="Add node on this connection"
                className="grid size-6 place-items-center rounded-full border border-primary/50 bg-card text-primary shadow-sm transition-all hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto border-border p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <NodePicker
                onPick={(kind) => {
                  setOpen(false);
                  edgeData?.onInsert(id, kind);
                }}
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={(e) => {
              e.stopPropagation();
              edgeData?.onRemove(id);
            }}
            aria-label="Remove connection"
            className="grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-all hover:border-destructive hover:text-destructive group-hover:opacity-100"
            title="Remove connection"
          >
            <X className="size-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
