import {
  AtelierEmptyState,
  SectionLabel,
  TemplatesIllustration,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Plus, Users2 } from 'lucide-react';

import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { useWorkflowRolesTable } from './hooks/use-workflow-roles-table.js';
import { WorkflowRolesTable } from './data-table.js';

interface WorkflowRolesTableContainerProps {
  canCreate?: boolean;
  onCreate?: () => void;
}

// Decision: data-table host — roles table mounted by SettingsWorkflowRolesContainer
// (gates canCreate); featured empty uses page AtelierEmptyState (no SectionLabel).
export function WorkflowRolesTableContainer(props: WorkflowRolesTableContainerProps) {
  const table = useWorkflowRolesTable();
  const { canCreate, onCreate } = props;

  if (table.showFeaturedEmpty) {
    return (
      <AtelierEmptyState
        variant="page"
        illustration={TemplatesIllustration}
        heading={table.t('empty.heading')}
        body={table.t('empty.body')}
        primaryAction={
          canCreate && onCreate
            ? { label: table.t('empty.cta'), onClick: onCreate, icon: Plus }
            : undefined
        }
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <section aria-label={table.t('listSectionLabel')} className={WORKBENCH_TABLE_SECTION_CLASS}>
      <SectionLabel icon={Users2}>{table.t('listSectionLabel')}</SectionLabel>
      <WorkflowRolesTable {...props} {...table} />
    </section>
  );
}
