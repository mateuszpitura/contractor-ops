import { AtelierPageHeader, SectionLabel } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { UserPlus, Users } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { useSettingsMembers } from './hooks/use-settings-members.js';
import { InviteDialogContainer } from './invite-dialog-container.js';
import { PinActionButton } from './pin-action-button.js';
import { UsersTableContainer } from './users-table-container.js';

export function SettingsMembersContainer() {
  const t = useTranslations('Users');
  const { inviteOpen, setInviteOpen, openInvite, canInvite } = useSettingsMembers();

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader
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

      <AnimateIn delay={1}>
        <section aria-label={t('title')} className="space-y-3">
          <SectionLabel icon={Users}>{t('title')}</SectionLabel>
          <UsersTableContainer />
        </section>
      </AnimateIn>

      <InviteDialogContainer open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
