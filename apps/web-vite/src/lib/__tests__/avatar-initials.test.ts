import { describe, expect, it } from 'vitest';
import { getAvatarInitials } from '../avatar-initials';

describe('getAvatarInitials', () => {
  it('uses first letter of first and last word for multi-word names', () => {
    expect(getAvatarInitials('John Doe')).toBe('JD');
    expect(getAvatarInitials('  Alice   Bob  Carter  ')).toBe('AC');
  });

  it('uses first two letters for a single word with length >= 2', () => {
    expect(getAvatarInitials('Mateusz')).toBe('MA');
    expect(getAvatarInitials('ab')).toBe('AB');
  });

  it('uses one letter for a single character name', () => {
    expect(getAvatarInitials('X')).toBe('X');
  });

  it('falls back to email when name is empty', () => {
    expect(getAvatarInitials(null, 'alice@example.com')).toBe('AL');
    expect(getAvatarInitials('  ', 'bob@test.dev')).toBe('BO');
  });

  it('returns ? when no name and no email', () => {
    expect(getAvatarInitials(undefined)).toBe('?');
    expect(getAvatarInitials(null, null)).toBe('?');
    expect(getAvatarInitials('', '')).toBe('?');
  });
});
