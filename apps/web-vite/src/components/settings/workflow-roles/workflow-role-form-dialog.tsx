import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { useWorkflowRoleFormDialog as UseWorkflowRoleFormDialog } from './hooks/use-workflow-role-form-dialog.js';
import { useWorkflowRoleFormDialog } from './hooks/use-workflow-role-form-dialog.js';

type SetTaskField = ReturnType<typeof useWorkflowRoleFormDialog>['setTaskField'];
type MoveTask = ReturnType<typeof useWorkflowRoleFormDialog>['moveTask'];
type RemoveTask = ReturnType<typeof useWorkflowRoleFormDialog>['removeTask'];
type TranslateFn = ReturnType<typeof useWorkflowRoleFormDialog>['t'];

interface TaskItemRowProps {
  idx: number;
  item: WorkflowRoleTaskItem;
  id: string;
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
  setTaskField: SetTaskField;
  moveTask: MoveTask;
  removeTask: RemoveTask;
  t: TranslateFn;
}

function TaskItemRow({
  idx,
  item,
  id,
  isFirst,
  isLast,
  isOnly,
  setTaskField,
  moveTask,
  removeTask,
  t,
}: TaskItemRowProps) {
  const handleMoveUp = useCallback(() => moveTask(idx, -1), [moveTask, idx]);
  const handleMoveDown = useCallback(() => moveTask(idx, 1), [moveTask, idx]);
  const handleRemove = useCallback(() => removeTask(idx), [removeTask, idx]);
  const handleTitleEn = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTaskField(idx, 'titleEn', e.target.value),
    [setTaskField, idx],
  );
  const handleTitlePl = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTaskField(idx, 'titlePl', e.target.value),
    [setTaskField, idx],
  );
  const handleTitleDe = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTaskField(idx, 'titleDe', e.target.value),
    [setTaskField, idx],
  );
  const handleDescriptionEn = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      setTaskField(idx, 'descriptionEn', e.target.value),
    [setTaskField, idx],
  );
  const handleDueDay = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setTaskField(idx, 'dueDayOffset', parseInt(e.target.value, 10) || 0),
    [setTaskField, idx],
  );
  const handleRequiredDocs = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setTaskField(
        idx,
        'requiredDocs',
        e.target.value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      ),
    [setTaskField, idx],
  );

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('form.taskNumber', { n: idx + 1 })}</span>
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isFirst}
            aria-label={t('form.moveUp')}
            onClick={handleMoveUp}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isLast}
            aria-label={t('form.moveDown')}
            onClick={handleMoveDown}>
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('form.removeTask')}
            className="text-destructive hover:text-destructive"
            onClick={handleRemove}
            disabled={isOnly}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder={t('form.titleEn')} value={item.titleEn} onChange={handleTitleEn} />
        <Input placeholder={t('form.titlePl')} value={item.titlePl} onChange={handleTitlePl} />
        <Input placeholder={t('form.titleDe')} value={item.titleDe} onChange={handleTitleDe} />
      </div>
      <Textarea
        placeholder={t('form.descriptionEn')}
        rows={2}
        value={item.descriptionEn}
        onChange={handleDescriptionEn}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${id}-due-${idx}`} className="text-xs">
            {t('form.dueDayOffset')}
          </Label>
          <Input
            id={`${id}-due-${idx}`}
            type="number"
            min={0}
            value={item.dueDayOffset}
            onChange={handleDueDay}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-docs-${idx}`} className="text-xs">
            {t('form.requiredDocs')}
          </Label>
          <Input
            id={`${id}-docs-${idx}`}
            value={item.requiredDocs.join(', ')}
            onChange={handleRequiredDocs}
            placeholder={t('form.requiredDocsHint')}
          />
        </div>
      </div>
    </div>
  );
}

export interface WorkflowRoleTaskItem {
  sortOrder: number;
  titleEn: string;
  titlePl: string;
  titleDe: string;
  descriptionEn: string;
  descriptionPl: string;
  descriptionDe: string;
  dueDayOffset: number;
  requiredDocs: string[];
}

export interface WorkflowRoleFormInput {
  id?: string;
  role: string;
  displayNameEn: string;
  displayNamePl: string;
  displayNameDe: string;
  taskItems: WorkflowRoleTaskItem[];
}

interface WorkflowRoleFormDialogBaseProps {
  mode: 'create' | 'edit';
  initial?: WorkflowRoleFormInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type WorkflowRoleFormDialogProps = WorkflowRoleFormDialogBaseProps &
  ReturnType<typeof UseWorkflowRoleFormDialog>;

export function WorkflowRoleFormDialogView({
  mode,
  open,
  onOpenChange,
  id,
  t,
  form,
  setField,
  setTaskField,
  addTask,
  removeTask,
  moveTask,
  handleSubmit,
  isPending,
}: WorkflowRoleFormDialogProps) {
  const handleRoleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setField('role', e.target.value),
    [setField],
  );
  const handleNameEnChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setField('displayNameEn', e.target.value),
    [setField],
  );
  const handleNamePlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setField('displayNamePl', e.target.value),
    [setField],
  );
  const handleNameDeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setField('displayNameDe', e.target.value),
    [setField],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('form.titleCreate') : t('form.titleEdit')}
          </DialogTitle>
          <DialogDescription>{t('form.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`${id}-role`}>{t('form.roleSlug')}</Label>
                <Input
                  id={`${id}-role`}
                  value={form.role}
                  onChange={handleRoleChange}
                  placeholder="finance_lead"
                  disabled={mode === 'edit'}
                  pattern="^[a-z0-9_-]+$"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('form.roleSlugHint')}</p>
              </div>
              <div>
                <Label htmlFor={`${id}-name-en`}>{t('form.displayNameEn')}</Label>
                <Input
                  id={`${id}-name-en`}
                  value={form.displayNameEn}
                  onChange={handleNameEnChange}
                />
              </div>
              <div>
                <Label htmlFor={`${id}-name-pl`}>{t('form.displayNamePl')}</Label>
                <Input
                  id={`${id}-name-pl`}
                  value={form.displayNamePl}
                  onChange={handleNamePlChange}
                />
              </div>
              <div>
                <Label htmlFor={`${id}-name-de`}>{t('form.displayNameDe')}</Label>
                <Input
                  id={`${id}-name-de`}
                  value={form.displayNameDe}
                  onChange={handleNameDeChange}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('form.taskItemsLabel')}</Label>
                <Button type="button" size="sm" variant="outline" onClick={addTask}>
                  <Plus className="me-1 size-3.5" />
                  {t('form.addTask')}
                </Button>
              </div>
              {form.taskItems.map((item, idx) => (
                <TaskItemRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: client-only editable task list with no stable identity field — sortOrder is reassigned to the array index on every add/remove/move, so it offers no improvement over the index
                  key={idx}
                  idx={idx}
                  item={item}
                  id={id}
                  isFirst={idx === 0}
                  isLast={idx === form.taskItems.length - 1}
                  isOnly={form.taskItems.length === 1}
                  setTaskField={setTaskField}
                  moveTask={moveTask}
                  removeTask={removeTask}
                  t={t}
                />
              ))}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            {t('form.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {mode === 'create' ? t('form.create') : t('form.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkflowRoleFormDialog({
  mode,
  initial,
  open,
  onOpenChange,
}: WorkflowRoleFormDialogBaseProps) {
  const form = useWorkflowRoleFormDialog({ mode, initial, onOpenChange });
  return (
    <WorkflowRoleFormDialogView
      mode={mode}
      initial={initial}
      open={open}
      onOpenChange={onOpenChange}
      {...form}
    />
  );
}
