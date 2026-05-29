import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNotionSearchPages, mockConfluenceSearchPages } = vi.hoisted(() => {
  return {
    mockNotionSearchPages: vi.fn(),
    mockConfluenceSearchPages: vi.fn(),
  };
});

const mockDecryptCredentials = vi.hoisted(() => vi.fn());

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: mockDecryptCredentials,
}));

vi.mock('@contractor-ops/integrations/adapters/notion-adapter', () => {
  return {
    NotionAdapter: class {
      slug = 'notion';
      searchPages = mockNotionSearchPages;
    },
  };
});

vi.mock('@contractor-ops/integrations/adapters/confluence-adapter', () => {
  return {
    ConfluenceAdapter: class {
      slug = 'confluence';
      searchPages = mockConfluenceSearchPages;
    },
  };
});

import { attachDocLink, detachDocLink, getDocLinks, searchDocs } from '../doc-link-service';

const mockPrisma = {
  externalLink: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  integrationConnection: {
    findFirst: vi.fn(),
  },
} as unknown;

const ORG_ID = 'org-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockDecryptCredentials.mockReturnValue({
    accessToken: 'mock-token',
    extra: { workspaceName: 'Test Workspace' },
  });
});

// ---------------------------------------------------------------------------
// attachDocLink
// ---------------------------------------------------------------------------

describe('attachDocLink', () => {
  it('passes ALL required fields to externalLink.create in the data payload', async () => {
    mockPrisma.externalLink.create.mockResolvedValue({ id: 'link-1' });

    const metadata = { title: 'Design Doc', icon: 'emoji', lastEditedTime: '2025-01-01' };

    await attachDocLink(mockPrisma, {
      organizationId: ORG_ID,
      integrationConnectionId: 'conn-1',
      workflowTaskRunId: 'wtr-1',
      externalId: 'notion-page-1',
      externalUrl: 'https://notion.so/page-1',
      externalType: 'NOTION_PAGE',
      metadata,
    });

    expect(mockPrisma.externalLink.create).toHaveBeenCalledWith({
      data: {
        organizationId: ORG_ID,
        integrationConnectionId: 'conn-1',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: 'wtr-1',
        externalType: 'NOTION_PAGE',
        externalId: 'notion-page-1',
        externalUrl: 'https://notion.so/page-1',
        metadataJson: metadata,
      },
    });
  });

  it('maps workflowTaskRunId to entityId (not as its own field)', async () => {
    mockPrisma.externalLink.create.mockResolvedValue({ id: 'link-1' });

    await attachDocLink(mockPrisma, {
      organizationId: ORG_ID,
      integrationConnectionId: 'conn-1',
      workflowTaskRunId: 'wtr-99',
      externalId: 'ext-1',
      externalUrl: 'https://example.com',
      externalType: 'CONFLUENCE_PAGE',
      metadata: {},
    });

    const data = mockPrisma.externalLink.create.mock.calls[0][0].data;
    expect(data.entityId).toBe('wtr-99');
    expect(data.entityType).toBe('WORKFLOW_TASK_RUN');
    expect(data).not.toHaveProperty('workflowTaskRunId');
  });

  it('returns the created externalLink record', async () => {
    const created = { id: 'link-1', externalType: 'NOTION_PAGE' };
    mockPrisma.externalLink.create.mockResolvedValue(created);

    const result = await attachDocLink(mockPrisma, {
      organizationId: ORG_ID,
      integrationConnectionId: 'conn-1',
      workflowTaskRunId: 'wtr-1',
      externalId: 'ext-1',
      externalUrl: 'https://example.com',
      externalType: 'NOTION_PAGE',
      metadata: {},
    });

    expect(result).toBe(created);
  });
});

// ---------------------------------------------------------------------------
// detachDocLink
// ---------------------------------------------------------------------------

