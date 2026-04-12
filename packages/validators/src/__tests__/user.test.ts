import { describe, expect, it } from 'vitest';
import { inviteUserSchema, updateUserRoleSchema } from '../user.js';

describe('inviteUserSchema', () => {
  it('accepts valid email and role', () => {
    const r = inviteUserSchema.safeParse({
      email: 'new@example.com',
      role: 'readonly',
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = inviteUserSchema.safeParse({
      email: 'not-email',
      role: 'admin',
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown role', () => {
    const r = inviteUserSchema.safeParse({
      email: 'a@b.com',
      role: 'superuser',
    });
    expect(r.success).toBe(false);
  });
});

describe('updateUserRoleSchema', () => {
  it('requires userId and role', () => {
    const r = updateUserRoleSchema.safeParse({
      userId: 'u1',
      role: 'finance_admin',
    });
    expect(r.success).toBe(true);
  });
});
