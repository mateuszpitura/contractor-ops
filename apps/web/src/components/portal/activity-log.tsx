"use client";

import { Banknote, CheckCircle2, Circle, Eye, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityEntry {
  event: string;
  detail?: string | null;
  timestamp: Date | string;
}

interface ActivityLogProps {
  entries: ActivityEntry[];
  maxHeight?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENT_ICONS: Record<string, typeof Circle> = {
  submitted: Circle,
  review: Eye,
  approved: CheckCircle2,
  rejected: XCircle,
  paid: Banknote,
  payment: Banknote,
};

function getIcon(event: string) {
  const lower = event.toLowerCase();
  if (lower.includes("submitted")) return EVENT_ICONS.submitted!;
  if (lower.includes("review")) return EVENT_ICONS.review!;
  if (lower.includes("approved")) return EVENT_ICONS.approved!;
  if (lower.includes("rejected")) return EVENT_ICONS.rejected!;
  if (lower.includes("paid") || lower.includes("payment")) return EVENT_ICONS.paid!;
  return Circle;
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek !== 1 ? "s" : ""} ago`;
  return `${diffMonth} month${diffMonth !== 1 ? "s" : ""} ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityLog({ entries, maxHeight = "300px" }: ActivityLogProps) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ScrollArea style={{ maxHeight }} className="w-full">
      <div>
        {entries.map((entry, i) => {
          const Icon = getIcon(entry.event);
          return (
            <div key={`${entry.event}-${i}`}>
              <div className="flex items-start gap-3 py-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{entry.event}</p>
                  {entry.detail && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{entry.detail}</p>
                  )}
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {formatRelativeTime(entry.timestamp)}
                  </p>
                </div>
              </div>
              {i < entries.length - 1 && <Separator />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
