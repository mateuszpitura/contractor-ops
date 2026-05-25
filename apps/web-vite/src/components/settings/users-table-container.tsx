// Decision: members table mounted by SettingsMembersContainer (page-level composition with invite
// dialog). View branches on membersQuery.isLoading + members.length empty internally — branches
// stay in view for test compatibility (see __tests__/users-table.test.tsx).
import { useUsersTable } from './hooks/use-users-table.js';
import { UsersTable } from './users-table.js';

export function UsersTableContainer() {
  const table = useUsersTable();
  return <UsersTable {...table} />;
}
