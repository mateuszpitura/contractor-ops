/**
 * DrillDownBreadcrumb pulls its "All" + "Clear filter" labels
 * from i18next (`Reports.all`, `Reports.clearFilter`) — `mount()` boots
 * `applyLocale('en')` before the first render so the real bundle resolves.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// `@contractor-ops/ui` shadcn breadcrumb (pre-bundled to `dist/`) uses
// `next-intl` for default aria labels; web-vite has no NextIntlClientProvider.
// Vite optimizeDeps pre-bundles the package, so a `vi.mock('next-intl', ...)`
// at this scope doesn't always intercept the transitive import — mocking the
// shadcn entry point itself with minimal native-element passthroughs is more
// reliable and keeps the markup the test asserts against (`button`, plain
// text segments) intact.
vi.mock('@contractor-ops/ui/components/shadcn/breadcrumb', () => {
  type Render = (props: Record<string, unknown>) => unknown;
  function Breadcrumb({ children }: { children?: React.ReactNode }) {
    return <nav>{children}</nav>;
  }
  function BreadcrumbList({ children }: { children?: React.ReactNode }) {
    return <ol>{children}</ol>;
  }
  function BreadcrumbItem({ children }: { children?: React.ReactNode }) {
    return <li>{children}</li>;
  }
  function BreadcrumbLink({ render }: { render?: Render; children?: React.ReactNode }) {
    return <>{render?.({})}</>;
  }
  function BreadcrumbPage({ children }: { children?: React.ReactNode }) {
    return <span>{children}</span>;
  }
  function BreadcrumbSeparator() {
    return <span aria-hidden="true">/</span>;
  }
  return {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
  };
});

import { DrillDownBreadcrumb } from '../drill-down-breadcrumb.js';
import { click, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DrillDownBreadcrumb (web-vite)', () => {
  it('renders nothing when segments has 1 or fewer items', async () => {
    const { container } = await mount(
      <DrillDownBreadcrumb segments={[{ label: 'All' }]} onClear={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when segments is empty', async () => {
    const { container } = await mount(<DrillDownBreadcrumb segments={[]} onClear={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders breadcrumb when more than 1 segment', async () => {
    await mount(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Engineering', id: 'eng' }]}
        onClear={vi.fn()}
      />,
    );
    // First segment is replaced by the i18n "All" anchor.
    expect(findByText(document.body, 'All')).not.toBeNull();
    expect(findByText(document.body, 'Engineering')).not.toBeNull();
  });

  it('renders clear filter button', async () => {
    await mount(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Sales', id: 'sales' }]}
        onClear={vi.fn()}
      />,
    );
    expect(findByText(document.body, 'Clear filter')).not.toBeNull();
  });

  it('calls onClear when clear filter button is clicked', async () => {
    const onClear = vi.fn();
    await mount(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Sales', id: 'sales' }]}
        onClear={onClear}
      />,
    );
    const btn = findButton(document.body, 'Clear filter');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when the All breadcrumb control is clicked', async () => {
    const onClear = vi.fn();
    await mount(
      <DrillDownBreadcrumb
        segments={[{ label: 'All' }, { label: 'Sales', id: 'sales' }]}
        onClear={onClear}
      />,
    );
    // The "All" link is rendered via Breadcrumb's render prop as a <button>.
    const btn = findButton(document.body, 'All');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders multiple drill-down segments', async () => {
    await mount(
      <DrillDownBreadcrumb
        segments={[
          { label: 'All' },
          { label: 'Engineering', id: 'eng' },
          { label: 'Frontend', id: 'fe' },
        ]}
        onClear={vi.fn()}
      />,
    );
    expect(findByText(document.body, 'Engineering')).not.toBeNull();
    expect(findByText(document.body, 'Frontend')).not.toBeNull();
  });
});
