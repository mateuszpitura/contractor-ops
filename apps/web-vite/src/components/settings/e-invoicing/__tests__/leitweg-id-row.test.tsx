/**
 * NOTE: A canonical copy of this test also lives at
 * `apps/web-vite/src/components/settings/__tests__/leitweg-id-row.test.tsx`
 * (mirror of the same component) — assertions are identical.
 *
 * The row is a `<tr>`, so it must be mounted inside a `<table><tbody>`
 * for a valid DOM. Edit and delete dialog containers pull tRPC at module
 * eval — stubbed to noops to keep the test scoped to row rendering.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../leitweg-id-create-dialog-container', () => ({
  LeitwegIdCreateDialogContainer: () => null,
}));
vi.mock('../leitweg-id-delete-dialog-container', () => ({
  LeitwegIdDeleteDialogContainer: () => null,
}));

import { render, screen } from '@/test/test-utils';
import type { useLeitwegIdRow } from '../hooks/use-leitweg-id-row';
import type { LeitwegIdRowData } from '../leitweg-id-row';
import { LeitwegIdRow } from '../leitweg-id-row';

type HookReturn = ReturnType<typeof useLeitwegIdRow>;

const tStub = ((key: string) => key) as never;

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    editOpen: false,
    setEditOpen: vi.fn(),
    deleteOpen: false,
    setDeleteOpen: vi.fn(),
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
    setDefaultMutation: { isPending: false } as HookReturn['setDefaultMutation'],
    isSetDefaultPending: false,
    handleSetDefault: vi.fn(),
    ...overrides,
  } as HookReturn;
}

const baseRow: LeitwegIdRowData = {
  id: 'leitweg-1',
  value: '991-33333TEST-33',
  description: 'Primary federal portal',
  isDefaultForContractor: true,
  contractorId: 'contractor-1',
  contractor: { id: 'contractor-1', displayName: 'Bundeswehr GmbH' },
};

function renderInTable(ui: React.ReactNode) {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );
}

describe('LeitwegIdRow (e-invoicing path)', () => {
  it('renders the Leitweg value inside an LTR <bdi> for RTL safety', () => {
    renderInTable(<LeitwegIdRow row={baseRow} t={tStub} {...buildHook()} />);

    const valueEl = screen.getByTestId('leitweg-value-leitweg-1');
    expect(valueEl.textContent).toBe('991-33333TEST-33');
    expect(valueEl.getAttribute('dir')).toBe('ltr');
  });

  it('renders the default badge when isDefaultForContractor is true', () => {
    renderInTable(<LeitwegIdRow row={baseRow} t={tStub} {...buildHook()} />);
    expect(screen.getByText('defaultBadge')).toBeInTheDocument();
  });

  it('omits the default badge when isDefaultForContractor is false', () => {
    renderInTable(
      <LeitwegIdRow
        row={{ ...baseRow, isDefaultForContractor: false }}
        t={tStub}
        {...buildHook()}
      />,
    );
    expect(screen.queryByText('defaultBadge')).not.toBeInTheDocument();
  });

  it('renders the actions dropdown trigger with an accessible label', () => {
    renderInTable(<LeitwegIdRow row={baseRow} t={tStub} {...buildHook()} />);
    const trigger = screen.getByTestId('leitweg-actions-leitweg-1');
    expect(trigger.getAttribute('aria-label')).toBe('actionsAriaLabel');
  });

  it('renders the contractor badge when contractor is attached', () => {
    renderInTable(<LeitwegIdRow row={baseRow} t={tStub} {...buildHook()} />);
    expect(screen.getByText('Bundeswehr GmbH')).toBeInTheDocument();
  });
});
