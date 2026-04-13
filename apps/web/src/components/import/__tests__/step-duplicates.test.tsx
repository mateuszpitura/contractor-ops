import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import type { ImportRow } from '../import-wizard-dialog';
import { StepDuplicates } from '../step-duplicates';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  usePermissionsMock,
} = vi.hoisted(() => ({
  usePermissionsMock: vi.fn(() => ({ role: 'admin' })),
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const duplicateRow = (
  rowNumber: number,
  data: Record<string, unknown>,
  duplicateOf: string,
): ImportRow => ({
  rowNumber,
  data,
  status: 'duplicate',
  errors: [],
  duplicateOf,
});

const ROW_1 = duplicateRow(1, { taxId: '1234567890', legalName: 'New Corp' }, 'Existing Ltd');

const ROW_2 = duplicateRow(2, { contractorTaxId: '9988776655', title: 'Alt title' }, 'Other Co');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepDuplicates', () => {
  beforeEach(() => {
    usePermissionsMock.mockReturnValue({ role: 'admin' });
  });

  it('renders duplicate count in the banner', () => {
    const onActionsChange = vi.fn();
    render(
      <StepDuplicates
        duplicateRows={[ROW_1, ROW_2]}
        duplicateActions={{}}
        onActionsChange={onActionsChange}
      />,
    );

    expect(
      screen.getByText(/We found 2 potential duplicates based on NIP\/tax ID/),
    ).toBeInTheDocument();
  });

  it('Skip all duplicates sets skip for every row', async () => {
    const onActionsChange = vi.fn();
    const { user } = setup(
      <StepDuplicates
        duplicateRows={[ROW_1, ROW_2]}
        duplicateActions={{}}
        onActionsChange={onActionsChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Skip all duplicates' }));

    expect(onActionsChange).toHaveBeenCalledWith({
      '1': 'skip',
      '2': 'skip',
    });
  });

  it('Update all duplicates sets update for every row', async () => {
    const onActionsChange = vi.fn();
    const { user } = setup(
      <StepDuplicates
        duplicateRows={[ROW_1, ROW_2]}
        duplicateActions={{}}
        onActionsChange={onActionsChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Update all' }));

    expect(onActionsChange).toHaveBeenCalledWith({
      '1': 'update',
      '2': 'update',
    });
  });

  it('merges per-row action into duplicateActions', async () => {
    const onActionsChange = vi.fn();
    const { user } = setup(
      <StepDuplicates
        duplicateRows={[ROW_1, ROW_2]}
        duplicateActions={{ '1': 'skip' }}
        onActionsChange={onActionsChange}
      />,
    );

    const updateRadios = screen.getAllByRole('radio', { name: 'Update existing' });
    await user.click(updateRadios[1]);

    expect(onActionsChange).toHaveBeenCalledWith({
      '1': 'skip',
      '2': 'update',
    });
  });

  it('masks tax ID for roles without sensitive PII access', () => {
    usePermissionsMock.mockReturnValue({ role: 'readonly' });

    render(
      <StepDuplicates duplicateRows={[ROW_1]} duplicateActions={{}} onActionsChange={vi.fn()} />,
    );

    expect(screen.getByText('12••••••90')).toBeInTheDocument();
    expect(screen.queryByText('1234567890')).not.toBeInTheDocument();
  });

  it('shows full tax ID for privileged roles', () => {
    usePermissionsMock.mockReturnValue({ role: 'admin' });

    render(
      <StepDuplicates duplicateRows={[ROW_1]} duplicateActions={{}} onActionsChange={vi.fn()} />,
    );

    expect(screen.getByText('1234567890')).toBeInTheDocument();
  });
});
