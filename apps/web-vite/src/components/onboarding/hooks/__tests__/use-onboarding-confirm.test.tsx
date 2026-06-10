/**
 * `useOnboardingConfirm` — step 4 of the import wizard.
 *
 * Covers:
 *   - peopleToImport derivation excludes skipped + existing accounts
 *   - projectsToImport derivation excludes skipped projects
 *   - roleBreakdown aggregates per role with `readonly` default
 *   - totalSteps sums selection.steps with fallback to project.statuses
 *   - canStart is false when both lists are empty
 *   - startImport mutation emits jobId via onJobIdChange + success toast
 *   - startImport mutation emits error toast on failure
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import type { ImportedProject, MergedPerson } from '@contractor-ops/validators';

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import type { PersonSelection, ProjectSelection } from '../../import-wizard.js';
import { useOnboardingConfirm } from '../use-onboarding-confirm.js';

const trpcProxy = createTRPCProxy();

const samplePeople = [
  { email: 'a@x.com', name: 'A', status: 'new' },
  { email: 'b@x.com', name: 'B', status: 'new' },
  { email: 'c@x.com', name: 'C', status: 'exists' },
] as unknown as MergedPerson[];

const sampleProjects: ImportedProject[] = [
  {
    sourceProvider: 'JIRA',
    externalId: 'P1',
    name: 'Atlas',
    statuses: [
      { id: 's1', name: 'Todo' },
      { id: 's2', name: 'Done' },
    ],
  },
  {
    sourceProvider: 'LINEAR',
    externalId: 'L1',
    name: 'Orion',
    statuses: [{ id: 's3', name: 'Backlog' }],
  },
];

const peopleSelections = new Map<string, PersonSelection>([
  ['a@x.com', { role: 'admin', skip: false, resolvedConflicts: {} }],
  ['b@x.com', { role: 'readonly', skip: true, resolvedConflicts: {} }],
  ['c@x.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
]);

const projectSelections = new Map<string, ProjectSelection>([
  [
    'JIRA-P1',
    {
      skip: false,
      name: 'Atlas',
      steps: [
        { name: 'Todo', sortOrder: 0 },
        { name: 'Done', sortOrder: 1 },
      ],
    },
  ],
  ['LINEAR-L1', { skip: true, name: 'Orion', steps: [] }],
]);

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOnboardingConfirm', () => {
  it('derives peopleToImport without skipped + existing rows', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: peopleSelections,
        projects: sampleProjects,
        projectSelections,
        onJobIdChange: vi.fn(),
      }),
    );
    expect(result.current.peopleToImport.map(p => p.email)).toEqual(['a@x.com']);
  });

  it('derives projectsToImport without skipped projects', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: peopleSelections,
        projects: sampleProjects,
        projectSelections,
        onJobIdChange: vi.fn(),
      }),
    );
    expect(result.current.projectsToImport.map(p => p.externalId)).toEqual(['P1']);
  });

  it('groups roleBreakdown counts and totals steps from active projects only', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: peopleSelections,
        projects: sampleProjects,
        projectSelections,
        onJobIdChange: vi.fn(),
      }),
    );
    expect(result.current.roleBreakdown).toEqual([{ role: 'admin', count: 1 }]);
    expect(result.current.totalSteps).toBe(2);
  });

  it('canStart is false when both lists are empty', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: [],
        personSelections: new Map(),
        projects: [],
        projectSelections: new Map(),
        onJobIdChange: vi.fn(),
      }),
    );
    expect(result.current.canStart).toBe(false);
  });

  it('handleStartImport fires the mutation and emits jobId on success', async () => {
    const onJobIdChange = vi.fn();
    setTRPCMock({
      'onboardingImport.startImport': () => ({ jobId: 'job-123' }),
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: peopleSelections,
        projects: sampleProjects,
        projectSelections,
        onJobIdChange,
      }),
    );
    act(() => result.current.handleStartImport());
    await waitFor(() => expect(onJobIdChange).toHaveBeenCalledWith('job-123'));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('handleStartImport emits an error toast when the mutation fails', async () => {
    const onJobIdChange = vi.fn();
    setTRPCMock({
      'onboardingImport.startImport': () => {
        throw new Error('quota exceeded');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: peopleSelections,
        projects: sampleProjects,
        projectSelections,
        onJobIdChange,
      }),
    );
    act(() => result.current.handleStartImport());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe('Something went wrong. Please try again.');
    expect(onJobIdChange).not.toHaveBeenCalled();
  });

  it('isEmpty is true when all people skipped and all projects skipped', () => {
    const emptyPeople = new Map<string, PersonSelection>([
      ['a@x.com', { role: 'readonly', skip: true, resolvedConflicts: {} }],
    ]);
    const emptyProjects = new Map<string, ProjectSelection>([
      ['JIRA-P1', { skip: true, name: 'Atlas', steps: [] }],
    ]);
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: emptyPeople,
        projects: sampleProjects,
        projectSelections: emptyProjects,
        onJobIdChange: vi.fn(),
      }),
    );
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.canStart).toBe(false);
  });

  it('isError is true after startImport mutation fails', async () => {
    setTRPCMock({
      'onboardingImport.startImport': () => {
        throw new Error('network');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: peopleSelections,
        projects: sampleProjects,
        projectSelections,
        onJobIdChange: vi.fn(),
      }),
    );
    act(() => result.current.handleStartImport());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('handleRetryStart resets mutation and retries startImport', async () => {
    let calls = 0;
    const onJobIdChange = vi.fn();
    setTRPCMock({
      'onboardingImport.startImport': () => {
        calls += 1;
        if (calls === 1) throw new Error('transient');
        return { jobId: 'job-retry' };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingConfirm({
        mergedPeople: samplePeople,
        personSelections: peopleSelections,
        projects: sampleProjects,
        projectSelections,
        onJobIdChange,
      }),
    );
    act(() => result.current.handleStartImport());
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => result.current.handleRetryStart());
    await waitFor(() => expect(onJobIdChange).toHaveBeenCalledWith('job-retry'));
    expect(result.current.isError).toBe(false);
  });
});
