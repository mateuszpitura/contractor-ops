"use client";

import { useState } from "react";
import { Clock, Ticket, Loader2, CalendarDays } from "lucide-react";
import { format, startOfISOWeek, endOfISOWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExternalSyncButtonProps {
  provider: "CLOCKIFY" | "JIRA";
  connected: boolean;
  onSync: (
    startDate: string,
    endDate: string,
  ) => Promise<{ imported: number; skipped: number }>;
  isSyncing: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROVIDER_CONFIG = {
  CLOCKIFY: {
    icon: Clock,
    label: "Clockify",
  },
  JIRA: {
    icon: Ticket,
    label: "Jira",
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sync button for external time provider per UI-SPEC ExternalSyncButton (D-09, D-10).
 *
 * Shows provider icon + "Sync from {provider}" label.
 * Click opens Popover with date range and "Import Entries" button.
 * During sync: Loader2 spinner + "Importing..." text.
 * Disabled when provider not connected with tooltip explanation.
 */
export function ExternalSyncButton({
  provider,
  connected,
  onSync,
  isSyncing,
}: ExternalSyncButtonProps) {
  const config = PROVIDER_CONFIG[provider];
  const Icon = config.icon;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(startOfISOWeek(new Date()));
  const [toDate, setToDate] = useState<Date>(endOfISOWeek(new Date()));
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);

  const handleImport = async () => {
    setPopoverOpen(false);
    try {
      const result = await onSync(
        format(fromDate, "yyyy-MM-dd"),
        format(toDate, "yyyy-MM-dd"),
      );

      if (result.imported > 0) {
        toast.success(
          `${result.imported} entries imported from ${config.label}`,
        );
      } else {
        toast.info(
          `No entries found in ${config.label} for the selected period`,
        );
      }
    } catch {
      toast.error(
        `Failed to import from ${config.label}. Check your connection in Settings.`,
      );
    }
  };

  if (!connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" disabled className="gap-2">
                <Icon className="h-4 w-4" />
                Sync from {config.label}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Connect {config.label} in Settings &gt; Integrations to import
              time entries
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isSyncing) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Importing...
      </Button>
    );
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Icon className="h-4 w-4" />
          Sync from {config.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">
            Import from {config.label}
          </h4>

          {/* From date */}
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Popover
              open={fromCalendarOpen}
              onOpenChange={setFromCalendarOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start font-normal"
                >
                  <CalendarDays className="me-2 h-3.5 w-3.5" />
                  {format(fromDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(d) => {
                    if (d) setFromDate(d);
                    setFromCalendarOpen(false);
                  }}
                  defaultMonth={fromDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* To date */}
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start font-normal"
                >
                  <CalendarDays className="me-2 h-3.5 w-3.5" />
                  {format(toDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(d) => {
                    if (d) setToDate(d);
                    setToCalendarOpen(false);
                  }}
                  defaultMonth={toDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button className="w-full" onClick={handleImport}>
            Import Entries
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
