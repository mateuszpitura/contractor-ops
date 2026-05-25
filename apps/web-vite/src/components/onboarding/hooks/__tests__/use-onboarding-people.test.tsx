/**
 * `useOnboardingPeople` — step 2 of the import wizard.
 *
 * Covers:
 *   - loading + isEmpty + isError projections of `fetchPeople`
 *   - initial-load side effect: persists merged people + seeds default
 *     selections (skip=true for existing accounts, readonly default role)
 *   - filter tabs derive the `filteredPeople` slice; counts stay stable
 *   - selection helpers (select-all + row toggle + skip + role + conflict)
 *   - batch ops over checked rows (import / skip / role) clear selection
 *     where appropriate
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import type { MergedPerson } from '@contractor-ops/validators';

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import type { PersonSelection } from '../../import-wizard.js';
import { useOnboardingPeople } from '../use-onboarding-people.js';

const trpcProxy = createTRPCProxy();

const samplePeople: MergedPerson[] = [
  {
    email: 'alice@example.com',
    name: 'Alice',
    status: 'new',
    sources: [{ source: 'JIRA', externalId: 'u1' }],
    conflicts: [],
  } as unknown as MergedPerson,
  {
    email: 'bob@example.com',
    name: 'Bob',
    status: 'conflict',
    sources: [{ source: 'JIRA', externalId: 'u2' }],
    conflicts: [{ field: 'name', values: [{ source: 'JIRA', value: 'Bob' }] }],
  } as unknown as MergedPerson,
  {
    email: 'carol@example.com',
    name: 'Carol',
    status: 'exists',
    sources: [{ source: 'SLACK', externalId: 'u3' }],
    conflicts: [],
  } as unknown as MergedPerson,
];

function makeHarness(initial?: {
  mergedPeople?: MergedPerson[];
  personSelections?: Map<string, PersonSelection>;
  selectedSources?: string[];
}) {
  let mergedPeople = initial?.mergedPeople ?? [];
  let personSelections = initial?.personSelections ?? new Map<string, PersonSelection>();
  const selectedSources = initial?.selectedSources ?? ['JIRA'];

  const onMergedPeopleChange = vi.fn((next: MergedPerson[]) => {
    mergedPeople = next;
  });
  const onPersonSelectionsChange = vi.fn((next: Map<string, PersonSelection>) => {
    personSelections = next;
  });

  const useHook = () =>
    useOnboardingPeople({
      selectedSources,
      mergedPeople,
      onMergedPeopleChange,
      personSelections,
      onPersonSelectionsChange,
    });

  return {
    useHook,
    getMergedPeople: () => mergedPeople,
    getPersonSelections: () => personSelections,
    onMergedPeopleChange,
    onPersonSelectionsChange,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOnboardingPeople', () => {
  it('reports isLoading when sources are selected and the query is pending', () => {
    setTRPCMock({ 'onboardingImport.fetchPeople': () => new Promise(() => undefined) });
    const { useHook } = makeHarness();
    const { result } = renderHookWithProviders(useHook);
    expect(result.current.isLoading).toBe(true);
  });

  it('exposes isEmpty when the query resolves with no people', async () => {
    setTRPCMock({ 'onboardingImport.fetchPeople': () => [] });
    const { useHook, getMergedPeople } = makeHarness();
    const { result } = renderHookWithProviders(useHook);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Side effect did not fire because data length is 0 + mergedPeople.length === 0 but no items
    expect(getMergedPeople()).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
  });

  it('exposes isError when fetchPeople rejects', async () => {
    setTRPCMock({
      'onboardingImport.fetchPeople': () => {
        throw new Error('boom');
      },
    });
    const { useHook } = makeHarness();
    const { result } = renderHookWithProviders(useHook);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('seeds merged people + default selections on first resolve', async () => {
    setTRPCMock({ 'onboardingImport.fetchPeople': () => samplePeople });
    const { useHook, onMergedPeopleChange, onPersonSelectionsChange } = makeHarness();
    renderHookWithProviders(useHook);
    await waitFor(() => expect(onMergedPeopleChange).toHaveBeenCalled());
    expect(onMergedPeopleChange).toHaveBeenCalledWith(samplePeople);
    const seededMap = onPersonSelectionsChange.mock.calls.at(-1)?.[0] as Map<
      string,
      PersonSelection
    >;
    expect(seededMap.get('alice@example.com')?.skip).toBe(false);
    expect(seededMap.get('carol@example.com')?.skip).toBe(true);
  });

  it('filters people by activeFilter and produces stable counts', async () => {
    setTRPCMock({ 'onboardingImport.fetchPeople': () => samplePeople });
    const selections = new Map<string, PersonSelection>([
      ['alice@example.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
    ]);
    const { useHook } = makeHarness({
      mergedPeople: samplePeople,
      personSelections: selections,
    });
    const { result } = renderHookWithProviders(useHook);
    expect(result.current.counts).toEqual({ new: 1, conflict: 1, exists: 1, total: 3 });
    act(() => result.current.setActiveFilter('new'));
    expect(result.current.filteredPeople.map(p => p.email)).toEqual(['alice@example.com']);
  });

  it('row + select-all check tracks checked emails (existing rows excluded)', async () => {
    setTRPCMock({ 'onboardingImport.fetchPeople': () => samplePeople });
    const { useHook } = makeHarness({
      mergedPeople: samplePeople,
      personSelections: new Map([
        ['alice@example.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
        ['bob@example.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
      ]),
    });
    const { result } = renderHookWithProviders(useHook);
    act(() => result.current.handleRowCheck('alice@example.com'));
    expect(result.current.checkedEmails.has('alice@example.com')).toBe(true);
    act(() => result.current.handleSelectAll());
    expect(result.current.checkedEmails.has('bob@example.com')).toBe(true);
    expect(result.current.checkedEmails.has('carol@example.com')).toBe(false);
  });

  it('handleSkipRow / handleRoleChange / handleResolveConflict update selections', async () => {
    setTRPCMock({ 'onboardingImport.fetchPeople': () => samplePeople });
    const selections = new Map<string, PersonSelection>([
      ['alice@example.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
      ['bob@example.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
    ]);
    const { useHook, onPersonSelectionsChange } = makeHarness({
      mergedPeople: samplePeople,
      personSelections: selections,
    });
    const { result } = renderHookWithProviders(useHook);

    act(() => result.current.handleSkipRow('alice@example.com'));
    expect(
      (onPersonSelectionsChange.mock.calls.at(-1)?.[0] as Map<string, PersonSelection>).get(
        'alice@example.com',
      )?.skip,
    ).toBe(true);

    act(() => result.current.handleRoleChange('alice@example.com', 'admin'));
    expect(
      (onPersonSelectionsChange.mock.calls.at(-1)?.[0] as Map<string, PersonSelection>).get(
        'alice@example.com',
      )?.role,
    ).toBe('admin');

    act(() => result.current.handleResolveConflict('bob@example.com', 'name', 'Robert'));
    expect(
      (onPersonSelectionsChange.mock.calls.at(-1)?.[0] as Map<string, PersonSelection>).get(
        'bob@example.com',
      )?.resolvedConflicts.name,
    ).toBe('Robert');
  });

  it('batch ops apply to all checked emails and clear the selection for import + skip', async () => {
    setTRPCMock({ 'onboardingImport.fetchPeople': () => samplePeople });
    const selections = new Map<string, PersonSelection>([
      ['alice@example.com', { role: 'readonly', skip: true, resolvedConflicts: {} }],
      ['bob@example.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
    ]);
    const { useHook, onPersonSelectionsChange } = makeHarness({
      mergedPeople: samplePeople,
      personSelections: selections,
    });
    const { result } = renderHookWithProviders(useHook);
    act(() => result.current.handleRowCheck('alice@example.com'));
    act(() => result.current.handleRowCheck('bob@example.com'));
    act(() => result.current.handleBatchImport());
    const importMap = onPersonSelectionsChange.mock.calls.at(-1)?.[0] as Map<
      string,
      PersonSelection
    >;
    expect(importMap.get('alice@example.com')?.skip).toBe(false);
    expect(importMap.get('bob@example.com')?.skip).toBe(false);
    expect(result.current.checkedEmails.size).toBe(0);

    act(() => result.current.handleRowCheck('alice@example.com'));
    act(() => result.current.handleBatchRole('admin'));
    const roleMap = onPersonSelectionsChange.mock.calls.at(-1)?.[0] as Map<string, PersonSelection>;
    expect(roleMap.get('alice@example.com')?.role).toBe('admin');
    // handleBatchRole does NOT clear checkedEmails — preserve user selection
    expect(result.current.checkedEmails.has('alice@example.com')).toBe(true);

    act(() => result.current.handleBatchSkip());
    const skipMap = onPersonSelectionsChange.mock.calls.at(-1)?.[0] as Map<string, PersonSelection>;
    expect(skipMap.get('alice@example.com')?.skip).toBe(true);
    expect(result.current.checkedEmails.size).toBe(0);
  });
});
