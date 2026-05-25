import { AtelierEmptyState, SectionLabel, WorkflowsIllustration } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { GitBranch, Plus } from 'lucide-react';
import { Link } from '../../../i18n/navigation.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { JiraActivitySummary } from '../../integrations/jira-activity-summary-container.js';
import { TemplatePickerContainer } from '../../workflows/template-picker-container.js';
import type { useContractorTabWorkflows } from '../hooks/use-contractor-tab-workflows.js';

const runStatusBadgeColors: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground border border-border',
  IN_PROGRESS: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  CANCELLED: 'bg-muted text-muted-foreground border border-border',
  BLOCKED: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  OVERDUE: 'bg-destructive/10 text-destructive',
};

type WorkflowsTabViewProps = {
  contractorId: string;
} & ReturnType<typeof useContractorTabWorkflows>;

export function WorkflowsTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-center gap-4 rounded-lg border px-4 py-3">
            <Skeleton className="h-4 flex-1 max-w-[280px]" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-12 tabular-nums" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export type WorkflowsTabEmptyProps = Pick<
  WorkflowsTabViewProps,
  'contractorId' | 'pickerOpen' | 'setPickerOpen'
>;

export function WorkflowsTabEmpty({
  contractorId,
  pickerOpen,
  setPickerOpen,
}: WorkflowsTabEmptyProps) {
  const t = useTranslations('Workflows');
  return (
    <>
      <AtelierEmptyState
        variant="subview"
        illustration={WorkflowsIllustration}
        heading={t('contractorNoWorkflows')}
        body={t('contractorNoWorkflowsBody')}
        primaryAction={{
          label: t('contractorNoWorkflowsCta'),
          onClick: () => setPickerOpen(true),
          icon: Plus,
        }}
        renderAction={(action, variant) => {
          const Icon = action.icon;
          return (
            <Button
              variant={variant === 'secondary' ? 'outline' : 'default'}
              onClick={action.onClick}>
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {action.label}
            </Button>
          );
        }}
      />
      <JiraActivitySummary contractorId={contractorId} />
      <TemplatePickerContainer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contractorId={contractorId}
      />
    </>
  );
}

export function WorkflowsTabView({
  contractorId,
  pickerOpen,
  setPickerOpen,
  page,
  setPage,
  items,
  totalPages,
}: WorkflowsTabViewProps) {
  const t = useTranslations('Workflows');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={GitBranch}>{t('contractorWorkflowsTab')}</SectionLabel>
        </div>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="me-1.5 size-3.5" />
          {t('contractorStartWorkflow')}
        </Button>
      </div>

      <div className="space-y-2">
        {items.map(run => (
          <Link
            key={run.id}
            href={`/workflows/${run.id}`}
            className="flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {run.workflowTemplate?.name ?? 'Workflow'}
              </p>
            </div>
            <Badge variant="secondary" className={runStatusBadgeColors[run.status] ?? ''}>
              {tDynLoose(t, 'runStatus', enumKey(run.status))}
            </Badge>
            <span className="text-sm tabular-nums text-muted-foreground">
              {run.progress.done}/{run.progress.total}
            </span>
            {run.startedAt ? (
              <span className="text-sm text-muted-foreground">
                {new Date(run.startedAt).toLocaleDateString('pl-PL')}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}>
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            &raquo;
          </Button>
        </div>
      ) : null}

      <JiraActivitySummary contractorId={contractorId} />

      <TemplatePickerContainer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contractorId={contractorId}
      />
    </div>
  );
}
