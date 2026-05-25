/**
 * TemplateForm — presentational workflow template create/edit form.
 */

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
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useId } from 'react';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { useTemplateFormSection } from '../hooks/use-template-form-section.js';
import { SortableTaskList } from './sortable-task-list.js';
import type { TemplateFormValues } from './use-template-form.js';

const TEMPLATE_TYPES = [
  'ONBOARDING',
  'OFFBOARDING',
  'DOCUMENT_COLLECTION',
  'COMPLIANCE_REVIEW',
  'CUSTOM',
] as const;

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-green-500/10 text-green-800 dark:text-green-400',
  ARCHIVED: 'bg-muted/50 text-muted-foreground/60',
};

type TemplateFormProps = ReturnType<typeof useTemplateFormSection>;

export function TemplateForm({
  form,
  fields,
  tasks,
  isDirty,
  addTask,
  removeTask,
  reorderTasks,
  templateStatus,
  isEditing,
  isSaving,
  isUpdatePending,
  isDuplicatePending,
  isDeletePending,
  handleSave,
  handleActivate,
  handleArchive,
  handleDuplicate,
  handleDelete,
}: TemplateFormProps) {
  const t = useTranslations('Workflows');
  const reactId = useId();

  const templateTypeItems = TEMPLATE_TYPES.map(type => ({
    value: type,
    label: tDynLoose(t, 'type', enumKey(type)),
  }));

  return (
    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${reactId}-template-name`}>{t('templateName')}</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Input
            id={`${reactId}-template-name`}
            className="min-w-0 flex-1"
            aria-invalid={!!form.formState.errors.name}
            placeholder={t('templateNamePlaceholder')}
            {...form.register('name')}
          />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="submit" disabled={isSaving || !form.watch('name').trim()}>
              {!!isDirty && <span className="me-1.5 inline-block size-2 rounded-full bg-current" />}
              {t('saveTemplate')}
            </Button>
            {isEditing && templateStatus === 'DRAFT' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleActivate}
                disabled={isUpdatePending}>
                {t('activate')}
              </Button>
            )}
            {isEditing && templateStatus === 'ACTIVE' && (
              <AlertDialog>
                <AlertDialogTrigger render={<Button type="button" variant="outline" />}>
                  {t('archive')}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('archiveConfirmTitle', { name: form.watch('name') })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t('archiveConfirmBody')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchive}>
                      {t('archiveConfirmCta')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDuplicate}
                disabled={isDuplicatePending}>
                {t('duplicate')}
              </Button>
            )}
            {isEditing && templateStatus === 'DRAFT' && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button type="button" variant="destructive" className="ms-auto" />}>
                  {t('deleteTemplate')}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('deleteConfirmTitle', { name: form.watch('name') })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t('deleteConfirmBody')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction disabled={isDeletePending} onClick={handleDelete}>
                      {t('deleteConfirmCta')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        {!!form.formState.errors.name?.message && (
          <p className="text-sm text-destructive" role="alert">
            {t('validationTemplateNameRequired')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={`${reactId}-template-type`}>{t('columns.templateType')}</Label>
          <Select
            value={form.watch('type')}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
            onValueChange={val =>
              form.setValue('type', val as TemplateFormValues['type'], {
                shouldDirty: true,
              })
            }
            items={templateTypeItems}>
            <SelectTrigger
              id={`${reactId}-template-type`}
              aria-label={t('columns.templateType')}
              className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templateTypeItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isEditing && (
          <div className="shrink-0 space-y-1.5 sm:max-w-[200px]">
            <p className="text-sm font-medium leading-none">{t('columns.status')}</p>
            <div className="flex min-h-8 items-center">
              <Badge className={STATUS_BADGE_STYLES[templateStatus] ?? ''} variant="secondary">
                {tDynLoose(t, 'templateStatus', enumKey(templateStatus))}
              </Badge>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${reactId}-template-description`}>{t('descriptionField')}</Label>
        <Textarea
          id={`${reactId}-template-description`}
          placeholder={t('descriptionPlaceholder')}
          rows={2}
          {...form.register('description')}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">{t('tasksHeading')}</h2>
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
