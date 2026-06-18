/**
 * BoE rate history table — render parity test.
 *
 * Ported from apps/web parity: the admin BoE-rate page is the only
 * platform-operator admin surface with locked product copy. This test
 * pins the three render modes (skeleton, empty, populated rows) and the
 * source-pill semantics (BOE_API vs Manual) so accidental column-order
 * or status-mapping regressions show up before they hit prod.
 *
 * No tRPC mock needed — BoeRateTable is pure-presentational, props in /
 * JSX out. The translator is stubbed to identity (returns the key) so
 * the assertions don't depend on the i18n bundle.
 *
 * Rendering uses React 19's createRoot directly because @testing-library
 * is not a web-vite devDep (constraint: touch only new test files).
 */

import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

import { BoeRateTable } from '../boe-rate/data-table.js';
import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';

interface Harness {
  container: HTMLDivElement;
  root: Root;
}

function mount(ui: React.ReactNode): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  void act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(h: Harness) {
  void act(() => {
    h.root.unmount();
  });
  h.container.remove();
}

const sampleEntries: BoeRateEntry[] = [
  {
    id: 'rate-1',
    effectiveFrom: new Date('2024-08-01').toISOString(),
    ratePercent: '5.25',
    source: 'BOE_API',
    recordedByUserId: null,
    recordedAt: new Date('2024-08-01').toISOString(),
    createdAt: new Date('2024-08-01').toISOString(),
    notes: null,
  },
  {
    id: 'rate-2',
    effectiveFrom: new Date('2024-09-01').toISOString(),
    ratePercent: '5.00',
    source: 'MANUAL',
    recordedByUserId: 'user-1',
    recordedAt: new Date('2024-09-01').toISOString(),
    createdAt: new Date('2024-09-01').toISOString(),
    notes: 'Override after BoE press release',
  },
];

const onEdit = vi.fn();
const onDelete = vi.fn();

let harness: Harness | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (harness) {
    unmount(harness);
    harness = undefined;
  }
});

describe('BoeRateTable', () => {
  it('renders skeleton rows in the loading state', () => {
    harness = mount(
      <BoeRateTable entries={undefined} isLoading={true} onEdit={onEdit} onDelete={onDelete} />,
    );
    // SimpleDataTable renders 6 skeleton rows by default, one Skeleton per cell.
    const skeletonRows = harness.container.querySelectorAll('tbody tr');
    expect(skeletonRows.length).toBe(6);
    const skeletons = harness.container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    // Shell exposes aria-busy while loading.
    expect(harness.container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders the empty state when entries is an empty array', () => {
    harness = mount(
      <BoeRateTable entries={[]} isLoading={false} onEdit={onEdit} onDelete={onDelete} />,
    );
    expect(harness.container.textContent).toContain('noRateEntries');
    expect(harness.container.textContent).toContain('noRateEntriesBody');
  });

  it('renders a populated row per entry with source pill + formatted rate', () => {
    harness = mount(
      <BoeRateTable
        entries={sampleEntries}
        isLoading={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    const rows = harness.container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(harness.container.textContent).toContain('5.25%');
    expect(harness.container.textContent).toContain('5.00%');
    expect(harness.container.textContent).toContain('sourceBoeApi');
    expect(harness.container.textContent).toContain('sourceManual');
    expect(harness.container.textContent).toContain('Override after BoE press release');
  });

  it('shows "System" when recordedByUserId is null', () => {
    harness = mount(
      <BoeRateTable
        entries={[sampleEntries[0] as BoeRateEntry]}
        isLoading={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    const cells = harness.container.querySelectorAll('tbody td');
    const recordedByCell = Array.from(cells).find(c => c.textContent === 'System');
    expect(recordedByCell).toBeDefined();
  });

  it('invokes onEdit / onDelete with the entry when row action buttons fire', () => {
    harness = mount(
      <BoeRateTable
        entries={[sampleEntries[0] as BoeRateEntry]}
        isLoading={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    const editBtn = harness.container.querySelector('button[aria-label="ariaEditRate"]');
    const deleteBtn = harness.container.querySelector('button[aria-label="ariaDeleteRate"]');
    expect(editBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();
    void act(() => {
      (editBtn as HTMLButtonElement).click();
      (deleteBtn as HTMLButtonElement).click();
    });
    expect(onEdit).toHaveBeenCalledWith(sampleEntries[0]);
    expect(onDelete).toHaveBeenCalledWith(sampleEntries[0]);
  });
});
