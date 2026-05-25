/**
 * Presentational test for the import wizard's "duplicates" step. Covers:
 *   - banner + initial render with tax IDs masked for non-privileged roles
 *   - tax ID unmasked for finance_admin / owner / etc.
 *   - per-row action change forwards a normalized actions map
 *   - bulk skip-all / update-all populate every row
 *
 * `usePermissions` is mocked to control PII gating without touching the
 * auth/tRPC stack — the component only consumes `role`.
 */

import { render, screen, setup } from '@/test/test-utils';
import { setupTestI18n } from '../../../test-utils/setup-test-i18n';
import type { ImportRow } from '../import-wizard-dialog';
import { StepDuplicates } from '../step-duplicates';

const usePermissionsMock = vi.fn();
vi.mock('../../../hooks/use-permissions.js', () => ({
  usePermissions: () => usePermissionsMock(),
}));

beforeAll(async () => {
  await setupTestI18n();
});

const duplicateRows: ImportRow[] = [
  {
    rowNumber: 3,
    data: { taxId: '1234567890', legalName: 'Acme sp. z o.o.' },
    status: 'duplicate',
    errors: [],
    duplicateOf: 'Acme Sp. z o.o. (existing)',
  },
  {
    rowNumber: 5,
    data: { taxId: '9876543210', legalName: 'Beta Ltd' },
    status: 'duplicate',
    errors: [],
    duplicateOf: 'Beta Limited',
  },
];

describe('StepDuplicates', () => {
  beforeEach(() => {
    usePermissionsMock.mockReset();
    usePermissionsMock.mockReturnValue({ role: 'finance_admin' });
  });

  it('shows the count banner and both rows', () => {
    render(
      <StepDuplicates
        duplicateRows={duplicateRows}
        duplicateActions={{}}
        onActionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/found 2 potential duplicates/i)).toBeInTheDocument();
    expect(screen.getByText('Acme sp. z o.o.')).toBeInTheDocument();
    expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
  });

  it('renders full tax IDs for privileged roles', () => {
    render(
      <StepDuplicates
        duplicateRows={duplicateRows}
        duplicateActions={{}}
        onActionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1234567890')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  it('masks tax IDs for non-privileged roles', () => {
    usePermissionsMock.mockReturnValue({ role: 'member' });
    render(
      <StepDuplicates
        duplicateRows={duplicateRows}
        duplicateActions={{}}
        onActionsChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('1234567890')).not.toBeInTheDocument();
    expect(screen.getByText(/12•+90/)).toBeInTheDocument();
  });

  it('forwards a per-row action update when a radio changes', async () => {
    const onActionsChange = vi.fn();
    const { user, container } = setup(
      <StepDuplicates
        duplicateRows={duplicateRows}
        duplicateActions={{}}
        onActionsChange={onActionsChange}
      />,
    );

    // Each row renders three radios — query by the deterministic id we wire
    // onto the underlying RadioGroupItem so we hit the row-3 "update" choice.
    const updateRadio = container.querySelector('#dup-3-update');
    expect(updateRadio).not.toBeNull();
    if (updateRadio) {
      await user.click(updateRadio);
    }
    expect(onActionsChange).toHaveBeenCalledWith({ '3': 'update' });
  });

  it('bulk skip-all populates every row with skip', async () => {
    const onActionsChange = vi.fn();
    const { user } = setup(
      <StepDuplicates
        duplicateRows={duplicateRows}
        duplicateActions={{}}
        onActionsChange={onActionsChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /skip all duplicates/i }));
    expect(onActionsChange).toHaveBeenCalledWith({ '3': 'skip', '5': 'skip' });
  });

  it('bulk update-all populates every row with update', async () => {
    const onActionsChange = vi.fn();
    const { user } = setup(
      <StepDuplicates
        duplicateRows={duplicateRows}
        duplicateActions={{}}
        onActionsChange={onActionsChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^update all$/i }));
    expect(onActionsChange).toHaveBeenCalledWith({ '3': 'update', '5': 'update' });
  });
});
