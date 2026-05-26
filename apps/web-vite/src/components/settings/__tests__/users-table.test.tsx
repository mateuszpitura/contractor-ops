/**
 * Settings → members table — render parity test.
 *
 * Ported from apps/web/src/components/settings/__tests__/users-table.test.tsx.
 *
 * The member-management table is the only RBAC-graded surface in
 * Settings; a regressed row (missing role badge, dropped status,
 * inverted "deactivate" rule for the current user) instantly produces
 * a tenant-data exposure. We pin column headers, body cells, and the
 * action-cell visibility rules here at the presentational layer; the
 * tRPC mutation paths are covered separately in the hook tests.
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

vi.mock('../deactivate-dialog-container.js', () => ({
  DeactivateDialogContainer: () => null,
}));

vi.mock('../user-consent-sheet-container.js', () => ({
  UserConsentSheetContainer: () => null,
}));

import type { Member } from '../hooks/use-users-table.js';
import { UsersTable } from '../users-table.js';

type TableProps = React.ComponentProps<typeof UsersTable>;

interface Harness {
  container: HTMLDivElement;
  root: Root;
}

function mount(ui: React.ReactNode): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(h: Harness) {
  act(() => {
    h.root.unmount();
  });
  h.container.remove();
}

const members: Member[] = [
  {
    id: 'u1',
    userId: 'u1',
    name: 'Alice Smith',
    email: 'alice@test.com',
    role: 'admin',
    status: 'active',
  },
  {
    id: 'u2',
    userId: 'u2',
    name: 'Bob Jones',
    email: 'bob@test.com',
    role: 'readonly',
    status: 'invited',
  },
];

function buildProps(overrides: Partial<TableProps> = {}): TableProps {
  const noop = () => undefined;
  const baseQuery = {
    isLoading: false,
    isFetching: false,
    data: members,
  } as unknown as TableProps['membersQuery'];
  const updateRoleMutation = {
    isPending: false,
    mutate: noop,
  } as unknown as TableProps['updateRoleMutation'];
  const reactivateMutation = {
    isPending: false,
    mutate: noop,
  } as unknown as TableProps['reactivateMutation'];
  return {
    t: ((key: string) => key) as TableProps['t'],
    membersQuery: baseQuery,
    members,
    showActionsColumn: true,
    canManageMembers: true,
    canDeleteMembers: true,
    canReadConsent: true,
    currentUserId: 'u1',
    updateRoleMutation,
    reactivateMutation,
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

describe('UsersTable (web-vite)', () => {
  it('renders the four base column headers plus the actions column', () => {
    harness = mount(<UsersTable {...buildProps()} />);
    const headerCells = Array.from(harness.container.querySelectorAll('thead th')).map(
      th => th.textContent,
    );
    expect(headerCells).toContain('columns.name');
    expect(headerCells).toContain('columns.email');
    expect(headerCells).toContain('columns.role');
    expect(headerCells).toContain('columns.status');
    expect(headerCells).toContain('columns.actions');
  });

  it('renders one body row per member with name + email', () => {
    harness = mount(<UsersTable {...buildProps()} />);
    const bodyRows = harness.container.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(2);
    expect(harness.container.textContent).toContain('Alice Smith');
    expect(harness.container.textContent).toContain('Bob Jones');
    expect(harness.container.textContent).toContain('alice@test.com');
    expect(harness.container.textContent).toContain('bob@test.com');
  });

  it('renders skeleton rows while the query is loading', () => {
    const loadingQuery = {
      isLoading: true,
      isFetching: true,
      data: undefined,
    } as unknown as TableProps['membersQuery'];
    harness = mount(<UsersTable {...buildProps({ membersQuery: loadingQuery })} />);
    const skeletons = harness.container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders the empty state body copy when there are no members', () => {
    harness = mount(<UsersTable {...buildProps({ members: [] })} />);
    expect(harness.container.textContent).toContain('emptyState.heading');
    expect(harness.container.textContent).toContain('emptyState.body');
  });

  it('hides the actions column header when showActionsColumn is false', () => {
    harness = mount(<UsersTable {...buildProps({ showActionsColumn: false })} />);
    const headerCells = Array.from(harness.container.querySelectorAll('thead th')).map(
      th => th.textContent,
    );
    expect(headerCells).not.toContain('columns.actions');
  });

  it('never offers a deactivate button against the current user themselves', () => {
    // u1 is currentUserId; the row's action cell should not include the
    // destructive "deactivate" button — this is the safety rule that keeps
    // an admin from locking themselves out by misclick.
    harness = mount(<UsersTable {...buildProps({ currentUserId: 'u1' })} />);
    const aliceRow = Array.from(harness.container.querySelectorAll('tbody tr')).find(tr =>
      tr.textContent?.includes('Alice Smith'),
    );
    expect(aliceRow).toBeDefined();
    // viewConsent button is allowed; deactivate must not appear for self.
    expect(aliceRow?.textContent).not.toContain('actions.deactivate');
  });
});
