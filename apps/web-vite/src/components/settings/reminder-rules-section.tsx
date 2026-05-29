import { AtelierEmptyState, NotificationsIllustration } from '@contractor-ops/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { renderEmptyStateAction } from '../shared/atelier-bridges';
import type { ReminderRule, useReminderRulesSection } from './hooks/use-reminder-rules-section.js';
import { CHANNEL_BADGE_VARIANT } from './hooks/use-reminder-rules-section.js';
import { ReminderRuleEditorContainer } from './reminder-rule-editor-container.js';

export type { ReminderRule };

export type ReminderRulesSectionProps = ReturnType<typeof useReminderRulesSection>;

export function ReminderRulesSection({
  t,
  tAria,
  rulesQuery,
  rules,
  editorOpen,
  setEditorOpen,
  editingRule,
  deletingRuleId,
  setDeletingRuleId,
  toggleActiveMutation,
  deleteMutation,
  handleToggleActive,
  handleEdit,
  handleCreate,
  handleDelete,
  getRuleDescription,
  CHANNEL_LABEL_KEYS,
  RECIPIENT_LABEL_KEYS,
}: ReminderRulesSectionProps) {
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
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
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

  if (rules.length === 0) {
    return (
      <>
        <AtelierEmptyState
          variant="subview"
          illustration={NotificationsIllustration}
          heading={t('reminderRules.emptyHeading')}
          body={t('reminderRules.emptyBody')}
          primaryAction={{
            label: t('reminderRules.emptyCta'),
            onClick: handleCreate,
            icon: Plus,
          }}
          renderAction={renderEmptyStateAction}
        />
        <ReminderRuleEditorContainer
          open={editorOpen}
          onOpenChange={setEditorOpen}
          rule={editingRule ?? undefined}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">{t('reminderRules.heading')}</h3>
            <p className="text-sm text-muted-foreground">{t('reminderRules.description')}</p>
          </div>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button onClick={handleCreate}>
            <Plus className="me-1.5 size-4" />
            {t('reminderRules.createRule')}
          </Button>
        </div>

        {rules.map(rule => {
          const channelBadgeClass =
            CHANNEL_BADGE_VARIANT[rule.channel] ?? 'bg-muted text-muted-foreground';

          return (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{rule.name}</span>
                  <Switch
                    checked={rule.active}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onCheckedChange={() => handleToggleActive(rule)}
                    disabled={toggleActiveMutation.isPending}
                    aria-label={tAria('toggleActive', { name: rule.name })}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{getRuleDescription(rule)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className={channelBadgeClass}>
                    {t(
                      `reminderRules.editor.${CHANNEL_LABEL_KEYS[rule.channel] ?? 'channelInApp'}` as Parameters<
                        typeof t
                      >[0],
                    )}
                  </Badge>
                  <Badge variant="secondary">
                    {t(
                      `reminderRules.editor.${RECIPIENT_LABEL_KEYS[rule.recipientMode] ?? 'recipientEntityOwner'}` as Parameters<
                        typeof t
                      >[0],
                    )}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                  <Pencil className="me-1.5 size-3.5" />
                  {t('reminderRules.edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => setDeletingRuleId(rule.id)}>
                  <Trash2 className="me-1.5 size-3.5" />
                  {t('reminderRules.delete')}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <ReminderRuleEditorContainer
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editingRule ?? undefined}
      />

      <AlertDialog
        open={deletingRuleId !== null}
        // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
        onOpenChange={open => {
          if (!open) setDeletingRuleId(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('reminderRules.deleteConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('reminderRules.deleteConfirm.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('reminderRules.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                if (deletingRuleId) handleDelete(deletingRuleId);
              }}>
              {t('reminderRules.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
