'use client';

import { AtelierPageHeader } from '@contractor-ops/ui';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { InviteDialog } from '@/components/settings/invite-dialog';
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
            canInvite ? (
              <Button onClick={openInvite}>
                <UserPlus className="me-2 h-4 w-4" />
                {t('inviteCta')}
              </Button>
            ) : undefined
          }
        />
      </AnimateIn>

      <AnimateIn delay={1}>
        <UsersTable />
      </AnimateIn>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
