/**
 * Web-vite port of apps/web/src/components/settings/__tests__/audit-log-tab.test.tsx.
 *
 * Container/component split — the section receives ~40 props from
 * `useAuditLogTab`. Tests inject shaped stubs and assert on the empty,
 * loaded, and active-filter branches. The inner `AuditLogTable` reads
 * i18n itself, so its empty/loaded copy comes from the live bundle.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { AuditLogTab } from '../audit-log-tab';
import type { AuditLogEntry } from '../audit-log-table';
import type { useAuditLogTab } from '../hooks/use-audit-log-tab';

type HookReturn = ReturnType<typeof useAuditLogTab>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  const base = {
    t: tStub,
    tAria: tStub,
    tEmpty: tStub,
    localSearch: '',
    setLocalSearch: vi.fn(),
    actorId: '',
    actions: [] as string[],
    resourceTypes: [] as string[],
    dateFrom: '',
    dateTo: '',
    auditSort: 'desc',
    dateRangeValue: undefined,
    currentPage: 1,
    items: [] as AuditLogEntry[],
    totalCount: 0,
    expandedRows: {},
    handleToggleRow: vi.fn(),
    handlePageChange: vi.fn(),
    handleSortOrderChange: vi.fn(),
    handleExport: vi.fn(),
    exportMutation: { isPending: false },
    actorOpen: false,
    setActorOpen: vi.fn(),
    actorQuery: '',
    setActorQuery: vi.fn(),
    actorOptions: [] as Array<{ id: string; name: string }>,
    selectedActorLabel: null,
    visibleActorOptions: [] as Array<{ id: string; name: string }>,
    MAX_VISIBLE_ACTORS: 10,
    toggleAction: vi.fn(),
    toggleResourceType: vi.fn(),
    removeAction: vi.fn(),
    removeResourceType: vi.fn(),
    clearAllFilters: vi.fn(),
    handleDateRangeSelect: vi.fn(),
    clearDates: vi.fn(),
    selectActor: vi.fn(),
    clearActor: vi.fn(),
    activeFilterCount: 0,
    isLoading: false,
    isRefetching: false,
    isTrulyEmpty: false,
    ...overrides,
  };
  return base as unknown as HookReturn;
}

describe('AuditLogTab', () => {
  it('renders the title, search input and export CTA', () => {
    render(<AuditLogTab {...buildHook()} />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('searchPlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportCta/i })).toBeInTheDocument();
  });

  it('disables export when totalCount is 0', () => {
    render(<AuditLogTab {...buildHook({ totalCount: 0 })} />);
    expect(screen.getByRole('button', { name: /exportCta/i })).toBeDisabled();
  });

  it('enables export and fires handleExport on click when entries exist', async () => {
    const handleExport = vi.fn();
    const { user } = setup(<AuditLogTab {...buildHook({ totalCount: 5, handleExport })} />);

    const cta = screen.getByRole('button', { name: /exportCta/i });
    expect(cta).toBeEnabled();
    await user.click(cta);
    expect(handleExport).toHaveBeenCalledTimes(1);
  });

  it('renders the truly-empty state when isTrulyEmpty is true', () => {
    render(<AuditLogTab {...buildHook({ isTrulyEmpty: true })} />);
    expect(screen.getByText('heading')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders the active-filter chip row when activeFilterCount > 0', () => {
    render(
      <AuditLogTab
        {...buildHook({
          actions: ['CREATE'],
          activeFilterCount: 1,
        })}
      />,
    );

    expect(screen.getByText('clearAll')).toBeInTheDocument();
  });

  it('clears all filters when the "clearAll" link is clicked', async () => {
    const clearAllFilters = vi.fn();
    const { user } = setup(
      <AuditLogTab
        {...buildHook({
          actions: ['CREATE'],
          activeFilterCount: 1,
          clearAllFilters,
        })}
      />,
    );

    await user.click(screen.getByText('clearAll'));
    expect(clearAllFilters).toHaveBeenCalledTimes(1);
  });

  it('forwards typed search text to setLocalSearch', async () => {
    const setLocalSearch = vi.fn();
    const { user } = setup(<AuditLogTab {...buildHook({ setLocalSearch })} />);
    await user.type(screen.getByPlaceholderText('searchPlaceholder'), 'x');
    expect(setLocalSearch).toHaveBeenCalledWith('x');
  });
});
