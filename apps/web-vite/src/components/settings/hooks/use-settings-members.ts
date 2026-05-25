import { useCallback, useState } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';

export interface UseSettingsMembersResult {
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
  openInvite: () => void;
  canInvite: boolean;
}

/**
 * Drives the `/settings/members` page header — owns the invite-dialog
 * open state and the `member:create` permission gate. Keeps the
 * container JSX wiring only.
 */
export function useSettingsMembers(): UseSettingsMembersResult {
  const [inviteOpen, setInviteOpen] = useState(false);
  const openInvite = useCallback(() => setInviteOpen(true), []);
  const { can } = usePermissions();
  const canInvite = can('member', ['create']);
  return { inviteOpen, setInviteOpen, openInvite, canInvite };
}
