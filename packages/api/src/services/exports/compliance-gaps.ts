/**
 * Compliance gaps streaming source.
 *
 * Yields gap rows one contractor at a time using cursor pagination so the
 * caller's memory footprint stays O(CSV_PAGE_SIZE) regardless of org size.
 * Used by the async export framework (`handleComplianceGaps`) and re-usable
 * by any other long-running consumer that needs to process compliance gaps
 * without loading every contractor into the heap.
 *
 * Design note (vs the in-memory `report.complianceGaps` tRPC procedure):
 *   - The tRPC paginated procedure (`packages/api/src/routers/core/report.ts`)
 *     is bounded to a single page of UI results — it loads everyone, sorts
 *     in JS, and returns one slice. That code path is acceptable as a
 *     dashboard query (a SQL-side health predicate on `Contractor` is tracked
 *     as a follow-up).
 *   - This iterator is the EXPORT path. CSV exports cannot afford to load
 *     all contractors into memory, so the iterator yields rows lazily.
 *
 * Memory profile (rough, on a 5k-contractor org with avg 12 compliance items
 * per contractor):
 *   - Per page (CSV_PAGE_SIZE=500): ~500 contractor rows × inline arrays
 *     for complianceItems + contracts ≈ 3-5 MiB peak, GC'd between pages.
 *   - Total heap delta during the export: bounded by 2× page size (current
 *     page + the page being yielded) ≈ 6-10 MiB. Independent of org size.
 *   - Compare with the legacy non-streaming path (load all 5k × 12 = 60k
 *     compliance-item rows + 5k contractor rows): 30-60 MiB sustained,
 *     scales linearly with contractor count.
 */

import type { PrismaClient } from '@contractor-ops/db';

/**
 * Public shape of one yielded gap row. Matches the CSV columns declared in
 * `COMPLIANCE_COLUMNS` so the export handler is a thin pipe from this
 * iterator to `csv-stringify`.
 */
export interface ComplianceGapRow {
  contractorId: string;
  contractorName: string;
  missingDocuments: number;
  contractStatus: 'ACTIVE' | 'NONE';
  overdueTasks: number;
  health: 'red' | 'yellow';
}

export interface IterateComplianceGapsOptions {
  /** Org to scope the query to. Always required — no cross-org iteration. */
  organizationId: string;
  /** Page size used by the underlying cursor pagination. Defaults to 500. */
  pageSize?: number;
}

/**
 * Reusable cursor-paginated iterator over compliance gaps for an org.
 *
 * Yields ONLY non-green contractors (red/yellow). Green contractors are
 * filtered in-process after the fetch — pushing this predicate into SQL
 * via a denormalised `complianceHealth` column on `Contractor` is tracked
 * as a follow-up.
 *
 * Errors propagate to the caller; the iterator stops at the first failed
 * page.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cursor-paginated async generator — the loop, per-row compliance-health derivation, and yield logic form one streaming contract that must share the pagination state.
export async function* iterateComplianceGaps(
  prisma: PrismaClient,
  opts: IterateComplianceGapsOptions,
): AsyncGenerator<ComplianceGapRow, void, void> {
  const pageSize = opts.pageSize ?? 500;
  let cursor: string | undefined;

  while (true) {
    const page = await prisma.contractor.findMany({
      where: {
        organizationId: opts.organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        complianceItems: { select: { status: true } },
        contracts: { where: { deletedAt: null }, select: { status: true } },
        _count: {
          select: {
            complianceItems: { where: { status: { in: ['MISSING', 'EXPIRED'] } } },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (page.length === 0) break;

    for (const c of page) {
      const missingOrExpired = c._count.complianceItems;
      const hasPending = c.complianceItems.some(ci => ci.status === 'PENDING');
      const hasActiveContract = c.contracts.some(con => con.status === 'ACTIVE');

      let health: 'red' | 'yellow' | 'green' = 'green';
      if (missingOrExpired > 0 || !hasActiveContract) health = 'red';
      else if (hasPending) health = 'yellow';

      if (health === 'green') continue;

      yield {
        contractorId: c.id,
        contractorName: c.legalName,
        missingDocuments: missingOrExpired,
        contractStatus: hasActiveContract ? 'ACTIVE' : 'NONE',
        overdueTasks: 0,
        health,
      };
    }

    // Last page — no need for another round-trip when we know we're done.
    if (page.length < pageSize) break;
    cursor = page[page.length - 1]?.id;
  }
}
