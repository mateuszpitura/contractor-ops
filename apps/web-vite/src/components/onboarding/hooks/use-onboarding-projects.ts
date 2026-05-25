import type { FetchProjectsOutput } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ProjectSelection } from '../import-wizard.js';

export interface UseOnboardingProjectsParams {
  selectedSources: string[];
  projects: FetchProjectsOutput;
  onProjectsChange: (projects: FetchProjectsOutput) => void;
  projectSelections: Map<string, ProjectSelection>;
  onProjectSelectionsChange: (selections: Map<string, ProjectSelection>) => void;
}

export interface UseOnboardingProjectsResult {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  handleRefetch: () => void;
  pmSources: string[];
  projects: FetchProjectsOutput;
  projectSelections: Map<string, ProjectSelection>;
  getProjectKey: (project: FetchProjectsOutput[number]) => string;
  getSelectionFor: (project: FetchProjectsOutput[number]) => ProjectSelection;
  handleSelectionChange: (key: string, selection: ProjectSelection) => void;
}

function makeDefaultSelection(project: FetchProjectsOutput[number]): ProjectSelection {
  return {
    skip: false,
    name: project.name,
    steps: project.statuses.map((s, i) => ({ name: s.name, sortOrder: i })),
  };
}

function getProjectKey(project: FetchProjectsOutput[number]): string {
  return `${project.sourceProvider}-${project.externalId}`;
}

export function useOnboardingProjects(
  params: UseOnboardingProjectsParams,
): UseOnboardingProjectsResult {
  const {
    selectedSources,
    projects,
    onProjectsChange,
    projectSelections,
    onProjectSelectionsChange,
  } = params;

  const pmSources = useMemo(
    () => selectedSources.filter(s => s === 'JIRA' || s === 'LINEAR'),
    [selectedSources],
  );

  const trpc = useTRPC();
  const projectsQuery = useQuery({
    ...trpc.onboardingImport.fetchProjects.queryOptions({
      sources: pmSources as ['JIRA' | 'LINEAR'],
    }),
    enabled: pmSources.length > 0,
  });

  useEffect(() => {
    if (projectsQuery.data && projects.length === 0) {
      const data = projectsQuery.data as FetchProjectsOutput;
      onProjectsChange(data);
      const next = new Map<string, ProjectSelection>();
      for (const project of data) {
        next.set(getProjectKey(project), makeDefaultSelection(project));
      }
      onProjectSelectionsChange(next);
    }
  }, [projectsQuery.data, projects.length, onProjectsChange, onProjectSelectionsChange]);

  const handleSelectionChange = useCallback(
    (key: string, selection: ProjectSelection) => {
      const next = new Map(projectSelections);
      next.set(key, selection);
      onProjectSelectionsChange(next);
    },
    [projectSelections, onProjectSelectionsChange],
  );

  const getSelectionFor = useCallback(
    (project: FetchProjectsOutput[number]): ProjectSelection => {
      return projectSelections.get(getProjectKey(project)) ?? makeDefaultSelection(project);
    },
    [projectSelections],
  );

  const handleRefetch = useCallback(() => {
    void projectsQuery.refetch();
  }, [projectsQuery]);

  return {
    isLoading: projectsQuery.isLoading && pmSources.length > 0,
    isError: projectsQuery.isError,
    isEmpty: projects.length === 0 && pmSources.length === 0,
    handleRefetch,
    pmSources,
    projects,
    projectSelections,
    getProjectKey,
    getSelectionFor,
    handleSelectionChange,
  };
}
