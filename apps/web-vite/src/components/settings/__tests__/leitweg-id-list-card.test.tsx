/**
 * Leitweg-ID list card — render parity test.
 *
 * Complements `leitweg-id-row.test.tsx` by pinning the parent card's
 * three render branches:
 *   1. isLoading      → skeleton placeholders, no table, no empty copy.
 *   2. isEmpty        → IntegrationsIllustration + emptyHeading + emptyBody.
 *   3. populated rows → table with all 5 column headers + one row per id.
 *
 * The create-dialog container is mocked to avoid pulling shadcn `dialog`
 * (which imports next-intl, a missing dep in apps/web-vite).
 */

import type * as React from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../e-invoicing/leitweg-id-create-dialog.js', () => ({
  LeitwegIdCreateDialog: () => null,
}));

vi.mock('../e-invoicing/leitweg-id-row.js', () => ({
  LeitwegIdRow: ({ row }: { row: { id: string; value: string } }) => (
    <tr data-testid={`row-${row.id}`}>
      <td>{row.value}</td>
    </tr>
  ),
}));

import type { LeitwegIdListCardProps } from '../e-invoicing/leitweg-id-list-card.js';
import { LeitwegIdListCardView } from '../e-invoicing/leitweg-id-list-card.js';
import type { LeitwegIdRowData } from '../e-invoicing/leitweg-id-row.js';

type CardProps = LeitwegIdListCardProps;

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

function buildProps(overrides: Partial<CardProps> = {}): CardProps {
  const listQuery = {
    isLoading: false,
    data: [],
  } as unknown as CardProps['listQuery'];
  return {
    t: ((key: string) => key) as CardProps['t'],
    createOpen: false,
    setCreateOpen: () => undefined,
    listQuery,
    rows: [],
    isEmpty: true,
    isLoading: false,
    ...overrides,
  };
}

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

describe('LeitwegIdListCardView (web-vite)', () => {
  it('renders the empty state when isEmpty is true and not loading', () => {
    harness = mount(<LeitwegIdListCardView {...buildProps({ isEmpty: true })} />);
    expect(harness.container.textContent).toContain('emptyHeading');
    expect(harness.container.textContent).toContain('emptyBody');
    // No table body when empty.
    expect(harness.container.querySelector('tbody')).toBeNull();
  });

  it('renders skeletons in the loading state', () => {
    harness = mount(<LeitwegIdListCardView {...buildProps({ isLoading: true })} />);
    const skeletons = harness.container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    // emptyHeading must not appear under loading.
    expect(harness.container.textContent).not.toContain('emptyHeading');
  });

  it('renders the row table with one mocked row per entry when populated', () => {
    const rows: LeitwegIdRowData[] = [
      { id: 'a', value: '991-AAA', isDefaultForContractor: false },
      { id: 'b', value: '991-BBB', isDefaultForContractor: false },
      { id: 'c', value: '991-CCC', isDefaultForContractor: false },
    ];
    harness = mount(<LeitwegIdListCardView {...buildProps({ rows, isEmpty: false })} />);
    expect(harness.container.querySelectorAll('[data-testid^="row-"]').length).toBe(3);
    // Column headers all present.
    const headers = Array.from(harness.container.querySelectorAll('thead th')).map(
      th => th.textContent ?? th.getAttribute('aria-label') ?? '',
    );
    expect(headers).toContain('colValue');
    expect(headers).toContain('colDescription');
    expect(headers).toContain('colAssignedTo');
    expect(headers).toContain('colDefault');
    expect(headers).toContain('colValidPeriod');
  });

  it('always exposes the create CTA in the header', () => {
    harness = mount(<LeitwegIdListCardView {...buildProps()} />);
    const buttons = Array.from(harness.container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent?.includes('ctaCreate'))).toBe(true);
  });
});
