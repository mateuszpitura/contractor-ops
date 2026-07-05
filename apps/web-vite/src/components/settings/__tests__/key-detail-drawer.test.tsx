/**
 * The KeyDetailDrawer presentational surface: scope visualization, acting-user
 * rebind, monthly usage, and the source-IP log — each with loading / empty /
 * error states. `useKeyDetail` (the tRPC boundary) is mocked so the branches are
 * driven deterministically.
 */

import { describe, expect, it, vi } from 'vitest';

const { mockUseKeyDetail } = vi.hoisted(() => ({ mockUseKeyDetail: vi.fn() }));

vi.mock('../hooks/use-api-keys-tab', () => ({ useKeyDetail: mockUseKeyDetail }));

import { render, screen } from '@/test/test-utils';
import type { KeyDetailRow } from '../api-keys/key-detail-drawer';
import { KeyDetailDrawer } from '../api-keys/key-detail-drawer';

const tStub = (key: string) => key;

const apiKey: KeyDetailRow = {
  id: 'key-1',
  name: 'ERP Integration',
  scopes: ['contractor:read', 'contractor:create', 'invoice:read'],
  actingUserId: 'user-1',
  actingUser: { id: 'user-1', name: 'John Doe' },
};

function mockDetail(overrides: Record<string, unknown> = {}) {
  mockUseKeyDetail.mockReturnValue({
    t: tStub,
    ipLogQuery: { isLoading: false, isError: false, data: [] },
    usageQuery: {
      isLoading: false,
      isError: false,
      data: { month: '2026-07', count: 42, quota: 1000 },
    },
    membersQuery: {
      isLoading: false,
      isError: false,
      data: [{ userId: 'user-1', name: 'John Doe', email: null }],
    },
    rebindMutation: { isPending: false },
    rebind: vi.fn(),
    ...overrides,
  });
}

describe('KeyDetailDrawer', () => {
  it('renders the scope groups (read + write), usage, and section headings', () => {
    mockDetail();
    render(<KeyDetailDrawer apiKey={apiKey} open onOpenChange={vi.fn()} />);

    expect(screen.getByText('detail.scopesHeading')).toBeInTheDocument();
    expect(screen.getByText('detail.actingUserHeading')).toBeInTheDocument();
    expect(screen.getByText('detail.usageHeading')).toBeInTheDocument();
    expect(screen.getByText('detail.ipLogHeading')).toBeInTheDocument();
    // contractor has read + write; invoice has read only.
    expect(screen.getAllByText('detail.scopeWrite').length).toBe(1);
    expect(screen.getAllByText('detail.scopeRead').length).toBe(2);
    // usage bar shows a progressbar with the current count.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });

  it('shows the empty state for the source-IP log', () => {
    mockDetail({ ipLogQuery: { isLoading: false, isError: false, data: [] } });
    render(<KeyDetailDrawer apiKey={apiKey} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('detail.ipLogEmpty')).toBeInTheDocument();
  });

  it('shows error states when the queries fail', () => {
    mockDetail({
      ipLogQuery: { isLoading: false, isError: true, data: undefined },
      usageQuery: { isLoading: false, isError: true, data: undefined },
      membersQuery: { isLoading: false, isError: true, data: undefined },
    });
    render(<KeyDetailDrawer apiKey={apiKey} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('detail.ipLogError')).toBeInTheDocument();
    expect(screen.getByText('detail.usageError')).toBeInTheDocument();
    expect(screen.getByText('detail.membersError')).toBeInTheDocument();
  });

  it('renders recent source-IP rows when present', () => {
    mockDetail({
      ipLogQuery: {
        isLoading: false,
        isError: false,
        data: [
          {
            id: 'e1',
            ipAddress: '203.0.113.7',
            userAgent: 'sdk/1',
            seenAt: '2026-07-01T10:00:00Z',
          },
        ],
      },
    });
    render(<KeyDetailDrawer apiKey={apiKey} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
  });
});
