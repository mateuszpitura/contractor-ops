'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  GripVertical,
  KeyRound,
  Monitor,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { JiraTaskConfig } from '@/components/integrations/jira-task-config';
import { LinearTaskConfig } from '@/components/integrations/linear-task-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CalendarTaskConfig } from '@/components/workflow/calendar-task-config';
import { trpc } from '@/trpc/init';
import { ConditionBuilder, getConditionSummary } from './condition-builder';
import type { TaskFormValues, TemplateFormValues } from './use-template-form';

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
  'DOCUMENT_COLLECTION',
  'APPROVAL',
  'ACCESS_GRANT',
  'ACCESS_REVOKE',
  'FINANCE_SETUP',
  'EQUIPMENT',
  'KNOWLEDGE_TRANSFER',
  'MEETING',
  'MANUAL',
  'NOTIFICATION',
] as const;

const ASSIGNEE_MODES = [
  'FIXED_USER',
  'ROLE_BASED',
  'CONTRACTOR_OWNER',
  'CONTRACT_OWNER',
  'PROJECT_MANAGER',
] as const;

const USER_ROLES = [
  'ORG_ADMIN',
  'FINANCE_ADMIN',
  'OPS_MANAGER',
  'TEAM_MANAGER',
  'LEGAL_VIEWER',
  'IT_ADMIN',
  'ACCOUNTANT',
  'READ_ONLY',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskCard({ index, onRemove, allTasks, form, dragHandleProps }: TaskCardProps) {
  const t = useTranslations('Workflows');
  const [isOpen, setIsOpen] = useState(false);

  const task = form.watch(`tasks.${index}`);
  const taskType = task?.taskType ?? 'MANUAL';
  const assigneeMode = task?.assigneeMode ?? 'ROLE_BASED';
  const title = task?.title ?? '';
  const conditions = task?.conditions ?? null;

  const TypeIcon = TASK_TYPE_ICONS[taskType] ?? ClipboardList;

  // Fetch users for FIXED_USER mode
  const usersQuery = useQuery({
    ...trpc.user.list.queryOptions(),
    enabled: assigneeMode === 'FIXED_USER',
  });

  const users = usersQuery.data ?? [];

  const taskTypeItems = TASK_TYPES.map(type => ({
    value: type,
    label: t(`taskType_${type}`),
  }));

  const assigneeModeItems = ASSIGNEE_MODES.map(mode => ({
    value: mode,
    label: t(`assigneeMode_${mode}`),
  }));

  const userRoleItems = USER_ROLES.map(role => ({
    value: role,
    label: role
      .split('_')
      .map(w => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' '),
  }));

  const conditionSummary = getConditionSummary(
    conditions as Parameters<typeof getConditionSummary>[0],
    t as (key: string, values?: Record<string, string | number>) => string,
  );

  // Dependency options: only tasks with lower sortOrder
  const dependencyOptions = allTasks
    .filter((_, i) => i < index)
    .map((t, i) => ({
      value: t.id ?? `task-${i}`,
      label: t.title || `Task ${i + 1}`,
    }));

  const handleConditionsChange = useCallback(
    (val: Parameters<typeof getConditionSummary>[0]) => {
      form.setValue(`tasks.${index}.conditions`, val, { shouldDirty: true });
    },
    [form, index],
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        {/* Collapsed header */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Drag handle */}
          <button
            type="button"
            className="flex cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...(dragHandleProps?.attributes as React.HTMLAttributes<HTMLButtonElement>)}
            {...(dragHandleProps?.listeners as React.HTMLAttributes<HTMLButtonElement>)}>
            <GripVertical className="size-5" />
          </button>

          {/* Title + badges */}
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`truncate text-sm ${title ? 'font-medium' : 'text-muted-foreground'}`}>
              {title || t('untitledTask')}
            </span>

            <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
              <TypeIcon className="size-3" />
              {t(`taskType_${taskType}`)}
            </Badge>

            {!!task?.assigneeMode && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {t(`assigneeMode_${assigneeMode}`)}
              </span>
            )}

            {task?.dueOffsetDays ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {task.dueOffsetDays}
                {t('dueOffsetDays')}
              </span>
            ) : null}

            {!!task?.required && (
              <Badge variant="default" className="shrink-0 text-xs">
                {t('requiredTask')}
              </Badge>
            )}

            {conditionSummary && (
              <Badge variant="outline" className="max-w-[240px] shrink-0 truncate text-xs">
                {conditionSummary}
              </Badge>
            )}

            <span className="ms-auto shrink-0 text-muted-foreground">
              {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </span>
          </CollapsibleTrigger>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 py-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor={`task-title-${index}`}>{t('taskTitle')}</Label>
              <Input
                id={`task-title-${index}`}
                placeholder={t('taskTitlePlaceholder')}
                {...form.register(`tasks.${index}.title`)}
              />
            </div>

            {/* Task type */}
            <div className="space-y-1.5">
              <Label htmlFor={`task-type-${index}`}>{t('taskType')}</Label>
              <Select
                value={taskType}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                onValueChange={val =>
                  form.setValue(`tasks.${index}.taskType`, val as typeof taskType, {
                    shouldDirty: true,
                  })
                }
                items={taskTypeItems}>
                <SelectTrigger id={`task-type-${index}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypeItems.map(item => {
                    const Icon = TASK_TYPE_ICONS[item.value] ?? ClipboardList;
                    return (
                      <SelectItem key={item.value} value={item.value}>
                        <Icon className="me-1.5 inline-block size-3.5" />
                        {item.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor={`task-desc-${index}`}>{t('taskDescription')}</Label>
              <Textarea
                id={`task-desc-${index}`}
                placeholder={t('descriptionPlaceholder')}
                rows={2}
                {...form.register(`tasks.${index}.description`)}
              />
            </div>

            {/* Assignee mode */}
            <div className="space-y-1.5">
              <Label htmlFor={`task-assignee-${index}`}>{t('assignedTo')}</Label>
              <Select
                value={assigneeMode}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                onValueChange={val =>
                  form.setValue(`tasks.${index}.assigneeMode`, val as typeof assigneeMode, {
                    shouldDirty: true,
                  })
                }
                items={assigneeModeItems}>
                <SelectTrigger id={`task-assignee-${index}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assigneeModeItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional: Role select (when ROLE_BASED) */}
            {assigneeMode === 'ROLE_BASED' && (
              <div className="space-y-1.5">
                <Label htmlFor={`task-role-${index}`}>{t('roleField')}</Label>
                <Select
                  value={task?.assigneeRole ?? ''}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onValueChange={val =>
                    form.setValue(
                      `tasks.${index}.assigneeRole`,
                      val as (typeof USER_ROLES)[number],
                      { shouldDirty: true },
                    )
                  }
                  items={userRoleItems}>
                  <SelectTrigger id={`task-role-${index}`} className="w-full">
                    <SelectValue placeholder={t('rolePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {userRoleItems.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Conditional: User select (when FIXED_USER) */}
            {assigneeMode === 'FIXED_USER' && (
              <div className="space-y-1.5">
                <Label htmlFor={`task-user-${index}`}>{t('userField')}</Label>
                {(() => {
                  const userItems = users.map(user => ({
                    value: user.id as string,
                    label: ((user.name ?? user.email) as string) ?? '',
                  }));
                  return (
                    <Select
                      value={task?.assigneeUserId ?? ''}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                      onValueChange={val =>
                        form.setValue(`tasks.${index}.assigneeUserId`, val as string, {
                          shouldDirty: true,
                        })
                      }
                      items={userItems}>
                      <SelectTrigger id={`task-user-${index}`} className="w-full">
                        <SelectValue placeholder={t('userPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {userItems.map((item: { value: string; label: string }) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
            )}

            {/* Due offset */}
            <div className="space-y-1.5">
              <Label id={`task-due-label-${index}`}>{t('dueOffset')}</Label>
              <fieldset
                className="flex items-center gap-2"
                aria-labelledby={`task-due-label-${index}`}>
                <Input
                  id={`task-due-days-${index}`}
                  type="number"
                  min={0}
                  className="w-24"
                  placeholder="0"
                  {...form.register(`tasks.${index}.dueOffsetDays`, {
                    valueAsNumber: true,
                  })}
                  aria-label={t('dueOffsetDays')}
                />
                <span className="text-sm text-muted-foreground">{t('dueOffsetDays')}</span>
                <Input
                  id={`task-due-hours-${index}`}
                  type="number"
                  min={0}
                  className="w-24"
                  placeholder="0"
                  {...form.register(`tasks.${index}.dueOffsetHours`, {
                    valueAsNumber: true,
                  })}
                  aria-label={t('dueOffsetHours')}
                />
                <span className="text-sm text-muted-foreground">{t('dueOffsetHours')}</span>
              </fieldset>
            </div>

            {/* Required toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id={`task-required-${index}`}
                checked={task?.required ?? false}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                onCheckedChange={checked =>
                  form.setValue(`tasks.${index}.required`, !!checked, {
                    shouldDirty: true,
                  })
                }
              />
              <Label htmlFor={`task-required-${index}`}>{t('requiredTask')}</Label>
            </div>

            {/* Dependency */}
            <div className="space-y-1.5">
              <Label htmlFor={`task-depends-${index}`}>{t('dependsOn')}</Label>
              {(() => {
                const depItems = [
                  { value: '__none__', label: t('noDependency') },
                  ...dependencyOptions,
                ];
                return (
                  <Select
                    value={task?.dependsOnTaskTemplateId ?? ''}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onValueChange={val =>
                      form.setValue(
                        `tasks.${index}.dependsOnTaskTemplateId`,
                        val === '__none__' ? undefined : (val as string),
                        { shouldDirty: true },
                      )
                    }
                    items={depItems}>
                    <SelectTrigger id={`task-depends-${index}`} className="w-full">
                      <SelectValue placeholder={t('dependsOnPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {depItems.map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <Label>{t('conditions')}</Label>
              <ConditionBuilder
                value={conditions as Parameters<typeof ConditionBuilder>[0]['value']}
                onChange={handleConditionsChange}
              />
            </div>

            {/* Jira integration — only for saved task templates */}
            {!!task?.id && <JiraTaskConfig taskTemplateId={task.id} />}

            {/* Linear integration — only for saved task templates (D-05) */}
            {!!task?.id && <LinearTaskConfig taskTemplateId={task.id} />}

            {/* Calendar integration — only for saved task templates */}
            {!!task?.id && <CalendarTaskConfig taskTemplateId={task.id} />}

            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-3">
              <button
                type="button"
                className="text-sm text-destructive hover:underline"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => onRemove(index)}>
                {t('removeTask')}
              </button>
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
                {t('doneEditing')}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
