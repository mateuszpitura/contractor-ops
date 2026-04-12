"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardList,
  FileText,
  KeyRound,
  Lock,
  Monitor,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { DocLinksSection } from "@/components/integrations/doc-links-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/trpc/init";
import { TaskAttachments } from "./task-attachments";
import { TaskComments } from "./task-comments";

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
// Task type icon mapping
// ---------------------------------------------------------------------------

const taskTypeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DOCUMENT_COLLECTION: FileText,
  APPROVAL: CheckCircle,
  ACCESS_GRANT: KeyRound,
  ACCESS_REVOKE: KeyRound,
  FINANCE_SETUP: Banknote,
  EQUIPMENT: Monitor,
  KNOWLEDGE_TRANSFER: BookOpen,
  MEETING: Calendar,
  MANUAL: ClipboardList,
  NOTIFICATION: Bell,
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
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date: string | Date): string {
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
// Skip Popover
// ---------------------------------------------------------------------------

function SkipPopover({ taskRunId, runId }: { taskRunId: string; runId: string }) {
  const t = useTranslations("Workflows");
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  const skipMutation = useMutation(
    trpc.workflow.skipTask.mutationOptions({
      onSuccess: () => {
        toast.success(t("toastTaskSkipped"));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
        setOpen(false);
        setReason("");
      },
      onError: () => {
        toast.error(t("errors.failedToCompleteTask"));
      },
    }),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button {...props} variant="ghost" size="sm">
            {t("taskActionSkip")}
          </Button>
        )}
      />
      <PopoverContent className="w-72 space-y-3" align="start">
        <Textarea
          placeholder={t("skipReasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          disabled={reason.trim().length < 3 || skipMutation.isPending}
          onClick={() => {
            skipMutation.mutate({ taskRunId, reason: reason.trim() });
          }}
        >
          {t("skipConfirm")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Reassign Popover
// ---------------------------------------------------------------------------

function ReassignPopover({ taskRunId, runId }: { taskRunId: string; runId: string }) {
  const t = useTranslations("Workflows");
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [open, setOpen] = useState(false);

  const usersQuery = useQuery({
    ...trpc.user.list.queryOptions(),
    enabled: open,
  });

  // user.list returns flattened members: { id, userId, name, email, role, ... }
  const members = usersQuery.data ?? [];

  const reassignMutation = useMutation(
    trpc.workflow.reassignTask.mutationOptions({
      onSuccess: () => {
        const member = members.find((m) => m.userId === selectedUserId);
        toast.success(
          t("toastTaskReassigned", {
            name: (member?.name as string) ?? "user",
          }),
        );
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
        setOpen(false);
        setSelectedUserId("");
      },
      onError: () => {
        toast.error(t("errors.failedToCompleteTask"));
      },
    }),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button {...props} variant="ghost" size="sm">
            {t("taskActionReassign")}
          </Button>
        )}
      />
      <PopoverContent className="w-72 space-y-3" align="start">
        <Select value={selectedUserId} onValueChange={(val) => setSelectedUserId(val ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder={t("reassignPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.userId as string} value={member.userId as string}>
                {(member.name ?? member.email ?? member.userId) as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="w-full"
          disabled={!selectedUserId || reassignMutation.isPending}
          onClick={() => {
            reassignMutation.mutate({
              taskRunId,
              newAssigneeUserId: selectedUserId,
            });
          }}
        >
          {t("reassignConfirm")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskCardRun({ task, runId, currentUserId, dependencyTitle }: TaskCardRunProps) {
  const t = useTranslations("Workflows");
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const isOverdue = task.isOverdue;
  const statusConfig = isOverdue
    ? { icon: AlertCircle, className: "text-destructive" }
    : (statusIconMap[task.status] ?? statusIconMap.TODO!);

  const StatusIcon = statusConfig.icon;
  const TypeIcon = taskTypeIconMap[task.taskType] ?? ClipboardList;

  const isConditionSkipped =
    task.status === "SKIPPED" &&
    (task.resultJson as Record<string, unknown>)?.skipReason === "condition_not_met";

  const isUserSkipped = task.status === "SKIPPED" && !isConditionSkipped;

  const isAssignedToMe = currentUserId !== null && task.assigneeUserId === currentUserId;

  const canAct = isAssignedToMe && (task.status === "TODO" || task.status === "IN_PROGRESS");

  const canReassignOnly =
    !isAssignedToMe && (task.status === "TODO" || task.status === "IN_PROGRESS");

  // Complete mutation
  const completeMutation = useMutation(
    trpc.workflow.completeTask.mutationOptions({
      onSuccess: () => {
        toast.success(t("toastTaskCompleted"));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
      },
      onError: () => {
        toast.error(t("errors.failedToCompleteTask"));
      },
    }),
  );

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="rounded-lg border bg-card">
        {/* Collapsed view */}
        <CollapsibleTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              className="flex w-full items-center gap-3 p-4 text-start hover:bg-muted/50 transition-colors"
            >
              {/* Status icon */}
              <StatusIcon className={`size-5 shrink-0 ${statusConfig.className}`} />

              {/* Title and metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{task.title}</span>
                  <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                    <TypeIcon className="size-3" />
                    {t(`taskType_${task.taskType}` as Parameters<typeof t>[0])}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[13px] text-muted-foreground">
                  {task.assigneeUserId && (
                    <span>{t("assignedToLabel", { name: task.assigneeUserId })}</span>
                  )}
                  {task.dueAt && (
                    <span className={isOverdue ? "text-destructive font-medium" : ""}>
                      {isOverdue ? t("overdue") : t("dueLabel", { date: formatDate(task.dueAt) })}
                    </span>
                  )}
                </div>
              </div>

              {/* Inline action buttons (stop propagation to not toggle collapse) */}
              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                }}
              >
                {canAct && (
                  <>
                    <Button
                      size="sm"
                      disabled={completeMutation.isPending}
                      onClick={() => {
                        completeMutation.mutate({ taskRunId: task.id });
                      }}
                    >
                      {t("taskActionComplete")}
                    </Button>
                    <SkipPopover taskRunId={task.id} runId={runId} />
                    <ReassignPopover taskRunId={task.id} runId={runId} />
                  </>
                )}
                {canReassignOnly && <ReassignPopover taskRunId={task.id} runId={runId} />}
                {task.status === "BLOCKED" && dependencyTitle && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={(props) => (
                          <span {...props} className="text-xs text-muted-foreground cursor-default">
                            <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
                          </span>
                        )}
                      />
                      <TooltipContent>
                        {t("blockedTooltip", { title: dependencyTitle })}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </button>
          )}
        />

        {/* Expanded view */}
        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3 space-y-4">
            {/* Description */}
            {task.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            )}

            {/* Status-specific info */}
            {task.status === "DONE" && task.completedAt && (
              <p className="text-xs text-muted-foreground">
                Completed by {task.completedByUserId ?? "unknown"} on{" "}
                {formatDateTime(task.completedAt)}
              </p>
            )}
            {isUserSkipped && (
              <p className="text-xs text-muted-foreground">
                Skipped:{" "}
                {((task.resultJson as Record<string, unknown>)?.skipReason as string) ??
                  "No reason provided"}
              </p>
            )}
            {isConditionSkipped && (
              <p className="text-xs text-muted-foreground">{t("conditionSkipped")}</p>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {task.createdAt && <span>Created {formatDateTime(task.createdAt)}</span>}
            </div>

            {/* Attachments */}
            <TaskAttachments runId={runId} taskRunId={task.id} />

            {/* Document links */}
            <DocLinksSection
              workflowTaskRunId={task.id}
              readOnly={["DONE", "SKIPPED", "CANCELLED"].includes(task.status)}
            />

            {/* Comments */}
            <TaskComments runId={runId} taskRunId={task.id} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
