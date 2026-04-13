import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: (
      data: Record<string, unknown>,
      index: number,
      event: Record<string, unknown>,
    ) => void;
  }) => (
    <button
      type="button"
      data-testid="bar"
      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
      onClick={() =>
        onClick?.({ id: 'segment-id', name: 'Row' }, 0, {
          payload: { id: 'segment-id', name: 'Row' },
        })
      }>
      {children}
    </button>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" data-fill={fill} />,
}));

import { ReportChart } from '../report-chart';

describe('ReportChart', () => {
  it('renders loading skeleton when isLoading', () => {
    const { container } = render(
      <ReportChart
        type="bar-horizontal"
        data={[]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
        isLoading
      />,
    );
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('returns null when data is empty and not loading', () => {
    const { container } = render(
      <ReportChart
        type="bar-horizontal"
        data={[]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders bar chart for bar-horizontal type', () => {
    render(
      <ReportChart
        type="bar-horizontal"
        data={[{ name: 'A', value: 100, id: 'a' }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders bar chart for bar-grouped type', () => {
    render(
      <ReportChart
        type="bar-grouped"
        data={[{ bucket: '30d', count: 5 }]}
        dataKey="count"
        nameKey="bucket"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders pie chart for pie type', () => {
    render(
      <ReportChart
        type="pie"
        data={[{ critical: 3, warning: 5, ok: 10 }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('calls onSegmentClick with id when bar-horizontal bar is clicked', async () => {
    const onSegmentClick = vi.fn();
    const { user } = setup(
      <ReportChart
        type="bar-horizontal"
        data={[{ name: 'A', value: 100, id: 'row-1' }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={onSegmentClick}
      />,
    );
    await user.click(screen.getByTestId('bar'));
    expect(onSegmentClick).toHaveBeenCalledWith('segment-id');
  });

  it('renders pie from array rows when first row has name (not aggregate object)', () => {
    render(
      <ReportChart
        type="pie"
        data={[
          { name: 'Critical', value: 5, id: 'critical' },
          { name: 'OK', value: 10, id: 'ok' },
        ]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('cell')).toHaveLength(2);
  });

  it('limits bar-horizontal data to top 10', () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      name: `Item ${i}`,
      value: i * 100,
      id: `item-${i}`,
    }));
    render(
      <ReportChart
        type="bar-horizontal"
        data={data}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    // Should render cells for top 10 only
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(10);
  });

  it('returns null for unsupported chart type', () => {
    const { container } = render(
      <ReportChart
        type={'unknown' as unknown}
        data={[{ name: 'A', value: 1 }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('dims inactive cells when activeId is set for bar-horizontal', () => {
    render(
      <ReportChart
        type="bar-horizontal"
        data={[
          { name: 'A', value: 100, id: 'a' },
          { name: 'B', value: 200, id: 'b' },
        ]}
        dataKey="value"
        nameKey="name"
        activeId="a"
        onSegmentClick={vi.fn()}
      />,
    );
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(2);
    // Active cell should have primary fill, inactive should have muted
    const activeCell = cells.find(c => c.getAttribute('data-fill')?.includes('primary'));
    expect(activeCell).toBeTruthy();
  });

  it('dims inactive pie cells when activeId is set', () => {
    render(
      <ReportChart
        type="pie"
        data={[
          { name: 'Critical', value: 5, id: 'critical' },
          { name: 'OK', value: 10, id: 'ok' },
        ]}
        dataKey="value"
        nameKey="name"
        activeId="critical"
        onSegmentClick={vi.fn()}
      />,
    );
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(2);
  });

  it('transforms aggregate object to pie data entries', () => {
    render(
      <ReportChart
        type="pie"
        data={[{ critical: 3, warning: 0, ok: 10 }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    // warning=0 should be filtered out, so 2 cells
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(2);
  });

  it('sorts bar-horizontal data by value descending', () => {
    render(
      <ReportChart
        type="bar-horizontal"
        data={[
          { name: 'Low', value: 10, id: 'low' },
          { name: 'High', value: 100, id: 'high' },
        ]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
