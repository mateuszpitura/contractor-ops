'use client';

import { workflowAssignableRoleValues } from '@contractor-ops/validators/roles';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  GitBranch,
  GripVertical,
  KeyRound,
  Monitor,
  Plus,
  Save,
  Shield,
  Sparkles,
  Trash2,
  UserCircle,
  Workflow,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode, MouseEvent as RME } from 'react';
import { useCallback, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type {
  TaskFormValues,
  TemplateFormValues,
} from '@/components/workflows/template-builder/use-template-form';
import { useTemplateForm } from '@/components/workflows/template-builder/use-template-form';
import { trpc } from '@/trpc/init';

// =============================================================================
// TASK TYPE CONFIG
// =============================================================================

const TASK_TYPES = [
  {
    value: 'DOCUMENT_COLLECTION',
    icon: FileText,
    label: 'Document Collection',
    color: 'var(--color-info)',
  },
  { value: 'APPROVAL', icon: CheckCircle, label: 'Approval', color: 'var(--color-success)' },
  { value: 'ACCESS_GRANT', icon: KeyRound, label: 'Access Grant', color: 'var(--color-chart-1)' },
  {
    value: 'ACCESS_REVOKE',
    icon: KeyRound,
    label: 'Access Revoke',
    color: 'var(--color-destructive)',
  },
  { value: 'FINANCE_SETUP', icon: Banknote, label: 'Finance Setup', color: 'var(--color-warning)' },
  { value: 'EQUIPMENT', icon: Monitor, label: 'Equipment', color: 'var(--color-chart-2)' },
  {
    value: 'KNOWLEDGE_TRANSFER',
    icon: BookOpen,
    label: 'Knowledge Transfer',
    color: 'var(--color-chart-3)',
  },
  { value: 'MEETING', icon: Calendar, label: 'Meeting', color: 'var(--color-accent-warm)' },
  {
    value: 'MANUAL',
    icon: ClipboardList,
    label: 'Manual Task',
    color: 'var(--color-muted-foreground)',
  },
  { value: 'NOTIFICATION', icon: Bell, label: 'Notification', color: 'var(--color-chart-4)' },
] as const;

const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.map(t => [t.value, t]));

const TEMPLATE_TYPES = [
  { value: 'ONBOARDING', label: 'Onboarding', icon: Sparkles, color: 'var(--color-success)' },
  { value: 'OFFBOARDING', label: 'Offboarding', icon: ArrowRight, color: 'var(--color-warning)' },
  {
    value: 'DOCUMENT_COLLECTION',
    label: 'Document Collection',
    icon: FileText,
    color: 'var(--color-info)',
  },
  {
    value: 'COMPLIANCE_REVIEW',
    label: 'Compliance Review',
    icon: Shield,
    color: 'var(--color-destructive)',
  },
  { value: 'CUSTOM', label: 'Custom', icon: Zap, color: 'var(--color-chart-1)' },
] as const;

const ASSIGNEE_MODES = [
  { value: 'ROLE_BASED', label: 'By Role' },
  { value: 'FIXED_USER', label: 'Specific User' },
  { value: 'CONTRACTOR_OWNER', label: 'Contractor Owner' },
  { value: 'CONTRACT_OWNER', label: 'Contract Owner' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
] as const;

const ROLES = workflowAssignableRoleValues;

// =============================================================================
// BACKGROUND
// =============================================================================

function AtelierBg() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" />
      <div className="absolute -start-[10%] -top-[10%] h-[600px] w-[600px] rounded-full" />
      <div className="absolute -end-[5%] bottom-[10%] h-[400px] w-[400px] rounded-full" />
      <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.05] mix-blend-overlay" />
    </div>
  );
}

// =============================================================================
// TILT CARD
// =============================================================================

function TiltCard({
  children,
  className = '',
  delay: _delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: RME<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `perspective(1000px) rotateY(${((e.clientX - r.left) / r.width - 0.5) * 2}deg) rotateX(${((e.clientY - r.top) / r.height - 0.5) * -2}deg)`;
  }, []);
  const onLeave = useCallback(() => {
    if (ref.current) {
      ref.current.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)';
    }
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse handlers for visual tilt effect only, not interactive
    <div
      ref={ref}
      className={`atelier-enter atelier-glass relative rounded-2xl p-5 transition-[transform] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${className}`}
      role="presentation"
      onMouseMove={onMove}
      onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

// =============================================================================
// PIPELINE CONNECTOR — visual line between task cards
// =============================================================================

function PipelineConnector() {
  return (
    <div className="relative ms-6 flex h-6 items-center">
      <div className="absolute start-0 h-full w-[2px] rounded-full" />
      <div className="ms-4 h-px flex-1 bg-gradient-to-r from-border/40 to-transparent" />
    </div>
  );
}

// =============================================================================
// TASK CARD V2 — extracted sub-components
// =============================================================================

function TaskBadges({ task }: { task: TaskFormValues }) {
  return (
    <div className="hidden items-center gap-2 sm:flex">
      {!!task.required && (
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Required
        </span>
      )}
      {task.dueOffsetDays != null && task.dueOffsetDays > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
          <Clock className="h-3 w-3" /> {task.dueOffsetDays}d
        </span>
      )}
      {!!task.dependsOnTaskTemplateId && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
          <GitBranch className="h-3 w-3" /> Dep
        </span>
      )}
    </div>
  );
}

