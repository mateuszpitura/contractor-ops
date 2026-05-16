'use client';

import { AtelierPageHeader, SectionLabel } from '@contractor-ops/ui';
import { Plus, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { PinActionButton } from '@/components/settings/pin-action-button';
import { WorkflowRoleFormDialog } from '@/components/settings/workflow-roles/workflow-role-form-dialog';
import { WorkflowRolesTable } from '@/components/settings/workflow-roles/workflow-roles-table';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';

export default function WorkflowRolesPage() {
  const t = useTranslations('WorkflowRoles');
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = useCallback(() => setCreateOpen(true), []);
  const { can } = usePermissions();

  const canCreate = can('workflow', ['create']);

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
          <WorkflowRolesTable canCreate={canCreate} onCreate={openCreate} />
        </section>
      </AnimateIn>

      <WorkflowRoleFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
