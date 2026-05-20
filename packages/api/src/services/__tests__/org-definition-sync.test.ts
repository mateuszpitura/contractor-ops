// Tests for the org-definitions sync service. We exercise the merge-on-collision,
// idempotent-link, and fresh-insert paths against a hand-rolled Prisma double —
// the real ctx.db type is too involved for a mock and the logic under test is
// pure orchestration over a small surface.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const { mockFetchJiraProjects, mockFetchLinearTeams, mockDecryptCredentials } = vi.hoisted(() => ({
  mockFetchJiraProjects: vi.fn(),
  mockFetchLinearTeams: vi.fn(),
  mockDecryptCredentials: vi.fn(() => ({ accessToken: 'tok_test' })),
}));

vi.mock('@contractor-ops/integrations', () => ({
  fetchJiraProjects: mockFetchJiraProjects,
  fetchLinearTeams: mockFetchLinearTeams,
  decryptCredentials: mockDecryptCredentials,
}));

const { mockWriteAuditLog } = vi.hoisted(() => ({
  mockWriteAuditLog: vi.fn(async () => undefined),
}));
vi.mock('../audit-writer', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

import {
  syncJiraProjectsToOrgDefinitions,
  syncLinearTeamsToOrgDefinitions,
} from '../org-definition-sync';

interface ExistingLink {
  id: string;
  externalId: string;
  projectId: string;
}

interface ExistingProject {
  id: string;
  name: string;
}

interface DbState {
  links: ExistingLink[];
  projects: ExistingProject[];
  pendingMerges: Array<{
    organizationId: string;
    source: string;
    externalId: string;
    incomingName: string;
    candidateProjectIds: string[];
  }>;
  newProjects: ExistingProject[];
  newLinks: ExistingLink[];
  connectionUpdates: Record<string, unknown>[];
  createdProjectIds: string[];
}

function buildDb(state: DbState) {
  let txCounter = 0;
  return {
    projectExternalLink: {
      findMany: vi.fn(async ({ where }: { where: { externalId: { in: string[] } } }) => {
        return state.links.filter(l => where.externalId.in.includes(l.externalId));
      }),
      update: vi.fn(async () => ({})),
      create: vi.fn(async ({ data }: { data: ExistingLink & { syncedAt: Date } }) => {
        state.newLinks.push({
          id: `lnk_${state.newLinks.length}`,
          externalId: data.externalId,
          projectId: data.projectId,
        });
        return { id: `lnk_${state.newLinks.length}` };
      }),
    },
    project: {
      findMany: vi.fn(async () => state.projects),
      create: vi.fn(async ({ data }: { data: ExistingProject & { externalId?: string } }) => {
        const id = `pr_new_${++txCounter}`;
        state.newProjects.push({ id, name: data.name });
        state.createdProjectIds.push(id);
        return { id, name: data.name };
      }),
    },
    pendingProjectMerge: {
      upsert: vi.fn(async ({ create }: { create: DbState['pendingMerges'][number] }) => {
        state.pendingMerges.push(create);
        return create;
      }),
    },
    integrationConnection: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.connectionUpdates.push(data);
        return data;
      }),
    },
    // $transaction passes a tx that points at the same fake — sufficient for
    // the unit under test since we just need create/upsert to land in state.
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb(buildDb(state));
    }),
  } as unknown as Parameters<typeof syncJiraProjectsToOrgDefinitions>[0]['db'];
}

function freshState(over: Partial<DbState> = {}): DbState {
  return {
    links: [],
    projects: [],
    pendingMerges: [],
    newProjects: [],
    newLinks: [],
    connectionUpdates: [],
    createdProjectIds: [],
    ...over,
  };
}

const jiraConnection = {
  id: 'ic_jira',
  organizationId: 'org_1',
  provider: 'JIRA' as const,
  credentialsRef: 'cred_jira',
  configJson: { cloudId: 'cloud-1' },
};

const linearConnection = {
  id: 'ic_linear',
  organizationId: 'org_1',
  provider: 'LINEAR' as const,
  credentialsRef: 'cred_linear',
  configJson: null,
};

