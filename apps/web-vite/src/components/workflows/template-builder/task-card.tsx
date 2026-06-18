/**
 * TaskCard — collapsible task editor inside the template builder.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card } from '@contractor-ops/ui/components/shadcn/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { workflowAssignableRoleValues } from '@contractor-ops/validators/roles';
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
import { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { JiraTaskConfig } from '../../integrations/jira-task-config.js';
import { LinearTaskConfig } from '../../integrations/linear-task-config.js';
import { CalendarTaskConfig } from '../calendar-task-config.js';
import { useTaskCardTemplateUsers } from '../hooks/use-task-card-template-users.js';
import { ConditionBuilder, getConditionSummary } from './condition-builder.js';
import type { TaskFormValues, TemplateFormValues } from './use-template-form.js';

export interface TaskCardProps {
  index: number;
  onRemove: (index: number) => void;
  allTasks: TaskFormValues[];
  form: UseFormReturn<TemplateFormValues>;
  dragHandleProps?: {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
  };
  users: Array<{ id: string; name?: string | null; email?: string | null }>;
  usersQuery: { isLoading: boolean };
  /**
   * Container-decided flag — true when `assigneeMode === 'FIXED_USER'` and the
   * users query is still loading. The view renders a placeholder instead of
   * the user `<Select>` to avoid flicker.
   */
  isFixedUserLoading?: boolean;
}

export type TaskCardContainerProps = Omit<
  TaskCardProps,
  'users' | 'usersQuery' | 'isFixedUserLoading'
>;

interface FixedUserFieldProps {
  index: number;
  form: UseFormReturn<TemplateFormValues>;
  users: Array<{ id: string; name?: string | null; email?: string | null }>;
  isLoading: boolean;
  value: string;
  t: ReturnType<typeof useTranslations>;
}

function FixedUserField({ index, form, users, isLoading, value, t }: FixedUserFieldProps) {
  const handleUserChange = useCallback(
    (val: string | null) =>
      form.setValue(`tasks.${index}.assigneeUserId`, val ?? '', {
        shouldDirty: true,
      }),
    [form, index],
  );

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`task-user-${index}`}>{t('userField')}</Label>
        <div
          id={`task-user-${index}`}
          role="status"
          aria-busy="true"
          aria-label={t('userPlaceholder')}
          className="h-9 w-full animate-pulse rounded-md border bg-muted/40"
        />
      </div>
    );
  }

  const userItems = users.map(user => ({
    value: user.id as string,
    label: ((user.name ?? user.email) as string) ?? '',
  }));

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`task-user-${index}`}>{t('userField')}</Label>
      <Select value={value} onValueChange={handleUserChange} items={userItems}>
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
    </div>
  );
}

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

