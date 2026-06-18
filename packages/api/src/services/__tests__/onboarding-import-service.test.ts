import { describe, expect, it } from 'vitest';
import type { SourcePerson } from '../onboarding-import-service.js';
import { mergeByEmail } from '../onboarding-import-service.js';

function person(
  email: string,
  name: string,
  source: SourcePerson['source'] = 'JIRA',
): SourcePerson {
  return { email, name, source };
}

describe('mergeByEmail', () => {
  it('merges duplicate emails case-insensitively and normalizes to lowercase', () => {
    const merged = mergeByEmail(
      [person('Alice@Example.com', 'Alice'), person('alice@example.com', 'Alice')],
      new Set(),
    );

    expect(merged).toHaveLength(1);
    // Email is normalized to lowercase (the documented contract — matched
    // case-insensitively against existing members and stored normalized).
    expect(merged[0]?.email).toBe('alice@example.com');
    expect(merged[0]?.status).toBe('new');
    expect(merged[0]?.sources).toHaveLength(2);
  });

  it('marks existing org members as exists', () => {
    const merged = mergeByEmail([person('bob@example.com', 'Bob')], new Set(['bob@example.com']));

    expect(merged[0]?.status).toBe('exists');
    expect(merged[0]?.conflicts).toBeUndefined();
  });

  it('detects name conflicts across sources for the same email', () => {
    const merged = mergeByEmail(
      [
        person('carol@example.com', 'Carol A', 'JIRA'),
        person('carol@example.com', 'Carol B', 'LINEAR'),
      ],
      new Set(),
    );

    expect(merged[0]?.status).toBe('conflict');
    expect(merged[0]?.conflicts).toEqual([
      {
        field: 'name',
        values: [
          { source: 'JIRA', value: 'Carol A' },
          { source: 'LINEAR', value: 'Carol B' },
        ],
      },
    ]);
  });

  it('skips invalid and blank emails', () => {
    const merged = mergeByEmail(
      [person('', 'No Email'), person('not-an-email', 'Bad'), person('valid@example.com', 'Valid')],
      new Set(),
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.email).toBe('valid@example.com');
  });

  it('sorts conflict before new before exists', () => {
    const merged = mergeByEmail(
      [
        person('exists@example.com', 'Exists User'),
        person('new@example.com', 'New User'),
        person('conflict@example.com', 'Name A', 'JIRA'),
        person('conflict@example.com', 'Name B', 'SLACK'),
      ],
      new Set(['exists@example.com']),
    );

    expect(merged.map(row => row.status)).toEqual(['conflict', 'new', 'exists']);
  });
});
