import { useUsersTable } from '../hooks/use-users-table.js';
import { UsersTable } from './data-table.js';

export function UsersTableContainer() {
  const table = useUsersTable();
  return <UsersTable {...table} />;
}
