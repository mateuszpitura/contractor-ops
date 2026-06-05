/**
 * Recharts ResponsiveContainer requires real DOM measurement and doesn't
 * render Cells in jsdom, so recharts is stubbed at the module level. This
 * lets the test assert on data-driven behavior (cell counts after
 * sort/slice, click payload) without depending on SVG layout.
 *
 * Notes:
 *   - `data-fill` cells let us check active/inactive dimming.
 *   - `ResponsiveContainer` stub omits the size measurement entirely.
 *   - `vi.mock('recharts', …)` must be at file scope to hoist before
 *     `report-chart` imports it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => {
  type BarStubOnClick = (
    data: Record<string, unknown>,
    index: number,
    event: Record<string, unknown>,
  ) => void;
  const BarStub = ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: BarStubOnClick;
  }) => {
    const handleClick = () =>
      onClick?.({ id: 'segment-id', name: 'Row' }, 0, {
        payload: { id: 'segment-id', name: 'Row' },
      });
    return (
      <button type="button" data-testid="bar" onClick={handleClick}>
        {children}
      </button>
    );
  };
  return {
    BarChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="bar-chart">{children}</div>
    ),
    Bar: BarStub,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    PieChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pie-chart">{children}</div>
    ),
    Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
    Cell: ({ fill }: { fill: string }) => <div data-testid="cell" data-fill={fill} />,
  };
});

import { ReportChart } from '../report-chart.js';
import { click, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ReportChart (web-vite)', () => {
  it('renders loading skeleton when isLoading', async () => {
    const { container } = await mount(
      <ReportChart
        type="bar-horizontal"
        data={[]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
        isLoading
      />,
    );
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
  });

  it('renders the empty-state border box when no data and not loading', async () => {
    const { container } = await mount(
      <ReportChart
        type="bar-horizontal"
        data={[]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    // Web-vite renders a dashed empty box rather than `''`; assert the
    // visible affordance is present and chart svg containers are absent.
    const emptyBox = container.querySelector('.border-dashed');
    expect(emptyBox).not.toBeNull();
    expect(container.querySelector('[data-testid="bar-chart"]')).toBeNull();
  });

  it('renders BarChart for bar-horizontal type', async () => {
    const { container } = await mount(
      <ReportChart
        type="bar-horizontal"
        data={[{ name: 'A', value: 100, id: 'a' }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="bar-chart"]')).not.toBeNull();
  });

  it('renders BarChart for bar-grouped type', async () => {
    const { container } = await mount(
      <ReportChart
        type="bar-grouped"
        data={[{ bucket: '30d', count: 5 }]}
        dataKey="count"
        nameKey="bucket"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="bar-chart"]')).not.toBeNull();
  });

  it('renders PieChart for pie type with aggregate object data', async () => {
    const { container } = await mount(
      <ReportChart
        type="pie"
        data={[{ critical: 3, warning: 5, ok: 10 }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="pie-chart"]')).not.toBeNull();
  });

  it('calls onSegmentClick with id when bar-horizontal Bar is clicked', async () => {
    const onSegmentClick = vi.fn();
    const { container } = await mount(
      <ReportChart
        type="bar-horizontal"
        data={[{ name: 'A', value: 100, id: 'row-1' }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={onSegmentClick}
      />,
    );
    const bar = container.querySelector<HTMLButtonElement>('[data-testid="bar"]');
    expect(bar).not.toBeNull();
    await click(bar as HTMLButtonElement);
    expect(onSegmentClick).toHaveBeenCalledWith('segment-id');
  });

  it('renders pie cells from a pre-shaped array of {name,value,id} rows', async () => {
    const { container } = await mount(
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
    expect(container.querySelector('[data-testid="pie-chart"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="cell"]').length).toBe(2);
  });

  it('limits bar-horizontal data to top 10 by value', async () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      name: `Item ${i}`,
      value: i * 100,
      id: `item-${i}`,
    }));
    const { container } = await mount(
      <ReportChart
        type="bar-horizontal"
        data={data}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    const cells = container.querySelectorAll('[data-testid="cell"]');
    expect(cells.length).toBe(10);
  });

  it('returns null for an unsupported chart type', async () => {
    const { container } = await mount(
      <ReportChart
        type={'unknown' as never}
        data={[{ name: 'A', value: 1 }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('dims inactive cells when activeId is set for bar-horizontal', async () => {
    const { container } = await mount(
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
    const cells = Array.from(container.querySelectorAll<HTMLDivElement>('[data-testid="cell"]'));
    expect(cells.length).toBe(2);
    // Active cell uses the gradient `url(#…-grad)`, inactive falls back to
    // `var(--color-muted-foreground)`.
    const activeFill = cells.find(c => (c.getAttribute('data-fill') ?? '').includes('grad'));
    const inactiveFill = cells.find(c =>
      (c.getAttribute('data-fill') ?? '').includes('muted-foreground'),
    );
    expect(activeFill).toBeDefined();
    expect(inactiveFill).toBeDefined();
  });

  it('filters zero-value entries from pie aggregate transformation', async () => {
    const { container } = await mount(
      <ReportChart
        type="pie"
        data={[{ critical: 3, warning: 0, ok: 10 }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    // warning=0 must be filtered out → 2 cells, not 3.
    const cells = container.querySelectorAll('[data-testid="cell"]');
    expect(cells.length).toBe(2);
  });

  it('renders an empty placeholder box when pie aggregate has only zeros', async () => {
    const { container } = await mount(
      <ReportChart
        type="pie"
        data={[{ critical: 0, warning: 0, ok: 0 }]}
        dataKey="value"
        nameKey="name"
        onSegmentClick={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="pie-chart"]')).toBeNull();
    expect(container.querySelector('.border-dashed')).not.toBeNull();
  });
});
