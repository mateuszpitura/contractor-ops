import { useCallback, useState } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';

export interface UseSettingsWorkflowRolesResult {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  openCreate: () => void;
  canCreate: boolean;
}

/**
 * Drives the `/settings/workflow-roles` page header — owns the create
 * dialog open state and the `workflow:create` permission gate. Keeps
 * the container JSX-only.
 */
export function useSettingsWorkflowRoles(): UseSettingsWorkflowRolesResult {
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = useCallback(() => setCreateOpen(true), []);
  const { can } = usePermissions();
  const canCreate = can('workflow', ['create']);
  return { createOpen, setCreateOpen, openCreate, canCreate };
}
