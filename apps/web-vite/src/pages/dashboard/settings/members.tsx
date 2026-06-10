import {
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { UserPlus, Users } from 'lucide-react';
import { Suspense } from 'react';

import { useSettingsMembers } from '../../../components/settings/hooks/use-settings-members.js';
import { InviteDialog } from '../../../components/settings/invite-dialog.js';
import { UsersTable } from '../../../components/settings/members/data-table.js';
import { PinActionButton } from '../../../components/settings/pin-action-button.js';
import { AnimateIn } from '../../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function MembersSettingsContent() {
  const t = useTranslations('Users');
  const { inviteOpen, setInviteOpen, openInvite, canInvite } = useSettingsMembers();

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('title')}
          description={t('subtitle')}
          actions={
            <div className="flex items-center gap-2">
              <PinActionButton tabKey="members" />
              {canInvite && (
                <Button onClick={openInvite}>
                  <UserPlus className="me-2 h-4 w-4" />
                  {t('inviteCta')}
                </Button>
              )}
            </div>
          }
        />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <section aria-label={t('title')} className={WORKBENCH_TABLE_SECTION_CLASS}>
          <SectionLabel icon={Users}>{t('title')}</SectionLabel>
          <div className={WORKBENCH_DATA_TABLE_CLASS}>
            <UsersTable sectionClassName="" />
          </div>
        </section>
      </AnimateIn>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

export default function MembersSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <MembersSettingsContent />
    </Suspense>
  );
}
