import { z } from 'zod';
import { invitableMemberRoleEnum } from './roles.js';

/**
 * Schema for inviting a new user to the organization.
 * The user will receive an invitation email with a link to accept.
 */
export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: invitableMemberRoleEnum,
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

/**
 * Schema for updating an existing user's role.
 * This is a sensitive action requiring re-authentication.
 */
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: invitableMemberRoleEnum,
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
