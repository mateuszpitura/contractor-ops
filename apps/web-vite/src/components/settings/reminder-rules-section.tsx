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
import { useCallback } from 'react';
import { renderEmptyStateAction } from '../shared/atelier-bridges';
import {
  useReminderRulesSection,
  type ReminderRule,
  type useReminderRulesSection as UseReminderRulesSection,
} from './hooks/use-reminder-rules-section.js';
import { CHANNEL_BADGE_VARIANT } from './hooks/use-reminder-rules-section.js';
import { ReminderRuleEditor } from './reminder-rule-editor.js';

export type { ReminderRule };

export type ReminderRulesSectionProps = ReturnType<typeof UseReminderRulesSection>;

interface ReminderRuleCardProps {
  rule: ReminderRule;
  t: ReminderRulesSectionProps['t'];
  tAria: ReminderRulesSectionProps['tAria'];
  togglePending: boolean;
  onToggleActive: ReminderRulesSectionProps['handleToggleActive'];
  onEdit: ReminderRulesSectionProps['handleEdit'];
  onRequestDelete: (ruleId: string) => void;
  getRuleDescription: ReminderRulesSectionProps['getRuleDescription'];
  channelLabelKeys: ReminderRulesSectionProps['CHANNEL_LABEL_KEYS'];
  recipientLabelKeys: ReminderRulesSectionProps['RECIPIENT_LABEL_KEYS'];
}

function ReminderRuleCard({
  rule,
  t,
  tAria,
  togglePending,
  onToggleActive,
  onEdit,
  onRequestDelete,
  getRuleDescription,
  channelLabelKeys,
  recipientLabelKeys,
}: ReminderRuleCardProps) {
  const channelBadgeClass = CHANNEL_BADGE_VARIANT[rule.channel] ?? 'bg-muted text-muted-foreground';

  const handleToggle = useCallback(() => onToggleActive(rule), [onToggleActive, rule]);
  const handleEditClick = useCallback(() => onEdit(rule), [onEdit, rule]);
  const handleDeleteClick = useCallback(() => onRequestDelete(rule.id), [onRequestDelete, rule.id]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{rule.name}</span>
          <Switch
            checked={rule.active}
            onCheckedChange={handleToggle}
            disabled={togglePending}
            aria-label={tAria('toggleActive', { name: rule.name })}
          />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{getRuleDescription(rule)}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="secondary" className={channelBadgeClass}>
            {t(
              `reminderRules.editor.${channelLabelKeys[rule.channel] ?? 'channelInApp'}` as Parameters<
                typeof t
              >[0],
            )}
          </Badge>
          <Badge variant="secondary">
            {t(
              `reminderRules.editor.${recipientLabelKeys[rule.recipientMode] ?? 'recipientEntityOwner'}` as Parameters<
                typeof t
              >[0],
            )}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="ghost" size="sm" onClick={handleEditClick}>
          <Pencil className="me-1.5 size-3.5" />
          {t('reminderRules.edit')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={handleDeleteClick}>
          <Trash2 className="me-1.5 size-3.5" />
          {t('reminderRules.delete')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ReminderRulesSectionView({
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
  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setDeletingRuleId(null);
    },
    [setDeletingRuleId],
  );
  const handleConfirmDelete = useCallback(() => {
    if (deletingRuleId) handleDelete(deletingRuleId);
  }, [deletingRuleId, handleDelete]);

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
        <ReminderRuleEditor
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
          <Button onClick={handleCreate}>
            <Plus className="me-1.5 size-4" />
            {t('reminderRules.createRule')}
          </Button>
        </div>

        {rules.map(rule => (
          <ReminderRuleCard
            key={rule.id}
            rule={rule}
            t={t}
            tAria={tAria}
            togglePending={toggleActiveMutation.isPending}
            onToggleActive={handleToggleActive}
            onEdit={handleEdit}
            onRequestDelete={setDeletingRuleId}
            getRuleDescription={getRuleDescription}
            channelLabelKeys={CHANNEL_LABEL_KEYS}
            recipientLabelKeys={RECIPIENT_LABEL_KEYS}
          />
        ))}
      </div>

      <ReminderRuleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editingRule ?? undefined}
      />

      <AlertDialog open={deletingRuleId !== null} onOpenChange={handleDeleteDialogOpenChange}>
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
              onClick={handleConfirmDelete}>
              {t('reminderRules.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ReminderRulesSection() {
  const section = useReminderRulesSection();
  return <ReminderRulesSectionView {...section} />;
}
