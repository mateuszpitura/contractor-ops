import { render, screen, setup } from '@/test/test-utils';
import { StepConfirm } from '../step-confirm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('StepConfirm', () => {
  const defaultCounts = {
    newRecords: 10,
    updates: 3,
    skippedDuplicates: 2,
    skippedErrors: 1,
  };

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

  it('renders import button', () => {
    render(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={vi.fn()}
        importResult={null}
        isImporting={false}
      />,
    );
    expect(screen.getByText(/Import.*records/)).toBeInTheDocument();
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
  });

  it('shows completion state with results', () => {
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
  });

  it('calls onImport when import button clicked', async () => {
    const onImport = vi.fn();
    const { user } = setup(
      <StepConfirm
        entityType="contractor"
        counts={defaultCounts}
        onImport={onImport}
        importResult={null}
        isImporting={false}
      />,
    );
    await user.click(screen.getByText(/Import.*records/));
    expect(onImport).toHaveBeenCalled();
  });
});
