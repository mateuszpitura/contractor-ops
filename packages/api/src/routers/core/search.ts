/**
 * Unified cross-entity search tRPC router.
 * Queries contractors, contracts, and invoices via PostgreSQL tsvector
 * full-text search for a global search / command palette experience.
 */

import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type SearchResult = {
  id: string;
  name: string;
  subtitle: string;
  type: 'contractor' | 'contract' | 'invoice';
};

// ---------------------------------------------------------------------------
// Search router
// ---------------------------------------------------------------------------

export const searchRouter = router({
  /**
   * Global search across contractors, contracts, and invoices.
   * Uses tsvector prefix matching with 'simple' text search config.
   * Returns up to 5 results per entity type (15 max total).
   *
   * Requires `contractor:read` because the result set merges contractor
   * identity rows. Roles without contractor read access (e.g. standalone
   * integration roles) cannot use the command palette to enumerate
   * contractor names.
   */
  global: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
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
        .map(t => t.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ''))
        .filter(t => t.length > 0 && t.length <= 100)
        .slice(0, 10) // Max 10 terms to prevent abuse
        .map(t => `${t}:*`)
        .join(' & ');

      if (!sanitizedTerms) {
        return [] as SearchResult[];
      }

      // Use Prisma.sql for safe parameterization of the tsquery string.
      // The tsquery is built from sanitized alphanumeric tokens, then passed
      // as a parameter to to_tsquery() — never interpolated into SQL.
      const tsquery = Prisma.sql`to_tsquery('simple', ${sanitizedTerms})`;

      // Surface `displayName` (non-PII) instead of `taxId`. Tax identifiers
      // (NIP, REGON, USt-IdNr, NINO, NIE, etc.) are sensitive financial PII
      // and have no place in a global command-palette result. The dedicated
      // contractor-detail page renders taxId for roles that need it (gated
      // separately).
      const [contractors, contracts, invoices] = await Promise.all([
        // contractor-only-raw-sql: the Contractor table is inherently contractor-only
        // (the workerType discriminator lives on the Worker base table, not here), so
        // this command-palette search needs no workerType predicate.
        ctx.db.$queryRaw<SearchResult[]>`
          SELECT id, "legalName" as name, COALESCE("displayName", '') as subtitle, 'contractor' as type
          FROM "Contractor"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "search_vector" @@ ${tsquery}
          LIMIT 5
        `,
        ctx.db.$queryRaw<SearchResult[]>`
          SELECT id, title as name, '' as subtitle, 'contract' as type
          FROM "Contract"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "searchVector" @@ ${tsquery}
          LIMIT 5
        `,
        ctx.db.$queryRaw<SearchResult[]>`
          SELECT id, "invoiceNumber" as name, '' as subtitle, 'invoice' as type
          FROM "Invoice"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "search_vector" @@ ${tsquery}
          LIMIT 5
        `,
      ]);

      // Defensive dedupe by (type, id). The three queries are org-scoped
      // over disjoint tables, so collisions are unlikely (cuids are globally
      // unique), but a Set guard prevents the UI from rendering duplicates
      // if a future refactor folds the entity types together (e.g. via a
      // materialised search-index view).
      const seen = new Set<string>();
      const merged: SearchResult[] = [];
      for (const row of [...contractors, ...contracts, ...invoices]) {
        const key = `${row.type}:${row.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
      return merged;
    }),
});
