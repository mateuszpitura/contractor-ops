/**
 * Ported from apps/web/src/components/contracts/contract-detail/__tests__/amendments-tab.test.tsx.
 *
 * Web-vite split: AmendmentsTab is presentational; `tab` and `addDialog`
 * props are produced by `useContractAmendmentsTab` / `useAddAmendmentDialog`.
 * We supply shaped stubs so the test runs without a tRPC harness.
 */

import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { AmendmentsTab } from '../amendments-tab';

type TabProps = Parameters<typeof AmendmentsTab>[0];

function makeTab(overrides: Partial<TabProps['tab']> = {}): TabProps['tab'] {
  return {
    dialogOpen: false,
    openDialog: vi.fn(),
    setDialogOpen: vi.fn(),
    ...overrides,
  };
}

function makeAddDialog(overrides: Partial<TabProps['addDialog']> = {}): TabProps['addDialog'] {
  return {
    title: '',
    effectiveDate: '',
    description: '',
    isPending: false,
    handleSubmit: vi.fn(),
    setTitle: vi.fn(),
    setEffectiveDate: vi.fn(),
    setDescription: vi.fn(),
    ...overrides,
  };
}

describe('AmendmentsTab', () => {
  it('renders empty state with add CTA when no amendments', () => {
    render(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [],
        }}
        tab={makeTab()}
        addDialog={makeAddDialog()}
      />,
    );
    expect(screen.getByText('No amendments')).toBeInTheDocument();
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
        tab={makeTab()}
        addDialog={makeAddDialog()}
      />,
    );
    expect(screen.getByText('Rate Change')).toBeInTheDocument();
    expect(screen.getByText('A-001')).toBeInTheDocument();
  });

  it('expands amendment details on click', async () => {
    const { user } = setup(
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
        tab={makeTab()}
        addDialog={makeAddDialog()}
      />,
    );
    await user.click(screen.getByText('Rate Change'));
    expect(screen.getByText('Updated hourly rate')).toBeInTheDocument();
  });

  it('collapses amendment details on second click', async () => {
    const { user } = setup(
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
        tab={makeTab()}
        addDialog={makeAddDialog()}
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
        tab={makeTab()}
        addDialog={makeAddDialog()}
      />,
    );
    const titles = screen.getAllByText(/Change/);
    expect(titles[0]).toHaveTextContent('Second Change');
    expect(titles[1]).toHaveTextContent('First Change');
  });

  it('renders original contract at timeline bottom', () => {
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
        tab={makeTab()}
        addDialog={makeAddDialog()}
      />,
    );
    expect(screen.getByText('Original contract')).toBeInTheDocument();
  });

  it('invokes tab.openDialog when add CTA is clicked', async () => {
    const openDialog = vi.fn();
    const { user } = setup(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [],
        }}
        tab={makeTab({ openDialog })}
        addDialog={makeAddDialog()}
      />,
    );
    // Two "Add amendment" buttons: header + empty state.
    const addButtons = screen.getAllByText('Add amendment');
    await user.click(addButtons[0]);
    expect(openDialog).toHaveBeenCalled();
  });

  it('renders the add dialog when tab.dialogOpen is true', () => {
    render(
      <AmendmentsTab
        contract={{
          id: 'ct1',
          title: 'Agreement',
          startDate: '2024-01-01',
          createdAt: '2024-01-01',
          amendments: [],
        }}
        tab={makeTab({ dialogOpen: true })}
        addDialog={makeAddDialog()}
      />,
    );
    expect(screen.getByText('New amendment')).toBeInTheDocument();
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
        tab={makeTab()}
        addDialog={makeAddDialog()}
      />,
    );
    expect(screen.getByText('Original contract')).toBeInTheDocument();
  });
});
