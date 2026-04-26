import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockLinearGraphQL } = vi.hoisted(() => ({
  mockLinearGraphQL: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    workflowTemplate: { create: vi.fn() },
    workflowTaskTemplate: { createMany: vi.fn() },
  },
}));

vi.mock('../linear-issue-sync.js', () => ({
  linearGraphQL: mockLinearGraphQL,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@contractor-ops/db';
import type { SourcePerson } from '../onboarding-import-service.js';
import {
  createWorkflowTemplatesFromProjects,
  fetchUsersFromSource,
  mergeByEmail,
} from '../onboarding-import-service.js';

// ---------------------------------------------------------------------------
// Typed mock handles
// ---------------------------------------------------------------------------

const mockPrisma = prisma as unknown as {
  workflowTemplate: { create: ReturnType<typeof vi.fn> };
  workflowTaskTemplate: { createMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// mergeByEmail
// ---------------------------------------------------------------------------

describe('mergeByEmail', () => {
  it('groups people by normalized lowercase email', () => {
    const people: SourcePerson[] = [
      { email: 'Alice@example.com', name: 'Alice', source: 'JIRA' },
      { email: 'alice@example.com', name: 'Alice', source: 'LINEAR' },
    ];

    const result = mergeByEmail(people, new Set());

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('alice@example.com');
    expect(result[0].sources).toHaveLength(2);
    expect(result[0].status).toBe('new');
  });

  it('detects name conflicts across sources', () => {
    const people: SourcePerson[] = [
      { email: 'bob@example.com', name: 'Bob Smith', source: 'JIRA' },
      { email: 'bob@example.com', name: 'Robert Smith', source: 'SLACK' },
    ];

    const result = mergeByEmail(people, new Set());

    expect(result[0].status).toBe('conflict');
    expect(result[0].conflicts).toBeDefined();
    expect(result[0].conflicts?.[0].field).toBe('name');
    expect(result[0].conflicts?.[0].values).toHaveLength(2);
  });

  it('marks existing emails with status "exists"', () => {
    const people: SourcePerson[] = [
      { email: 'existing@example.com', name: 'Existing User', source: 'JIRA' },
    ];

    const result = mergeByEmail(people, new Set(['existing@example.com']));

    expect(result[0].status).toBe('exists');
  });

  it('sorts conflicts first, then new, then exists', () => {
    const people: SourcePerson[] = [
      { email: 'new@example.com', name: 'New User', source: 'JIRA' },
      { email: 'existing@example.com', name: 'Existing', source: 'JIRA' },
      { email: 'conflict@example.com', name: 'Name A', source: 'JIRA' },
      { email: 'conflict@example.com', name: 'Name B', source: 'SLACK' },
    ];

    const result = mergeByEmail(people, new Set(['existing@example.com']));

    expect(result[0].status).toBe('conflict');
    expect(result[1].status).toBe('new');
    expect(result[2].status).toBe('exists');
  });

  it('returns empty array for empty input', () => {
    const result = mergeByEmail([], new Set());
    expect(result).toEqual([]);
  });

  it('no conflicts field when names are identical across sources', () => {
    const people: SourcePerson[] = [
      { email: 'same@example.com', name: 'Same Name', source: 'JIRA' },
      { email: 'same@example.com', name: 'Same Name', source: 'LINEAR' },
    ];

    const result = mergeByEmail(people, new Set());

    expect(result[0].conflicts).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createWorkflowTemplatesFromProjects
// ---------------------------------------------------------------------------

describe('createWorkflowTemplatesFromProjects', () => {
  const ORG_ID = 'org-onboard-1';
  const USER_ID = 'user-onboard-1';

  it('creates templates for non-skipped projects', async () => {
    mockPrisma.workflowTemplate.create
      .mockResolvedValueOnce({ id: 'tmpl-1' })
      .mockResolvedValueOnce({ id: 'tmpl-2' });
    mockPrisma.workflowTaskTemplate.createMany.mockResolvedValue({ count: 2 });

    const projects = [
      {
        sourceProvider: 'LINEAR',
        externalId: 'ext-1',
        name: 'Project Alpha',
        skip: false,
        steps: [
          { name: 'Step 1', sortOrder: 0 },
          { name: 'Step 2', sortOrder: 1 },
        ],
      },
      {
        sourceProvider: 'JIRA',
        externalId: 'ext-2',
        name: 'Project Beta',
        skip: false,
        steps: [{ name: 'Step A', sortOrder: 0 }],
      },
    ];

    const result = await createWorkflowTemplatesFromProjects({
      projects,
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
    });

    expect(result).toEqual(['tmpl-1', 'tmpl-2']);
    expect(mockPrisma.workflowTemplate.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.workflowTaskTemplate.createMany).toHaveBeenCalledTimes(2);
  });

  it('skips projects with skip: true', async () => {
    mockPrisma.workflowTemplate.create.mockResolvedValue({ id: 'tmpl-only' });
    mockPrisma.workflowTaskTemplate.createMany.mockResolvedValue({ count: 1 });

    const projects = [
      {
        sourceProvider: 'LINEAR',
        externalId: 'ext-skip',
        name: 'Skipped Project',
        skip: true,
        steps: [{ name: 'Step X', sortOrder: 0 }],
      },
      {
        sourceProvider: 'LINEAR',
        externalId: 'ext-keep',
        name: 'Kept Project',
        skip: false,
        steps: [{ name: 'Step Y', sortOrder: 0 }],
      },
    ];

    const result = await createWorkflowTemplatesFromProjects({
      projects,
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
    });

    expect(result).toEqual(['tmpl-only']);
    expect(mockPrisma.workflowTemplate.create).toHaveBeenCalledTimes(1);
  });

  it('returns template IDs in order', async () => {
    mockPrisma.workflowTemplate.create
      .mockResolvedValueOnce({ id: 'tmpl-a' })
      .mockResolvedValueOnce({ id: 'tmpl-b' })
      .mockResolvedValueOnce({ id: 'tmpl-c' });
    mockPrisma.workflowTaskTemplate.createMany.mockResolvedValue({ count: 1 });

    const projects = [
      {
        sourceProvider: 'JIRA',
        externalId: '1',
        name: 'A',
        skip: false,
        steps: [{ name: 'S', sortOrder: 0 }],
      },
      {
        sourceProvider: 'JIRA',
        externalId: '2',
        name: 'B',
        skip: false,
        steps: [{ name: 'S', sortOrder: 0 }],
      },
      {
        sourceProvider: 'JIRA',
        externalId: '3',
        name: 'C',
        skip: false,
        steps: [{ name: 'S', sortOrder: 0 }],
      },
    ];

    const result = await createWorkflowTemplatesFromProjects({
      projects,
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
    });

    expect(result).toEqual(['tmpl-a', 'tmpl-b', 'tmpl-c']);
  });

  it('does not create task templates when steps are empty', async () => {
    mockPrisma.workflowTemplate.create.mockResolvedValue({ id: 'tmpl-empty' });

    const projects = [
      {
        sourceProvider: 'LINEAR',
        externalId: 'ext-empty',
        name: 'Empty Steps',
        skip: false,
        steps: [],
      },
    ];

    const result = await createWorkflowTemplatesFromProjects({
      projects,
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
    });

    expect(result).toEqual(['tmpl-empty']);
    expect(mockPrisma.workflowTaskTemplate.createMany).not.toHaveBeenCalled();
  });

  it('sets template type to CUSTOM and status to DRAFT', async () => {
    mockPrisma.workflowTemplate.create.mockResolvedValue({ id: 'tmpl-check' });
    mockPrisma.workflowTaskTemplate.createMany.mockResolvedValue({ count: 1 });

    await createWorkflowTemplatesFromProjects({
      projects: [
        {
          sourceProvider: 'JIRA',
          externalId: 'ext-1',
          name: 'Check Fields',
          skip: false,
          steps: [{ name: 'Step', sortOrder: 0 }],
        },
      ],
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
    });

    const createData = mockPrisma.workflowTemplate.create.mock.calls[0][0].data;
    expect(createData.type).toBe('CUSTOM');
    expect(createData.status).toBe('DRAFT');
    expect(createData.name).toBe('Check Fields Onboarding');
  });

  it('returns empty array when all projects are skipped', async () => {
    const result = await createWorkflowTemplatesFromProjects({
      projects: [
        { sourceProvider: 'JIRA', externalId: '1', name: 'A', skip: true, steps: [] },
        { sourceProvider: 'JIRA', externalId: '2', name: 'B', skip: true, steps: [] },
      ],
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
    });

    expect(result).toEqual([]);
    expect(mockPrisma.workflowTemplate.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fetchUsersFromSource
// ---------------------------------------------------------------------------

describe('fetchUsersFromSource', () => {
  it('returns empty array for unsupported provider', async () => {
    const result = await fetchUsersFromSource('UNKNOWN', 'token', {});
    expect(result).toEqual([]);
  });

  it('fetches Linear users via graphQL', async () => {
    mockLinearGraphQL.mockResolvedValue({
      organization: {
        users: {
          nodes: [
            {
              id: 'lin-1',
              name: 'Alice',
              email: 'alice@test.com',
              active: true,
              avatarUrl: 'https://img/a',
            },
            { id: 'lin-2', name: 'Bob', email: 'bob@test.com', active: false },
          ],
        },
      },
    });

    const result = await fetchUsersFromSource('LINEAR', 'test-token', {});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      email: 'alice@test.com',
      name: 'Alice',
      source: 'LINEAR',
      avatarUrl: 'https://img/a',
      metadata: { linearId: 'lin-1' },
    });
  });

  it('fetches Jira users with cloudId from metadata', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        {
          emailAddress: 'carol@test.com',
          displayName: 'Carol',
          avatarUrls: { '48x48': 'https://img/c' },
        },
      ],
    } as Response);

    const result = await fetchUsersFromSource('JIRA', 'jira-token', { cloudId: 'cloud-123' });

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('carol@test.com');
    expect(result[0].source).toBe('JIRA');

    mockFetch.mockRestore();
  });

  it('returns empty for Jira when no cloudId in metadata', async () => {
    const result = await fetchUsersFromSource('JIRA', 'token', {});
    expect(result).toEqual([]);
  });

  it('fetches Slack users filtering bots and deleted', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        members: [
          {
            id: 'U1',
            deleted: false,
            is_bot: false,
            is_app_user: false,
            profile: { email: 'dave@test.com', real_name: 'Dave' },
          },
          {
            id: 'U2',
            deleted: false,
            is_bot: true,
            is_app_user: false,
            profile: { email: 'bot@test.com', real_name: 'Bot' },
          },
          {
            id: 'U3',
            deleted: true,
            is_bot: false,
            is_app_user: false,
            profile: { email: 'old@test.com', real_name: 'Old' },
          },
        ],
        response_metadata: {},
      }),
    } as Response);

    const result = await fetchUsersFromSource('SLACK', 'slack-token', {});

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('dave@test.com');
    expect(result[0].source).toBe('SLACK');

    mockFetch.mockRestore();
  });

  it('fetches Google Workspace users', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [
          {
            id: 'g-1',
            primaryEmail: 'eve@test.com',
            name: { fullName: 'Eve' },
            thumbnailPhotoUrl: 'https://img/e',
          },
        ],
      }),
    } as Response);

    const result = await fetchUsersFromSource('GOOGLE_WORKSPACE', 'gws-token', {});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      email: 'eve@test.com',
      name: 'Eve',
      source: 'GOOGLE_WORKSPACE',
      avatarUrl: 'https://img/e',
      metadata: { googleId: 'g-1' },
    });

    mockFetch.mockRestore();
  });
});
