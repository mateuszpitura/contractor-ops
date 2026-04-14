// Phase 59 Plan 59-03 Task 3 — Ir35ChainPanel structural smoke tests.
// Verifies the panel is a labelled <section>, renders the participants as a
// semantic <table>, and shows the empty-state copy when no participants exist.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

// Mock child components so we can focus on the panel contract without pulling in
// the full tRPC client.
vi.mock('../chain-participant-row', () => ({
  ChainParticipantRow: ({ row }: { row: { id: string; displayName: string } }) => (
    <tr data-testid={`row-${row.id}`}>
      <td>{row.displayName}</td>
    </tr>
  ),
}));

vi.mock('../add-participant-dialog', () => ({
  AddParticipantDialog: () => <div data-testid="add-participant-dialog" />,
}));

// Mock the tRPC client init layer — the panel calls queryOptions/mutationOptions
// on trpc.ir35Chain.* and React Query handles state.
const mockData: unknown[] = [];
vi.mock('@/trpc/init', () => ({
  trpc: {
    ir35Chain: {
      listByEngagement: {
        queryOptions: () => ({
          queryKey: ['mock', 'ir35Chain', 'listByEngagement'],
          queryFn: async () => mockData,
        }),
      },
      markDelivered: { mutationOptions: () => ({ mutationFn: async () => ({}) }) },
      markAcknowledged: { mutationOptions: () => ({ mutationFn: async () => ({}) }) },
      removeParticipant: { mutationOptions: () => ({ mutationFn: async () => ({}) }) },
    },
  },
}));

import { Ir35ChainPanel } from '../ir35-chain-panel';

const messages = {
  Ir35Chain: {
    title: 'IR35 chain',
    subtitle: 'Track the chain.',
    emptyState: 'No chain participants yet.',
    addParticipant: 'Add participant',
  },
};

function renderPanel(engagementId = 'cass_1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <Ir35ChainPanel engagementId={engagementId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('Ir35ChainPanel', () => {
  it('renders as a labelled section with the chain heading', () => {
    renderPanel();
    const heading = screen.getByRole('heading', { name: 'IR35 chain' });
    expect(heading.id).toBeTruthy();
    const section = heading.closest('section');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('shows empty state copy when there are no participants (initial render)', () => {
    renderPanel();
    expect(screen.getByText('No chain participants yet.')).toBeInTheDocument();
  });

  it('renders the Add participant button', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Add participant' })).toBeInTheDocument();
  });
});
