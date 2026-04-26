import { describe, expect, it } from 'vitest';
import {
  batchImportInputSchema,
  conflictSchema,
  fetchPeopleInputSchema,
  fetchPeopleOutputSchema,
  importedProjectSchema,
  importProgressOutputSchema,
  importProjectInputSchema,
  listSourcesOutputSchema,
  mergedPersonSchema,
  retryItemInputSchema,
  sourceEntrySchema,
  sourceProviderSchema,
  startImportInputSchema,
} from '../onboarding-import.js';

// ---------------------------------------------------------------------------
// sourceProviderSchema
// ---------------------------------------------------------------------------

describe('sourceProviderSchema', () => {
  it.each(['JIRA', 'LINEAR', 'GOOGLE_WORKSPACE', 'SLACK'])('accepts %s', val => {
    expect(sourceProviderSchema.safeParse(val).success).toBe(true);
  });

  it('rejects unknown provider', () => {
    expect(sourceProviderSchema.safeParse('GITHUB').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listSourcesOutputSchema
// ---------------------------------------------------------------------------

describe('listSourcesOutputSchema', () => {
  it('accepts valid array', () => {
    const r = listSourcesOutputSchema.safeParse([
      { provider: 'JIRA', connected: true, selected: false },
      { provider: 'SLACK', connected: false, selected: true },
    ]);
    expect(r.success).toBe(true);
  });

  it('accepts empty array', () => {
    expect(listSourcesOutputSchema.safeParse([]).success).toBe(true);
  });

  it('rejects missing fields', () => {
    const r = listSourcesOutputSchema.safeParse([{ provider: 'JIRA' }]);
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchPeopleInputSchema
// ---------------------------------------------------------------------------

describe('fetchPeopleInputSchema', () => {
  it('accepts valid sources', () => {
    const r = fetchPeopleInputSchema.safeParse({ sources: ['JIRA', 'LINEAR'] });
    expect(r.success).toBe(true);
  });

  it('rejects empty sources array', () => {
    const r = fetchPeopleInputSchema.safeParse({ sources: [] });
    expect(r.success).toBe(false);
  });

  it('rejects invalid source in array', () => {
    const r = fetchPeopleInputSchema.safeParse({ sources: ['GITHUB'] });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sourceEntrySchema
// ---------------------------------------------------------------------------

describe('sourceEntrySchema', () => {
  it('accepts minimal entry', () => {
    const r = sourceEntrySchema.safeParse({ source: 'JIRA', name: 'John Doe' });
    expect(r.success).toBe(true);
  });

  it('accepts entry with optional fields', () => {
    const r = sourceEntrySchema.safeParse({
      source: 'SLACK',
      name: 'Jane',
      avatarUrl: 'https://example.com/avatar.png',
      metadata: { slackId: 'U123' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing name', () => {
    const r = sourceEntrySchema.safeParse({ source: 'JIRA' });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// conflictSchema
// ---------------------------------------------------------------------------

describe('conflictSchema', () => {
  it('accepts valid conflict', () => {
    const r = conflictSchema.safeParse({
      field: 'name',
      values: [
        { source: 'JIRA', value: 'John' },
        { source: 'SLACK', value: 'Johnny' },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('accepts conflict with resolved field', () => {
    const r = conflictSchema.safeParse({
      field: 'name',
      values: [{ source: 'JIRA', value: 'John' }],
      resolved: 'John',
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing values', () => {
    const r = conflictSchema.safeParse({ field: 'name' });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mergedPersonSchema
// ---------------------------------------------------------------------------

describe('mergedPersonSchema', () => {
  const validPerson = {
    email: 'john@example.com',
    name: 'John Doe',
    sources: [{ source: 'JIRA', name: 'John Doe' }],
    status: 'new' as const,
  };

  it('accepts valid person', () => {
    expect(mergedPersonSchema.safeParse(validPerson).success).toBe(true);
  });

  it('accepts all status values', () => {
    for (const status of ['new', 'conflict', 'exists']) {
      const r = mergedPersonSchema.safeParse({ ...validPerson, status });
      expect(r.success).toBe(true);
    }
  });

  it('rejects invalid email', () => {
    const r = mergedPersonSchema.safeParse({ ...validPerson, email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const r = mergedPersonSchema.safeParse({ ...validPerson, status: 'unknown' });
    expect(r.success).toBe(false);
  });

  it('accepts person with conflicts', () => {
    const r = mergedPersonSchema.safeParse({
      ...validPerson,
      status: 'conflict',
      conflicts: [
        {
          field: 'name',
          values: [
            { source: 'JIRA', value: 'John' },
            { source: 'SLACK', value: 'Johnny' },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// batchImportInputSchema
// ---------------------------------------------------------------------------

describe('batchImportInputSchema', () => {
  it('accepts valid batch', () => {
    const r = batchImportInputSchema.safeParse({
      people: [{ email: 'a@b.com', name: 'A', role: 'readonly' }],
    });
    expect(r.success).toBe(true);
  });

  it('defaults skip to false', () => {
    const r = batchImportInputSchema.safeParse({
      people: [{ email: 'a@b.com', name: 'A', role: 'readonly' }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.people[0]?.skip).toBe(false);
    }
  });

  it('rejects invalid email in people array', () => {
    const r = batchImportInputSchema.safeParse({
      people: [{ email: 'not-email', name: 'A', role: 'readonly' }],
    });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// importedProjectSchema
// ---------------------------------------------------------------------------

describe('importedProjectSchema', () => {
  it('accepts valid project', () => {
    const r = importedProjectSchema.safeParse({
      sourceProvider: 'LINEAR',
      externalId: 'ext-123',
      name: 'My Project',
      statuses: [{ id: 's1', name: 'Todo' }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts status with optional color', () => {
    const r = importedProjectSchema.safeParse({
      sourceProvider: 'JIRA',
      externalId: 'ext-1',
      name: 'Proj',
      statuses: [{ id: 's1', name: 'Done', color: '#00ff00' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid source provider', () => {
    const r = importedProjectSchema.safeParse({
      sourceProvider: 'GITHUB',
      externalId: 'ext-1',
      name: 'Proj',
      statuses: [],
    });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// importProjectInputSchema
// ---------------------------------------------------------------------------

describe('importProjectInputSchema', () => {
  it('accepts valid input', () => {
    const r = importProjectInputSchema.safeParse({
      projects: [
        {
          sourceProvider: 'JIRA',
          externalId: 'ext-1',
          name: 'Proj',
          steps: [{ name: 'Todo', sortOrder: 0 }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('defaults skip to false', () => {
    const r = importProjectInputSchema.safeParse({
      projects: [
        {
          sourceProvider: 'JIRA',
          externalId: 'ext-1',
          name: 'Proj',
          steps: [{ name: 'Todo', sortOrder: 0 }],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.projects[0]?.skip).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// importProgressOutputSchema
// ---------------------------------------------------------------------------

describe('importProgressOutputSchema', () => {
  it('accepts valid progress', () => {
    const r = importProgressOutputSchema.safeParse({
      jobId: 'job-123',
      status: 'processing',
      totalItems: 10,
      completedItems: 5,
      failedItems: [],
    });
    expect(r.success).toBe(true);
  });

  it('accepts all status values', () => {
    for (const status of ['pending', 'processing', 'completed', 'failed']) {
      const r = importProgressOutputSchema.safeParse({
        jobId: 'j',
        status,
        totalItems: 0,
        completedItems: 0,
        failedItems: [],
      });
      expect(r.success).toBe(true);
    }
  });

  it('accepts progress with failed items', () => {
    const r = importProgressOutputSchema.safeParse({
      jobId: 'j',
      status: 'failed',
      totalItems: 1,
      completedItems: 0,
      failedItems: [{ email: 'a@b.com', error: 'Duplicate', role: 'readonly' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const r = importProgressOutputSchema.safeParse({
      jobId: 'j',
      status: 'cancelled',
      totalItems: 0,
      completedItems: 0,
      failedItems: [],
    });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// retryItemInputSchema
// ---------------------------------------------------------------------------

describe('retryItemInputSchema', () => {
  it('accepts valid input', () => {
    const r = retryItemInputSchema.safeParse({ jobId: 'job-1', email: 'a@b.com' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = retryItemInputSchema.safeParse({ jobId: 'job-1', email: 'bad' });
    expect(r.success).toBe(false);
  });

  it('rejects missing jobId', () => {
    const r = retryItemInputSchema.safeParse({ email: 'a@b.com' });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// startImportInputSchema
// ---------------------------------------------------------------------------

describe('startImportInputSchema', () => {
  it('accepts valid combined input', () => {
    const r = startImportInputSchema.safeParse({
      people: [{ email: 'a@b.com', name: 'A', role: 'readonly' }],
      projects: [
        {
          sourceProvider: 'JIRA',
          externalId: 'ext-1',
          name: 'Proj',
          steps: [{ name: 'Todo', sortOrder: 0 }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing people', () => {
    const r = startImportInputSchema.safeParse({
      projects: [],
    });
    expect(r.success).toBe(false);
  });
});
