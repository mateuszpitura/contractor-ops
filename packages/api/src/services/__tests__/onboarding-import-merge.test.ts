import { describe, expect, it } from 'vitest';
import type { SourcePerson } from '../onboarding-import-service.js';
import { mergeByEmail } from '../onboarding-import-service.js';

describe('mergeByEmail', () => {
  it('sorts conflict before new before exists', () => {
    const people: SourcePerson[] = [
      { email: 'exists@x.com', name: 'Exists', source: 'SLACK' },
      { email: 'new@x.com', name: 'New', source: 'JIRA' },
      { email: 'conflict@x.com', name: 'A', source: 'JIRA' },
      { email: 'conflict@x.com', name: 'B', source: 'LINEAR' },
    ];

    const merged = mergeByEmail(people, new Set(['exists@x.com']));
    expect(merged.map(m => m.status)).toEqual(['conflict', 'new', 'exists']);
  });

  it('marks conflict when names differ for same email', () => {
    const merged = mergeByEmail(
      [
        { email: 'x@y.com', name: 'One', source: 'SLACK' },
        { email: 'x@y.com', name: 'Two', source: 'JIRA' },
      ],
      new Set(),
    );
    expect(merged[0]?.status).toBe('conflict');
    expect(merged[0]?.conflicts).toBeDefined();
  });
});
