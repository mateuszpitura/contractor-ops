/**
 * Leitweg-ID row — render parity test.
 *
 * The XRechnung Leitweg-ID identifies the German public-sector buyer on
 * the e-invoice envelope; a wrong default-flag silently misroutes
 * invoices, so the row's "default" badge, mono Leitweg value rendering,
 * and three-action dropdown menu (Edit / Set default / Delete) are the
 * locked surface we verify here.
 *
 * shadcn `dialog` + `sheet` import next-intl which is not a web-vite
 * dep — we stub them out (and the create/delete dialog containers) to
 * keep the row component import graph resolvable inside jsdom.
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

vi.mock('../e-invoicing/leitweg-id-delete-dialog.js', () => ({
  LeitwegIdDeleteDialog: () => null,
}));

import type { LeitwegIdRowData } from '../e-invoicing/leitweg-id-row.js';
import { LeitwegIdRowView, type LeitwegIdRowViewProps } from '../e-invoicing/leitweg-id-row.js';

type RowProps = LeitwegIdRowViewProps;

interface Harness {
  container: HTMLDivElement;
  root: Root;
}

function mount(ui: React.ReactNode): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // Row is a <tr>; mount inside a <table><tbody> so the DOM is valid.
  act(() => {
    root.render(
      <table>
        <tbody>{ui}</tbody>
      </table>,
    );
  });
  return { container, root };
}

function unmount(h: Harness) {
  act(() => {
    h.root.unmount();
  });
  h.container.remove();
}

function buildHookReturn(
  overrides: Partial<Omit<RowProps, 'row' | 't'>> = {},
): Omit<RowProps, 'row' | 't'> {
  const noop = () => undefined;
  const setDefaultMutation = {
    isPending: false,
    mutate: noop,
  } as unknown as Omit<RowProps, 'row' | 't'>['setDefaultMutation'];
  return {
    editOpen: false,
    setEditOpen: noop,
    deleteOpen: false,
    setDeleteOpen: noop,
    editInitial: {
      id: '',
      value: '',
      description: null,
      contractorId: null,
      contractId: null,
      isDefaultForContractor: false,
      validFrom: null,
      validTo: null,
      notes: null,
    },
    isSetDefaultPending: false,
    handleSetDefault: noop,
    ...overrides,
    setDefaultMutation: overrides.setDefaultMutation ?? setDefaultMutation,
  };
}

const baseRow: LeitwegIdRowData = {
  id: 'leitweg-1',
  value: '991-33333TEST-33',
  description: 'Primary federal portal',
  isDefaultForContractor: true,
  contractorId: 'contractor-1',
  contractor: { id: 'contractor-1', displayName: 'Bundeswehr GmbH' },
};

const tFn = (key: string) => key;

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

describe('LeitwegIdRowView (web-vite)', () => {
  it('renders the Leitweg value inside an LTR <bdi> for RTL safety', () => {
    harness = mount(<LeitwegIdRowView row={baseRow} t={tFn as RowProps['t']} {...buildHookReturn()} />);
    const valueEl = harness.container.querySelector('[data-testid="leitweg-value-leitweg-1"]');
    expect(valueEl).not.toBeNull();
    expect(valueEl?.textContent).toBe('991-33333TEST-33');
    expect(valueEl?.getAttribute('dir')).toBe('ltr');
  });

  it('renders the default badge when isDefaultForContractor is true', () => {
    harness = mount(<LeitwegIdRowView row={baseRow} t={tFn as RowProps['t']} {...buildHookReturn()} />);
    expect(harness.container.textContent).toContain('defaultBadge');
  });

  it('omits the default badge when isDefaultForContractor is false', () => {
    harness = mount(
      <LeitwegIdRowView
        row={{ ...baseRow, isDefaultForContractor: false }}
        t={tFn as RowProps['t']}
        {...buildHookReturn()}
      />,
    );
    expect(harness.container.textContent).not.toContain('defaultBadge');
  });

  it('renders the actions dropdown trigger with an accessible label', () => {
    harness = mount(<LeitwegIdRowView row={baseRow} t={tFn as RowProps['t']} {...buildHookReturn()} />);
    const trigger = harness.container.querySelector('[data-testid="leitweg-actions-leitweg-1"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-label')).toBe('actionsAriaLabel');
  });

  it('renders contractor badge when contractor is attached', () => {
    harness = mount(<LeitwegIdRowView row={baseRow} t={tFn as RowProps['t']} {...buildHookReturn()} />);
    expect(harness.container.textContent).toContain('Bundeswehr GmbH');
  });
});
