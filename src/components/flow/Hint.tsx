import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Hover explanation. Wraps any element and describes what it does the moment
 * the pointer rests on it — no click required.
 */
export function Hint({
  children,
  title,
  text,
  side = "bottom",
  asChild = true,
}: {
  children: ReactNode;
  title?: string;
  text: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  asChild?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-[280px] text-left">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        <p className="text-[11px] leading-relaxed opacity-90">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
