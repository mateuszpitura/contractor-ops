'use client';

import { AtelierPageHeader, SectionLabel } from '@contractor-ops/ui';
import { UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { InviteDialog } from '@/components/settings/invite-dialog';
import { PinActionButton } from '@/components/settings/pin-action-button';
import { UsersTable } from '@/components/settings/users-table';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';

/**
 * Team members page.
 * Shows user management table with invite button (for admins).
 */
export default function MembersPage() {
  const t = useTranslations('Users');
  const [inviteOpen, setInviteOpen] = useState(false);
  const openInvite = useCallback(() => setInviteOpen(true), []);
  const { can } = usePermissions();

  const canInvite = can('member', ['create']);

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
          <UsersTable />
        </section>
      </AnimateIn>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