describe('detachDocLink', () => {
  it('findFirst uses org-scoped where clause (id + organizationId)', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValue({
      id: 'link-1',
      organizationId: ORG_ID,
    });
    mockPrisma.externalLink.delete.mockResolvedValue({});

    await detachDocLink(mockPrisma, {
      organizationId: ORG_ID,
      externalLinkId: 'link-1',
    });

    expect(mockPrisma.externalLink.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'link-1',
        organizationId: ORG_ID,
      },
    });
  });

  it('delete uses the correct ID from input', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValue({
      id: 'link-42',
      organizationId: ORG_ID,
    });
    mockPrisma.externalLink.delete.mockResolvedValue({});

    await detachDocLink(mockPrisma, {
      organizationId: ORG_ID,
      externalLinkId: 'link-42',
    });

    expect(mockPrisma.externalLink.delete).toHaveBeenCalledWith({
      where: { id: 'link-42' },
    });
  });

  it('throws TRPCError NOT_FOUND when findFirst returns null', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValue(null);

    await expect(
      detachDocLink(mockPrisma, {
        organizationId: ORG_ID,
        externalLinkId: 'nonexistent',
      }),
    ).rejects.toThrow('docLinkNotFound');

    // delete should NOT be called
    expect(mockPrisma.externalLink.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getDocLinks
// ---------------------------------------------------------------------------

describe('getDocLinks', () => {
  it('where clause filters by NOTION_PAGE and CONFLUENCE_PAGE external types', async () => {
    mockPrisma.externalLink.findMany.mockResolvedValue([]);

    await getDocLinks(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-1',
    });

    const callArgs = mockPrisma.externalLink.findMany.mock.calls[0][0];
    expect(callArgs.where.externalType).toEqual({
      in: ['NOTION_PAGE', 'CONFLUENCE_PAGE'],
    });
  });

  it('where clause scopes by entityType WORKFLOW_TASK_RUN, entityId, and organizationId', async () => {
    mockPrisma.externalLink.findMany.mockResolvedValue([]);

    await getDocLinks(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-5',
    });

    const where = mockPrisma.externalLink.findMany.mock.calls[0][0].where;
    expect(where.entityType).toBe('WORKFLOW_TASK_RUN');
    expect(where.entityId).toBe('wtr-5');
    expect(where.organizationId).toBe(ORG_ID);
  });

  it('orders results by createdAt desc', async () => {
    mockPrisma.externalLink.findMany.mockResolvedValue([]);

    await getDocLinks(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: 'wtr-1',
    });

    const callArgs = mockPrisma.externalLink.findMany.mock.calls[0][0];
    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
  });
});

// ---------------------------------------------------------------------------
// searchDocs
// ---------------------------------------------------------------------------

