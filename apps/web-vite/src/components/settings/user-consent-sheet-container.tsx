import { useUserConsentSheet } from './hooks/use-user-consent-sheet.js';
import { UserConsentSheet } from './user-consent-sheet.js';

interface UserConsentSheetContainerProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange + selected userId gated by UsersTable; hook
// scopes the per-user consent query (skipped when userId is null) to sheet mount.
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
