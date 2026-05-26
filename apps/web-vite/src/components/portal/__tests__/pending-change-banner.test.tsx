/**
 * Ported from apps/web/src/components/portal/__tests__/pending-change-banner.test.tsx.
 *
 * Stubs the portal date formatter so the banner does not need real org
 * settings; assertions cover the title, submitted-on copy, and the
 * collapsed field list which expands on click.
 */

vi.mock('@/lib/format/use-portal-date-formatter.js', () => ({
  usePortalDateFormatter: () => ({
    formatDate: (v: unknown) =>
      v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''),
  }),
}));

import { render, screen, setup } from '@/test/test-utils';

import { PendingChangeBanner } from '../pending-change-banner';

describe('PendingChangeBanner', () => {
  const request = {
    requestedChanges: {
      bankAccountNumber: '****1234',
      bankName: 'Acme Bank',
      taxId: 'TX-001',
    },
    createdAt: new Date('2025-04-10T10:00:00Z'),
  };

  it('renders the localized title', () => {
    render(<PendingChangeBanner pendingChangeRequest={request} />);
    expect(screen.getByText(/Pending|pending/)).toBeInTheDocument();
  });

  it('renders the submitted-on date copy with the formatted date', () => {
    render(<PendingChangeBanner pendingChangeRequest={request} />);
    expect(screen.getByText(/2025-04-10/)).toBeInTheDocument();
  });

  it('keeps the field list collapsed by default', () => {
    render(<PendingChangeBanner pendingChangeRequest={request} />);
    expect(screen.queryByText('****1234')).not.toBeInTheDocument();
  });

  it('reveals the field rows after clicking the disclosure', async () => {
    const { user } = setup(<PendingChangeBanner pendingChangeRequest={request} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('****1234')).toBeInTheDocument();
    expect(screen.getByText('Acme Bank')).toBeInTheDocument();
    expect(screen.getByText('TX-001')).toBeInTheDocument();
  });

  it('skips field rows when requestedChanges is empty', () => {
    render(
      <PendingChangeBanner
        pendingChangeRequest={{
          requestedChanges: {},
          createdAt: new Date('2025-04-10T10:00:00Z'),
        }}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
