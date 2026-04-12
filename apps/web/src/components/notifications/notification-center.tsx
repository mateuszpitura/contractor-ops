"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { AnimateIn } from "@/components/shared/animate-in";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/init";
import type { NotificationData } from "./notification-item";
import { getEntityUrl, NotificationItem } from "./notification-item";

// ---------------------------------------------------------------------------
// Type filter mapping: UI chip value -> notification type(s)
// ---------------------------------------------------------------------------

type NotificationType =
  | "APPROVAL_REQUEST"
  | "APPROVAL_DECISION"
  | "TASK_ASSIGNED"
  | "TASK_OVERDUE"
  | "CONTRACT_EXPIRING"
  | "INVOICE_RECEIVED";

const TYPE_MAP: Record<string, NotificationType[]> = {
  approvals: ["APPROVAL_REQUEST", "APPROVAL_DECISION"],
  tasks: ["TASK_ASSIGNED", "TASK_OVERDUE"],
  contracts: ["CONTRACT_EXPIRING"],
  invoices: ["INVOICE_RECEIVED"],
};

const FILTER_KEYS = ["all", "approvals", "tasks", "contracts", "invoices"] as const;

// ---------------------------------------------------------------------------
// NotificationCenter
// ---------------------------------------------------------------------------

export function NotificationCenter() {
  const t = useTranslations("Notifications");
  const te = useTranslations("EmptyStates");
  const router = useRouter();
  const queryClient = useQueryClient();

  // URL state via nuqs
  const [typeFilter, setTypeFilter] = useQueryState("type", parseAsString.withDefault("all"));
  const [unreadOnly, setUnreadOnly] = useQueryState("unread", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  // Build query input
  const queryInput = useMemo(() => {
    const types = typeFilter !== "all" ? TYPE_MAP[typeFilter] : undefined;
    // The API accepts a single type enum value, not an array.
    // For multi-type filters (e.g. approvals = 2 types), we pass undefined and let
    // the API return all. For single-type filters, we pass the specific type.
    const type: NotificationType | undefined = types && types.length === 1 ? types[0] : undefined;

    return {
      type,
      unreadOnly: unreadOnly === "true" ? true : undefined,
      page,
      perPage: 10,
    };
  }, [typeFilter, unreadOnly, page]);

  const listQuery = useQuery({
    ...trpc.notification.list.queryOptions(queryInput),
  });

  const data = useMemo(() => {
    const result = listQuery.data as
      | { items: NotificationData[]; total: number; page: number; totalPages: number }
      | undefined;
    return result;
  }, [listQuery.data]);

  const notifications = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Unread count for mark-all-read button state
  const unreadQuery = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
  });
  const unreadCount = (unreadQuery.data as { count: number } | undefined)?.count ?? 0;

  // Mark read mutation
  const markReadMutation = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [["notification"]],
        });
      },
    }),
  );

  // Mark all read
  const markAllReadMutation = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => {
        toast.success(t("markedAllRead"));
        void queryClient.invalidateQueries({
          queryKey: [["notification"]],
        });
      },
      onError: () => {
        toast.error(t("errors.failedToMarkRead"));
      },
    }),
  );

  const handleItemClick = useCallback(
    (notification: NotificationData) => {
      if (!notification.readAt) {
        markReadMutation.mutate({ notificationId: notification.id });
      }
      const url = getEntityUrl(notification.entityType, notification.entityId);
      router.push(url);
    },
    [markReadMutation, router],
  );

  const handleFilterChange = useCallback(
    (filter: string) => {
      void setTypeFilter(filter);
      void setPage(1);
    },
    [setTypeFilter, setPage],
  );

  const handleUnreadToggle = useCallback(
    (checked: boolean) => {
      void setUnreadOnly(checked ? "true" : "");
      void setPage(1);
    },
    [setUnreadOnly, setPage],
  );

  const isLoading = listQuery.isLoading;
  const isEmpty = !isLoading && notifications.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page header */}
      <AnimateIn delay={0}>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">
            {t("title")}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
          >
            {t("markAllRead")}
          </Button>
        </div>
      </AnimateIn>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter chips */}
        {FILTER_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleFilterChange(key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              typeFilter === key
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t(`filters.${key}` as Parameters<typeof t>[0])}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Unread only toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="unread-only"
            checked={unreadOnly === "true"}
            onCheckedChange={handleUnreadToggle}
          />
          <Label htmlFor="unread-only" className="text-sm">
            {t("unreadOnly")}
          </Label>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col rounded-lg border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-60" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        /* Empty state - informational only */
        <EmptyState
          icon={Bell}
          heading={te("notifications.heading")}
          body={te("notifications.body")}
        />
      ) : (
        <>
          <div className="flex flex-col rounded-lg border">
            {notifications.map((n) => (
              <div key={n.id} className="border-b last:border-b-0">
                <NotificationItem notification={n} onClick={() => handleItemClick(n)} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void setPage(page - 1)}
                disabled={page <= 1}
              >
                {t("pagination.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("pagination.pageOf", { page, totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void setPage(page + 1)}
                disabled={page >= totalPages}
              >
                {t("pagination.next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
