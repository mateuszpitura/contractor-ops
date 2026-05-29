import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { workflowTaskSkipReason } from '@contractor-ops/validators';
import {
  AlertCircle,
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardList,
  FileText,
  KeyRound,
  Lock,
  Monitor,
  SkipForward,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { DocLinksSection } from '../../integrations/doc-links-section-container.js';
import type {
  useReassignTaskPopover,
  useSkipTaskPopover,
  useTaskCardRun,
} from '../hooks/use-task-card-run.js';
import { LinearTaskIssueChip } from './linear-task-issue-chip-container.js';

const statusIconMap: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  TODO: { icon: Circle, className: 'text-muted-foreground' },
  IN_PROGRESS: { icon: CircleDot, className: 'text-primary' },
  DONE: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  BLOCKED: { icon: Lock, className: 'text-amber-600 dark:text-amber-400' },
  SKIPPED: { icon: SkipForward, className: 'text-muted-foreground/60' },
  CANCELLED: { icon: XCircle, className: 'text-muted-foreground/60' },
};

const taskTypeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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

export interface TaskCardRunTask {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  required: boolean;
  assigneeUserId: string | null;
  assigneeRole: string | null;
  dueAt: string | Date | null;
  completedAt: string | Date | null;
  completedByUserId: string | null;
  startedAt: string | Date | null;
  dependsOnTaskRunId: string | null;
  resultJson: unknown;
  isOverdue: boolean;
  createdAt: string | Date;
}

interface TaskCardRunProps {
  task: TaskCardRunTask;
  runId: string;
  currentUserId: string | null;
  dependencyTitle?: string;
  completeMutation: ReturnType<typeof useTaskCardRun>['completeMutation'];
  skip: ReturnType<typeof useSkipTaskPopover>;
  reassign: ReturnType<typeof useReassignTaskPopover>;
  attachmentsSection?: ReactNode;
  commentsSection?: ReactNode;
}

