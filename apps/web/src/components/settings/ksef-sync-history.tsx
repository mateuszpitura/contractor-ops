"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronDown, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ---------------------------------------------------------------------------
// Sync status styling
// ---------------------------------------------------------------------------

const SYNC_STATUS_STYLES: Record<
  string,
  { className: string; labelKey: string }
> = {
  SUCCESS: {
    className: "bg-emerald-500/10 text-emerald-500",
    labelKey: "syncStatusSuccess",
  },
  FAILED: {
    className: "bg-destructive/10 text-destructive",
    labelKey: "syncStatusFailed",
  },
  STARTED: {
    className: "bg-blue-500/10 text-blue-500",
    labelKey: "syncing",
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncLogEntry {
  id: string;
  syncType: string;
  status: string;
  direction: string;
  errorMessage: string | null;
  responsePayloadJson: Record<string, unknown> | null;
  startedAt: string | Date;
  completedAt: string | Date | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KsefSyncHistoryProps {
  connectionId: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KsefSyncHistory({ connectionId }: KsefSyncHistoryProps) {
  const t = useTranslations("ksef");
  const [isOpen, setIsOpen] = useState(false);

  const syncHistoryQuery = useQuery(
    trpc.ksef.syncHistory.queryOptions(
      { limit: 10 },
      { enabled: !!connectionId },
    ),
  );

  const rawData = syncHistoryQuery.data as
    | { logs: SyncLogEntry[] }
    | undefined;
  const logs = rawData?.logs ?? [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <History className="size-4" aria-hidden="true" />
        <span>{t("syncHistoryTitle")}</span>
        <ChevronDown
          className={`ms-auto size-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        {syncHistoryQuery.isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="ms-auto h-5 w-16" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("syncHistoryEmpty")}
          </p>
        ) : (
          <div className="divide-y">
            {logs.map((log) => {
              const statusStyle = SYNC_STATUS_STYLES[log.status] ??
                SYNC_STATUS_STYLES.STARTED!;

              const payload = log.responsePayloadJson as Record<
                string,
                unknown
              > | null;
              const invoicesCreated =
                (payload?.invoicesCreated as number) ?? 0;

              const isNoNew =
                log.status === "SUCCESS" && invoicesCreated === 0;

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  {/* Timestamp */}
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(log.startedAt), {
                      addSuffix: true,
                    })}
                  </span>

                  {/* Invoice count */}
                  {!isNoNew && invoicesCreated > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {t("syncInvoiceCount", { count: invoicesCreated })}
                    </Badge>
                  )}

                  {/* Status badge */}
                  <Badge
                    variant="secondary"
                    className={`ms-auto text-xs ${
                      isNoNew
                        ? "bg-muted text-muted-foreground"
                        : statusStyle.className
                    }`}
                  >
                    {isNoNew
                      ? t("syncStatusNoNew")
                      : t(
                          statusStyle.labelKey as Parameters<typeof t>[0],
                        )}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
