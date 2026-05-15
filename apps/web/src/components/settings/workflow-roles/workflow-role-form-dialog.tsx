'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

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

const EMPTY_TASK: WorkflowRoleTaskItem = {
  sortOrder: 0,
  titleEn: '',
  titlePl: '',
  titleDe: '',
  descriptionEn: '',
  descriptionPl: '',
  descriptionDe: '',
  dueDayOffset: 0,
  requiredDocs: [],
};

interface Props {
  mode: 'create' | 'edit';
  initial?: WorkflowRoleFormInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowRoleFormDialog({ mode, initial, open, onOpenChange }: Props) {
  const t = useTranslations('WorkflowRoles');
  const queryClient = useQueryClient();
  const id = useId();

  const [form, setForm] = useState<WorkflowRoleFormInput>(
    initial ?? {
      role: '',
      displayNameEn: '',
      displayNamePl: '',
      displayNameDe: '',
      taskItems: [{ ...EMPTY_TASK }],
    },
  );

  const onSuccess = useCallback(() => {
    toast.success(mode === 'create' ? t('toast.created') : t('toast.updated'));
    queryClient.invalidateQueries(trpc.workflowRoles.pathFilter());
    onOpenChange(false);
  }, [mode, t, queryClient, onOpenChange]);

  const createMutation = useMutation(
    trpc.workflowRoles.create.mutationOptions({
      onSuccess,
      onError: err => toast.error(err.message),
    }),
  );
  const updateMutation = useMutation(
    trpc.workflowRoles.update.mutationOptions({
      onSuccess,
      onError: err => toast.error(err.message),
    }),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const setField = useCallback(
    <K extends keyof WorkflowRoleFormInput>(field: K, value: WorkflowRoleFormInput[K]) => {
      setForm(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const setTaskField = useCallback(
    <K extends keyof WorkflowRoleTaskItem>(
      idx: number,
      field: K,
      value: WorkflowRoleTaskItem[K],
    ) => {
      setForm(prev => ({
        ...prev,
        taskItems: prev.taskItems.map((item, i) =>
          i === idx ? { ...item, [field]: value } : item,
        ),
      }));
    },
    [],
  );

  const addTask = useCallback(() => {
    setForm(prev => ({
      ...prev,
      taskItems: [...prev.taskItems, { ...EMPTY_TASK, sortOrder: prev.taskItems.length }],
    }));
  }, []);

  const removeTask = useCallback((idx: number) => {
    setForm(prev => ({
      ...prev,
      taskItems: prev.taskItems
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, sortOrder: i })),
    }));
  }, []);

  const moveTask = useCallback((idx: number, dir: -1 | 1) => {
    setForm(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.taskItems.length) return prev;
      const items = [...prev.taskItems];
      const [moved] = items.splice(idx, 1);
      if (!moved) return prev;
      items.splice(target, 0, moved);
      return {
        ...prev,
        taskItems: items.map((item, i) => ({ ...item, sortOrder: i })),
      };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (form.taskItems.length === 0) {
      toast.error(t('validation.atLeastOneTask'));
      return;
    }
    if (form.taskItems.length > 20) {
      toast.error(t('validation.maxTasks'));
      return;
    }
    const payload = {
      role: form.role,
      displayNameEn: form.displayNameEn,
      displayNamePl: form.displayNamePl || undefined,
      displayNameDe: form.displayNameDe || undefined,
      taskItems: form.taskItems.map(item => ({
        sortOrder: item.sortOrder,
        titleEn: item.titleEn,
        titlePl: item.titlePl || undefined,
        titleDe: item.titleDe || undefined,
        descriptionEn: item.descriptionEn || undefined,
        descriptionPl: item.descriptionPl || undefined,
        descriptionDe: item.descriptionDe || undefined,
        dueDayOffset: item.dueDayOffset,
        requiredDocs: item.requiredDocs.length > 0 ? item.requiredDocs : undefined,
      })),
    };
    if (mode === 'edit' && form.id) {
      updateMutation.mutate({ id: form.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [form, mode, t, createMutation, updateMutation]);

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
