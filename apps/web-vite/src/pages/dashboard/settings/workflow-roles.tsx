import { WORKBENCH_TABLE_PAGE_FILL_CLASS } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { useSettingsWorkflowRoles } from '../../../components/settings/hooks/use-settings-workflow-roles.js';
import { PinActionButton } from '../../../components/settings/pin-action-button.js';
import { WorkflowRolesTable } from '../../../components/settings/workflow-roles/data-table.js';
import { useWorkflowRolesTable } from '../../../components/settings/workflow-roles/hooks/use-workflow-roles-table.js';
import { WorkflowRoleFormDialog } from '../../../components/settings/workflow-roles/workflow-role-form-dialog.js';
import { AnimateIn } from '../../../components/shared/animate-in.js';
import { isListControlsDisabled } from '../../../components/shared/list-controls-disabled.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function WorkflowRolesSettingsContent() {
  const t = useTranslations('WorkflowRoles');
  const { createOpen, setCreateOpen, openCreate, canCreate } = useSettingsWorkflowRoles();
  const { listQuery, showFeaturedEmpty } = useWorkflowRolesTable();
  const controlsDisabled = isListControlsDisabled({
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
  });

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('title')}
          description={t('subtitle')}
          actions={
            <div className="flex items-center gap-2">
              <PinActionButton tabKey="workflow-roles" />
              {canCreate && !showFeaturedEmpty ? (
                <Button disabled={controlsDisabled} onClick={openCreate}>
                  <Plus className="me-2 h-4 w-4" />
                  {t('createCta')}
                </Button>
              ) : null}
            </div>
          }
        />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <WorkflowRolesTable canCreate={canCreate} onCreate={openCreate} />
      </AnimateIn>

      <WorkflowRoleFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export default function WorkflowRolesSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <WorkflowRolesSettingsContent />
    </Suspense>
  );
}
