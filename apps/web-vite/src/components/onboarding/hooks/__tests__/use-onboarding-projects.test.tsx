/**
 * `useOnboardingProjects` — step 3 of the import wizard.
 *
 * Covers:
 *   - PM-source filtering (only JIRA / LINEAR feed `fetchProjects`)
 *   - loading / error / empty (no pm sources) states
 *   - first-resolve side effect persists fetched projects + seeds default
 *     selections keyed by `${provider}-${externalId}`
 *   - handleSelectionChange writes into the selections map
 *   - getSelectionFor falls back to the default selection when key missing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import type { FetchProjectsOutput } from '@contractor-ops/validators';

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import type { ProjectSelection } from '../../import-wizard.js';
import { useOnboardingProjects } from '../use-onboarding-projects.js';

const trpcProxy = createTRPCProxy();

const sampleProjects: FetchProjectsOutput = [
  {
    sourceProvider: 'JIRA',
    externalId: 'P1',
    name: 'Atlas',
    statuses: [
      { name: 'Todo', externalId: 's1' },
      { name: 'Done', externalId: 's2' },
    ],
  } as unknown as FetchProjectsOutput[number],
];

function makeHarness(initial?: {
  projects?: FetchProjectsOutput;
  selections?: Map<string, ProjectSelection>;
  selectedSources?: string[];
}) {
  let projects = initial?.projects ?? [];
  let projectSelections = initial?.selections ?? new Map<string, ProjectSelection>();
  const selectedSources = initial?.selectedSources ?? ['JIRA', 'GOOGLE_WORKSPACE'];

  const onProjectsChange = vi.fn((next: FetchProjectsOutput) => {
    projects = next;
  });
  const onProjectSelectionsChange = vi.fn((next: Map<string, ProjectSelection>) => {
    projectSelections = next;
  });

  return {
    useHook: () =>
      useOnboardingProjects({
        selectedSources,
        projects,
        onProjectsChange,
        projectSelections,
        onProjectSelectionsChange,
      }),
    onProjectsChange,
    onProjectSelectionsChange,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOnboardingProjects', () => {
  it('reports isLoading when JIRA/LINEAR sources are present and query pending', () => {
    setTRPCMock({ 'onboardingImport.fetchProjects': () => new Promise(() => undefined) });
    const { useHook } = makeHarness();
    const { result } = renderHookWithProviders(useHook);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.pmSources).toEqual(['JIRA']);
  });

  it('isEmpty + no query fires when no PM sources are selected', async () => {
    setTRPCMock({
      'onboardingImport.fetchProjects': () => {
        throw new Error('should-not-fire');
      },
    });
    const { useHook } = makeHarness({ selectedSources: ['GOOGLE_WORKSPACE'] });
    const { result } = renderHookWithProviders(useHook);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.projects).toEqual([]);
  });

  it('isError surfaces when fetchProjects fails', async () => {
    setTRPCMock({
      'onboardingImport.fetchProjects': () => {
        throw new Error('boom');
      },
    });
    const { useHook } = makeHarness();
    const { result } = renderHookWithProviders(useHook);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('seeds projects + default selections on first resolve', async () => {
    setTRPCMock({ 'onboardingImport.fetchProjects': () => sampleProjects });
    const { useHook, onProjectsChange, onProjectSelectionsChange } = makeHarness();
    renderHookWithProviders(useHook);
    await waitFor(() => expect(onProjectsChange).toHaveBeenCalled());
    expect(onProjectsChange).toHaveBeenCalledWith(sampleProjects);
    const seeded = onProjectSelectionsChange.mock.calls.at(-1)?.[0] as Map<
      string,
      ProjectSelection
    >;
    const sel = seeded.get('JIRA-P1');
    expect(sel?.skip).toBe(false);
    expect(sel?.name).toBe('Atlas');
    expect(sel?.steps.map(s => s.name)).toEqual(['Todo', 'Done']);
  });

  it('handleSelectionChange writes a new selection into the map', async () => {
    setTRPCMock({ 'onboardingImport.fetchProjects': () => sampleProjects });
    const startMap = new Map<string, ProjectSelection>([
      ['JIRA-P1', { skip: false, name: 'Atlas', steps: [] }],
    ]);
    const { useHook, onProjectSelectionsChange } = makeHarness({
      projects: sampleProjects,
      selections: startMap,
    });
    const { result } = renderHookWithProviders(useHook);
    act(() => {
      result.current.handleSelectionChange('JIRA-P1', {
        skip: true,
        name: 'Renamed',
        steps: [],
      });
    });
    const final = onProjectSelectionsChange.mock.calls.at(-1)?.[0] as Map<string, ProjectSelection>;
    expect(final.get('JIRA-P1')).toEqual({ skip: true, name: 'Renamed', steps: [] });
  });

  it('getSelectionFor returns the default when the key is missing', async () => {
    setTRPCMock({ 'onboardingImport.fetchProjects': () => sampleProjects });
    const { useHook } = makeHarness({ projects: sampleProjects });
    const { result } = renderHookWithProviders(useHook);
    const sel = result.current.getSelectionFor(sampleProjects[0]);
    expect(sel.name).toBe('Atlas');
    expect(sel.skip).toBe(false);
    expect(sel.steps).toHaveLength(2);
  });
});
