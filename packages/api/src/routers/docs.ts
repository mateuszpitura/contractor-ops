import { z } from "zod";
import { prisma } from "@contractor-ops/db";
import {
  attachDocInputSchema,
  docSearchInputSchema,
} from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import {
  attachDocLink,
  detachDocLink,
  getDocLinks,
  searchDocs,
  refreshDocMetadata,
} from "../services/doc-link-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps externalType to provider slug for IntegrationConnection lookup.
 */
function providerFromExternalType(
  externalType: "NOTION_PAGE" | "CONFLUENCE_PAGE",
): string {
  return externalType === "NOTION_PAGE" ? "NOTION" : "CONFLUENCE";
}

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Docs Router
// ---------------------------------------------------------------------------

export const docsRouter = router({
  /**
   * Attach a Notion or Confluence page link to a workflow task run.
   *
   * Looks up the IntegrationConnection for the org matching the provider
   * (derived from externalType), then delegates to the doc link service.
   */
  attach: tenantProcedure
    .input(attachDocInputSchema)
    .mutation(async ({ ctx, input }) => {
      const provider = providerFromExternalType(input.externalType);

      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider,
          status: "CONNECTED",
        },
        select: { id: true },
      });

      if (!connection) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No active ${provider.toLowerCase()} connection found. Please connect ${provider.toLowerCase()} in Settings > Integrations.`,
        });
      }

      const result = await attachDocLink(ctx.prisma, {
        organizationId: ctx.organizationId,
        integrationConnectionId: connection.id,
        workflowTaskRunId: input.workflowTaskRunId,
        externalId: input.externalId,
        externalUrl: input.externalUrl,
        externalType: input.externalType,
        metadata: input.metadata as Record<string, unknown>,
      });

      return plain(result);
    }),

  /**
   * Detach a doc link from a workflow task run.
   */
  detach: tenantProcedure
    .input(z.object({ externalLinkId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await detachDocLink(ctx.prisma, {
        organizationId: ctx.organizationId,
        externalLinkId: input.externalLinkId,
      });

      return { success: true };
    }),

  /**
   * List all doc links (Notion/Confluence pages) attached to a workflow task run.
   */
  list: tenantProcedure
    .input(z.object({ workflowTaskRunId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const links = await getDocLinks(ctx.prisma, {
        organizationId: ctx.organizationId,
        workflowTaskRunId: input.workflowTaskRunId,
      });

      return plain(links);
    }),

  /**
   * Search Notion and/or Confluence pages by title.
   *
   * Aggregates results from connected providers. Returns empty
   * array if no connections exist (no error thrown).
   */
  search: tenantProcedure
    .input(docSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const results = await searchDocs({
        organizationId: ctx.organizationId,
        query: input.query,
        provider: input.provider,
        prisma: ctx.prisma,
      });

      return results;
    }),

  /**
   * Refresh cached metadata for a doc link.
   *
   * Re-fetches title, icon, and lastEditedTime from the provider API
   * if the cached data is older than 24 hours.
   */
  refreshMetadata: tenantProcedure
    .input(z.object({ externalLinkId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await refreshDocMetadata(
        ctx.prisma,
        input.externalLinkId,
        ctx.organizationId,
      );

      return plain(result);
    }),
});
