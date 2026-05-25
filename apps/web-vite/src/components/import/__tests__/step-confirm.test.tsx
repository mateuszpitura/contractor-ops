/**
 * Presentational test for the import wizard's final "confirm" step.
 *
 * Covers four render states (pre-import / loading / completion / error) and
 * the `onImport`-throws → error-state path. `useRouter` is stubbed via the
 * web-vite locale-aware navigation shim so the completion CTA stays inert.
 */

import { render, screen, setup } from '@/test/test-utils';
import { setupTestI18n } from '../../../test-utils/setup-test-i18n';
import { StepConfirm } from '../step-confirm';

beforeAll(async () => {
  // Patches the ICU formatter so `{count}` / pluralized strings interpolate
  // under Node ESM — without this they render with literal `{count}` markers.
  await setupTestI18n();
});

const routerPushMock = vi.fn();
vi.mock('../../../i18n/navigation.js', async () => {
  const actual = await vi.importActual<typeof import('../../../i18n/navigation.tsx')>(
    '../../../i18n/navigation.tsx',
  );
  return {
    ...actual,
    useRouter: () => ({ push: routerPushMock, replace: vi.fn() }),
  };
});

describe('StepConfirm', () => {
  const defaultCounts = {
    newRecords: 10,
    updates: 3,
    skippedDuplicates: 2,
    skippedErrors: 1,
  };

  beforeEach(() => {
    routerPushMock.mockReset();
  });

  it('renders pre-import state with summary counts', () => {
    render(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={null}
        isImporting={false}
      />,
    );
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders import button with total count', () => {
    render(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={null}
        isImporting={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Import 13 records/i })).toBeInTheDocument();
  });

  it('shows loading state while importing', () => {
    render(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={null}
        isImporting={true}
      />,
    );
    expect(screen.getByText('Importing...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import \d+ records/i })).not.toBeInTheDocument();
  });

  it('shows completion state with per-row counts', () => {
    render(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={{ created: 10, updated: 3, skipped: 2, failed: 0 }}
        isImporting={false}
      />,
    );
    expect(screen.getByText('Import complete')).toBeInTheDocument();
    expect(screen.getByText(/10 records created/)).toBeInTheDocument();
    expect(screen.getByText(/3 records updated/)).toBeInTheDocument();
  });

  it('renders failed count only when > 0', () => {
    const { rerender } = render(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={{ created: 10, updated: 3, skipped: 2, failed: 0 }}
        isImporting={false}
      />,
    );
    expect(screen.queryByText(/records failed/)).not.toBeInTheDocument();

    rerender(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={{ created: 10, updated: 3, skipped: 2, failed: 4 }}
        isImporting={false}
      />,
    );
    expect(screen.getByText(/4 records failed/)).toBeInTheDocument();
  });

  it('routes to /contractors when viewing entities for contractor import', async () => {
    const { user } = setup(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={{ created: 10, updated: 3, skipped: 2, failed: 0 }}
        isImporting={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /View contractors/i }));
    expect(routerPushMock).toHaveBeenCalledWith('/contractors');
  });

  it('routes to /contracts for a contract import', async () => {
    const { user } = setup(
      <StepConfirm
        entityType="contract"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={{ created: 10, updated: 3, skipped: 2, failed: 0 }}
        isImporting={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /View contracts/i }));
    expect(routerPushMock).toHaveBeenCalledWith('/contracts');
  });

  it('calls onImport when import button clicked', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={onImport}
        importResult={null}
        isImporting={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Import \d+ records/i }));
    expect(onImport).toHaveBeenCalled();
  });

  it('surfaces an error state when onImport rejects and offers retry', async () => {
    const onImport = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const { user } = setup(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={onImport}
        importResult={null}
        isImporting={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Import \d+ records/i }));
    expect(await screen.findByText('Import failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onImport).toHaveBeenCalledTimes(2);
  });
});
