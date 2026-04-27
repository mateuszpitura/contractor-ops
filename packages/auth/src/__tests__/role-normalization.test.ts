import { describe, expect, it } from 'vitest';
import {
  eligibleMemberRolesForApproval,
  isAdminLikeRole,
  parseMemberRole,
} from '../role-normalization.js';

describe('role parsing', () => {
  it('accepts current Better Auth member roles', () => {
    expect(parseMemberRole('finance_admin')).toBe('finance_admin');
    expect(parseMemberRole('legal_compliance_viewer')).toBe('legal_compliance_viewer');
    expect(parseMemberRole('readonly')).toBe('readonly');
  });

  it('rejects non-current role names', () => {
    expect(parseMemberRole('FINANCE_ADMIN')).toBeNull();
    expect(parseMemberRole('ORG_ADMIN')).toBeNull();
    expect(parseMemberRole('ACCOUNTANT')).toBeNull();
    expect(parseMemberRole('READ_ONLY')).toBeNull();
  });

  it('rejects whitespace-padded inputs (no implicit trimming)', () => {
    // Authorization predicates accept exact matches only — silent whitespace
    // normalization is a code smell at this layer.
    expect(parseMemberRole(' admin')).toBeNull();
    expect(parseMemberRole('admin ')).toBeNull();
    expect(parseMemberRole('  admin  ')).toBeNull();
    expect(parseMemberRole('\tadmin')).toBeNull();
  });

  it('rejects null, undefined, and empty strings', () => {
    expect(parseMemberRole(null)).toBeNull();
    expect(parseMemberRole(undefined)).toBeNull();
    expect(parseMemberRole('')).toBeNull();
  });

  it('allows owners to satisfy admin approval steps', () => {
    expect(eligibleMemberRolesForApproval('admin')).toEqual(['owner', 'admin']);
  });

  it('treats owner and admin as admin-like', () => {
    expect(isAdminLikeRole('owner')).toBe(true);
    expect(isAdminLikeRole('admin')).toBe(true);
    expect(isAdminLikeRole('finance_admin')).toBe(false);
  });
});
