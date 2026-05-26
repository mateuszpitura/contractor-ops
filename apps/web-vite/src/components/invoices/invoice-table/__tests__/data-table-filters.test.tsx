import { render, screen, setup } from '@/test/test-utils';

import { DataTableFilters } from '../data-table-filters';

describe('DataTableFilters', () => {
  it('shows the active filter count badge on the Filters trigger', () => {
    render(
      <DataTableFilters
        filters={{ status: ['RECEIVED', 'PAID'], matchStatus: [], source: ['MANUAL_UPLOAD'] }}
        onFiltersChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /filters/i });
    expect(trigger).toHaveTextContent('3');
  });

  it('calls onFiltersChange with cleared arrays when Clear all is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: ['RECEIVED'], matchStatus: [], source: [] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /clear all/i }));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: [],
        source: [],
      }),
    );
  });

  it('removes a status chip when its remove control is activated', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: ['RECEIVED'], matchStatus: [], source: [] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: /remove filter.*received/i,
      }),
    );

    expect(onFiltersChange).toHaveBeenCalledWith({ status: [] });
  });

  it('toggles an Overdue filter when the Overdue button is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: [], matchStatus: [], source: [], overdue: false }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /overdue/i }));
    expect(onFiltersChange).toHaveBeenCalledWith({ overdue: true });
  });
});
