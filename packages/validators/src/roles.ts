import { z } from 'zod';

export const invitableMemberRoleValues = [
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly',
] as const;

export const workflowAssignableRoleValues = invitableMemberRoleValues;

export const invitableMemberRoleEnum = z.enum(invitableMemberRoleValues);
export const workflowAssignableRoleEnum = z.enum(workflowAssignableRoleValues);

export type InvitableMemberRole = (typeof invitableMemberRoleValues)[number];
export type DirectoryRole = InvitableMemberRole;
export type WorkflowAssignableRole = (typeof workflowAssignableRoleValues)[number];
