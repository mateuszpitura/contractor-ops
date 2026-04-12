import { ConfluenceAdapter } from "@contractor-ops/integrations/adapters/confluence-adapter";
import { NotionAdapter } from "@contractor-ops/integrations/adapters/notion-adapter";
import { decryptCredentials } from "@contractor-ops/integrations/services/credential-service";
import type { DocSearchResult } from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import type { DbClient } from "./types.js";

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
const DOC_EXTERNAL_TYPES = ["NOTION_PAGE", "CONFLUENCE_PAGE"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttachDocLinkInput {
  organizationId: string;
  integrationConnectionId: string;
  workflowTaskRunId: string;
  externalId: string;
  externalUrl: string;
  externalType: "NOTION_PAGE" | "CONFLUENCE_PAGE";
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
  provider: "notion" | "confluence" | "all";
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
      entityType: "WORKFLOW_TASK_RUN",
      entityId: input.workflowTaskRunId,
      externalType: input.externalType,
      externalId: input.externalId,
      externalUrl: input.externalUrl,
      metadataJson: input.metadata,
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
      code: "NOT_FOUND",
      message: "Doc link not found",
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
      entityType: "WORKFLOW_TASK_RUN",
      entityId: input.workflowTaskRunId,
      organizationId: input.organizationId,
      externalType: { in: [...DOC_EXTERNAL_TYPES] },
    },
    orderBy: { createdAt: "desc" },
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
  if (provider === "notion" || provider === "all") {
    const notionResults = await searchNotionPages(prisma, organizationId, query);
    results.push(...notionResults);
  }

  // Search Confluence
  if (provider === "confluence" || provider === "all") {
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
      provider: "NOTION",
      status: "CONNECTED",
    },
  });

  if (!connection) return [];

  try {
    const credentials = decryptCredentials(connection.credentialsRef, "notion");
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
            ? ((credentials.extra as Record<string, string>).workspaceName ?? "Notion")
            : "Notion",
          url: page.url,
          provider: "notion" as const,
        }),
      );
  } catch (error) {
    console.error("[doc-link-service] Notion search failed:", error);
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
      provider: "CONFLUENCE",
      status: "CONNECTED",
    },
  });

  if (!connection) return [];

  const config = connection.configJson as ConnectionConfig | null;
  const cloudId = config?.cloudId;

  if (!cloudId) {
    console.error("[doc-link-service] Confluence connection missing cloudId");
    return [];
  }

  try {
    const credentials = decryptCredentials(connection.credentialsRef, "confluence");
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
          provider: "confluence" as const,
        }),
      );
  } catch (error) {
    console.error("[doc-link-service] Confluence search failed:", error);
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
      code: "NOT_FOUND",
      message: "Doc link not found",
    });
  }

  const metadata = (link.metadataJson ?? {}) as Record<string, unknown>;
  const lastEditedTime = metadata.lastEditedTime as string | undefined;

  // Check staleness — if metadata has a lastEditedTime and it's recent, skip refresh
  if (lastEditedTime) {
    const lastEdited = new Date(lastEditedTime).getTime();
    const now = Date.now();
    if (now - lastEdited < METADATA_STALENESS_MS) {
      return link;
    }
  }

  // Find the integration connection for this link
  if (!link.integrationConnectionId) {
    return link;
  }

  const connection = await prisma.integrationConnection.findFirst({
    where: {
      id: link.integrationConnectionId,
      organizationId,
      status: "CONNECTED",
    },
  });

  if (!connection) {
    return link;
  }

  try {
    if (link.externalType === "NOTION_PAGE") {
      const credentials = decryptCredentials(connection.credentialsRef, "notion");

      // Re-fetch the page via Notion API
      const response = await fetch(`https://api.notion.com/v1/pages/${link.externalId}`, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (response.ok) {
        const page = (await response.json()) as {
          last_edited_time: string;
          icon?: {
            type: string;
            emoji?: string;
            external?: { url: string };
          } | null;
          properties?: {
            title?: { title?: Array<{ plain_text: string }> };
          };
        };

        const titleProp = page.properties?.title?.title;
        const title = titleProp?.[0]?.plain_text ?? metadata.title ?? "Untitled";

        let icon: string | null = null;
        if (page.icon?.type === "emoji") {
          icon = page.icon.emoji ?? null;
        } else if (page.icon?.type === "external") {
          icon = page.icon.external?.url ?? null;
        }

        const updatedMetadata = {
          ...metadata,
          title,
          icon,
          lastEditedTime: page.last_edited_time,
        };

        const updated = await prisma.externalLink.update({
          where: { id: externalLinkId },
          data: { metadataJson: updatedMetadata },
        });

        return updated;
      }
    } else if (link.externalType === "CONFLUENCE_PAGE") {
      const credentials = decryptCredentials(connection.credentialsRef, "confluence");
      const config = connection.configJson as ConnectionConfig | null;
      const cloudId = config?.cloudId;

      if (cloudId) {
        const response = await fetch(
          `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/content/${link.externalId}?expand=space,version`,
          {
            headers: {
              Authorization: `Bearer ${credentials.accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (response.ok) {
          const content = (await response.json()) as {
            title: string;
            space?: { key: string; name: string };
            version?: { when: string };
          };

          const updatedMetadata = {
            ...metadata,
            title: content.title,
            spaceKey: content.space?.key ?? metadata.spaceKey,
            spaceName: content.space?.name ?? metadata.spaceName,
            lastEditedTime: content.version?.when,
          };

          const updated = await prisma.externalLink.update({
            where: { id: externalLinkId },
            data: { metadataJson: updatedMetadata },
          });

          return updated;
        }
      }
    }
  } catch (error) {
    console.error("[doc-link-service] Metadata refresh failed:", error);
  }

  // Return existing link if refresh failed
  return link;
}
