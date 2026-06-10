/**
 * Unit tests for the compliance-gaps streaming source.
 *
 * The iterator is a small piece of business logic but the cursor pagination
 * is easy to break (off-by-one when re-using the cursor from `take` size,
 * forgetting `skip: 1`). These tests pin those properties without needing
 * a real Postgres connection.
 */

import { describe, expect, it, vi } from 'vitest';

import { iterateComplianceGaps } from '../compliance-gaps';

type ContractorPage = Array<{
  id: string;
  legalName: string;
  complianceItems: Array<{ status: string }>;
  contracts: Array<{ status: string }>;
  _count: { complianceItems: number };
}>;

function makeMockPrisma(pages: ContractorPage[]) {
  let pageIdx = 0;
  const findMany = vi.fn(async () => {
    const page = pages[pageIdx] ?? [];
    pageIdx++;
    return page;
  });
  return {
    contractor: { findMany },
  } as unknown as Parameters<typeof iterateComplianceGaps>[0];
}

async function collect<T>(iter: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) out.push(v);
  return out;
}

describe('iterateComplianceGaps', () => {
  it('yields red rows for contractors with missing/expired items', async () => {
    const prisma = makeMockPrisma([
      [
        {
          id: 'c1',
          legalName: 'Contractor One',
          complianceItems: [{ status: 'MISSING' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 2 },
        },
      ],
    ]);

    const rows = await collect(iterateComplianceGaps(prisma, { organizationId: 'org-1' }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contractorId: 'c1',
      contractorName: 'Contractor One',
      missingDocuments: 2,
      contractStatus: 'ACTIVE',
      health: 'red',
    });
  });

  it('yields red rows for contractors with no active contract', async () => {
    const prisma = makeMockPrisma([
      [
        {
          id: 'c2',
          legalName: 'No Active Contract',
          complianceItems: [],
          contracts: [{ status: 'EXPIRED' }],
          _count: { complianceItems: 0 },
        },
      ],
    ]);

    const rows = await collect(iterateComplianceGaps(prisma, { organizationId: 'org-1' }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ health: 'red', contractStatus: 'NONE' });
  });

  it('yields yellow rows for contractors with only PENDING items', async () => {
    const prisma = makeMockPrisma([
      [
        {
          id: 'c3',
          legalName: 'Yellow',
          complianceItems: [{ status: 'PENDING' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 0 },
        },
      ],
    ]);

    const rows = await collect(iterateComplianceGaps(prisma, { organizationId: 'org-1' }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.health).toBe('yellow');
  });

  it('skips green contractors entirely', async () => {
    const prisma = makeMockPrisma([
      [
        {
          id: 'c4',
          legalName: 'Healthy',
          complianceItems: [{ status: 'OK' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 0 },
        },
      ],
    ]);

    const rows = await collect(iterateComplianceGaps(prisma, { organizationId: 'org-1' }));
    expect(rows).toEqual([]);
  });

  it('paginates with cursor + skip:1 across multiple pages and stops on short page', async () => {
    // Two full pages followed by an empty fetch — the iterator must hit
    // exactly two findMany calls (NO third call: short page == done).
    // pageSize=2 keeps the test tight.
    const fullPage: ContractorPage = [
      {
        id: 'a',
        legalName: 'A',
        complianceItems: [{ status: 'MISSING' }],
        contracts: [{ status: 'ACTIVE' }],
        _count: { complianceItems: 1 },
      },
      {
        id: 'b',
        legalName: 'B',
        complianceItems: [{ status: 'MISSING' }],
        contracts: [{ status: 'ACTIVE' }],
        _count: { complianceItems: 1 },
      },
    ];
    const partialPage: ContractorPage = [
      {
        id: 'c',
        legalName: 'C',
        complianceItems: [{ status: 'MISSING' }],
        contracts: [{ status: 'ACTIVE' }],
        _count: { complianceItems: 1 },
      },
    ];

    const findMany = vi.fn();
    findMany.mockResolvedValueOnce(fullPage);
    findMany.mockResolvedValueOnce(partialPage);
    const prisma = {
      contractor: { findMany },
    } as unknown as Parameters<typeof iterateComplianceGaps>[0];

    const rows = await collect(
      iterateComplianceGaps(prisma, { organizationId: 'org-page', pageSize: 2 }),
    );

    expect(rows.map(r => r.contractorId)).toEqual(['a', 'b', 'c']);
    expect(findMany).toHaveBeenCalledTimes(2);

    // First call has no cursor; second call has cursor=b + skip:1.
    const firstArgs = findMany.mock.calls[0]?.[0] as { cursor?: unknown; skip?: number };
    const secondArgs = findMany.mock.calls[1]?.[0] as { cursor?: { id: string }; skip?: number };

    expect(firstArgs.cursor).toBeUndefined();
    expect(firstArgs.skip).toBeUndefined();

    expect(secondArgs.cursor).toEqual({ id: 'b' });
    expect(secondArgs.skip).toBe(1);
  });

  it('stops cleanly on an empty first page (no infinite loop)', async () => {
    const prisma = makeMockPrisma([[]]);
    const rows = await collect(iterateComplianceGaps(prisma, { organizationId: 'org' }));
    expect(rows).toEqual([]);
  });
});
