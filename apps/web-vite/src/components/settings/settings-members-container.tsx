import {
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { UserPlus, Users } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { useSettingsMembers } from './hooks/use-settings-members.js';
import { InviteDialogContainer } from './invite-dialog-container.js';
import { PinActionButton } from './pin-action-button.js';
import { UsersTableContainer } from './members/container.js';

export function SettingsMembersContainer() {
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
            <UsersTableContainer />
          </div>
        </section>
      </AnimateIn>

      <InviteDialogContainer open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
