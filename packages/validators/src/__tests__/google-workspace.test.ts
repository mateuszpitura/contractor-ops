import { describe, expect, it } from 'vitest';
import {
  directoryImportInputSchema,
  googleDirectoryUserSchema,
  groupRoleMappingSchema,
} from '../google-workspace.js';

const validUser = {
  id: 'u1',
  primaryEmail: 'jane@example.com',
  name: {
    givenName: 'Jane',
    familyName: 'Doe',
    fullName: 'Jane Doe',
  },
  thumbnailPhotoUrl: 'https://lh3.googleusercontent.com/a/photo',
  orgUnitPath: '/Sales',
  department: 'Sales',
  isAdmin: false,
};

describe('Google Workspace Validators', () => {
  describe('googleDirectoryUserSchema', () => {
    it('accepts valid Google directory user with all fields', () => {
      const parsed = googleDirectoryUserSchema.parse(validUser);
      expect(parsed.primaryEmail).toBe('jane@example.com');
      expect(parsed.name.fullName).toBe('Jane Doe');
      expect(parsed.thumbnailPhotoUrl).toBe(validUser.thumbnailPhotoUrl);
    });

    it('accepts user with optional fields omitted', () => {
      const parsed = googleDirectoryUserSchema.parse({
        id: 'u2',
        primaryEmail: 'bob@example.com',
        name: {
          givenName: 'Bob',
          familyName: 'Smith',
          fullName: 'Bob Smith',
        },
      });
      expect(parsed.thumbnailPhotoUrl).toBeUndefined();
      expect(parsed.orgUnitPath).toBeUndefined();
      expect(parsed.department).toBeUndefined();
    });

    it('rejects user with invalid email', () => {
      expect(() =>
        googleDirectoryUserSchema.parse({
          ...validUser,
          primaryEmail: 'not-an-email',
        }),
      ).toThrow();
    });

    it('rejects user with missing required name fields', () => {
      expect(() =>
        googleDirectoryUserSchema.parse({
          id: 'u3',
          primaryEmail: 'x@example.com',
          name: { givenName: 'X', familyName: 'Y' },
        }),
      ).toThrow();
    });
  });

  describe('directoryImportInputSchema', () => {
    const baseRow = {
      email: 'member@example.com',
      name: 'Member User',
      googleUserId: 'g123',
    };

    it('accepts valid import input with users, defaultRole, and optional mappings', () => {
      const parsed = directoryImportInputSchema.parse({
        users: [baseRow],
        defaultRole: 'readonly',
        groupRoleMappings: [
          {
            groupEmail: 'finance@example.com',
            groupName: 'Finance',
            role: 'finance_admin',
          },
        ],
        userRoleOverrides: { 'boss@example.com': 'admin' },
        userGroupMemberships: { 'member@example.com': ['group@example.com'] },
      });
      expect(parsed.users).toHaveLength(1);
      expect(parsed.defaultRole).toBe('readonly');
      expect(parsed.groupRoleMappings).toHaveLength(1);
      expect(parsed.userRoleOverrides['boss@example.com']).toBe('admin');
      expect(parsed.userGroupMemberships['member@example.com']).toEqual(['group@example.com']);
    });

    it('defaults groupRoleMappings to empty array', () => {
      const parsed = directoryImportInputSchema.parse({
        users: [baseRow],
        defaultRole: 'team_manager',
      });
      expect(parsed.groupRoleMappings).toEqual([]);
    });

    it('defaults userRoleOverrides to empty object', () => {
      const parsed = directoryImportInputSchema.parse({
        users: [baseRow],
        defaultRole: 'readonly',
      });
      expect(parsed.userRoleOverrides).toEqual({});
    });

    it('defaults userGroupMemberships to empty object', () => {
      const parsed = directoryImportInputSchema.parse({
        users: [baseRow],
        defaultRole: 'readonly',
      });
      expect(parsed.userGroupMemberships).toEqual({});
    });

    it('rejects import with empty users array', () => {
      expect(() =>
        directoryImportInputSchema.parse({
          users: [],
          defaultRole: 'readonly',
        }),
      ).toThrow();
    });

    it('rejects import with invalid role value', () => {
      expect(() =>
        directoryImportInputSchema.parse({
          users: [baseRow],
          defaultRole: 'not_a_role',
        }),
      ).toThrow();
    });
  });

  describe('groupRoleMappingSchema', () => {
    it('accepts valid group-to-role mapping', () => {
      const parsed = groupRoleMappingSchema.parse({
        groupEmail: 'team-leads@example.com',
        groupName: 'Team Leads',
        role: 'team_manager',
      });
      expect(parsed.role).toBe('team_manager');
    });

    it('rejects mapping with invalid group email', () => {
      expect(() =>
        groupRoleMappingSchema.parse({
          groupEmail: 'not-email',
          groupName: 'X',
          role: 'readonly',
        }),
      ).toThrow();
    });

    it('rejects mapping with invalid role', () => {
      expect(() =>
        groupRoleMappingSchema.parse({
          groupEmail: 'g@example.com',
          groupName: 'G',
          role: 'superuser',
        }),
      ).toThrow();
    });
  });
});
