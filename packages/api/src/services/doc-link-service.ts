import type { Prisma } from '@contractor-ops/db';
import { fetchWithTimeout } from '@contractor-ops/integrations';
import { ConfluenceAdapter } from '@contractor-ops/integrations/adapters/confluence-adapter';
import { NotionAdapter } from '@contractor-ops/integrations/adapters/notion-adapter';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { createLogger } from '@contractor-ops/logger';
import type { DocSearchResult } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { DOC_LINK_NOT_FOUND } from '../errors';
import type { DbClient } from './types';

const log = createLogger({ service: 'doc-link-service' });

type PrismaClient = DbClient;

// ---------------------------------------------------------------------------
// Singleton adapter instances
// ---------------------------------------------------------------------------

const notionAdapter = new NotionAdapter();
const confluenceAdapter = new ConfluenceAdapter();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum results per provider when searching docs */
const MAX_RESULTS_PER_PROVIDER = 10;

/** Metadata staleness threshold in milliseconds (24 hours) */
const METADATA_STALENESS_MS = 24 * 60 * 60 * 1000;

/** Doc link external types */
const DOC_EXTERNAL_TYPES = ['NOTION_PAGE', 'CONFLUENCE_PAGE'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttachDocLinkInput {
  organizationId: string;
  integrationConnectionId: string;
  workflowTaskRunId: string;
  externalId: string;
  externalUrl: string;
  externalType: 'NOTION_PAGE' | 'CONFLUENCE_PAGE';
  metadata: Record<string, unknown>;
}

interface DetachDocLinkInput {
  organizationId: string;
  externalLinkId: string;
}

interface GetDocLinksInput {
  organizationId: string;
  workflowTaskRunId: string;
}

interface SearchDocsInput {
  organizationId: string;
  query: string;
  provider: 'notion' | 'confluence' | 'all';
  prisma: PrismaClient;
}

interface ConnectionConfig {
  cloudId?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Attach Doc Link
// ---------------------------------------------------------------------------

/**
 * Attaches a Notion or Confluence page link to a workflow task run.
 *
 * Creates an ExternalLink record with entityType WORKFLOW_TASK_RUN,
 * caching page metadata (title, icon, lastEditedTime) in metadataJson
 * for display without re-fetching from the provider API.
 *
 * @param prisma - Prisma client instance
 * @param input - Attach parameters including org scoping and doc metadata
 * @returns The created ExternalLink record
 */
export async function attachDocLink(prisma: PrismaClient, input: AttachDocLinkInput) {
  const externalLink = await prisma.externalLink.create({
    data: {
      organizationId: input.organizationId,
      integrationConnectionId: input.integrationConnectionId,
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: input.workflowTaskRunId,
      externalType: input.externalType,
      externalId: input.externalId,
      externalUrl: input.externalUrl,
      metadataJson: input.metadata as Prisma.InputJsonValue,
    },
  });

  return externalLink;
}

// ---------------------------------------------------------------------------
// Detach Doc Link
// ---------------------------------------------------------------------------

/**
 * Detaches a doc link from a workflow task run.
 *
 * Deletes the ExternalLink record, scoped to the organization for
 * tenant isolation.
 *
 * @param prisma - Prisma client instance
 * @param input - Detach parameters with org-scoped externalLinkId
 */
export async function detachDocLink(
  prisma: PrismaClient,
  input: DetachDocLinkInput,
): Promise<void> {
  const link = await prisma.externalLink.findFirst({
    where: {
      id: input.externalLinkId,
      organizationId: input.organizationId,
    },
  });

  if (!link) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: DOC_LINK_NOT_FOUND,
    });
  }

  await prisma.externalLink.delete({
    where: { id: input.externalLinkId },
  });
}

// ---------------------------------------------------------------------------
// Get Doc Links
// ---------------------------------------------------------------------------

/**
 * Lists all doc links (Notion/Confluence pages) attached to a workflow task run.
 *
 * Returns only NOTION_PAGE and CONFLUENCE_PAGE external types,
 * filtered by organization for tenant isolation.
 *
 * @param prisma - Prisma client instance
 * @param input - Query parameters with org scoping
 * @returns Array of ExternalLink records for the task run
 */