function SkipPopover({
  taskRunId,
  skip,
}: {
  taskRunId: string;
  skip: ReturnType<typeof useSkipTaskPopover>;
}) {
  const t = useTranslations('Workflows');

  return (
    <Popover open={skip.open} onOpenChange={skip.setOpen}>
      <PopoverTrigger
        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
        render={props => (
          <Button {...props} variant="ghost" size="sm">
            {t('taskActionSkip')}
          </Button>
        )}
      />
      <PopoverContent className="w-72 space-y-3" align="start">
        <Textarea
          placeholder={t('skipReasonPlaceholder')}
          value={skip.reason}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => skip.setReason(e.target.value)}
          rows={3}
        />
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          disabled={skip.reason.trim().length < 3 || skip.skipMutation.isPending}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => skip.handleSkip(taskRunId)}>
          {t('skipConfirm')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ReassignPopover({
  taskRunId,
  reassign,
}: {
  taskRunId: string;
  reassign: ReturnType<typeof useReassignTaskPopover>;
}) {
  const t = useTranslations('Workflows');
  const { setSelectedUserId } = reassign;
  const handleSelectedUserChange = useCallback(
    (val: string | null | undefined) => setSelectedUserId(val ?? ''),
    [setSelectedUserId],
  );

  return (
    <Popover open={reassign.open} onOpenChange={reassign.setOpen}>
      <PopoverTrigger
        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
        render={props => (
          <Button {...props} variant="ghost" size="sm">
            {t('taskActionReassign')}
          </Button>
        )}
      />
      <PopoverContent className="w-72 space-y-3" align="start">
        <Select value={reassign.selectedUserId} onValueChange={handleSelectedUserChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('reassignPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {reassign.members.map(member => (
              <SelectItem key={member.userId as string} value={member.userId as string}>
                {(member.name ?? member.email ?? member.userId) as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="w-full"
          disabled={!reassign.selectedUserId || reassign.reassignMutation.isPending}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => reassign.handleReassign(taskRunId)}>
          {t('reassignConfirm')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function TaskActionToolbar({
  canAct,
  canReassignOnly,
  task,
  dependencyTitle,
  completeMutation,
  skip,
  reassign,
  t,
}: {
  canAct: boolean;
  canReassignOnly: boolean;
  task: TaskCardRunTask;
  dependencyTitle?: string;
  completeMutation: TaskCardRunProps['completeMutation'];
  skip: ReturnType<typeof useSkipTaskPopover>;
  reassign: ReturnType<typeof useReassignTaskPopover>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      {!!canAct && (
        <>
          <Button
            size="sm"
            disabled={completeMutation.isPending}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => {
              completeMutation.mutate({ taskRunId: task.id });
            }}>
            {t('taskActionComplete')}
          </Button>
          <SkipPopover taskRunId={task.id} skip={skip} />
          <ReassignPopover taskRunId={task.id} reassign={reassign} />
        </>
      )}
      {!!canReassignOnly && <ReassignPopover taskRunId={task.id} reassign={reassign} />}
      {task.status === 'BLOCKED' && dependencyTitle && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <span {...props} className="text-xs text-muted-foreground cursor-default">
                  <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
                </span>
              )}
            />
            <TooltipContent>{t('blockedTooltip', { title: dependencyTitle })}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}

function TaskExpandedDetails({
  task,
  isUserSkipped,
  isConditionSkipped,
  attachmentsSection,
  commentsSection,
  t,
}: {
  task: TaskCardRunTask;
  isUserSkipped: boolean;
  isConditionSkipped: boolean;
  attachmentsSection?: ReactNode;
  commentsSection?: ReactNode;
  t: ReturnType<typeof useTranslations>;
}) {
  const { formatDateTime } = useDateFormatter();

  return (
    <div className="border-t px-4 pb-4 pt-3 space-y-4">
      {!!task.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
      )}

      {task.status === 'DONE' && task.completedAt && (
        <p className="text-xs text-muted-foreground">
          Completed by {task.completedByUserId ?? 'unknown'} on {formatDateTime(task.completedAt)}
        </p>
      )}
      {!!isUserSkipped && (
        <p className="text-xs text-muted-foreground">
          Skipped:{' '}
          {((task.resultJson as Record<string, unknown>)?.skipReason as string) ??
            'No reason provided'}
        </p>
      )}
      {!!isConditionSkipped && (
        <p className="text-xs text-muted-foreground">{t('conditionSkipped')}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {!!task.createdAt && <span>Created {formatDateTime(task.createdAt)}</span>}
      </div>

      <div className="empty:hidden">
        <LinearTaskIssueChip taskRunId={task.id} />
      </div>

      {attachmentsSection}

      <DocLinksSection
        workflowTaskRunId={task.id}
        readOnly={['DONE', 'SKIPPED', 'CANCELLED'].includes(task.status)}
      />

      {commentsSection}
    </div>
  );
}

export function TaskCardRun({
  task,
  runId,
  currentUserId,
  dependencyTitle,
  completeMutation,
  skip,
  reassign,
  attachmentsSection,
  commentsSection,
}: TaskCardRunProps) {
  const t = useTranslations('Workflows');
  const { formatDate } = useDateFormatter();
  const [expanded, setExpanded] = useState(false);

  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const stopKeyPropagation = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
  }, []);

  const isOverdue = task.isOverdue;
  const statusConfig = isOverdue
    ? { icon: AlertCircle, className: 'text-destructive' }
    : (statusIconMap[task.status] ?? statusIconMap.TODO);

  const StatusIcon = statusConfig.icon;
  const TypeIcon = taskTypeIconMap[task.taskType] ?? ClipboardList;

  const isConditionSkipped =
    task.status === 'SKIPPED' &&
    (task.resultJson as Record<string, unknown>)?.skipReason ===
      workflowTaskSkipReason.conditionNotMet;

  const isUserSkipped = task.status === 'SKIPPED' && !isConditionSkipped;

  const isAssignedToMe = currentUserId !== null && task.assigneeUserId === currentUserId;

  const canAct = isAssignedToMe && (task.status === 'TODO' || task.status === 'IN_PROGRESS');

  const canReassignOnly =
    !isAssignedToMe && (task.status === 'TODO' || task.status === 'IN_PROGRESS');

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <button
                {...props}
                type="button"
                className="flex flex-1 min-w-0 items-center gap-3 text-start">
                <StatusIcon className={`size-5 shrink-0 ${statusConfig.className}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{task.title}</span>
                    <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                      <TypeIcon className="size-3" />
                      {tDynLoose(t, 'taskType', enumKey(task.taskType))}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[13px] text-muted-foreground">
                    {!!task.assigneeUserId && (
                      <span>{t('assignedToLabel', { name: task.assigneeUserId })}</span>
                    )}
                    {!!task.dueAt && (
                      <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                        {isOverdue ? t('overdue') : t('dueLabel', { date: formatDate(task.dueAt) })}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )}
          />
          <div
            className="flex items-center gap-1 shrink-0"
            role="toolbar"
            onClick={stopPropagation}
            onKeyDown={stopKeyPropagation}>
            <TaskActionToolbar
              canAct={canAct}
              canReassignOnly={canReassignOnly}
              task={task}
              dependencyTitle={dependencyTitle}
              completeMutation={completeMutation}
              skip={skip}
              reassign={reassign}
              t={t}
            />
          </div>
        </div>

        <CollapsibleContent>
          <TaskExpandedDetails
            task={task}
            isUserSkipped={isUserSkipped}
            isConditionSkipped={isConditionSkipped}
            attachmentsSection={attachmentsSection}
            commentsSection={commentsSection}
            t={t}
          />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
