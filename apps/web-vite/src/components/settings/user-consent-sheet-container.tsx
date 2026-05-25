// Decision: sheet rendered conditionally by UsersTable (open prop driven by selected user). Container
// scopes the per-user consent query (skipped when userId is null) to sheet mount.

import { useUserConsentSheet } from './hooks/use-user-consent-sheet.js';
import { UserConsentSheet } from './user-consent-sheet.js';

interface UserConsentSheetContainerProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserConsentSheetContainer({
  userId,
  userName,
  open,
  onOpenChange,
}: UserConsentSheetContainerProps) {
  const sheet = useUserConsentSheet(userId, open);
  return (
    <UserConsentSheet
      userId={userId}
      userName={userName}
      open={open}
      onOpenChange={onOpenChange}
      {...sheet}
    />
  );
}
