import { render, screen, setup } from '@/test/test-utils';
import { DrillDownBreadcrumb } from '../drill-down-breadcrumb';

describe('DrillDownBreadcrumb', () => {
  it('renders nothing when segments has 1 or fewer items', () => {
    const { container } = render(
      <DrillDownBreadcrumb segments={[{ label: 'All' }]} onClear={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when segments is empty', () => {
    const { container } = render(<DrillDownBreadcrumb segments={[]} onClear={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders breadcrumb when more than 1 segment', () => {
    render(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Engineering', id: 'eng' }]}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('renders clear filter button', () => {
    render(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Sales', id: 'sales' }]}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('Clear filter')).toBeInTheDocument();
  });

  it('calls onClear when clear filter button is clicked', async () => {
    const onClear = vi.fn();
    const { user } = setup(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Sales', id: 'sales' }]}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByText('Clear filter'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when the All breadcrumb control is clicked', async () => {
    const onClear = vi.fn();
    const { user } = setup(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Sales', id: 'sales' }]}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders multiple drill-down segments', () => {
    render(
      <DrillDownBreadcrumb
        segments={[
          { label: 'All' },
          { label: 'Engineering', id: 'eng' },
          { label: 'Frontend', id: 'fe' },
        ]}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });
});
