import type { ImportedProject, MergedPerson } from '@contractor-ops/validators';
import { useCallback, useMemo } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { PersonSelection, ProjectSelection } from '../import-wizard.js';

export interface UseOnboardingConfirmParams {
  mergedPeople: MergedPerson[];
  personSelections: Map<string, PersonSelection>;
  projects: ImportedProject[];
  projectSelections: Map<string, ProjectSelection>;
  onJobIdChange: (jobId: string) => void;
}

export interface RoleBreakdownEntry {
  role: string;
  count: number;
}

export interface UseOnboardingConfirmResult {
  peopleToImport: MergedPerson[];
  projectsToImport: ImportedProject[];
  roleBreakdown: RoleBreakdownEntry[];
  totalSteps: number;
  isStarting: boolean;
  isEmpty: boolean;
  isError: boolean;
  canStart: boolean;
  handleStartImport: () => void;
  handleRetryStart: () => void;
}

export function useOnboardingConfirm(
  params: UseOnboardingConfirmParams,
): UseOnboardingConfirmResult {
  const { mergedPeople, personSelections, projects, projectSelections, onJobIdChange } = params;

  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const startImportMutation = useResourceMutation(
    trpc.onboardingImport.startImport.mutationOptions({
      onSuccess: data => {
        onJobIdChange(data.jobId);
      },
    }),
    {
      successMessage: toasts.done(),
      invalidate: [trpc.onboardingImport.pathFilter()],
    },
  );

  const peopleToImport = useMemo(
    () =>
      mergedPeople.filter(p => {
        const sel = personSelections.get(p.email);
        return sel && !sel.skip && p.status !== 'exists';
      }),
    [mergedPeople, personSelections],
  );

  const roleBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of peopleToImport) {
      const role = personSelections.get(person.email)?.role ?? 'readonly';
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([role, count]) => ({ role, count }));
  }, [peopleToImport, personSelections]);

  const projectsToImport = useMemo(
    () =>
      projects.filter(p => {
        const sel = projectSelections.get(`${p.sourceProvider}-${p.externalId}`);
        return sel && !sel.skip;
      }),
    [projects, projectSelections],
  );

  const totalSteps = useMemo(() => {
    let count = 0;
    for (const project of projectsToImport) {
      const sel = projectSelections.get(`${project.sourceProvider}-${project.externalId}`);
      count += sel?.steps.length ?? project.statuses.length;
    }
    return count;
  }, [projectsToImport, projectSelections]);

  const handleStartImport = useCallback(() => {
    const people = peopleToImport.map(p => {
      const sel = personSelections.get(p.email);
      return {
        email: p.email,
        name: sel?.resolvedConflicts?.name ?? p.name,
        role: sel?.role ?? 'readonly',
        skip: false,
      };
    });

    const projectsPayload = projectsToImport.map(p => {
      const sel = projectSelections.get(`${p.sourceProvider}-${p.externalId}`);
      return {
        sourceProvider: p.sourceProvider,
        externalId: p.externalId,
        name: sel?.name ?? p.name,
        skip: false,
        steps: sel?.steps ?? p.statuses.map((s, i) => ({ name: s.name, sortOrder: i })),
      };
    });

    startImportMutation.mutate({ people, projects: projectsPayload });
  }, [peopleToImport, personSelections, projectsToImport, projectSelections, startImportMutation]);

  const canStart = peopleToImport.length > 0 || projectsToImport.length > 0;

  const handleRetryStart = useCallback(() => {
    startImportMutation.reset();
    handleStartImport();
  }, [startImportMutation, handleStartImport]);

  return {
    peopleToImport,
    projectsToImport,
    roleBreakdown,
    totalSteps,
    isStarting: startImportMutation.isPending,
    isEmpty: !canStart,
    isError: startImportMutation.isError,
    canStart,
    handleStartImport,
    handleRetryStart,
  };
}
