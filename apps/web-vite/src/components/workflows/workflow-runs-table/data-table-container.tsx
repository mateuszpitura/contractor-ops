import { AtelierEmptyState, SectionLabel, WorkflowsIllustration } from '@contractor-ops/ui';
import { GitBranch, Play, Plus } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { useWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import type { WorkflowRunRow } from './columns.js';
import { WorkflowRunsDataTable } from './data-table.js';

interface WorkflowRunsDataTableContainerProps {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  parentLoading?: boolean;
  contractorCount: number;
  canManageTemplates: boolean;
}

// Decision: data-table host — useWorkflowRunsDataTable supplies table state;
// container composes parent's parentLoading prop into tableLoading,
// toolbarDisabled, and showPaginationFooter flags consumed inline by the view.
export function WorkflowRunsDataTableContainer({
  onRowClick,
  onStartWorkflow,
  parentLoading,
  contractorCount,
  canManageTemplates,
}: WorkflowRunsDataTableContainerProps) {
  const te = useTranslations('EmptyStates');
  const table = useWorkflowRunsDataTable();

  const showRunsEmpty =
    !table.isLoading &&
    parentLoading !== true &&
    table.totalRows === 0 &&
    !table.hasFiltersOrSearch;

  if (showRunsEmpty) {
    return (
      <AtelierEmptyState
        variant="page"
        illustration={WorkflowsIllustration}
        heading={table.t('empty.heading')}
        body={table.t('empty.body')}
        primaryAction={{
          label: table.t('empty.cta'),
          onClick: onStartWorkflow,
          icon: Play,
        }}
        secondaryAction={
          canManageTemplates
            ? {
                label: table.t('templates.newTemplate'),
                href: '/workflows/templates/new',
                icon: Plus,
              }
            : undefined
        }
        prerequisiteMissing={contractorCount === 0}
        prerequisiteAction={{ label: te('prerequisite.cta'), href: '/contractors' }}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <>
      <SectionLabel icon={GitBranch}>{table.t('pageTitle')}</SectionLabel>
      <WorkflowRunsDataTable
        {...table}
        onRowClick={onRowClick}
        onStartWorkflow={onStartWorkflow}
        parentLoading={parentLoading}
      />
    </>
  );
}
