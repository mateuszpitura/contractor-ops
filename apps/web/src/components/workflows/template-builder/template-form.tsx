"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { trpc } from "@/trpc/init";
import { SortableTaskList } from "./sortable-task-list";
import { useTemplateForm, type TemplateFormValues } from "./use-template-form";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATE_TYPES = [
  "ONBOARDING",
  "OFFBOARDING",
  "DOCUMENT_COLLECTION",
  "COMPLIANCE_REVIEW",
  "CUSTOM",
] as const;

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-green-500/10 text-green-700 dark:text-green-400",
  ARCHIVED: "bg-muted/50 text-muted-foreground/60",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TemplateFormProps {
  templateId?: string;
}

export function TemplateForm({ templateId }: TemplateFormProps) {
  const t = useTranslations("Workflows");
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!templateId;

  // Fetch existing template when editing
  const templateQuery = useQuery(
    trpc.workflow.getTemplate.queryOptions(
      { id: templateId! },
      { enabled: isEditing },
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templateData = templateQuery.data as any;
  const templateStatus: string = templateData?.status ?? "DRAFT";

  // Initialize form
  const { form, fields, isDirty, addTask, removeTask, reorderTasks } =
    useTemplateForm(
      isEditing && templateData
        ? {
            name: templateData.name,
            type: templateData.type,
            description: templateData.description ?? "",
            tasks:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              templateData.tasks?.map((task: any) => ({
                id: task.id,
                title: task.title,
                taskType: task.taskType,
                description: task.description ?? "",
                sortOrder: task.sortOrder,
                required: task.required,
                assigneeMode: task.assigneeMode,
                assigneeRole: task.assigneeRole ?? undefined,
                assigneeUserId: task.assigneeUserId ?? undefined,
                dueOffsetDays: task.dueOffsetDays ?? undefined,
                dueOffsetHours: task.dueOffsetHours ?? undefined,
                dependsOnTaskTemplateId:
                  task.dependsOnTaskTemplateId ?? undefined,
                externalUrl: task.externalUrl ?? "",
                conditions: task.configJson ?? null,
              })) ?? [],
          }
        : undefined,
    );

  const tasks = form.watch("tasks");

  // Mutations
  const createMutation = useMutation(
    trpc.workflow.createTemplate.mutationOptions({
      onSuccess: () => {
        toast.success(t("toastTemplateSaved"));
        queryClient.invalidateQueries({ queryKey: ["workflow"] });
        router.push("/workflows");
      },
      onError: () => {
        toast.error(t("errorSaveTemplate"));
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.workflow.updateTemplate.mutationOptions({
      onSuccess: () => {
        toast.success(t("toastTemplateSaved"));
        queryClient.invalidateQueries({ queryKey: ["workflow"] });
        form.reset(form.getValues());
      },
      onError: () => {
        toast.error(t("errorSaveTemplate"));
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.workflow.deleteTemplate.mutationOptions({
      onSuccess: () => {
        toast.success(t("toastTemplateDeleted"));
        queryClient.invalidateQueries({ queryKey: ["workflow"] });
        router.push("/workflows");
      },
    }),
  );

  const duplicateMutation = useMutation(
    trpc.workflow.duplicateTemplate.mutationOptions({
      onSuccess: (data) => {
        toast.success(t("toastTemplateDuplicated"));
        queryClient.invalidateQueries({ queryKey: ["workflow"] });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(`/workflows/templates/${(data as any).id}`);
      },
    }),
  );

  // Save handler
  const handleSave = useCallback(
    (values: TemplateFormValues) => {
      const payload = {
        name: values.name,
        type: values.type,
        description: values.description || undefined,
        tasks: values.tasks.map((task, i) => ({
          id: task.id,
          title: task.title,
          taskType: task.taskType,
          description: task.description || undefined,
          sortOrder: i,
          required: task.required,
          assigneeMode: task.assigneeMode,
          assigneeRole: task.assigneeRole || undefined,
          assigneeUserId: task.assigneeUserId || undefined,
          dueOffsetDays: task.dueOffsetDays || undefined,
          dueOffsetHours: task.dueOffsetHours || undefined,
          dependsOnTaskTemplateId:
            task.dependsOnTaskTemplateId || undefined,
          externalUrl: task.externalUrl || undefined,
          conditions: task.conditions ?? undefined,
        })),
      };

      if (isEditing) {
        updateMutation.mutate({ id: templateId!, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
    [isEditing, templateId, createMutation, updateMutation],
  );

  // Status actions
  const handleActivate = useCallback(() => {
    if (!templateId) return;
    updateMutation.mutate({ id: templateId, status: "ACTIVE" });
  }, [templateId, updateMutation]);

  const handleArchive = useCallback(() => {
    if (!templateId) return;
    updateMutation.mutate({ id: templateId, status: "ARCHIVED" });
  }, [templateId, updateMutation]);

  const handleDuplicate = useCallback(() => {
    if (!templateId) return;
    duplicateMutation.mutate({ id: templateId });
  }, [templateId, duplicateMutation]);

  const handleDelete = useCallback(() => {
    if (!templateId) return;
    deleteMutation.mutate({ id: templateId });
  }, [templateId, deleteMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <form
      onSubmit={form.handleSubmit(handleSave)}
      className="space-y-6"
    >
      {/* Header: name, type, status, actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          {/* Template name */}
          <Input
            className="h-auto border-0 p-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            placeholder={t("templateNamePlaceholder")}
            {...form.register("name")}
          />

          <div className="flex items-center gap-3">
            {/* Type select */}
            <Select
              value={form.watch("type")}
              onValueChange={(val) =>
                form.setValue("type", val as TemplateFormValues["type"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`type_${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status badge */}
            {isEditing && (
              <Badge
                className={STATUS_BADGE_STYLES[templateStatus] ?? ""}
                variant="secondary"
              >
                {templateStatus}
              </Badge>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Save */}
          <Button type="submit" disabled={isSaving}>
            {isDirty && (
              <span className="mr-1.5 inline-block size-2 rounded-full bg-current" />
            )}
            {t("saveTemplate")}
          </Button>

          {/* Activate (DRAFT only) */}
          {isEditing && templateStatus === "DRAFT" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleActivate}
              disabled={updateMutation.isPending}
            >
              {t("activate")}
            </Button>
          )}

          {/* Archive (ACTIVE only) */}
          {isEditing && templateStatus === "ACTIVE" && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button type="button" variant="outline" />}>
                {t("archive")}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("archiveConfirmTitle", { name: form.watch("name") })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("archiveConfirmBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive}>
                    {t("archiveConfirmCta")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Duplicate */}
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDuplicate}
              disabled={duplicateMutation.isPending}
            >
              {t("duplicate")}
            </Button>
          )}

          {/* Delete (DRAFT only) */}
          {isEditing && templateStatus === "DRAFT" && (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button type="button" variant="destructive" />}
              >
                {t("deleteTemplate")}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("deleteConfirmTitle", { name: form.watch("name") })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteConfirmBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t("deleteConfirmCta")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="template-description">{t("descriptionField")}</Label>
        <Textarea
          id="template-description"
          placeholder={t("descriptionPlaceholder")}
          rows={2}
          {...form.register("description")}
        />
      </div>

      {/* Tasks */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("tasksHeading")}</h2>
        <SortableTaskList
          fields={fields}
          tasks={tasks}
          form={form}
          onReorder={reorderTasks}
          onRemove={removeTask}
          onAdd={addTask}
        />
      </div>
    </form>
  );
}
