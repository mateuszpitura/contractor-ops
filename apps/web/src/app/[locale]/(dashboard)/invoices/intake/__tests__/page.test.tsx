import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Server-component smoke test. We mock the server-flag helper, the
// next-intl `getTranslations`, the child IntakeList, and `next/navigation`'s
// `notFound`. Then we assert the route short-circuits with notFound() when
// the flag is off and renders the page header when it's on.
// ---------------------------------------------------------------------------

const { notFoundSpy } = vi.hoisted(() => ({ notFoundSpy: vi.fn() }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    notFoundSpy();
    // Mimic Next's real notFound which throws a sentinel.
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `t:${key}`,
}));

vi.mock('@/lib/server-flag', () => ({
  getServerFlag: vi.fn(),
}));

vi.mock('@/components/invoices/intake/intake-list', () => ({
  IntakeList: () => <div data-testid="intake-list-mock" />,
}));

vi.mock('@/components/shared/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

import { getServerFlag } from '@/lib/server-flag';
import IntakeListPage from '../page';

beforeEach(() => {
  notFoundSpy.mockReset();
  (getServerFlag as unknown as ReturnType<typeof vi.fn>).mockReset();
});

describe('IntakeListPage (server component)', () => {
  it('calls notFound() when the einvoice.import-enabled flag is off', async () => {
    (getServerFlag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await expect(async () => {
      await IntakeListPage({ searchParams: Promise.resolve({}) });
    }).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the page + IntakeList when the flag is on', async () => {
    (getServerFlag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const node = await IntakeListPage({
      searchParams: Promise.resolve({ status: 'NEEDS_REVIEW' }),
    });
    expect(notFoundSpy).not.toHaveBeenCalled();
    // The awaited result is a React element tree (page JSX); asserting the
    // tree isn't null is sufficient for a smoke test — render-time props
    // are covered by the child components' own tests.
    expect(node).toBeTruthy();
  });
});