const USER_ROLES = workflowAssignableRoleValues;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: task card view renders many conditional branches per task type and assignee mode (role/user/conditions); the branch density is intrinsic to the editor's states.
export function TaskCard({
  index,
  onRemove,
  allTasks,
  form,
  dragHandleProps,
  users,
  isFixedUserLoading = false,
}: TaskCardProps) {
  const t = useTranslations('Workflows');
  const tAria = useTranslations('Common.aria');
  const [isOpen, setIsOpen] = useState(false);

  const task = form.watch(`tasks.${index}`);
  const taskType = task?.taskType ?? 'MANUAL';
  const assigneeMode = task?.assigneeMode ?? 'ROLE_BASED';
  const title = task?.title ?? '';
  const conditions = task?.conditions ?? null;

  const TypeIcon = TASK_TYPE_ICONS[taskType] ?? ClipboardList;

  const taskTypeItems = TASK_TYPES.map(type => ({
    value: type,
    label: tDynLoose(t, 'taskType', enumKey(type)),
  }));

  const assigneeModeItems = ASSIGNEE_MODES.map(mode => ({
    value: mode,
    label: tDynLoose(t, 'assigneeMode', enumKey(mode)),
  }));

  const userRoleItems = USER_ROLES.map(role => ({
    value: role,
    label: role
      .split('_')
      .map(w => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' '),
  }));

  const conditionSummary = getConditionSummary(
    conditions,
    t as (key: string, values?: Record<string, string | number>) => string,
  );

  const dependencyOptions = allTasks
    .filter((_, i) => i < index)
    .map((tk, i) => ({
      value: tk.id ?? `task-${i}`,
      label: tk.title || `Task ${i + 1}`,
    }));

  const handleConditionsChange = useCallback(
    (val: Parameters<typeof getConditionSummary>[0]) => {
      form.setValue(`tasks.${index}.conditions`, val, { shouldDirty: true });
    },
    [form, index],
  );

  const handleTaskTypeChange = useCallback(
    (val: string | null) => {
      if (val) {
        form.setValue(`tasks.${index}.taskType`, val as typeof taskType, {
          shouldDirty: true,
        });
      }
    },
    [form, index],
  );

  const handleAssigneeModeChange = useCallback(
    (val: string | null) => {
      if (val) {
        form.setValue(`tasks.${index}.assigneeMode`, val as typeof assigneeMode, {
          shouldDirty: true,
        });
      }
    },
    [form, index],
  );

  const handleAssigneeRoleChange = useCallback(
    (val: string | null) => {
      if (val) {
        form.setValue(`tasks.${index}.assigneeRole`, val as (typeof USER_ROLES)[number], {
          shouldDirty: true,
        });
      }
    },
    [form, index],
  );

  const handleRequiredChange = useCallback(
    (checked: boolean) =>
      form.setValue(`tasks.${index}.required`, !!checked, {
        shouldDirty: true,
      }),
    [form, index],
  );

  const handleDependsOnChange = useCallback(
    (val: string | null) =>
      form.setValue(
        `tasks.${index}.dependsOnTaskTemplateId`,
        !val || val === '__none__' ? undefined : val,
        { shouldDirty: true },
      ),
    [form, index],
  );

  const handleRemoveClick = useCallback(() => onRemove(index), [onRemove, index]);
  const handleCollapse = useCallback(() => setIsOpen(false), []);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            aria-label={tAria('dragToReorder')}
            className="flex cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...(dragHandleProps?.attributes as React.HTMLAttributes<HTMLButtonElement>)}
            {...(dragHandleProps?.listeners as React.HTMLAttributes<HTMLButtonElement>)}>
            <GripVertical className="size-5" aria-hidden="true" />
          </button>

          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`truncate text-sm ${title ? 'font-medium' : 'text-muted-foreground'}`}>
              {title || t('untitledTask')}
            </span>

            <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
              <TypeIcon className="size-3" />
              {tDynLoose(t, 'taskType', enumKey(taskType))}
            </Badge>

            {!!task?.assigneeMode && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {tDynLoose(t, 'assigneeMode', enumKey(assigneeMode))}
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

        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor={`task-title-${index}`}>{t('taskTitle')}</Label>
              <Input
                id={`task-title-${index}`}
                placeholder={t('taskTitlePlaceholder')}
                {...form.register(`tasks.${index}.title`)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`task-type-${index}`}>{t('taskTypeLabel')}</Label>
              <Select value={taskType} onValueChange={handleTaskTypeChange} items={taskTypeItems}>
                <SelectTrigger
                  id={`task-type-${index}`}
                  aria-label={t('taskTypeLabel')}
                  className="w-full">
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

            <div className="space-y-1.5">
              <Label htmlFor={`task-desc-${index}`}>{t('taskDescription')}</Label>
              <Textarea
                id={`task-desc-${index}`}
                placeholder={t('descriptionPlaceholder')}
                rows={2}
                {...form.register(`tasks.${index}.description`)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`task-assignee-${index}`}>{t('assignedTo')}</Label>
              <Select
                value={assigneeMode}
                onValueChange={handleAssigneeModeChange}
                items={assigneeModeItems}>
                <SelectTrigger
                  id={`task-assignee-${index}`}
                  aria-label={t('assignedTo')}
                  className="w-full">
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

            {assigneeMode === 'ROLE_BASED' && (
              <div className="space-y-1.5">
                <Label htmlFor={`task-role-${index}`}>{t('roleField')}</Label>
                <Select
                  value={task?.assigneeRole ?? ''}
                  onValueChange={handleAssigneeRoleChange}
                  items={userRoleItems}>
                  <SelectTrigger
                    id={`task-role-${index}`}
                    aria-label={t('roleField')}
                    className="w-full">
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

            {assigneeMode === 'FIXED_USER' && (
              <FixedUserField
                index={index}
                form={form}
                users={users}
                isLoading={isFixedUserLoading}
                value={task?.assigneeUserId ?? ''}
                t={t}
              />
            )}

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

            <div className="flex items-center gap-3">
              <Switch
                id={`task-required-${index}`}
                checked={task?.required ?? false}
                onCheckedChange={handleRequiredChange}
              />
              <Label htmlFor={`task-required-${index}`}>{t('requiredTask')}</Label>
            </div>

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
                    onValueChange={handleDependsOnChange}
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

            <div className="space-y-1.5">
              <Label>{t('conditions')}</Label>
              <ConditionBuilder
                value={conditions as Parameters<typeof ConditionBuilder>[0]['value']}
                onChange={handleConditionsChange}
              />
            </div>

            {!!task?.id && <JiraTaskConfig taskTemplateId={task.id} />}
            {!!task?.id && <LinearTaskConfig taskTemplateId={task.id} />}
            {!!task?.id && <CalendarTaskConfig taskTemplateId={task.id} />}

            <div className="flex items-center justify-between border-t pt-3">
              <button
                type="button"
                className="text-sm text-destructive hover:underline"
                onClick={handleRemoveClick}>
                {t('removeTask')}
              </button>
              <Button type="button" variant="secondary" size="sm" onClick={handleCollapse}>
                {t('doneEditing')}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function TaskCardSection(props: TaskCardContainerProps) {
  const assigneeMode = props.form.watch(`tasks.${props.index}.assigneeMode`) ?? 'ROLE_BASED';
  const { users, usersQuery } = useTaskCardTemplateUsers(props.form, props.index);
  const isFixedUserLoading = assigneeMode === 'FIXED_USER' && usersQuery.isLoading;
  return (
    <TaskCard
      {...props}
      users={users}
      usersQuery={usersQuery}
      isFixedUserLoading={isFixedUserLoading}
    />
  );
}
