/**
 * `useTopBarBreadcrumbs` — view-model for the top-bar breadcrumb trail +
 * contract wizard / search openers. Covers:
 *   - empty path → no segments
 *   - segments derived with isLast flag + cumulative href
 *   - breadcrumb override map wins over fallback translation
 *   - long opaque ids (>=20 chars) collapse to "…"
 *   - openContractWizard toggles state; setter accepts close
 *   - openSearch calls search-provider setOpen(true)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameRef: { current: string } = { current: '/' };
const overridesRef: { current: Map<string, { label: string }> } = { current: new Map() };
const setSearchOpenMock = vi.fn();

vi.mock('../../../../i18n/navigation.js', () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => {
    const fn = (key: string) => `t:${key}`;
    return fn;
  },
}));

vi.mock('../../../../i18n/typed-keys.js', () => ({
  tHas: (_t: unknown, key: string) => key === 'contractors',
  tKey: (_t: unknown, key: string) => `nav:${key}`,
}));

vi.mock('../../../search/search-provider.js', () => ({
  useSearch: () => ({ setOpen: setSearchOpenMock }),
}));

vi.mock('../../breadcrumb-context.js', () => ({
  useBreadcrumbContext: () => ({
    overrides: overridesRef.current,
    setOverride: vi.fn(),
    clearOverride: vi.fn(),
  }),
}));

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useTopBarBreadcrumbs } from '../use-top-bar-breadcrumbs.js';

beforeEach(() => {
  pathnameRef.current = '/';
  overridesRef.current = new Map();
  setSearchOpenMock.mockReset();
});

describe('useTopBarBreadcrumbs', () => {
  it('produces no segments on the root path (empty branch)', () => {
    pathnameRef.current = '/';
    const { result } = renderHookWithProviders(() => useTopBarBreadcrumbs());
    expect(result.current.segments).toEqual([]);
  });

  it('builds cumulative href segments and flags only the last one (success)', () => {
    pathnameRef.current = '/contractors/abc';
    const { result } = renderHookWithProviders(() => useTopBarBreadcrumbs());
    expect(result.current.segments).toEqual([
      { segment: 'contractors', label: 'nav:contractors', href: '/contractors', isLast: false },
      { segment: 'abc', label: 'Abc', href: '/contractors/abc', isLast: true },
    ]);
  });

  it('collapses long opaque ids (>=20 chars) to "…" (id heuristic)', () => {
    pathnameRef.current = '/contractors/abcdefghijklmnopqrstu';
    const { result } = renderHookWithProviders(() => useTopBarBreadcrumbs());
    expect(result.current.segments[1]?.label).toBe('…');
  });

  it('breadcrumb override map wins over the fallback label (override branch)', () => {
    overridesRef.current = new Map([['abc', { label: 'Acme Ltd' }]]);
    pathnameRef.current = '/contractors/abc';
    const { result } = renderHookWithProviders(() => useTopBarBreadcrumbs());
    expect(result.current.segments[1]?.label).toBe('Acme Ltd');
  });

  it('openContractWizard flips the wizard-open flag; setter accepts close', () => {
    const { result } = renderHookWithProviders(() => useTopBarBreadcrumbs());
    expect(result.current.contractWizardOpen).toBe(false);
    act(() => result.current.openContractWizard());
    expect(result.current.contractWizardOpen).toBe(true);
    act(() => result.current.setContractWizardOpen(false));
    expect(result.current.contractWizardOpen).toBe(false);
  });

  it('openSearch calls the search provider with true', () => {
    const { result } = renderHookWithProviders(() => useTopBarBreadcrumbs());
    act(() => result.current.openSearch());
    expect(setSearchOpenMock).toHaveBeenCalledWith(true);
  });
});
