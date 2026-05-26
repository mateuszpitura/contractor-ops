import { useUsersTable } from './hooks/use-users-table.js';
import { UsersTable } from './users-table.js';

// Decision: data-table host — members table mounted by SettingsMembersContainer; view
// delegates loading/empty row variants to the shared table shell.
export function UsersTableContainer() {
  const table = useUsersTable();
  return <UsersTable {...table} />;
}
