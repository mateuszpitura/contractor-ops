"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";

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

interface ActivityItem {
  id: string;
  actorName: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  createdAt: Date | string;
}

interface GroupedActivities {
  label: string;
  items: ActivityItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEntityHref(resourceType: string, resourceId: string): string {
  switch (resourceType) {
    case "CONTRACTOR":
      return `/contractors/${resourceId}`;
    case "CONTRACT":
      return `/contracts/${resourceId}`;
    case "INVOICE":
      return `/invoices/${resourceId}`;
    case "WORKFLOW_TEMPLATE":
    case "WORKFLOW_RUN":
      return `/workflows`;
    case "DOCUMENT":
      return `/documents`;
    case "PAYMENT_RUN":
      return `/payments`;
    case "APPROVAL_FLOW":
    case "APPROVAL_STEP":
      return `/approvals`;
    default:
      return "#";
  }
}

// Resource type labels are now externalized via t("activity.resources.{TYPE}")

function groupByDay(items: ActivityItem[]): GroupedActivities[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, ActivityItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const item of items) {
    const date = new Date(item.createdAt);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      groups.today.push(item);
    } else if (date.getTime() === yesterday.getTime()) {
      groups.yesterday.push(item);
    } else {
      groups.earlier.push(item);
    }
  }

  const result: GroupedActivities[] = [];
  if (groups.today.length > 0) result.push({ label: "today", items: groups.today });
  if (groups.yesterday.length > 0)
    result.push({ label: "yesterday", items: groups.yesterday });
  if (groups.earlier.length > 0)
    result.push({ label: "earlier", items: groups.earlier });

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Activity feed showing last 20 audit log events grouped by today/yesterday/earlier.
 * Each event shows actor, action, resource type badge, and relative timestamp.
 */
export function ActivityFeed() {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(
    trpc.dashboard.activity.queryOptions(),
  );

  const grouped = useMemo(
    () => groupByDay(data?.items ?? []),
    [data?.items],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">
          {t("activity.title")}
        </CardTitle>
        <CardAction>
          <Link
            href="/settings?tab=audit-log"
            className="text-sm text-primary hover:underline"
          >
            {t("activity.seeAll")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("activity.empty")}
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="flex flex-col gap-4">
              {grouped.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t(`activity.${group.label}` as Parameters<typeof t>[0])}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <p className="text-sm">
                          <span className="text-foreground">
                            {item.actorName ?? t("activity.systemActor")}
                          </span>{" "}
                          <span className="font-semibold">
                            {t(`activity.actions.${item.action}` as Parameters<typeof t>[0])}
                          </span>
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {t(`activity.resources.${item.resourceType}` as Parameters<typeof t>[0])}
                          </Badge>
                          <Link
                            href={getEntityHref(
                              item.resourceType,
                              item.resourceId,
                            )}
                            className="min-w-0 truncate text-xs text-foreground hover:underline"
                          >
                            {item.resourceName ?? item.resourceId}
                          </Link>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
