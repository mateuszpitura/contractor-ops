import {
  AtelierEmptyState,
  AtelierPageHeader,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
  WORKBENCH_TABLE_TAB_PANEL_CLASS,
  WORKBENCH_TABLE_TABS_CLASS,
  WorkflowsIllustration,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { GitBranch, Play, Plus } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useState } from 'react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { useWorkflowsList } from './hooks/use-workflows-list.js';
import { MyTasksListContainer } from './my-tasks-list-container.js';
import { TemplatePickerContainer } from './template-picker-container.js';
import { TemplatesTableContainer } from './templates-table-container.js';
import type { WorkflowRunRow } from './workflow-runs-table/columns.js';
import { WorkflowRunsDataTableContainer } from './workflow-runs-table/data-table-container.js';
import { WorkflowSidePanelContainer } from './workflow-side-panel-container.js';

export function WorkflowsListContainer() {
  const t = useTranslations('Workflows');
  const te = useTranslations('EmptyStates');
  const list = useWorkflowsList();

  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('runs'));

  const [selectedRun, setSelectedRun] = useState<WorkflowRunRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const [action, setAction] = useQueryState('action', parseAsString);

  useEffect(() => {
    if (action === 'start') {
      setTemplatePickerOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  const handleRowClick = useCallback((run: WorkflowRunRow) => {
    setSelectedRun(run);
    setSidePanelOpen(true);
  }, []);

  const handleStartWorkflow = useCallback(() => {
    setTemplatePickerOpen(true);
  }, []);

  const handleSidePanelClose = useCallback(() => {
    setSidePanelOpen(false);
    setSelectedRun(null);
  }, []);

  if (list.showEmptyState) {
    return (
      <div className="space-y-section-gap">
        <AnimateIn delay={0}>
          <AtelierPageHeader
            title={t('pageTitle')}
            description={t('pageDescription')}
            actions={
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
              list.canManageTemplates
                ? {
                    label: t('templates.newTemplate'),
                    href: '/workflows/templates/new',
                    icon: Plus,
                  }
                : { label: te('workflows.cta'), onClick: handleStartWorkflow, icon: Play }
            }
            prerequisiteMissing={list.contractorCount === 0}
            prerequisiteAction={{ label: te('prerequisite.cta'), href: '/contractors' }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
        <TemplatePickerContainer open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} />
      </div>
    );
  }

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <AnimateIn delay={0}>
        <AtelierPageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={
            <Button size="sm" onClick={handleStartWorkflow}>
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              {t('startWorkflow')}
            </Button>
          }
        />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
        <Tabs
          value={tab}
          onValueChange={value => void setTab(value)}
          className={WORKBENCH_TABLE_TABS_CLASS}>
          <TabsList className="shrink-0">
            <TabsTrigger value="runs">{t('tabRuns')}</TabsTrigger>
            <TabsTrigger value="tasks">{t('tabMyTasks')}</TabsTrigger>
            {list.canManageTemplates && (
              <TabsTrigger value="templates">{t('tabTemplates')}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="runs" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
            <section aria-label={t('pageTitle')} className={WORKBENCH_TABLE_SECTION_CLASS}>
              <SectionLabel icon={GitBranch}>{t('pageTitle')}</SectionLabel>
              <WorkflowRunsDataTableContainer
                onRowClick={handleRowClick}
                onStartWorkflow={handleStartWorkflow}
                parentLoading={list.isCountLoading}
              />
            </section>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <MyTasksListContainer />
          </TabsContent>

          {list.canManageTemplates && (
            <TabsContent value="templates" className="mt-4">
              <div className="flex items-center justify-end mb-4">
                <Button size="sm" render={<Link href="/workflows/templates/new" />}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('templates.newTemplate')}
                </Button>
              </div>
              <TemplatesTableContainer />
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>

      <WorkflowSidePanelContainer
        runId={sidePanelOpen && selectedRun ? selectedRun.id : null}
        onClose={handleSidePanelClose}
      />

      <TemplatePickerContainer open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} />
    </div>
  );
}
