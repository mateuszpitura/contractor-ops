"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeadlineType = "CONTRACT_EXPIRING" | "TASK_OVERDUE" | "INVOICE_DUE";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEntityHref(type: DeadlineType, entityId: string): string {
  switch (type) {
    case "CONTRACT_EXPIRING":
      return `/contracts/${entityId}`;
    case "TASK_OVERDUE":
      return `/workflows?tab=my-tasks`;
    case "INVOICE_DUE":
      return `/invoices/${entityId}`;
  }
}

const DEADLINE_BADGE_CONFIG: Record<
  DeadlineType,
  { variant: "warning" | "destructive" | "info"; labelKey: string }
> = {
  CONTRACT_EXPIRING: {
    variant: "warning",
    labelKey: "deadlines.badgeContract",
  },
  TASK_OVERDUE: {
    variant: "destructive",
    labelKey: "deadlines.badgeTask",
  },
  INVOICE_DUE: {
    variant: "info",
    labelKey: "deadlines.badgeInvoice",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Upcoming deadlines widget showing contract expirations, overdue tasks,
 * and due invoices. Items sorted by urgency.
 */
export function DeadlinesWidget() {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(
    trpc.dashboard.deadlines.queryOptions(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">
          {t("deadlines.title")}
        </CardTitle>
        <CardAction>
          <Link
            href="/reports?report=expiring-contracts"
            className="text-sm text-primary hover:underline"
          >
            {t("deadlines.seeAll")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : !data?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("deadlines.empty")}
          </p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <div className="flex flex-col gap-2">
              {data.map((item) => {
                const badge = DEADLINE_BADGE_CONFIG[item.type as DeadlineType];
                const isOverdue = "daysOverdue" in item && item.daysOverdue != null;
                const days = (isOverdue ? item.daysOverdue : item.daysRemaining) ?? 0;

                return (
                  <div
                    key={`${item.type}-${item.entityId}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <Badge
                      variant={badge.variant}
                    >
                      {t(badge.labelKey as Parameters<typeof t>[0])}
                    </Badge>
                    <Link
                      href={getEntityHref(item.type as DeadlineType, item.entityId)}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    >
                      {item.entityName}
                    </Link>
                    <span
                      className={`shrink-0 text-xs ${
                        isOverdue
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isOverdue
                        ? t("deadlines.overdue", { days })
                        : t("deadlines.upcoming", { days })}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
