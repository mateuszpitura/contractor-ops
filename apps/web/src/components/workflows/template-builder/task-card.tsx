"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle,
  KeyRound,
  Banknote,
  Monitor,
  BookOpen,
  Calendar,
  ClipboardList,
  Bell,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { trpc } from "@/trpc/init";
import { ConditionBuilder, getConditionSummary } from "./condition-builder";
import type { TemplateFormValues, TaskFormValues } from "./use-template-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskCardProps {
  index: number;
  onRemove: (index: number) => void;
  allTasks: TaskFormValues[];
  form: UseFormReturn<TemplateFormValues>;
  dragHandleProps?: {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Icon map for task types
// ---------------------------------------------------------------------------

const TASK_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

const TASK_TYPES = [
  "DOCUMENT_COLLECTION",
  "APPROVAL",
  "ACCESS_GRANT",
  "ACCESS_REVOKE",
  "FINANCE_SETUP",
  "EQUIPMENT",
  "KNOWLEDGE_TRANSFER",
  "MEETING",
  "MANUAL",
  "NOTIFICATION",
] as const;

const ASSIGNEE_MODES = [
  "FIXED_USER",
  "ROLE_BASED",
  "CONTRACTOR_OWNER",
  "CONTRACT_OWNER",
  "PROJECT_MANAGER",
] as const;

const USER_ROLES = [
  "ORG_ADMIN",
  "FINANCE_ADMIN",
  "OPS_MANAGER",
  "TEAM_MANAGER",
  "LEGAL_VIEWER",
  "IT_ADMIN",
  "ACCOUNTANT",
  "READ_ONLY",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskCard({
  index,
  onRemove,
  allTasks,
  form,
  dragHandleProps,
}: TaskCardProps) {
  const t = useTranslations("Workflows");
  const [isOpen, setIsOpen] = useState(false);

  const task = form.watch(`tasks.${index}`);
  const taskType = task?.taskType ?? "MANUAL";
  const assigneeMode = task?.assigneeMode ?? "ROLE_BASED";
  const title = task?.title ?? "";
  const conditions = task?.conditions ?? null;

  const TypeIcon = TASK_TYPE_ICONS[taskType] ?? ClipboardList;

  // Fetch users for FIXED_USER mode
  const usersQuery = useQuery({
    ...trpc.user.list.queryOptions(),
    enabled: assigneeMode === "FIXED_USER",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = (usersQuery.data as any)?.items ?? [];

  const conditionSummary = getConditionSummary(
    conditions as Parameters<typeof getConditionSummary>[0],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t as any,
  );

  // Dependency options: only tasks with lower sortOrder
  const dependencyOptions = allTasks
    .filter((_, i) => i < index)
    .map((t, i) => ({
      value: t.id ?? `task-${i}`,
      label: t.title || `Task ${i + 1}`,
    }));

  const handleConditionsChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (val: any) => {
      form.setValue(`tasks.${index}.conditions`, val, { shouldDirty: true });
    },
    [form, index],
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        {/* Collapsed header */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ minHeight: 56 }}>
          {/* Drag handle */}
          <button
            type="button"
            className="flex cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...(dragHandleProps?.attributes as React.HTMLAttributes<HTMLButtonElement>)}
            {...(dragHandleProps?.listeners as React.HTMLAttributes<HTMLButtonElement>)}
          >
            <GripVertical className="size-5" />
          </button>

          {/* Title + badges */}
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`truncate text-sm ${title ? "font-medium" : "text-muted-foreground"}`}>
              {title || t("untitledTask")}
            </span>

            <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
              <TypeIcon className="size-3" />
              {t(`taskType_${taskType}`)}
            </Badge>

            {task?.assigneeMode && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {t(`assigneeMode_${assigneeMode}`)}
              </span>
            )}

            {task?.dueOffsetDays ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {task.dueOffsetDays}{t("dueOffsetDays")}
              </span>
            ) : null}

            {task?.required && (
              <Badge variant="default" className="shrink-0 text-xs">
                {t("requiredTask")}
              </Badge>
            )}

            {conditionSummary && (
              <Badge
                variant="outline"
                className="max-w-[240px] shrink-0 truncate text-xs"
              >
                {conditionSummary}
              </Badge>
            )}

            <span className="ml-auto shrink-0 text-muted-foreground">
              {isOpen ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </span>
          </CollapsibleTrigger>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 py-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor={`task-title-${index}`}>{t("taskTitle")}</Label>
              <Input
                id={`task-title-${index}`}
                placeholder={t("taskTitlePlaceholder")}
                {...form.register(`tasks.${index}.title`)}
              />
            </div>

            {/* Task type */}
            <div className="space-y-1.5">
              <Label>{t("taskType")}</Label>
              <Select
                value={taskType}
                onValueChange={(val) =>
                  form.setValue(`tasks.${index}.taskType`, val as typeof taskType, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => {
                    const Icon = TASK_TYPE_ICONS[type] ?? ClipboardList;
                    return (
                      <SelectItem key={type} value={type}>
                        <Icon className="mr-1.5 inline-block size-3.5" />
                        {t(`taskType_${type}`)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor={`task-desc-${index}`}>{t("taskDescription")}</Label>
              <Textarea
                id={`task-desc-${index}`}
                placeholder={t("descriptionPlaceholder")}
                rows={2}
                {...form.register(`tasks.${index}.description`)}
              />
            </div>

            {/* Assignee mode */}
            <div className="space-y-1.5">
              <Label>{t("assignedTo")}</Label>
              <Select
                value={assigneeMode}
                onValueChange={(val) =>
                  form.setValue(
                    `tasks.${index}.assigneeMode`,
                    val as typeof assigneeMode,
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNEE_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {t(`assigneeMode_${mode}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional: Role select (when ROLE_BASED) */}
            {assigneeMode === "ROLE_BASED" && (
              <div className="space-y-1.5">
                <Label>{t("roleField")}</Label>
                <Select
                  value={task?.assigneeRole ?? ""}
                  onValueChange={(val) =>
                    form.setValue(
                      `tasks.${index}.assigneeRole`,
                      val as (typeof USER_ROLES)[number],
                      { shouldDirty: true },
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("rolePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Conditional: User select (when FIXED_USER) */}
            {assigneeMode === "FIXED_USER" && (
              <div className="space-y-1.5">
                <Label>{t("userField")}</Label>
                <Select
                  value={task?.assigneeUserId ?? ""}
                  onValueChange={(val) =>
                    form.setValue(`tasks.${index}.assigneeUserId`, val as string, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("userPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {users.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name ?? user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Due offset */}
            <div className="space-y-1.5">
              <Label>{t("dueOffset")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-24"
                  placeholder="0"
                  {...form.register(`tasks.${index}.dueOffsetDays`, {
                    valueAsNumber: true,
                  })}
                />
                <span className="text-sm text-muted-foreground">
                  {t("dueOffsetDays")}
                </span>
                <Input
                  type="number"
                  min={0}
                  className="w-24"
                  placeholder="0"
                  {...form.register(`tasks.${index}.dueOffsetHours`, {
                    valueAsNumber: true,
                  })}
                />
                <span className="text-sm text-muted-foreground">
                  {t("dueOffsetHours")}
                </span>
              </div>
            </div>

            {/* Required toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={task?.required ?? false}
                onCheckedChange={(checked) =>
                  form.setValue(`tasks.${index}.required`, !!checked, {
                    shouldDirty: true,
                  })
                }
              />
              <Label>{t("requiredTask")}</Label>
            </div>

            {/* Dependency */}
            <div className="space-y-1.5">
              <Label>{t("dependsOn")}</Label>
              <Select
                value={task?.dependsOnTaskTemplateId ?? ""}
                onValueChange={(val) =>
                  form.setValue(
                    `tasks.${index}.dependsOnTaskTemplateId`,
                    val === "__none__" ? undefined : (val as string),
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("dependsOnPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("noDependency")}</SelectItem>
                  {dependencyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <Label>{t("conditions")}</Label>
              <ConditionBuilder
                value={conditions as Parameters<typeof ConditionBuilder>[0]["value"]}
                onChange={handleConditionsChange}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-3">
              <button
                type="button"
                className="text-sm text-destructive hover:underline"
                onClick={() => onRemove(index)}
              >
                {t("removeTask")}
              </button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                {t("doneEditing")}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
