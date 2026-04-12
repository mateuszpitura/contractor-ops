"use client";

import { formatDistanceToNow } from "date-fns";
import { ShieldCheck } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KsefSourceBadgeProps {
  fetchedAt?: string | Date | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KsefSourceBadge({ fetchedAt }: KsefSourceBadgeProps) {
  const tooltipText = fetchedAt
    ? `Fetched from KSeF ${formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}`
    : "Fetched from KSeF";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 transition-opacity hover:text-primary">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          <span>KSeF</span>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
