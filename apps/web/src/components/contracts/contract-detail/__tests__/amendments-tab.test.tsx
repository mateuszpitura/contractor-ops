import { render, screen } from '@/test/test-utils';
import { AmendmentsTab } from '../amendments-tab';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    contract: {
      createAmendment: { mutationOptions: (opts: any) => opts },
      getById: { queryKey: () => ['contract', 'getById'] },
      listAmendments: { queryKey: () => ['contract', 'listAmendments'] },
    },
  },
}));

describe('AmendmentsTab', () => {
  it('renders empty state when no amendments', () => {
    render(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [],
        }}
      />,
    );
    // Should show empty icon and add CTA
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders amendments in timeline', () => {
    render(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [
            {
              id: 'a1',
              amendmentNumber: 'A-001',
              title: 'Rate Change',
              effectiveDate: '2024-06-01',
              description: 'Updated hourly rate',
              changesSummaryJson: {},
              createdAt: '2024-05-15',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Rate Change')).toBeInTheDocument();
    expect(screen.getByText('A-001')).toBeInTheDocument();
  });

  it('expands amendment details on click', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [
            {
              id: 'a1',
              amendmentNumber: 'A-001',
              title: 'Rate Change',
              effectiveDate: '2024-06-01',
              description: 'Updated hourly rate',
              changesSummaryJson: {},
              createdAt: '2024-05-15',
            },
          ],
        }}
      />,
    );
    // Click on the amendment title to expand
    await user.click(screen.getByText('Rate Change'));
    expect(screen.getByText('Updated hourly rate')).toBeInTheDocument();
  });

  it('collapses amendment details on second click', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [
            {
              id: 'a1',
              amendmentNumber: 'A-001',
              title: 'Rate Change',
              effectiveDate: '2024-06-01',
              description: 'Updated hourly rate',
              changesSummaryJson: {},
              createdAt: '2024-05-15',
            },
          ],
        }}
      />,
    );
    await user.click(screen.getByText('Rate Change'));
    expect(screen.getByText('Updated hourly rate')).toBeInTheDocument();
    await user.click(screen.getByText('Rate Change'));
    expect(screen.queryByText('Updated hourly rate')).not.toBeInTheDocument();
  });

  it('sorts amendments newest first', () => {
    render(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [
            {
              id: 'a1',
              amendmentNumber: 'A-001',
              title: 'First Change',
              effectiveDate: '2024-03-01',
              description: null,
              changesSummaryJson: {},
              createdAt: '2024-02-15',
            },
            {
              id: 'a2',
              amendmentNumber: 'A-002',
              title: 'Second Change',
              effectiveDate: '2024-09-01',
              description: null,
              changesSummaryJson: {},
              createdAt: '2024-08-15',
            },
          ],
        }}
      />,
    );
    const titles = screen.getAllByText(/Change/);
    expect(titles[0]).toHaveTextContent('Second Change');
    expect(titles[1]).toHaveTextContent('First Change');
  });

  it('renders original contract at timeline bottom with start date', () => {
    render(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [
            {
              id: 'a1',
              amendmentNumber: 'A-001',
              title: 'Rate Change',
              effectiveDate: '2024-06-01',
              description: null,
              changesSummaryJson: {},
              createdAt: '2024-05-15',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Original contract')).toBeInTheDocument();
  });

  it('opens add amendment dialog when add button is clicked', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [],
        }}
      />,
    );
    await user.click(screen.getByText('Add amendment'));
    expect(screen.getByText('New amendment')).toBeInTheDocument();
  });

  it('renders amendment without description (null description)', async () => {
    const { setup: setupUtil } = await import('@/test/test-utils');
    const { user } = setupUtil(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [
            {
              id: 'a1',
              amendmentNumber: 'A-001',
              title: 'No Desc',
              effectiveDate: '2024-06-01',
              description: null,
              changesSummaryJson: {},
              createdAt: '2024-05-15',
            },
          ],
        }}
      />,
    );
    await user.click(screen.getByText('No Desc'));
    // Expanded section should show created date but not description paragraph
    const { waitFor: wf } = await import('@/test/test-utils');
    await wf(() => {
      expect(screen.getByText(/created/i)).toBeInTheDocument();
    });
  });

  it('renders contract without start date', () => {
    render(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: null,
          createdAt: '2024-01-01',
          amendments: [
            {
              id: 'a1',
              amendmentNumber: 'A-001',
              title: 'Change',
              effectiveDate: '2024-06-01',
              description: null,
              changesSummaryJson: {},
              createdAt: '2024-05-15',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Original contract')).toBeInTheDocument();
  });
});
