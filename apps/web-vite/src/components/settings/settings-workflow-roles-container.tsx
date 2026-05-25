import { AtelierPageHeader, SectionLabel } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Plus, Users2 } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { useSettingsWorkflowRoles } from './hooks/use-settings-workflow-roles.js';
import { PinActionButton } from './pin-action-button.js';
import { WorkflowRoleFormDialogContainer } from './workflow-roles/workflow-role-form-dialog-container.js';
import { WorkflowRolesTableContainer } from './workflow-roles/workflow-roles-table-container.js';

export function SettingsWorkflowRolesContainer() {
  const t = useTranslations('WorkflowRoles');
  const { createOpen, setCreateOpen, openCreate, canCreate } = useSettingsWorkflowRoles();

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader
          title={t('title')}
          description={t('subtitle')}
          actions={
            <div className="flex items-center gap-2">
              <PinActionButton tabKey="workflow-roles" />
              {canCreate && (
                <Button onClick={openCreate}>
                  <Plus className="me-2 h-4 w-4" />
                  {t('createCta')}
                </Button>
              )}
            </div>
          }
        />
      </AnimateIn>

      <AnimateIn delay={1}>
        <section aria-label={t('title')} className="space-y-3">
          <SectionLabel icon={Users2}>{t('listSectionLabel')}</SectionLabel>
          <WorkflowRolesTableContainer canCreate={canCreate} onCreate={openCreate} />
        </section>
      </AnimateIn>

      <WorkflowRoleFormDialogContainer
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
