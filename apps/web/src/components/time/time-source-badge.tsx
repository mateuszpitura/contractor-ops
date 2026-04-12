"use client";

import { Clock, Pencil, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Source -> badge config mapping per UI-SPEC Time Entry Source
// ---------------------------------------------------------------------------

const SOURCE_CONFIG = {
  MANUAL: {
    icon: Pencil,
    variant: "secondary" as const,
    label: "Manual",
  },
  CLOCKIFY: {
    icon: Clock,
    variant: "info" as const,
    label: "Clockify",
  },
  JIRA: {
    icon: Ticket,
    variant: "info" as const,
    label: "Jira",
  },
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimeSourceBadgeProps {
  source: "MANUAL" | "CLOCKIFY" | "JIRA";
  importedAt?: Date | string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact inline badge showing time entry source.
 * Manual entries: secondary badge with pencil icon, tooltip "Manual entry".
 * Imported entries: info badge with provider icon, tooltip with import date.
 */
export function TimeSourceBadge({ source, importedAt }: TimeSourceBadgeProps) {
  const config = SOURCE_CONFIG[source];
  const Icon = config.icon;

  const tooltipText =
    source === "MANUAL"
      ? "Manual entry"
      : `Imported from ${config.label} on ${importedAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(typeof importedAt === "string" ? new Date(importedAt) : importedAt) : "unknown date"}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className="gap-1 px-1.5 py-0.5">
            <Icon className="h-3.5 w-3.5" />
            <span className="text-xs">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