export async function getDocLinks(prisma: PrismaClient, input: GetDocLinksInput) {
  const links = await prisma.externalLink.findMany({
    where: {
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: input.workflowTaskRunId,
      organizationId: input.organizationId,
      externalType: { in: [...DOC_EXTERNAL_TYPES] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return links;
}

// ---------------------------------------------------------------------------
// Search Docs
// ---------------------------------------------------------------------------

/**
 * Searches Notion and/or Confluence pages via provider APIs.
 *
 * Proxies search requests through the adapter layer, looking up
 * active IntegrationConnections for the organization. Returns empty
 * results for providers without active connections (no error).
 *
 * Results are merged with Notion first, then Confluence, capped at
 * MAX_RESULTS_PER_PROVIDER per provider.
 *
 * @param input - Search parameters including query, provider filter, and org scoping
 * @returns Merged array of DocSearchResult from all matching providers
 */
export async function searchDocs(input: SearchDocsInput): Promise<DocSearchResult[]> {
  const { organizationId, query, provider, prisma } = input;
  const results: DocSearchResult[] = [];

  // Search Notion
  if (provider === 'notion' || provider === 'all') {
    const notionResults = await searchNotionPages(prisma, organizationId, query);
    results.push(...notionResults);
  }

  // Search Confluence
  if (provider === 'confluence' || provider === 'all') {
    const confluenceResults = await searchConfluencePages(prisma, organizationId, query);
    results.push(...confluenceResults);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Search Helpers
// ---------------------------------------------------------------------------

async function searchNotionPages(
  prisma: PrismaClient,
  organizationId: string,
  query: string,
): Promise<DocSearchResult[]> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'NOTION',
      status: 'CONNECTED',
    },
  });

  if (!connection) return [];

  try {
    const credentials = decryptCredentials(connection.credentialsRef, 'notion');
    const pages = await notionAdapter.searchPages(credentials.accessToken, query);

    return pages
      .slice(0, MAX_RESULTS_PER_PROVIDER)
      .map(
        (page: {
          id: string;
          title: string;
          icon: string | null;
          lastEditedTime: string;
          url: string;
        }) => ({
          id: page.id,
          title: page.title,
          icon: page.icon,
          subtitle: credentials.extra
            ? ((credentials.extra as Record<string, string>).workspaceName ?? 'Notion')
            : 'Notion',
          url: page.url,
          provider: 'notion' as const,
        }),
      );
  } catch (error) {
    log.error({ err: error }, 'notion search failed');
    return [];
  }
}

async function searchConfluencePages(
  prisma: PrismaClient,
  organizationId: string,
  query: string,
): Promise<DocSearchResult[]> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'CONFLUENCE',
      status: 'CONNECTED',
    },
  });

  if (!connection) return [];

  const config = connection.configJson as ConnectionConfig | null;
  const cloudId = config?.cloudId;

  if (!cloudId) {
    log.error({}, 'confluence connection missing cloudId');
    return [];
  }

  try {
    const credentials = decryptCredentials(connection.credentialsRef, 'confluence');
    const pages = await confluenceAdapter.searchPages(credentials.accessToken, cloudId, query);

    return pages
      .slice(0, MAX_RESULTS_PER_PROVIDER)
      .map(
        (page: {
          id: string;
          title: string;
          spaceKey: string;
          spaceName: string;
          url: string;
        }) => ({
          id: page.id,
          title: page.title,
          icon: null,
          subtitle: page.spaceName || page.spaceKey,
          url: page.url,
          provider: 'confluence' as const,
        }),
      );
  } catch (error) {
    log.error({ err: error }, 'confluence search failed');
    return [];
  }
}

// ---------------------------------------------------------------------------
// Refresh Doc Metadata
// ---------------------------------------------------------------------------

/**
 * Refreshes cached metadata for a doc link if stale (older than 24 hours).
 *
 * Checks the lastEditedTime in metadataJson to determine staleness.
 * If stale, fetches fresh metadata from the provider API (Notion search
 * or Confluence content) and updates the ExternalLink record.
 *
 * @param prisma - Prisma client instance
 * @param externalLinkId - The ExternalLink ID to refresh
 * @param organizationId - Organization ID for tenant isolation
 * @returns The (possibly updated) ExternalLink record
 */
