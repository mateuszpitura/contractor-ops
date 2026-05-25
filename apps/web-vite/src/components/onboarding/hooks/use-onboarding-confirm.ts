import type { FetchProjectsOutput, MergedPerson } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';
import type { PersonSelection, ProjectSelection } from '../import-wizard.js';

export interface UseOnboardingConfirmParams {
  mergedPeople: MergedPerson[];
  personSelections: Map<string, PersonSelection>;
  projects: FetchProjectsOutput;
  projectSelections: Map<string, ProjectSelection>;
  onJobIdChange: (jobId: string) => void;
}

export interface RoleBreakdownEntry {
  role: string;
  count: number;
}

export interface UseOnboardingConfirmResult {
  peopleToImport: MergedPerson[];
  projectsToImport: FetchProjectsOutput;
  roleBreakdown: RoleBreakdownEntry[];
  totalSteps: number;
  isStarting: boolean;
  canStart: boolean;
  handleStartImport: () => void;
}

export function useOnboardingConfirm(
  params: UseOnboardingConfirmParams,
): UseOnboardingConfirmResult {
  const { mergedPeople, personSelections, projects, projectSelections, onJobIdChange } = params;

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const startImportMutation = useMutation({
    ...trpc.onboardingImport.startImport.mutationOptions(),
    onSuccess: data => {
      onJobIdChange(data.jobId);
      toast.success('Done.');
      void queryClient.invalidateQueries(trpc.onboardingImport.pathFilter());
    },
    onError: err => toast.error(err.message),
  });

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
        name: p.name,
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

  return {
    peopleToImport,
    projectsToImport,
    roleBreakdown,
    totalSteps,
    isStarting: startImportMutation.isPending,
    canStart: peopleToImport.length > 0 || projectsToImport.length > 0,
    handleStartImport,
  };
}
