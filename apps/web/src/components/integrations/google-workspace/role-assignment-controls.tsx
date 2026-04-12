"use client";

import type { DirectoryRole } from "@contractor-ops/validators";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: DirectoryRole[] = [
  "admin",
  "finance_admin",
  "ops_manager",
  "team_manager",
  "legal_compliance_viewer",
  "it_admin",
  "external_accountant",
  "readonly",
];

const ROLE_LABELS: Record<DirectoryRole, string> = {
  admin: "Admin",
  finance_admin: "Finance Admin",
  ops_manager: "Ops Manager",
  team_manager: "Team Manager",
  legal_compliance_viewer: "Legal / Compliance Viewer",
  it_admin: "IT Admin",
  external_accountant: "External Accountant",
  readonly: "Read Only",
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
  const t = useTranslations("GoogleWorkspace.import");

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{t("defaultRoleLabel")}</label>
      <Select
        value={defaultRole}
        onValueChange={(val) => {
          if (val) onDefaultRoleChange(val as DirectoryRole);
        }}
      >
        <SelectTrigger className="w-60">
          <SelectValue>{ROLE_LABELS[defaultRole]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((role) => (
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
