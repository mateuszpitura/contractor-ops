"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, Eye, FileDown, PenLine, Send, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Event Type to Icon/Color Mapping
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<string, { icon: typeof Send; className: string }> = {
  ENVELOPE_CREATED: { icon: Send, className: "text-muted-foreground" },
  ENVELOPE_SENT: { icon: Send, className: "text-muted-foreground" },
  RECIPIENT_VIEWED: { icon: Eye, className: "text-muted-foreground" },
  RECIPIENT_SIGNED: { icon: PenLine, className: "text-green-600" },
  RECIPIENT_DECLINED: { icon: XCircle, className: "text-red-500" },
  ENVELOPE_VOIDED: { icon: Ban, className: "text-red-500" },
  ENVELOPE_COMPLETED: { icon: CheckCircle2, className: "text-green-600" },
  ENVELOPE_EXPIRED: { icon: XCircle, className: "text-red-500" },
  SIGNED_PDF_SAVED: { icon: FileDown, className: "text-muted-foreground" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFullDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SigningAuditTrailProps = {
  envelopeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Side panel showing chronological signing events for an envelope.
 * Per UI-SPEC: Sheet from right, 400px wide, newest first.
 */
export function SigningAuditTrail({ envelopeId, open, onOpenChange }: SigningAuditTrailProps) {
  const detailQuery = useQuery(
    trpc.esign.getEnvelopeDetail.queryOptions({ envelopeId }, { enabled: open && !!envelopeId }),
  );

  const envelope = detailQuery.data;
  const events = ((envelope as Record<string, unknown> | undefined)?.events ?? []) as Array<{
    id: string;
    eventType: string;
    description: string;
    actorName: string | null;
    occurredAt: string | Date;
  }>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Signing History</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          {detailQuery.isPending ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`audit-step-${i}`} className="flex items-start gap-3 py-2">
                  <Skeleton className="size-4 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h4 className="text-sm font-medium text-muted-foreground">No Signing History</h4>
              <p className="mt-1 max-w-[240px] text-sm text-muted-foreground">
                Signing events will appear here once a document is sent for signature.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {events.map((event) => {
                const config = EVENT_CONFIG[event.eventType] ?? {
                  icon: Send,
                  className: "text-muted-foreground",
                };
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b py-2 last:border-0"
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${config.className}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{event.description}</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={(props) => (
                              <p {...props} className="text-sm text-muted-foreground">
                                {formatRelativeTime(event.occurredAt)}
                              </p>
                            )}
                          />
                          <TooltipContent>{formatFullDateTime(event.occurredAt)}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {event.actorName && (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {event.actorName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
