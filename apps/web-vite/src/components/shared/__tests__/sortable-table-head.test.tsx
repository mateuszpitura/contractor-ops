/**
 * Step 10 port of apps/web/src/components/shared/__tests__/sortable-table-head.test.tsx.
 *
 * SortableTableHead wraps every data-table column header — placeholder
 * passthrough, non-sortable bare label, sortable button + ArrowUp/Down
 * icon, and the `aria-sort` value the screen-reader audit checks. Build a
 * minimal Header stub instead of plumbing a full TanStack table, and mock
 * `flexRender` to echo the string header so we can assert label text
 * without rendering JSX children.
 */

import type { Header } from '@tanstack/react-table';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SortableTableHead } from '../sortable-table-head.js';
import { click, mount } from './_render.js';

vi.mock('@tanstack/react-table', () => ({
  flexRender: (header: unknown) => header,
}));

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

interface MockHeaderOpts {
  canSort?: boolean;
  isSorted?: false | 'asc' | 'desc';
  isPlaceholder?: boolean;
  headerText?: string;
  size?: number;
  toggleHandler?: () => void;
}

function createMockHeader(opts: MockHeaderOpts = {}): Header<unknown, unknown> {
  const {
    canSort = true,
    isSorted = false,
    isPlaceholder = false,
    headerText = 'Name',
    size = 150,
    toggleHandler,
  } = opts;
  const toggleSortingHandler = vi.fn(() => toggleHandler);
  return {
    id: 'col-1',
    isPlaceholder,
    column: {
      getCanSort: () => canSort,
      getIsSorted: () => isSorted,
      getToggleSortingHandler: toggleSortingHandler,
      getSize: () => size,
      columnDef: {
        header: headerText,
      },
    },
    getContext: () => ({}),
  } as unknown as Header<unknown, unknown>;
}

function renderInTable(header: Header<unknown, unknown>, sortAriaLabel?: string) {
  return mount(
    <table>
      <thead>
        <tr>
          <SortableTableHead header={header} sortAriaLabel={sortAriaLabel} />
        </tr>
      </thead>
    </table>,
  );
}

describe('SortableTableHead (web-vite)', () => {
  it('renders header text for a sortable column', async () => {
    const { container } = await renderInTable(createMockHeader());
    expect(container.textContent ?? '').toContain('Name');
  });

  it('omits the sort button for a non-sortable column', async () => {
    const { container } = await renderInTable(createMockHeader({ canSort: false }));
    expect(container.textContent ?? '').toContain('Name');
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders a sort button with the supplied aria-label', async () => {
    const { container } = await renderInTable(createMockHeader(), 'Sort by name');
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Sort by name');
  });

  it('renders an empty <th> for a placeholder header', async () => {
    const { container } = await renderInTable(createMockHeader({ isPlaceholder: true }));
    expect((container.textContent ?? '').trim()).toBe('');
    expect(container.querySelector('th')).not.toBeNull();
  });

  it('sets aria-sort=ascending when sorted asc', async () => {
    const { container } = await renderInTable(createMockHeader({ isSorted: 'asc' }));
    const th = container.querySelector('th');
    expect(th?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('sets aria-sort=descending when sorted desc', async () => {
    const { container } = await renderInTable(createMockHeader({ isSorted: 'desc' }));
    const th = container.querySelector('th');
    expect(th?.getAttribute('aria-sort')).toBe('descending');
  });

  it('does not set aria-sort when unsorted', async () => {
    const { container } = await renderInTable(createMockHeader({ isSorted: false }));
    const th = container.querySelector('th');
    expect(th?.hasAttribute('aria-sort')).toBe(false);
  });

  it('invokes the toggle sorting handler on click', async () => {
    const onToggle = vi.fn();
    const header = createMockHeader({ toggleHandler: onToggle });
    const { container } = await renderInTable(header);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    await click(button as HTMLButtonElement);
    expect(onToggle).toHaveBeenCalled();
  });
});
