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
 *
 * NOTE: `userId` is the API surface (semantic for callers); the server
 * resolves it to the corresponding `Member.id` for the active organization
 * before calling Better Auth's `updateMemberRole` (which keys by Member.id,
 * not user id).
 */
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: invitableMemberRoleEnum,
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
