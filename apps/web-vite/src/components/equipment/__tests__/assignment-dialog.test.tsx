/**
 * AssignmentDialogView is presentational; the tRPC query/mutation live in
 * `useAssignmentDialog`. The test injects shaped hook state so it covers
 * the dialog branches (open, contractor list, empty, pending mutation).
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { AssignmentDialogView } from '../assignment-dialog';

type ViewProps = React.ComponentProps<typeof AssignmentDialogView>;

interface Overrides {
  open?: boolean;
  equipmentId?: string;
  equipmentName?: string;
  onOpenChange?: (open: boolean) => void;
  search?: string;
  selectedContractorId?: string | null;
  selectedContractorName?: string;
  contractors?: ViewProps['contractors'];
  isLoading?: boolean;
  isPending?: boolean;
  handleAssign?: () => void;
  handleOpenChange?: (open: boolean) => void;
}

function makeView(props: Overrides = {}) {
  const isLoading = props.isLoading ?? false;
  const isPending = props.isPending ?? false;
  const contractors = props.contractors ?? [];
  const viewProps = {
    open: props.open ?? true,
    onOpenChange: props.onOpenChange ?? vi.fn(),
    equipmentId: props.equipmentId ?? 'eq-1',
    equipmentName: props.equipmentName ?? 'MacBook Pro 16',
    search: props.search ?? '',
    setSearch: vi.fn(),
    selectedContractorId: props.selectedContractorId ?? null,
    setSelectedContractorId: vi.fn(),
    selectedContractorName: props.selectedContractorName ?? '',
    setSelectedContractorName: vi.fn(),
    contractorsQuery: { isLoading, data: { items: contractors } },
    contractors,
    assignMutation: { isPending, mutate: vi.fn() },
    assign: vi.fn(),
    handleAssign: props.handleAssign ?? vi.fn(),
    handleOpenChange: props.handleOpenChange ?? props.onOpenChange ?? vi.fn(),
  } as unknown as ViewProps;
  return <AssignmentDialogView {...viewProps} />;
}

describe('AssignmentDialog (web-vite)', () => {
  it('renders the equipment name in the dialog header', () => {
    render(makeView());
    expect(screen.getByText('MacBook Pro 16')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(makeView());
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('disables the assign action when no contractor is selected', () => {
    render(makeView());
    const buttons = screen.getAllByRole('button');
    const assignButton = buttons.find(
      b =>
        b.textContent?.toLowerCase().includes('assign') &&
        !b.textContent?.toLowerCase().includes('cancel'),
    );
    expect(assignButton).toBeDisabled();
  });

  it('does not render dialog content when open is false', () => {
    render(makeView({ open: false }));
    expect(screen.queryByText('MacBook Pro 16')).not.toBeInTheDocument();
  });

  it('renders contractor list items when data is available', () => {
    render(
      makeView({
        contractors: [
          { id: 'c1', displayName: 'Jan Kowalski', legalName: 'Jan Kowalski sp. z o.o.' },
          { id: 'c2', displayName: null, legalName: 'Acme Corp' },
        ],
      }),
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it("shows 'No contractors found.' when contractor list is empty and not loading", () => {
    render(makeView({ contractors: [], isLoading: false }));
    expect(screen.getByText('No contractors found.')).toBeInTheDocument();
  });

  it('invokes handleOpenChange(false) when Cancel is clicked', async () => {
    const handleOpenChange = vi.fn();
    const { user } = setup(makeView({ handleOpenChange }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders the contractor-search input placeholder', () => {
    render(makeView());
    expect(screen.getByPlaceholderText('Search contractors...')).toBeInTheDocument();
  });

  it('disables Cancel button when mutation is pending', () => {
    render(makeView({ isPending: true }));
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('uses legalName as fallback when displayName is null', () => {
    render(
      makeView({
        contractors: [{ id: 'c1', displayName: null, legalName: 'Legal Entity LLC' }],
      }),
    );
    expect(screen.getByText('Legal Entity LLC')).toBeInTheDocument();
  });
});
