'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import type { DirectoryRole } from '@contractor-ops/validators/roles';
import { invitableMemberRoleValues } from '@contractor-ops/validators/roles';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: DirectoryRole[] = [...invitableMemberRoleValues];

const ROLE_LABELS: Record<DirectoryRole, string> = {
  admin: 'Admin',
  finance_admin: 'Finance Admin',
  ops_manager: 'Ops Manager',
  team_manager: 'Team Manager',
  legal_compliance_viewer: 'Legal / Compliance Viewer',
  it_admin: 'IT Admin',
  external_accountant: 'External Accountant',
  readonly: 'Read Only',
};

// ---------------------------------------------------------------------------
// RoleAssignmentControls
// ---------------------------------------------------------------------------

interface RoleAssignmentControlsProps {
  defaultRole: DirectoryRole;
  onDefaultRoleChange: (role: DirectoryRole) => void;
}

export function RoleAssignmentControls({
  defaultRole,
  onDefaultRoleChange,
}: RoleAssignmentControlsProps) {
  const t = useTranslations('GoogleWorkspace.import');
  const reactId = useId();

  return (
    <div className="space-y-2">
      <label htmlFor={`${reactId}-gw-default-role`} className="text-sm font-medium">
        {t('defaultRoleLabel')}
      </label>
      <Select
        value={defaultRole}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
        onValueChange={val => {
          if (val) onDefaultRoleChange(val as DirectoryRole);
        }}>
        <SelectTrigger id={`${reactId}-gw-default-role`} className="w-60">
          <SelectValue>{ROLE_LABELS[defaultRole]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map(role => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { ROLE_LABELS, ROLE_OPTIONS };
