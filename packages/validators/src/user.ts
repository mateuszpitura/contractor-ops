import { z } from 'zod';

/** All available role names in the system */
const roleEnum = z.enum([
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly',
]);

/**
 * Schema for inviting a new user to the organization.
 * The user will receive an invitation email with a link to accept.
 */
export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: roleEnum,
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

/**
 * Schema for updating an existing user's role.
 * This is a sensitive action requiring re-authentication.
 */
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: roleEnum,
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
