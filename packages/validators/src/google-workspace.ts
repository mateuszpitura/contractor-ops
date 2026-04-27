import { z } from 'zod';
import type { DirectoryRole } from './roles.js';
import { invitableMemberRoleEnum } from './roles.js';

// ---------------------------------------------------------------------------
// Shared role enum (must match Better Auth organization roles)
// ---------------------------------------------------------------------------

export const directoryRoleEnum = invitableMemberRoleEnum;

export type { DirectoryRole };

// ---------------------------------------------------------------------------
// Google Directory User Schema
// ---------------------------------------------------------------------------

export const googleDirectoryUserSchema = z.object({
  id: z.string(),
  primaryEmail: z.email(),
  name: z.object({
    givenName: z.string(),
    familyName: z.string(),
    fullName: z.string(),
  }),
  thumbnailPhotoUrl: z.url().optional().nullable(),
  orgUnitPath: z.string().optional().nullable(),
  department: z.string().optional().nullable(), // extracted from organizations array
  isAdmin: z.boolean().optional(),
});

export type GoogleDirectoryUserParsed = z.infer<typeof googleDirectoryUserSchema>;

// ---------------------------------------------------------------------------
// Google Group Schema
// ---------------------------------------------------------------------------

export const googleGroupSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  description: z.string().optional().nullable(),
  directMembersCount: z.string().optional(),
});

export type GoogleGroupParsed = z.infer<typeof googleGroupSchema>;

// ---------------------------------------------------------------------------
// Group-to-Role Mapping Schema
// ---------------------------------------------------------------------------

export const groupRoleMappingSchema = z.object({
  groupEmail: z.email(),
  groupName: z.string(),
  role: directoryRoleEnum,
});

export type GroupRoleMapping = z.infer<typeof groupRoleMappingSchema>;

// ---------------------------------------------------------------------------
// Directory Import Input Schema
// ---------------------------------------------------------------------------

export const directoryImportInputSchema = z.object({
  users: z
    .array(
      z.object({
        email: z.email(),
        name: z.string(),
        googleUserId: z.string(),
      }),
    )
    .min(1),
  defaultRole: directoryRoleEnum,
  groupRoleMappings: z.array(groupRoleMappingSchema).default([]),
  userRoleOverrides: z.record(z.email(), directoryRoleEnum).default({}),
  /**
   * Client-supplied group memberships for display purposes only.
   * Server MUST re-fetch from Google API for RBAC role resolution.
   */
  userGroupMemberships: z.record(z.email(), z.array(z.email())).default({}),
});

export type DirectoryImportInput = z.infer<typeof directoryImportInputSchema>;

// ---------------------------------------------------------------------------
// Directory Import Result Schema
// ---------------------------------------------------------------------------

export const directoryImportResultSchema = z.object({
  succeeded: z.array(z.object({ email: z.string(), role: directoryRoleEnum })),
  failed: z.array(z.object({ email: z.string(), error: z.string() })),
});

export type DirectoryImportResult = z.infer<typeof directoryImportResultSchema>;