function AssigneeField({
  index,
  task,
  form,
  users,
}: {
  index: number;
  task: TaskFormValues;
  form: ReturnType<typeof useTemplateForm>['form'];
  users: Array<{ id: string; name: string | null }> | undefined;
}) {
  return (
    <div>
      <label
        htmlFor={`task-${index}-assignee`}
        className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
        <UserCircle className="h-3 w-3" /> Assignee
      </label>
      <select
        id={`task-${index}-assignee`}
        className="h-9 w-full rounded-lg border border-border/40 bg-transparent px-2 text-[12px] focus:border-primary/40 focus:outline-none"
        value={task.assigneeMode}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
        onChange={e =>
          form.setValue(
            `tasks.${index}.assigneeMode`,
            e.target.value as TaskFormValues['assigneeMode'],
            { shouldDirty: true },
          )
        }>
        {ASSIGNEE_MODES.map(m => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {/* Conditional: role select */}
      {task.assigneeMode === 'ROLE_BASED' && (
        <select
          className="mt-1.5 h-8 w-full rounded-lg border border-border/30 bg-transparent px-2 text-[11px] focus:border-primary/40 focus:outline-none"
          value={task.assigneeRole ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e =>
            form.setValue(
              `tasks.${index}.assigneeRole`,
              e.target.value as TaskFormValues['assigneeRole'],
              { shouldDirty: true },
            )
          }>
          <option value="">Select role...</option>
          {ROLES.map(r => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      )}

      {/* Conditional: user select */}
      {task.assigneeMode === 'FIXED_USER' && (
        <select
          className="mt-1.5 h-8 w-full rounded-lg border border-border/30 bg-transparent px-2 text-[11px] focus:border-primary/40 focus:outline-none"
          value={task.assigneeUserId ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e =>
            form.setValue(`tasks.${index}.assigneeUserId`, e.target.value, {
              shouldDirty: true,
            })
          }>
          <option value="">Select user...</option>
          {users?.map(u => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// =============================================================================
// TASK CARD V2 — visual pipeline node
// =============================================================================

interface TaskCardV2Props {
  index: number;
  task: TaskFormValues;
  form: ReturnType<typeof useTemplateForm>['form'];
  allTasks: TaskFormValues[];
  onRemove: (i: number) => void;
  dragHandleProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> };
}

function TaskCardV2({ index, task, form, allTasks, onRemove, dragHandleProps }: TaskCardV2Props) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TASK_TYPE_MAP[task.taskType] ?? TASK_TYPE_MAP.MANUAL;
  const _Icon = cfg.icon;

  const { data: users } = useQuery(
    trpc.user.list.queryOptions(undefined, {
      enabled: expanded && form.watch(`tasks.${index}.assigneeMode`) === 'FIXED_USER',
    }),
  );

  return (
    <div className="atelier-glass group relative rounded-xl transition-all hover:shadow-md dark:hover:shadow-lg">
      {/* ── Collapsed header ── */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-start"
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClick={() => setExpanded(!expanded)}>
        {/* Drag handle */}
        <span
          className="cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground/60"
          {...(dragHandleProps?.attributes ?? {})}
          {...(dragHandleProps?.listeners ?? {})}>
          <GripVertical className="h-4 w-4" />
        </span>

        {/* Step number + icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-[11px] font-black shadow-sm">
          {index + 1}
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">
            {task.title || <span className="italic text-muted-foreground/40">Untitled task</span>}
          </p>
          <p className="text-[10px] text-muted-foreground/50">{cfg.label}</p>
        </div>

        {/* Badges */}
        <TaskBadges task={task} />

        <span className="text-muted-foreground/30">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* ── Expanded form ── */}
      {!!expanded && (
        <div className="space-y-4 border-t border-border/20 px-4 pb-4 pt-4">
          {/* Row 1: Title + Type */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`task-${index}-title`}
                className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
                Title
              </label>
              <Input
                id={`task-${index}-title`}
                className="h-9 text-[13px]"
                placeholder="e.g. Collect NDA..."
                {...form.register(`tasks.${index}.title`)}
              />
            </div>
            <div>
              <label
                htmlFor={`task-${index}-type`}
                className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
                Task Type
              </label>
              <fieldset
                id={`task-${index}-type`}
                className="grid grid-cols-5 gap-1"
                aria-label="Task Type">
                {TASK_TYPES.map(tt => {
                  const TTIcon = tt.icon;
                  const active = task.taskType === tt.value;
                  return (
                    <button
                      key={tt.value}
                      type="button"
                      title={tt.label}
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() =>
                        form.setValue(`tasks.${index}.taskType`, tt.value, { shouldDirty: true })
                      }
                      className={`flex h-8 items-center justify-center rounded-lg border text-xs transition-all ${
                        active
                          ? 'border-primary/40 bg-primary/8 text-primary shadow-sm'
                          : 'border-transparent text-muted-foreground/40 hover:bg-muted/30 hover:text-muted-foreground'
                      }`}>
                      <TTIcon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </fieldset>
            </div>
          </div>

          {/* Row 2: Description */}
          <div>
            <label
              htmlFor={`task-${index}-description`}
              className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
              Description
            </label>
            <textarea
              id={`task-${index}-description`}
              className="h-16 w-full resize-none rounded-lg border border-border/40 bg-transparent px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
              placeholder="Optional description..."
              {...form.register(`tasks.${index}.description`)}
            />
          </div>

          {/* Row 3: Assignee + Due + Required */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Assignee mode */}
            <AssigneeField
              index={index}
              task={task}
              form={form}
              users={users as Array<{ id: string; name: string | null }> | undefined}
            />

            {/* Due offset */}
            <div>
              <label
                htmlFor={`task-${index}-due-days`}
                className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
                <Clock className="h-3 w-3" /> Due After
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`task-${index}-due-days`}
                    type="number"
                    min={0}
                    className="h-9 pe-8 text-[12px]"
                    placeholder="0"
                    {...form.register(`tasks.${index}.dueOffsetDays`, { valueAsNumber: true })}
                  />
                  <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40">
                    days
                  </span>
                </div>
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min={0}
                    className="h-9 pe-8 text-[12px]"
                    placeholder="0"
                    {...form.register(`tasks.${index}.dueOffsetHours`, { valueAsNumber: true })}
                  />
                  <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40">
                    hrs
                  </span>
                </div>
              </div>
            </div>

            {/* Required + Dependency */}
            <div className="space-y-2">
              <div>
                <label
                  htmlFor={`task-${index}-required`}
                  className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
                  Required
                </label>
                <div className="flex h-9 items-center">
                  <Switch
                    id={`task-${index}-required`}
                    checked={task.required}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onCheckedChange={v =>
                      form.setValue(`tasks.${index}.required`, !!v, { shouldDirty: true })
                    }
                  />
                  <span className="ms-2 text-[11px] text-muted-foreground/60">
                    {task.required ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {index > 0 && (
                <div>
                  <label
                    htmlFor={`task-${index}-depends`}
                    className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
                    <GitBranch className="h-3 w-3" /> Depends On
                  </label>
                  <select
                    id={`task-${index}-depends`}
                    className="h-8 w-full rounded-lg border border-border/30 bg-transparent px-2 text-[11px] focus:border-primary/40 focus:outline-none"
                    value={task.dependsOnTaskTemplateId ?? ''}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={e =>
                      form.setValue(
                        `tasks.${index}.dependsOnTaskTemplateId`,
                        e.target.value || undefined,
                        { shouldDirty: true },
                      )
                    }>
                    <option value="">None</option>
                    {allTasks.slice(0, index).map((t, ti) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: tasks may not have stable id yet
                      <option key={ti} value={t.id ?? `task-${ti}`}>
                        Step {ti + 1}: {t.title || 'Untitled'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Remove */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => onRemove(index)}
              className="flex items-center gap-1 text-[11px] font-medium text-destructive/60 transition-colors hover:text-destructive">
              <Trash2 className="h-3 w-3" /> Remove task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SORTABLE WRAPPER
// =============================================================================

function SortableTask(props: TaskCardV2Props & { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: _transform,
    transition: _transition,
    isDragging: _isDragging,
  } = useSortable({
    id: props.id,
  });
  return (
    <div ref={setNodeRef}>
      <TaskCardV2
        {...props}
        dragHandleProps={{
          attributes: attributes as unknown as Record<string, unknown>,
          listeners: (listeners ?? {}) as Record<string, unknown>,
        }}
      />
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function NewWorkflowTemplatePage() {
  const t = useTranslations('Workflows');
  const router = useRouter();
  const queryClient = useQueryClient();
  const reactId = useId();

  const { form, fields, isDirty, addTask, removeTask, reorderTasks } = useTemplateForm();
  const tasks = form.watch('tasks');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const createMutation = useMutation(
    trpc.workflow.createTemplate.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastTemplateSaved'));
        queryClient.invalidateQueries({ queryKey: ['workflow'] });
        router.push('/workflows');
      },
      onError: () => toast.error(t('errorSaveTemplate')),
    }),
  );

  const handleSave = useCallback(
    (values: TemplateFormValues) => {
      createMutation.mutate({
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
          dependsOnTaskTemplateId: task.dependsOnTaskTemplateId || undefined,
          externalUrl: task.externalUrl || undefined,
          conditions: task.conditions ?? undefined,
        })),
      });
    },
    [createMutation],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = fields.map(f => f.id);
      const oi = ids.indexOf(active.id as string);
      const ni = ids.indexOf(over.id as string);
      if (oi !== -1 && ni !== -1) reorderTasks(oi, ni);
    },
    [fields, reorderTasks],
  );

  return (
    <div className="relative -m-6 min-h-screen">
      <AtelierBg />

      <form onSubmit={form.handleSubmit(handleSave)} className="relative z-10 p-6 lg:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* ============================================================== */}
          {/* HEADER                                                         */}
          {/* ============================================================== */}
          <TiltCard delay={0} className="atelier-border-glow">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Workflow className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                {/* Title input — large, editorial */}
                <input
                  type="text"
                  placeholder="Name your workflow..."
                  className="w-full bg-transparent font-display text-[24px] font-black tracking-tight text-foreground placeholder:text-muted-foreground/25 focus:outline-none lg:text-[28px]"
                  {...form.register('name')}
                />
                {!!form.formState.errors.name && (
                  <p className="text-[11px] text-destructive">
                    {t('validationTemplateNameRequired')}
                  </p>
                )}

                {/* Type selector — visual pills */}
                <div>
                  <label
                    htmlFor={`${reactId}-workflow-type-group`}
                    className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
                    Workflow Type
                  </label>
                  <fieldset
                    id={`${reactId}-workflow-type-group`}
                    className="flex flex-wrap gap-1.5"
                    aria-label="Workflow Type">
                    {TEMPLATE_TYPES.map(tt => {
                      const TTIcon = tt.icon;
                      const active = form.watch('type') === tt.value;
                      return (
                        <button
                          key={tt.value}
                          type="button"
                          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                          onClick={() => form.setValue('type', tt.value, { shouldDirty: true })}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
                            active
                              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'bg-muted/30 text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground'
                          }`}>
                          <TTIcon className="h-3 w-3" />
                          {tt.label}
                        </button>
                      );
                    })}
                  </fieldset>
                </div>

                {/* Description */}
                <textarea
                  rows={2}
                  placeholder="Describe what this workflow does..."
                  className="w-full resize-none rounded-xl border border-border/30 bg-transparent px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
                  {...form.register('description')}
                />
              </div>
            </div>
          </TiltCard>

          {/* ============================================================== */}
          {/* PIPELINE — visual task list                                     */}
          {/* ============================================================== */}
          <div className="atelier-enter">
            <div className="mb-3 flex items-center gap-2.5 ps-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
                Pipeline — {fields.length} {fields.length === 1 ? 'step' : 'steps'}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
            </div>

            {fields.length === 0 ? (
              <div className="atelier-glass flex flex-col items-center gap-4 rounded-2xl border border-dashed border-primary/20 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold">No steps yet</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                    Add your first task to start building the pipeline
                  </p>
                </div>
                <Button type="button" size="sm" onClick={addTask} className="text-xs">
                  <Plus className="me-1 h-3.5 w-3.5" /> Add first step
                </Button>
              </div>
            ) : (
              <div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={fields.map(f => f.id)}
                    strategy={verticalListSortingStrategy}>
                    {fields.map((field, i) => (
                      <div key={field.id}>
                        {i > 0 && <PipelineConnector />}
                        <SortableTask
                          id={field.id}
                          index={i}
                          task={tasks[i]}
                          form={form}
                          allTasks={tasks}
                          onRemove={removeTask}
                        />
                      </div>
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Add step button */}
                <PipelineConnector />
                <button
                  type="button"
                  onClick={addTask}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] py-3 text-[11px] font-semibold text-primary/60 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                  <Plus className="h-3.5 w-3.5" /> Add step
                </button>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SAVE BAR                                                       */}
          {/* ============================================================== */}
          <div className="atelier-enter sticky bottom-6 z-20">
            <div className="atelier-glass flex items-center justify-between rounded-2xl px-5 py-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full transition-colors ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                    {isDirty ? 'Unsaved changes' : 'Saved'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/30">
                  {fields.length} {fields.length === 1 ? 'step' : 'steps'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => router.push('/workflows')}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs"
                  disabled={createMutation.isPending}>
                  {!!isDirty && (
                    <span className="me-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                  <Save className="me-1 h-3.5 w-3.5" />
                  {createMutation.isPending ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
