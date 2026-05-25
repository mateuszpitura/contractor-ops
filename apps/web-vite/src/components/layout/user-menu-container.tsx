import { useCallback } from 'react';

import { useUserMenu } from './hooks/use-user-menu.js';
import { UserMenu } from './user-menu.js';

export function UserMenuContainer() {
  const { isPending, user, displayName, initials, handleSignOut } = useUserMenu();

  const onSignOut = useCallback(() => {
    void handleSignOut();
  }, [handleSignOut]);

  return (
    <UserMenu
      isPending={isPending}
      user={user}
      displayName={displayName}
      initials={initials}
      onSignOut={onSignOut}
    />
  );
}
