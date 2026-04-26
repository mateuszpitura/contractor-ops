import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: Record<string, unknown>) => {
      if (params?.chainName) return `${key}(${params.chainName})`;
      if (params?.levelName) return `${key}(${params.levelName})`;
      return key;
    },
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    approval: {
      getAuditTrail: { queryOptions: (opts: Record<string, unknown>) => opts },
    },
  },
}));

vi.mock('@/lib/avatar-initials', () => ({
  getAvatarInitials: (name: string | null, email: string) => (name ? name[0] : email[0]),
}));

import { useQuery } from '@tanstack/react-query';
import { AuditTimeline } from '../audit-timeline';

const mockUseQuery = vi.mocked(useQuery);

describe('AuditTimeline', () => {
  it('renders loading skeleton when isLoading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as never);
    const { container } = render(<AuditTimeline invoiceId="inv-1" />);
    // Skeleton renders Card with Skeleton children
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders empty state when no events', () => {
    mockUseQuery.mockReturnValue({
      data: { events: [] },
      isLoading: false,
    } as unknown as never);
    render(<AuditTimeline invoiceId="inv-1" />);
    expect(screen.getByText('auditTrail.empty')).toBeInTheDocument();
  });

  it('renders heading', () => {
    mockUseQuery.mockReturnValue({
      data: { events: [] },
      isLoading: false,
    } as unknown as never);
    render(<AuditTimeline invoiceId="inv-1" />);
    expect(screen.getByText('auditTrail.heading')).toBeInTheDocument();
  });

  it('renders system events', () => {
    mockUseQuery.mockReturnValue({
      data: {
        events: [
          {
            type: 'system',
            label: 'submitted',
            timestamp: '2026-01-01T00:00:00Z',
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<AuditTimeline invoiceId="inv-1" />);
    expect(screen.getByText('auditTrail.submitted')).toBeInTheDocument();
  });

  it('renders decision events with actor name and badge', () => {
    mockUseQuery.mockReturnValue({
      data: {
        events: [
          {
            type: 'decision',
            label: 'approve',
            timestamp: '2026-01-01T00:00:00Z',
            actor: {
              id: 'u-1',
              name: 'Jan Kowalski',
              email: 'jan@test.com',
              image: null,
            },
            comment: null,
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<AuditTimeline invoiceId="inv-1" />);
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('auditTrail.decisionApproved')).toBeInTheDocument();
  });

  it('renders decision comment when present', () => {
    mockUseQuery.mockReturnValue({
      data: {
        events: [
          {
            type: 'decision',
            label: 'reject',
            timestamp: '2026-01-01T00:00:00Z',
            actor: {
              id: 'u-1',
              name: 'Anna',
              email: 'anna@test.com',
              image: null,
            },
            comment: 'Missing attachments',
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<AuditTimeline invoiceId="inv-1" />);
    expect(screen.getByText('Missing attachments')).toBeInTheDocument();
  });
});
