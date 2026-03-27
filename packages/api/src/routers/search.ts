/**
 * Unified cross-entity search tRPC router.
 * Queries contractors, contracts, and invoices via PostgreSQL tsvector
 * full-text search for a global search / command palette experience.
 */

import { z } from "zod";
import { Prisma } from "@contractor-ops/db/generated/prisma/client";
import { prisma } from "@contractor-ops/db";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type SearchResult = {
  id: string;
  name: string;
  subtitle: string;
  type: "contractor" | "contract" | "invoice";
};

// ---------------------------------------------------------------------------
// Search router
// ---------------------------------------------------------------------------

export const searchRouter = router({
  /**
   * Global search across contractors, contracts, and invoices.
   * Uses tsvector prefix matching with 'simple' text search config.
   * Returns up to 5 results per entity type (15 max total).
   */
  global: tenantProcedure
    .input(
      z.object({
        query: z.string().min(2).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Build tsquery terms with prefix matching.
      // Strict sanitization: only allow alphanumeric + Unicode letters.
      const sanitizedTerms = input.query
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ""))
        .filter((t) => t.length > 0 && t.length <= 100)
        .slice(0, 10) // Max 10 terms to prevent abuse
        .map((t) => `${t}:*`)
        .join(" & ");

      if (!sanitizedTerms) {
        return [] as SearchResult[];
      }

      // Use Prisma.sql for safe parameterization of the tsquery string.
      // The tsquery is built from sanitized alphanumeric tokens, then passed
      // as a parameter to to_tsquery() — never interpolated into SQL.
      const tsquery = Prisma.sql`to_tsquery('simple', ${sanitizedTerms})`;

      // Run 3 parallel raw queries across entity types
      const [contractors, contracts, invoices] = await Promise.all([
        prisma.$queryRaw<SearchResult[]>`
          SELECT id, "legalName" as name, "taxId" as subtitle, 'contractor' as type
          FROM "Contractor"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "search_vector" @@ ${tsquery}
          LIMIT 5
        `,
        prisma.$queryRaw<SearchResult[]>`
          SELECT id, title as name, '' as subtitle, 'contract' as type
          FROM "Contract"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "searchVector" @@ ${tsquery}
          LIMIT 5
        `,
        prisma.$queryRaw<SearchResult[]>`
          SELECT id, "invoiceNumber" as name, '' as subtitle, 'invoice' as type
          FROM "Invoice"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "search_vector" @@ ${tsquery}
          LIMIT 5
        `,
      ]);

      return [...contractors, ...contracts, ...invoices] as SearchResult[];
    }),
});