describe('searchDocs', () => {
  it('calls Notion adapter with decrypted accessToken when provider=notion', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      provider: 'NOTION',
      status: 'CONNECTED',
      credentialsRef: 'cred-ref-notion',
    });
    mockDecryptCredentials.mockReturnValue({
      accessToken: 'notion-secret-token',
      extra: { workspaceName: 'My Workspace' },
    });
    mockNotionSearchPages.mockResolvedValue([]);

    await searchDocs({
      organizationId: ORG_ID,
      query: 'test',
      provider: 'notion',
      prisma: mockPrisma,
    });

    expect(mockDecryptCredentials).toHaveBeenCalledWith('cred-ref-notion', 'notion');
    expect(mockNotionSearchPages).toHaveBeenCalledWith('notion-secret-token', 'test');
  });

  it('calls Confluence adapter with decrypted accessToken AND cloudId when provider=confluence', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-2',
      provider: 'CONFLUENCE',
      status: 'CONNECTED',
      credentialsRef: 'cred-ref-confluence',
      configJson: { cloudId: 'cloud-abc' },
    });
    mockDecryptCredentials.mockReturnValue({
      accessToken: 'confluence-secret-token',
    });
    mockConfluenceSearchPages.mockResolvedValue([]);

    await searchDocs({
      organizationId: ORG_ID,
      query: 'docs',
      provider: 'confluence',
      prisma: mockPrisma,
    });

    expect(mockDecryptCredentials).toHaveBeenCalledWith('cred-ref-confluence', 'confluence');
    expect(mockConfluenceSearchPages).toHaveBeenCalledWith(
      'confluence-secret-token',
      'cloud-abc',
      'docs',
    );
  });

  it('returns empty array (not error) when no connection found for notion', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'anything',
      provider: 'notion',
      prisma: mockPrisma,
    });

    expect(results).toEqual([]);
    expect(mockNotionSearchPages).not.toHaveBeenCalled();
  });

  it('returns empty array (not error) when no connection found for confluence', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'anything',
      provider: 'confluence',
      prisma: mockPrisma,
    });

    expect(results).toEqual([]);
    expect(mockConfluenceSearchPages).not.toHaveBeenCalled();
  });

  it('caps Notion results at 10 per provider', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      provider: 'NOTION',
      status: 'CONNECTED',
      credentialsRef: 'cred-ref',
    });

    // Return 15 results from adapter
    const fifteenPages = Array.from({ length: 15 }, (_, i) => ({
      id: `page-${i}`,
      title: `Page ${i}`,
      icon: null,
      lastEditedTime: '2025-01-01T00:00:00Z',
      url: `https://notion.so/page-${i}`,
    }));
    mockNotionSearchPages.mockResolvedValue(fifteenPages);

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'test',
      provider: 'notion',
      prisma: mockPrisma,
    });

    expect(results).toHaveLength(10);
  });

  it('caps Confluence results at 10 per provider', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-2',
      provider: 'CONFLUENCE',
      status: 'CONNECTED',
      credentialsRef: 'cred-ref',
      configJson: { cloudId: 'cloud-1' },
    });

    const fifteenPages = Array.from({ length: 15 }, (_, i) => ({
      id: `page-${i}`,
      title: `Page ${i}`,
      spaceKey: 'DEV',
      spaceName: 'Development',
      url: `https://site.atlassian.net/wiki/page-${i}`,
    }));
    mockConfluenceSearchPages.mockResolvedValue(fifteenPages);

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'test',
      provider: 'confluence',
      prisma: mockPrisma,
    });

    expect(results).toHaveLength(10);
  });

  it("maps Notion results with provider='notion' and workspace subtitle", async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      provider: 'NOTION',
      status: 'CONNECTED',
      credentialsRef: 'cred-ref',
    });
    mockDecryptCredentials.mockReturnValue({
      accessToken: 'token',
      extra: { workspaceName: 'Acme Workspace' },
    });
    mockNotionSearchPages.mockResolvedValue([
      {
        id: 'page-1',
        title: 'Design Doc',
        icon: 'icon-emoji',
        lastEditedTime: '2025-01-01',
        url: 'https://notion.so/page-1',
      },
    ]);

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'design',
      provider: 'notion',
      prisma: mockPrisma,
    });

    expect(results[0]).toEqual({
      id: 'page-1',
      title: 'Design Doc',
      icon: 'icon-emoji',
      subtitle: 'Acme Workspace',
      url: 'https://notion.so/page-1',
      provider: 'notion',
    });
  });

  it("maps Confluence results with provider='confluence', spaceName as subtitle, and icon=null", async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-2',
      provider: 'CONFLUENCE',
      status: 'CONNECTED',
      credentialsRef: 'cred-ref',
      configJson: { cloudId: 'cloud-1' },
    });
    mockConfluenceSearchPages.mockResolvedValue([
      {
        id: 'page-2',
        title: 'API Reference',
        spaceKey: 'ENG',
        spaceName: 'Engineering',
        url: 'https://site.atlassian.net/wiki/page-2',
      },
    ]);

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'api',
      provider: 'confluence',
      prisma: mockPrisma,
    });

    expect(results[0]).toEqual({
      id: 'page-2',
      title: 'API Reference',
      icon: null,
      subtitle: 'Engineering',
      url: 'https://site.atlassian.net/wiki/page-2',
      provider: 'confluence',
    });
  });

  it("provider='all' searches both Notion and Confluence and merges results", async () => {
    // First call for Notion, second for Confluence
    mockPrisma.integrationConnection.findFirst
      .mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'NOTION',
        status: 'CONNECTED',
        credentialsRef: 'cred-ref-n',
      })
      .mockResolvedValueOnce({
        id: 'conn-2',
        provider: 'CONFLUENCE',
        status: 'CONNECTED',
        credentialsRef: 'cred-ref-c',
        configJson: { cloudId: 'cloud-1' },
      });

    mockNotionSearchPages.mockResolvedValue([
      {
        id: 'n1',
        title: 'Notion Page',
        icon: null,
        lastEditedTime: '',
        url: 'https://notion.so/n1',
      },
    ]);
    mockConfluenceSearchPages.mockResolvedValue([
      {
        id: 'c1',
        title: 'Confluence Page',
        spaceKey: 'DEV',
        spaceName: 'Dev',
        url: 'https://site.atlassian.net/c1',
      },
    ]);

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'test',
      provider: 'all',
      prisma: mockPrisma,
    });

    expect(results).toHaveLength(2);
    // Notion results come first
    expect(results[0]?.provider).toBe('notion');
    expect(results[1]?.provider).toBe('confluence');
  });

  it('returns empty for Confluence when connection exists but cloudId is missing', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-2',
      provider: 'CONFLUENCE',
      status: 'CONNECTED',
      credentialsRef: 'cred-ref',
      configJson: {}, // no cloudId
    });

    const results = await searchDocs({
      organizationId: ORG_ID,
      query: 'test',
      provider: 'confluence',
      prisma: mockPrisma,
    });

    expect(results).toEqual([]);
    expect(mockConfluenceSearchPages).not.toHaveBeenCalled();
  });
});
