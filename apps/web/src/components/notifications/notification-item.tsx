"use client";

import {
  ClipboardCheck,
  CheckCircle2,
  UserCheck,
  Clock,
  FileWarning,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Bdi } from "@/components/ui/bdi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  status: string;
  readAt: string | Date | null;
  createdAt: string | Date;
}

interface NotificationItemProps {
  notification: NotificationData;
  onClick: () => void;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Icon / color mapping per notification type (per UI-SPEC)
// ---------------------------------------------------------------------------

interface TypeStyle {
  icon: LucideIcon;
  circleBg: string;
  iconColor: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  APPROVAL_REQUEST: {
    icon: ClipboardCheck,
    circleBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  APPROVAL_DECISION: {
    icon: CheckCircle2,
    circleBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  TASK_ASSIGNED: {
    icon: UserCheck,
    circleBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  TASK_OVERDUE: {
    icon: Clock,
    circleBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  CONTRACT_EXPIRING: {
    icon: FileWarning,
    circleBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  INVOICE_RECEIVED: {
    icon: FileText,
    circleBg: "bg-primary/10",
    iconColor: "text-primary",
  },
};

const DEFAULT_STYLE: TypeStyle = {
  icon: FileText,
  circleBg: "bg-muted",
  iconColor: "text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Entity URL helper
// ---------------------------------------------------------------------------

export function getEntityUrl(
  entityType: string | null,
  entityId: string | null,
): string {
  if (!entityType || !entityId) return "/notifications";

  const routes: Record<string, string> = {
    INVOICE: `/invoices/${entityId}`,
    CONTRACT: `/contracts/${entityId}`,
    CONTRACTOR: `/contractors/${entityId}`,
    WORKFLOW_RUN: `/workflows/${entityId}`,
    WORKFLOW_TASK_RUN: `/workflows`,
    ORGANIZATION: `/settings`,
  };

  return routes[entityType] ?? "/notifications";
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

// ---------------------------------------------------------------------------
// NotificationItem component
// ---------------------------------------------------------------------------

export function NotificationItem({
  notification,
  onClick,
  compact,
}: NotificationItemProps) {
  const isUnread = notification.readAt === null;
  const style = TYPE_STYLES[notification.type] ?? DEFAULT_STYLE;
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-accent",
        isUnread ? "bg-muted" : "bg-transparent",
        compact && "px-3 py-2",
      )}
      style={{ minHeight: compact ? undefined : 64 }}
    >
      {/* Unread dot */}
      <div className="flex w-2 shrink-0 items-center justify-center">
        {isUnread && (
          <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </div>

      {/* Icon circle */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          style.circleBg,
        )}
      >
        <Icon className={cn("h-4 w-4", style.iconColor)} />
      </div>

      {/* Title + body */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">
          <Bdi>{notification.title}</Bdi>
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {notification.body}
        </span>
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-xs text-muted-foreground">
        {relativeTime(notification.createdAt)}
      </span>
    </button>
  );
}
