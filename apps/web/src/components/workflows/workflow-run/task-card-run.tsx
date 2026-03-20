"use client";

import { useTranslations } from "next-intl";
import {
  Circle,
  CircleDot,
  CheckCircle2,
  Lock,
  SkipForward,
  XCircle,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status icon mapping
// ---------------------------------------------------------------------------

const statusIconMap: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  TODO: { icon: Circle, className: "text-muted-foreground" },
  IN_PROGRESS: { icon: CircleDot, className: "text-primary" },
  DONE: { icon: CheckCircle2, className: "text-green-600 dark:text-green-400" },
  BLOCKED: { icon: Lock, className: "text-amber-600 dark:text-amber-400" },
  SKIPPED: { icon: SkipForward, className: "text-muted-foreground/60" },
  CANCELLED: { icon: XCircle, className: "text-muted-foreground/60" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskCardRunProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    taskType: string;
    status: string;
    required: boolean;
    assigneeUserId: string | null;
    assigneeRole: string | null;
    dueAt: string | Date | null;
    completedAt: string | Date | null;
    completedByUserId: string | null;
    startedAt: string | Date | null;
    dependsOnTaskRunId: string | null;
    resultJson: unknown;
    isOverdue: boolean;
    createdAt: string | Date;
  };
  runId: string;
  currentUserId: string | null;
  dependencyTitle?: string;
}

// ---------------------------------------------------------------------------
// Component (stub -- will be replaced with full implementation in Task 2)
// ---------------------------------------------------------------------------

export function TaskCardRun({ task, dependencyTitle }: TaskCardRunProps) {
  const t = useTranslations("Workflows");

  const isOverdue = task.isOverdue;
  const statusConfig = isOverdue
    ? { icon: AlertCircle, className: "text-destructive" }
    : statusIconMap[task.status] ?? statusIconMap.TODO;

  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <StatusIcon className={`size-5 shrink-0 ${statusConfig.className}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        {task.status === "BLOCKED" && dependencyTitle && (
          <p className="text-xs text-muted-foreground">
            {t("blockedTooltip", { title: dependencyTitle })}
          </p>
        )}
      </div>
      {isOverdue && (
        <span className="shrink-0 text-xs font-medium text-destructive">
          {t("overdue")}
        </span>
      )}
    </div>
  );
}
