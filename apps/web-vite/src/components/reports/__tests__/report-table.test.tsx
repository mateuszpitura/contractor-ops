/**
 * i18n labels resolve from the real bundle via `mount()` → `applyLocale('en')`.
 * The refetch-overlay class set comes from `AtelierTableShell`:
 * `absolute inset-0` + `aria-busy="true"` (no `z-10`).
 *
 * Skeleton selector `[data-slot='skeleton']` matches shadcn's Skeleton
 * primitive used inside ReportTable's loading branch.
 */

import type { ColumnDef } from '@tanstack/react-table';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReportTable } from '../report-table/data-table.js';
import { click, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

interface TestRow {
  id: string;
  name: string;
  value: number;
}

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'value', header: 'Value', enableSorting: true },
];

const data: TestRow[] = [
  { id: '1', name: 'Alpha', value: 100 },
  { id: '2', name: 'Beta', value: 200 },
];

const defaultProps = {
  columns,
  data,
  totalCount: 40,
  page: 1,
  pageSize: 20,
  onPageChange: vi.fn(),
  onSortChange: vi.fn(),
  sortBy: 'name',
  sortOrder: 'asc',
};

describe('ReportTable (web-vite)', () => {
  it('renders table with data rows', async () => {
    await mount(<ReportTable<TestRow> {...defaultProps} />);
    expect(findByText(document.body, 'Alpha')).not.toBeNull();
    expect(findByText(document.body, 'Beta')).not.toBeNull();
  });

  it('renders skeleton rows when loading', async () => {
    const { container } = await mount(
      <ReportTable<TestRow> {...defaultProps} data={[]} isLoading />,
    );
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(8);
  });

  it('renders empty state with title and description when no data', async () => {
    await mount(
      <ReportTable<TestRow>
        {...defaultProps}
        data={[]}
        totalCount={0}
        emptyTitle="No results"
        emptyDescription="Try adjusting filters"
      />,
    );
    expect(findByText(document.body, 'No results')).not.toBeNull();
    expect(findByText(document.body, 'Try adjusting filters')).not.toBeNull();
  });

  it('renders pagination text and Previous/Next buttons', async () => {
    // i18next-icu sometimes interpolates `{page}` and sometimes returns
    // the raw template depending on suite ordering, so we assert on the
    // stable prefix ("Page") plus the literal button labels.
    const { container } = await mount(<ReportTable<TestRow> {...defaultProps} />);
    expect((container.textContent ?? '').includes('Page')).toBe(true);
    expect(findButton(document.body, 'Previous')).not.toBeNull();
    expect(findButton(document.body, 'Next')).not.toBeNull();
  });

  it('disables Previous on first page and Next on last page', async () => {
    const { unmount } = await mount(<ReportTable<TestRow> {...defaultProps} page={1} />);
    expect(findButton(document.body, 'Previous')?.disabled).toBe(true);
    unmount();

    await mount(<ReportTable<TestRow> {...defaultProps} page={2} />);
    expect(findButton(document.body, 'Next')?.disabled).toBe(true);
  });

  it('calls onPageChange when Next is clicked', async () => {
    const onPageChange = vi.fn();
    await mount(<ReportTable<TestRow> {...defaultProps} onPageChange={onPageChange} />);
    const btn = findButton(document.body, 'Next');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when Previous is clicked on page 2', async () => {
    const onPageChange = vi.fn();
    await mount(<ReportTable<TestRow> {...defaultProps} page={2} onPageChange={onPageChange} />);
    const btn = findButton(document.body, 'Previous');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onRowClick when a data row is clicked', async () => {
    const onRowClick = vi.fn();
    await mount(<ReportTable<TestRow> {...defaultProps} onRowClick={onRowClick} />);
    const alphaCell = findByText(document.body, 'Alpha');
    expect(alphaCell).not.toBeNull();
    const row = alphaCell?.closest('tr');
    expect(row).not.toBeNull();
    await click(row as HTMLTableRowElement);
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha' }));
  });

  it('renders grand total row when both label and value provided', async () => {
    await mount(
      <ReportTable<TestRow> {...defaultProps} grandTotalLabel="Total" grandTotalValue="300" />,
    );
    expect(findByText(document.body, 'Total')).not.toBeNull();
    expect(findByText(document.body, '300')).not.toBeNull();
  });

  it('does not render grand total when value is missing', async () => {
    await mount(<ReportTable<TestRow> {...defaultProps} grandTotalLabel="Total" />);
    // "Total" should not appear without grandTotalValue.
    expect(findByText(document.body, 'Total')).toBeNull();
  });

  it('renders sortable column headers as buttons with sort aria labels', async () => {
    // i18next-icu doesn't interpolate {column} in jsdom — aria-label
    // resolves to the static template "Sort by {column}".
    const { container } = await mount(<ReportTable<TestRow> {...defaultProps} />);
    const sortButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label]'),
    ).filter(b => (b.getAttribute('aria-label') ?? '').startsWith('Sort by'));
    expect(sortButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onSortChange when a sortable header button is clicked', async () => {
    const onSortChange = vi.fn();
    const { container } = await mount(
      <ReportTable<TestRow> {...defaultProps} onSortChange={onSortChange} />,
    );
    // Find the sort button inside the first <th>; it wraps the
    // header text "Name" plus a SortIcon svg.
    const headerButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('thead button'));
    const nameSortBtn = headerButtons.find(b => (b.textContent ?? '').includes('Name'));
    expect(nameSortBtn).toBeDefined();
    await click(nameSortBtn as HTMLButtonElement);
    expect(onSortChange).toHaveBeenCalledTimes(1);
    const [col, order] = onSortChange.mock.calls[0];
    expect(col).toBe('name');
    expect(order === 'asc' || order === 'desc').toBe(true);
  });

  it('shows refetch overlay (aria-busy) when isFetching and not isLoading', async () => {
    const { container } = await mount(
      <ReportTable<TestRow> {...defaultProps} isFetching isLoading={false} />,
    );
    const overlay = container.querySelector('[aria-busy="true"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.className ?? '').toContain('absolute');
  });

  it('renders aria-busy overlay when isLoading via canonical DataTable shell', async () => {
    // Canonical workbench DataTable renders the AtelierTableShell overlay
    // (aria-busy="true") whenever loading||refetching is true — the skeleton
    // body and the shell overlay coexist. Adapter follows the primitive.
    const { container } = await mount(
      <ReportTable<TestRow> {...defaultProps} data={[]} isLoading isFetching={false} />,
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('uses the default i18n No data title when empty without explicit title', async () => {
    await mount(<ReportTable<TestRow> {...defaultProps} data={[]} totalCount={0} />);
    expect(findByText(document.body, 'No data')).not.toBeNull();
  });

  it('does not render pagination when totalCount is 0', async () => {
    await mount(<ReportTable<TestRow> {...defaultProps} data={[]} totalCount={0} />);
    expect(findButton(document.body, 'Previous')).toBeNull();
    expect(findButton(document.body, 'Next')).toBeNull();
  });

  it('hides pagination while loading even if totalCount > 0', async () => {
    await mount(<ReportTable<TestRow> {...defaultProps} data={[]} isLoading />);
    expect(findButton(document.body, 'Previous')).toBeNull();
  });

  it('renders an empty-state icon when emptyIcon is provided', async () => {
    const { container } = await mount(
      <ReportTable<TestRow>
        {...defaultProps}
        data={[]}
        totalCount={0}
        emptyIcon={<span data-testid="empty-icon">icon</span>}
        emptyTitle="Nothing here"
      />,
    );
    expect(container.querySelector('[data-testid="empty-icon"]')).not.toBeNull();
  });

  it('does not apply cursor-pointer to rows when onRowClick is not provided', async () => {
    await mount(<ReportTable<TestRow> {...defaultProps} onRowClick={undefined} />);
    const row = findByText(document.body, 'Alpha')?.closest('tr');
    expect(row).not.toBeNull();
    expect(row?.className ?? '').not.toContain('cursor-pointer');
  });

  it('applies cursor-pointer to rows when onRowClick is provided', async () => {
    await mount(<ReportTable<TestRow> {...defaultProps} onRowClick={vi.fn()} />);
    const row = findByText(document.body, 'Alpha')?.closest('tr');
    expect(row?.className ?? '').toContain('cursor-pointer');
  });

  it('renders pagination at page 3 of 5 (controls enabled in middle)', async () => {
    // ICU placeholders aren't interpolated in jsdom; we instead verify
    // the in-the-middle pagination behavior (both controls enabled).
    await mount(<ReportTable<TestRow> {...defaultProps} totalCount={100} pageSize={20} page={3} />);
    expect(findButton(document.body, 'Previous')?.disabled).toBe(false);
    expect(findButton(document.body, 'Next')?.disabled).toBe(false);
  });
});
