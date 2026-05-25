import { useCallback } from 'react';

import { useUserMenu } from './hooks/use-user-menu.js';
import { UserMenu, UserMenuSkeleton } from './user-menu.js';

export function UserMenuContainer() {
  const { isPending, user, displayName, initials, handleSignOut } = useUserMenu();

  const onSignOut = useCallback(() => {
    void handleSignOut();
  }, [handleSignOut]);

  if (isPending) {
    return <UserMenuSkeleton />;
  }

  return (
    <UserMenu user={user} displayName={displayName} initials={initials} onSignOut={onSignOut} />
  );
}
