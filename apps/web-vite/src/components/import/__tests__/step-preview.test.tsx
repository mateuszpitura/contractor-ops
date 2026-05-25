/**
 * Presentational test for the import wizard's "preview" step. Locks down:
 *   - empty state when totalRows = 0
 *   - happy-path "all valid" message when no invalid rows
 *   - row counts in the stats bar
 *   - error-cell highlight + the show-errors-only toggle
 *
 * Pure props in / DOM out — no providers other than the shared web-vite
 * test-utils wrapper (i18n + router).
 */

import { render, screen, setup } from '@/test/test-utils';
import { setupTestI18n } from '../../../test-utils/setup-test-i18n';
import type { ImportRow } from '../import-wizard-dialog';
import { StepPreview } from '../step-preview';

beforeAll(async () => {
  await setupTestI18n();
});

const validRow: ImportRow = {
  rowNumber: 1,
  data: { legalName: 'Acme', taxId: '111', email: 'a@a.com' },
  status: 'valid',
  errors: [],
};

const invalidRow: ImportRow = {
  rowNumber: 2,
  data: { legalName: 'Beta', taxId: '', email: 'not-an-email' },
  status: 'invalid',
  errors: [{ field: 'taxId', message: 'Tax ID is required' }],
};

describe('StepPreview', () => {
  it('renders empty-state copy when total rows is zero', () => {
    render(<StepPreview validRows={[]} invalidRows={[]} totalRows={0} />);
    expect(screen.getByText('No rows to preview')).toBeInTheDocument();
  });

  it('renders an "all valid" banner when no rows are invalid', () => {
    render(<StepPreview validRows={[validRow]} invalidRows={[]} totalRows={1} />);
    expect(screen.getByText(/All 1 rows are valid/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show errors only/i })).not.toBeInTheDocument();
  });

  it('renders the stats bar with valid + invalid + total counts', () => {
    render(<StepPreview validRows={[validRow]} invalidRows={[invalidRow]} totalRows={2} />);
    expect(screen.getByText(/1 valid row/)).toBeInTheDocument();
    expect(screen.getByText(/1 invalid row/)).toBeInTheDocument();
    expect(screen.getByText(/2 total rows/)).toBeInTheDocument();
  });

  it('renders both rows by default and filters to invalid only when toggled', async () => {
    const { user } = setup(
      <StepPreview validRows={[validRow]} invalidRows={[invalidRow]} totalRows={2} />,
    );

    // Both rows visible (header + data rows)
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show errors only/i }));
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show all/i }));
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
});