describe('syncJiraProjectsToOrgDefinitions', () => {
  beforeEach(() => {
    mockFetchJiraProjects.mockReset();
    mockFetchLinearTeams.mockReset();
    mockWriteAuditLog.mockClear();
  });

  it('inserts a fresh Project + ProjectExternalLink for a never-seen remote project', async () => {
    mockFetchJiraProjects.mockResolvedValueOnce([
      { externalId: 'jira-1', name: 'Apollo', key: 'APL', statuses: [] },
    ]);
    const state = freshState();
    const result = await syncJiraProjectsToOrgDefinitions(
      { db: buildDb(state), actorUserId: 'user_1' },
      jiraConnection,
    );
    expect(result).toEqual({ inserted: 1, linked: 0, pending: 0, errors: 0 });
    expect(state.newProjects).toHaveLength(1);
    expect(state.newProjects[0]?.name).toBe('Apollo');
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
  });

  it('bumps syncedAt when a ProjectExternalLink already exists (no insert)', async () => {
    mockFetchJiraProjects.mockResolvedValueOnce([
      { externalId: 'jira-1', name: 'Apollo', key: 'APL', statuses: [] },
    ]);
    const state = freshState({
      links: [{ id: 'lnk_1', externalId: 'jira-1', projectId: 'pr_1' }],
    });
    const result = await syncJiraProjectsToOrgDefinitions(
      { db: buildDb(state), actorUserId: 'user_1' },
      jiraConnection,
    );
    expect(result).toEqual({ inserted: 0, linked: 1, pending: 0, errors: 0 });
    expect(state.newProjects).toHaveLength(0);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('queues a PendingProjectMerge on case-insensitive name collision', async () => {
    mockFetchJiraProjects.mockResolvedValueOnce([
      { externalId: 'jira-2', name: '  APOLLO  ', key: 'APL', statuses: [] },
    ]);
    const state = freshState({
      projects: [{ id: 'pr_local', name: 'apollo' }],
    });
    const result = await syncJiraProjectsToOrgDefinitions(
      { db: buildDb(state), actorUserId: null },
      jiraConnection,
    );
    expect(result).toEqual({ inserted: 0, linked: 0, pending: 1, errors: 0 });
    expect(state.pendingMerges).toEqual([
      {
        organizationId: 'org_1',
        source: 'JIRA',
        externalId: 'jira-2',
        incomingName: '  APOLLO  ',
        candidateProjectIds: ['pr_local'],
      },
    ]);
  });

  it('skips when cloudId is missing on the connection config', async () => {
    const state = freshState();
    const result = await syncJiraProjectsToOrgDefinitions(
      { db: buildDb(state), actorUserId: null },
      { ...jiraConnection, configJson: null },
    );
    expect(result).toEqual({ inserted: 0, linked: 0, pending: 0, errors: 0 });
    expect(mockFetchJiraProjects).not.toHaveBeenCalled();
  });

  it('records success on IntegrationConnection.lastSuccessAt when every row imports', async () => {
    mockFetchJiraProjects.mockResolvedValueOnce([
      { externalId: 'jira-1', name: 'Apollo', key: 'APL', statuses: [] },
    ]);
    const state = freshState();
    await syncJiraProjectsToOrgDefinitions(
      { db: buildDb(state), actorUserId: 'user_1' },
      jiraConnection,
    );
    expect(state.connectionUpdates).toHaveLength(1);
    const u = state.connectionUpdates[0]!;
    expect(u.lastSuccessAt).toBeInstanceOf(Date);
    expect(u.lastErrorMessage).toBeNull();
  });
});

describe('syncLinearTeamsToOrgDefinitions', () => {
  beforeEach(() => {
    mockFetchJiraProjects.mockReset();
    mockFetchLinearTeams.mockReset();
    mockWriteAuditLog.mockClear();
  });

  it('inserts a fresh Project for every never-seen Linear team', async () => {
    mockFetchLinearTeams.mockResolvedValueOnce([
      { externalId: 'lin-1', name: 'Mercury', key: 'MER', states: [] },
      { externalId: 'lin-2', name: 'Gemini', key: 'GEM', states: [] },
    ]);
    const state = freshState();
    const result = await syncLinearTeamsToOrgDefinitions(
      { db: buildDb(state), actorUserId: null },
      linearConnection,
    );
    expect(result).toEqual({ inserted: 2, linked: 0, pending: 0, errors: 0 });
    expect(state.newProjects).toHaveLength(2);
  });

  it('rejects a wrong-provider connection at the boundary', async () => {
    await expect(
      syncLinearTeamsToOrgDefinitions(
        { db: buildDb(freshState()), actorUserId: null },
        { ...linearConnection, provider: 'JIRA' as const },
      ),
    ).rejects.toThrow(/expected provider=LINEAR/);
  });
});
