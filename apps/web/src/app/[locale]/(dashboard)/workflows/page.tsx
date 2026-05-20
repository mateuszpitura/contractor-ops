'use client';

import {
  AtelierEmptyState,
  AtelierPageHeader,
  SectionLabel,
  WorkflowsIllustration,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Play, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useEffect, useState } from 'react';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { PageLoadingSpinner } from '@/components/shared/page-loading-spinner';
import { MyTasksList } from '@/components/workflows/my-tasks-list';
import { TemplatePicker } from '@/components/workflows/template-picker-dialog';
import { TemplatesTable } from '@/components/workflows/templates-table';
import type { WorkflowRunRow } from '@/components/workflows/workflow-runs-table/columns';
import { WorkflowRunsDataTable } from '@/components/workflows/workflow-runs-table/data-table';
import { WorkflowSidePanel } from '@/components/workflows/workflow-side-panel';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense)
// ---------------------------------------------------------------------------

function WorkflowsContent() {
  const t = useTranslations('Workflows');
  const te = useTranslations('EmptyStates');
  const { can } = usePermissions();

  // Tab state synced to URL
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('runs'));

  // Side panel state
  const [selectedRun, setSelectedRun] = useState<WorkflowRunRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // Template picker state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Action param for Cmd+K quick action
  const [action, setAction] = useQueryState('action', parseAsString);

  useEffect(() => {
    if (action === 'start') {
      setTemplatePickerOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  const handleRowClick = (run: WorkflowRunRow) => {
    setSelectedRun(run);
    setSidePanelOpen(true);
  };

  const handleStartWorkflow = () => {
    setTemplatePickerOpen(true);
  };

  // Count queries for empty state detection
  const runsCountQuery = useQuery(trpc.workflow.listRuns.queryOptions({ page: 1, pageSize: 10 }));
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );
  const runsTotal = (runsCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = runsCountQuery.isLoading;

  const canManageTemplates = can('workflow', ['create']);

  // Atelier full-page empty state only after count resolves AND there's truly
  // zero data. While count is in flight, fall through to the populated
  // branch — WorkflowRunsDataTable renders its real chrome and DataTableBody
  // shows skeleton rows. `parentLoading` is forwarded to prevent an
  // in-table empty flash before the swap to Atelier.
  if (!isCountLoading && runsTotal === 0 && !canManageTemplates) {
    return (
      <div className="space-y-6">
        <AnimateIn delay={0}>
          <AtelierPageHeader
            title={t('pageTitle')}
            description={t('pageDescription')}
            actions={
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              <Button size="sm" onClick={handleStartWorkflow}>
                <Play className="h-4 w-4" aria-hidden="true" />
                {t('startWorkflow')}
              </Button>
            }
          />
        </AnimateIn>
        <AnimateIn delay={1}>
          <AtelierEmptyState
            illustration={WorkflowsIllustration}
            heading={te('workflows.heading')}
            body={te('workflows.body')}
            primaryAction={
              canManageTemplates
                ? {
                    label: t('templates.newTemplate'),
                    href: '/workflows/templates/new',
                    icon: Plus,
                  }
                : { label: te('workflows.cta'), onClick: handleStartWorkflow, icon: Play }
            }
            prerequisiteMissing={contractorCount === 0}
            prerequisiteAction={{ label: te('prerequisite.cta'), href: '/contractors' }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
        <TemplatePicker open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AnimateIn delay={0}>
        <AtelierPageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            <Button size="sm" onClick={handleStartWorkflow}>
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              {t('startWorkflow')}
            </Button>
          }
        />
      </AnimateIn>

      {/* Tabs */}
      <AnimateIn delay={1}>
        {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
        <Tabs value={tab} onValueChange={value => void setTab(value)}>
          <TabsList>
            <TabsTrigger value="runs">{t('tabRuns')}</TabsTrigger>
            <TabsTrigger value="tasks">{t('tabMyTasks')}</TabsTrigger>
            {canManageTemplates && <TabsTrigger value="templates">{t('tabTemplates')}</TabsTrigger>}
          </TabsList>

          <TabsContent value="runs" className="mt-4">
            <section aria-label={t('pageTitle')} className="space-y-3">
              <SectionLabel icon={GitBranch}>{t('pageTitle')}</SectionLabel>
              <WorkflowRunsDataTable
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onRowClick={handleRowClick}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onStartWorkflow={handleStartWorkflow}
                parentLoading={isCountLoading}
              />
            </section>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <MyTasksList />
          </TabsContent>

          {canManageTemplates && (
            <TabsContent value="templates" className="mt-4">
              <div className="flex items-center justify-end mb-4">
                <Button size="sm" render={<Link href="/workflows/templates/new" />}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('templates.newTemplate')}
                </Button>
              </div>
              <TemplatesTable />
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>

      {/* Side panel */}
      <WorkflowSidePanel
        runId={sidePanelOpen && selectedRun ? selectedRun.id : null}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClose={() => {
          setSidePanelOpen(false);
          setSelectedRun(null);
        }}
      />

      {/* Template picker dialog */}
      <TemplatePicker open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Workflow list page at /workflows.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function WorkflowsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <WorkflowsContent />
    </Suspense>
  );
}
