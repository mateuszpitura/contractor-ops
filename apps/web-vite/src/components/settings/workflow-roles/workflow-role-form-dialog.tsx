import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
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
import type { useWorkflowRoleFormDialog } from './hooks/use-workflow-role-form-dialog.js';

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
  ReturnType<typeof useWorkflowRoleFormDialog>;

export function WorkflowRoleFormDialog({
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('form.titleCreate') : t('form.titleEdit')}
          </DialogTitle>
          <DialogDescription>{t('form.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${id}-role`}>{t('form.roleSlug')}</Label>
              <Input
                id={`${id}-role`}
                value={form.role}
                onChange={e => setField('role', e.target.value)}
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
                onChange={e => setField('displayNameEn', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${id}-name-pl`}>{t('form.displayNamePl')}</Label>
              <Input
                id={`${id}-name-pl`}
                value={form.displayNamePl}
                onChange={e => setField('displayNamePl', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${id}-name-de`}>{t('form.displayNameDe')}</Label>
              <Input
                id={`${id}-name-de`}
                value={form.displayNameDe}
                onChange={e => setField('displayNameDe', e.target.value)}
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
              // biome-ignore lint/suspicious/noArrayIndexKey: order managed via sortOrder
              <div key={idx} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t('form.taskNumber', { n: idx + 1 })}
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={idx === 0}
                      aria-label={t('form.moveUp')}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => moveTask(idx, -1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={idx === form.taskItems.length - 1}
                      aria-label={t('form.moveDown')}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => moveTask(idx, 1)}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('form.removeTask')}
                      className="text-destructive hover:text-destructive"
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => removeTask(idx)}
                      disabled={form.taskItems.length === 1}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder={t('form.titleEn')}
                    value={item.titleEn}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onChange={e => setTaskField(idx, 'titleEn', e.target.value)}
                  />
                  <Input
                    placeholder={t('form.titlePl')}
                    value={item.titlePl}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onChange={e => setTaskField(idx, 'titlePl', e.target.value)}
                  />
                  <Input
                    placeholder={t('form.titleDe')}
                    value={item.titleDe}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onChange={e => setTaskField(idx, 'titleDe', e.target.value)}
                  />
                </div>
                <Textarea
                  placeholder={t('form.descriptionEn')}
                  rows={2}
                  value={item.descriptionEn}
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onChange={e => setTaskField(idx, 'descriptionEn', e.target.value)}
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
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onChange={e =>
                        setTaskField(idx, 'dueDayOffset', parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${id}-docs-${idx}`} className="text-xs">
                      {t('form.requiredDocs')}
                    </Label>
                    <Input
                      id={`${id}-docs-${idx}`}
                      value={item.requiredDocs.join(', ')}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onChange={e =>
                        setTaskField(
                          idx,
                          'requiredDocs',
                          e.target.value
                            .split(',')
                            .map(s => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder={t('form.requiredDocsHint')}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
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
