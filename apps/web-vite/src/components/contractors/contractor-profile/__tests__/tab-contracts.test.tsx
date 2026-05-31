/**
 * web-vite port of apps/web/.../tab-contracts.test.tsx.
 *
 * Container/component split — `TabContractsView` takes the
 * `useContractorTabContracts` hook return as props. Tests inject a shaped
 * stub instead of mocking tRPC + react-query.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: () => '',
    formatDateTime: () => '',
  }),
}));

vi.mock('../../../contracts/contract-wizard/wizard-dialog-container.js', () => ({
  ContractWizardDialogContainer: () => null,
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { ContractorTabContractRow } from '../../hooks/use-contractor-tab-contracts.js';
import { TabContractsEmpty, TabContractsView } from '../tab-contracts.js';

type ViewProps = Parameters<typeof TabContractsView>[0];

interface Overrides {
  items?: ContractorTabContractRow[];
  isLoading?: boolean;
  page?: number;
  totalPages?: number;
  totalCount?: number;
  wizardOpen?: boolean;
  setWizardOpen?: ViewProps['setWizardOpen'];
  setPage?: ViewProps['setPage'];
}

function buildProps(override: Overrides = {}): ViewProps {
  return {
    contractorId: 'c1',
    wizardOpen: override.wizardOpen ?? false,
    setWizardOpen: override.setWizardOpen ?? vi.fn(),
    page: override.page ?? 1,
    setPage: override.setPage ?? vi.fn(),
    pageSize: 10,
    items: override.items ?? [],
    totalCount: override.totalCount ?? override.items?.length ?? 0,
    totalPages: override.totalPages ?? 1,
    isLoading: override.isLoading ?? false,
  };
}

describe('TabContractsView', () => {
  it('renders empty state heading and body text when no contracts', () => {
    render(<TabContractsEmpty contractorId="c1" wizardOpen={false} setWizardOpen={vi.fn()} />);
    expect(screen.getByText(/No contracts/i)).toBeInTheDocument();
    expect(screen.getByText(/Create a contract/i)).toBeInTheDocument();
  });

  it('renders the empty-state CTA button', () => {
    render(<TabContractsEmpty contractorId="c1" wizardOpen={false} setWizardOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add contract/i })).toBeInTheDocument();
  });

  it('renders skeleton rows when loading', () => {
    const { container } = render(<TabContractsView {...buildProps({ isLoading: true })} />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders the contracts table with a row when items exist', () => {
    render(
      <TabContractsView
        {...buildProps({
          items: [
            {
              id: 'ct-1',
              title: 'Dev Contract',
              status: 'ACTIVE',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
              rateValueMinor: 500000,
              currency: 'PLN',
            },
          ],
          totalCount: 1,
        })}
      />,
    );
    expect(screen.getByText('Dev Contract')).toBeInTheDocument();
  });

  it('renders ACTIVE status badge with localized label', () => {
    render(
      <TabContractsView
        {...buildProps({
          items: [
            {
              id: 'ct-1',
              title: 'Test',
              status: 'ACTIVE',
              startDate: null,
              endDate: null,
              rateValueMinor: null,
              currency: 'PLN',
            },
          ],
          totalCount: 1,
        })}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders formatted rate value with currency', () => {
    render(
      <TabContractsView
        {...buildProps({
          items: [
            {
              id: 'ct-1',
              title: 'Test',
              status: 'ACTIVE',
              startDate: null,
              endDate: null,
              rateValueMinor: 500000,
              currency: 'PLN',
            },
          ],
          totalCount: 1,
        })}
      />,
    );
    // 500000 / 100 = 5000.00 -> rendered with pl-PL grouping
    expect(screen.getByText(/5.*000/)).toBeInTheDocument();
  });

  it('renders the Add contract CTA in populated state', () => {
    render(
      <TabContractsView
        {...buildProps({
          items: [
            {
              id: 'ct-1',
              title: 'Test',
              status: 'ACTIVE',
              startDate: null,
              endDate: null,
              rateValueMinor: null,
              currency: 'PLN',
            },
          ],
          totalCount: 1,
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /Add contract/i })).toBeInTheDocument();
  });

  it('renders pagination when totalPages > 1', () => {
    render(
      <TabContractsView
        {...buildProps({
          items: [
            {
              id: 'ct-1',
              title: 'Test',
              status: 'DRAFT',
              startDate: null,
              endDate: null,
              rateValueMinor: null,
              currency: 'PLN',
            },
          ],
          totalCount: 30,
          totalPages: 3,
        })}
      />,
    );
    expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
  });

  it('does not render pagination when totalPages == 1', () => {
    render(
      <TabContractsView
        {...buildProps({
          items: [
            {
              id: 'ct-1',
              title: 'Test',
              status: 'DRAFT',
              startDate: null,
              endDate: null,
              rateValueMinor: null,
              currency: 'PLN',
            },
          ],
          totalCount: 1,
        })}
      />,
    );
    expect(screen.queryByText(/Page 1 of 1/i)).not.toBeInTheDocument();
  });

  it('invokes setWizardOpen(true) when the empty-state CTA is clicked', () => {
    const setWizardOpen = vi.fn();
    render(
      <TabContractsEmpty contractorId="c1" wizardOpen={false} setWizardOpen={setWizardOpen} />,
    );
    const btn = screen.getByRole('button', { name: /Add contract/i });
    btn.click();
    expect(setWizardOpen).toHaveBeenCalledWith(true);
  });
});
