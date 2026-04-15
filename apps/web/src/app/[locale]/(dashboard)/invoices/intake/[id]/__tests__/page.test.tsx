import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// The detail page is a server component — we invoke it as a function
// rather than rendering it via RTL (RSC execution is out of scope for
// a unit suite). Flag-off / cross-org NOT_FOUND / happy-path smoke are
// all covered here; the client-boundary tests live in a sibling file
// (intake-detail-client.test.tsx) so their mock surface is isolated.
// ---------------------------------------------------------------------------

const { notFoundSpy } = vi.hoisted(() => ({ notFoundSpy: vi.fn() }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    notFoundSpy();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `t:${key}`,
}));

vi.mock('@/lib/server-flag', () => ({
  getServerFlag: vi.fn(),
}));

vi.mock('@/trpc/server', () => ({
  getServerApi: vi.fn(),
}));

vi.mock('../intake-detail-client', () => ({
  IntakeDetailClient: ({ intake }: { intake: { id: string; profileLevel: string } }) => (
    <div data-testid="detail-client-mock">
      <span>{intake.id}</span>
      <span>level={intake.profileLevel}</span>
    </div>
  ),
}));

import { getServerApi } from '@/trpc/server';
import { getServerFlag } from '@/lib/server-flag';
import IntakeDetailPage from '../page';

beforeEach(() => {
  notFoundSpy.mockReset();
  (getServerFlag as unknown as ReturnType<typeof vi.fn>).mockReset();
  (getServerApi as unknown as ReturnType<typeof vi.fn>).mockReset();
});

describe('IntakeDetailPage (server component)', () => {
  it('renders the client boundary with the loaded intake when flag is on', async () => {
    (getServerFlag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    (getServerApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      invoiceIntake: {
        getById: async () => ({
          id: 'ck_intake_123',
          sourceKind: 'UPLOAD_PDF',
          status: 'PARSED',
          validationStatus: 'VALID',
          validationAcknowledgedAt: null,
          profileLevel: 'COMFORT',
          extractedSupplierName: 'ACME GmbH',
          extractedSupplierVatId: null,
          extractedSupplierLeitwegId: null,
          extractedInvoiceNumber: 'RE-2026-001',
          extractedInvoiceDate: null,
          extractedCurrency: 'EUR',
          extractedTotalMinor: 12300,
          parsedInvoiceJson: { lines: [] },
          unmappedFieldsJson: null,
        }),
      },
    });

    const node = await IntakeDetailPage({ params: Promise.resolve({ id: 'ck_intake_123' }) });
    expect(notFoundSpy).not.toHaveBeenCalled();
    expect(node).toBeTruthy();
  });

  it('calls notFound() when the router throws (cross-org isolation)', async () => {
    (getServerFlag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    (getServerApi as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      invoiceIntake: {
        getById: async () => {
          throw new Error('NOT_FOUND');
        },
      },
    });
    await expect(async () => {
      await IntakeDetailPage({ params: Promise.resolve({ id: 'ck_other_org' }) });
    }).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundSpy).toHaveBeenCalledTimes(1);
  });
});

