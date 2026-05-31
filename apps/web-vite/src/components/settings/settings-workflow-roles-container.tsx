import { WORKBENCH_TABLE_PAGE_FILL_CLASS } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Plus } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { isListControlsDisabled } from '../shared/list-controls-disabled.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { useSettingsWorkflowRoles } from './hooks/use-settings-workflow-roles.js';
import { PinActionButton } from './pin-action-button.js';
import { useWorkflowRolesTable } from './workflow-roles/hooks/use-workflow-roles-table.js';
import { WorkflowRoleFormDialogContainer } from './workflow-roles/workflow-role-form-dialog-container.js';
import { WorkflowRolesTableContainer } from './workflow-roles/workflow-roles-table-container.js';

export function SettingsWorkflowRolesContainer() {
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
        <WorkflowRolesTableContainer canCreate={canCreate} onCreate={openCreate} />
      </AnimateIn>

      <WorkflowRoleFormDialogContainer
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