export async function refreshDocMetadata(
  prisma: PrismaClient,
  externalLinkId: string,
  organizationId: string,
) {
  const link = await prisma.externalLink.findFirst({
    where: {
      id: externalLinkId,
      organizationId,
      externalType: { in: [...DOC_EXTERNAL_TYPES] },
    },
  });

  if (!link) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: DOC_LINK_NOT_FOUND,
    });
  }

  const metadata = (link.metadataJson ?? {}) as Record<string, unknown>;

  if (isMetadataFresh(metadata)) return link;
  if (!link.integrationConnectionId) return link;

  const connection = await prisma.integrationConnection.findFirst({
    where: {
      id: link.integrationConnectionId,
      organizationId,
      status: 'CONNECTED',
    },
  });

  if (!connection) return link;

  try {
    const updatedMetadata = await fetchFreshMetadata(
      link.externalType,
      link.externalId,
      connection,
      metadata,
    );
    if (updatedMetadata) {
      return prisma.externalLink.update({
        where: { id: externalLinkId },
        data: { metadataJson: updatedMetadata as Prisma.InputJsonValue },
      });
    }
  } catch (error) {
    log.error({ err: error }, 'metadata refresh failed');
  }

  return link;
}

// ---------------------------------------------------------------------------
// Staleness check
// ---------------------------------------------------------------------------

function isMetadataFresh(metadata: Record<string, unknown>): boolean {
  const lastEditedTime = metadata.lastEditedTime as string | undefined;
  if (!lastEditedTime) return false;
  return Date.now() - new Date(lastEditedTime).getTime() < METADATA_STALENESS_MS;
}

// ---------------------------------------------------------------------------
// Per-provider metadata refresh
// ---------------------------------------------------------------------------

async function fetchFreshMetadata(
  externalType: string,
  externalId: string,
  connection: { credentialsRef: string; configJson: unknown },
  existingMetadata: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (externalType === 'NOTION_PAGE') {
    return refreshNotionMetadata(externalId, connection.credentialsRef, existingMetadata);
  }
  if (externalType === 'CONFLUENCE_PAGE') {
    return refreshConfluenceMetadata(externalId, connection, existingMetadata);
  }
  return null;
}

async function refreshNotionMetadata(
  externalId: string,
  credentialsRef: string,
  existingMetadata: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const credentials = decryptCredentials(credentialsRef, 'notion');

  const response = await fetchWithTimeout(`https://api.notion.com/v1/pages/${externalId}`, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) return null;

  const page = (await response.json()) as {
    last_edited_time: string;
    icon?: { type: string; emoji?: string; external?: { url: string } } | null;
    properties?: { title?: { title?: Array<{ plain_text: string }> } };
  };

  const titleProp = page.properties?.title?.title;
  const title = titleProp?.[0]?.plain_text ?? existingMetadata.title ?? 'Untitled';

  let icon: string | null = null;
  if (page.icon?.type === 'emoji') {
    icon = page.icon.emoji ?? null;
  } else if (page.icon?.type === 'external') {
    icon = page.icon.external?.url ?? null;
  }

  return { ...existingMetadata, title, icon, lastEditedTime: page.last_edited_time };
}

async function refreshConfluenceMetadata(
  externalId: string,
  connection: { credentialsRef: string; configJson: unknown },
  existingMetadata: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const config = connection.configJson as ConnectionConfig | null;
  const cloudId = config?.cloudId;
  if (!cloudId) return null;

  const credentials = decryptCredentials(connection.credentialsRef, 'confluence');

  const response = await fetchWithTimeout(
    `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/content/${externalId}?expand=space,version`,
    {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) return null;

  const content = (await response.json()) as {
    title: string;
    space?: { key: string; name: string };
    version?: { when: string };
  };

  return {
    ...existingMetadata,
    title: content.title,
    spaceKey: content.space?.key ?? existingMetadata.spaceKey,
    spaceName: content.space?.name ?? existingMetadata.spaceName,
    lastEditedTime: content.version?.when,
  };
}
