"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ReminderRuleEditor } from "@/components/settings/reminder-rule-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReminderRule = {
  id: string;
  name: string;
  entityType: string;
  triggerType: string;
  offsetDays: number | null;
  offsetHours: number | null;
  channel: string;
  recipientMode: string;
  configJson: unknown;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const TRIGGER_LABEL_KEYS: Record<string, string> = {
  BEFORE_CONTRACT_END: "triggerBeforeContractEnd",
  BEFORE_DUE_DATE: "triggerBeforeDueDate",
  ON_DUE_DATE: "triggerOnDueDate",
  AFTER_DUE_DATE: "triggerAfterDueDate",
  BEFORE_DOCUMENT_EXPIRY: "triggerBeforeDocumentExpiry",
  ON_LIFECYCLE_CHANGE: "triggerOnLifecycleChange",
};

const CHANNEL_LABEL_KEYS: Record<string, string> = {
  IN_APP: "channelInApp",
  EMAIL: "channelEmail",
  SLACK: "channelSlack",
};

const RECIPIENT_LABEL_KEYS: Record<string, string> = {
  ENTITY_OWNER: "recipientEntityOwner",
  FINANCE_TEAM: "recipientFinanceTeam",
  ASSIGNEE: "recipientAssignee",
  SPECIFIC_USER: "recipientSpecificUser",
  ROLE: "recipientRole",
};

const CHANNEL_BADGE_VARIANT: Record<string, string> = {
  IN_APP: "bg-primary/10 text-primary",
  EMAIL: "bg-blue-500/10 text-blue-500",
  SLACK: "bg-purple-500/10 text-purple-500",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReminderRulesSection() {
  const t = useTranslations("Settings");
  const tAria = useTranslations("Common.aria");
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // ---- Data fetching ----
  const rulesQuery = useQuery(trpc.reminder.list.queryOptions());
  const rules = (rulesQuery.data ?? []) as ReminderRule[];

  // ---- Toggle active mutation ----
  const toggleActiveMutation = useMutation(
    trpc.reminder.toggleActive.mutationOptions({
      onSuccess: () => {
        toast.success(t("reminderRules.toasts.toggled"));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
      },
      onError: () => {
        toast.error(t("reminderRules.toasts.saveFailed"));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
      },
    }),
  );

  // ---- Delete mutation ----
  const deleteMutation = useMutation(
    trpc.reminder.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("reminderRules.toasts.deleted"));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
        setDeletingRuleId(null);
      },
      onError: () => {
        toast.error(t("reminderRules.toasts.deleteFailed"));
      },
    }),
  );

  // ---- Handlers ----
  function handleToggleActive(rule: ReminderRule) {
    toggleActiveMutation.mutate({ id: rule.id, active: !rule.active });
  }

  function handleEdit(rule: ReminderRule) {
    setEditingRule(rule);
    setEditorOpen(true);
  }

  function handleCreate() {
    setEditingRule(null);
    setEditorOpen(true);
  }

  function handleDelete(ruleId: string) {
    deleteMutation.mutate({ id: ruleId });
  }

  function getRuleDescription(rule: ReminderRule): string {
    const triggerKey = TRIGGER_LABEL_KEYS[rule.triggerType] ?? rule.triggerType;
    const recipientKey = RECIPIENT_LABEL_KEYS[rule.recipientMode] ?? rule.recipientMode;
    const channelKey = CHANNEL_LABEL_KEYS[rule.channel] ?? rule.channel;

    const triggerLabel = t(`reminderRules.editor.${triggerKey}` as Parameters<typeof t>[0]);
    const recipientLabel = t(`reminderRules.editor.${recipientKey}` as Parameters<typeof t>[0]);
    const channelLabel = t(`reminderRules.editor.${channelKey}` as Parameters<typeof t>[0]);

    if (rule.offsetDays) {
      return `${rule.offsetDays} ${t("reminderRules.editor.offsetDaysPlaceholder")} ${triggerLabel.toLowerCase()}, ${recipientLabel} ${channelLabel}`;
    }

    return `${triggerLabel}, ${recipientLabel} ${channelLabel}`;
  }

  // ---- Loading state ----
  if (rulesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-1 h-4 w-80" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={`skel-${i}`}>
            <CardHeader>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-64" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ---- Empty state ----
  if (rules.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Timer className="size-12 text-muted-foreground" />
          <h3 className="mt-4 text-base font-semibold">{t("reminderRules.emptyHeading")}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("reminderRules.emptyBody")}
          </p>
          <Button className="mt-4" onClick={handleCreate}>
            <Plus className="me-1.5 size-4" />
            {t("reminderRules.emptyCta")}
          </Button>
        </div>
        <ReminderRuleEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          rule={editingRule ?? undefined}
        />
      </>
    );
  }

  // ---- Populated state ----
  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">{t("reminderRules.heading")}</h3>
            <p className="text-sm text-muted-foreground">{t("reminderRules.description")}</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="me-1.5 size-4" />
            {t("reminderRules.createRule")}
          </Button>
        </div>

        {/* Rule cards */}
        {rules.map((rule) => {
          const channelBadgeClass =
            CHANNEL_BADGE_VARIANT[rule.channel] ?? "bg-muted text-muted-foreground";

          return (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{rule.name}</span>
                  <Switch
                    checked={rule.active}
                    onCheckedChange={() => handleToggleActive(rule)}
                    aria-label={tAria("toggleActive", { name: rule.name })}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{getRuleDescription(rule)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className={channelBadgeClass}>
                    {t(
                      `reminderRules.editor.${CHANNEL_LABEL_KEYS[rule.channel] ?? "channelInApp"}` as Parameters<
                        typeof t
                      >[0],
                    )}
                  </Badge>
                  <Badge variant="secondary">
                    {t(
                      `reminderRules.editor.${RECIPIENT_LABEL_KEYS[rule.recipientMode] ?? "recipientEntityOwner"}` as Parameters<
                        typeof t
                      >[0],
                    )}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                  <Pencil className="me-1.5 size-3.5" />
                  {t("reminderRules.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeletingRuleId(rule.id)}
                >
                  <Trash2 className="me-1.5 size-3.5" />
                  {t("reminderRules.delete")}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Rule editor dialog */}
      <ReminderRuleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editingRule ?? undefined}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deletingRuleId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRuleId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reminderRules.deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("reminderRules.deleteConfirm.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("reminderRules.deleteConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingRuleId) handleDelete(deletingRuleId);
              }}
            >
              {t("reminderRules.deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
