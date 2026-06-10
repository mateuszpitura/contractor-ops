import type { FetchPeopleSourceError, ImportedProject } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ProjectSelection } from '../import-wizard.js';

export interface UseOnboardingProjectsParams {
  selectedSources: string[];
  projects: ImportedProject[];
  onProjectsChange: (projects: ImportedProject[]) => void;
  projectSelections: Map<string, ProjectSelection>;
  onProjectSelectionsChange: (selections: Map<string, ProjectSelection>) => void;
  onStepReadinessChange?: (readiness: ProjectsStepReadiness) => void;
}

export interface ProjectsStepReadiness {
  isLoading: boolean;
  isError: boolean;
  allSourcesFailed: boolean;
  canContinue: boolean;
}

export interface UseOnboardingProjectsResult {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  allSourcesFailed: boolean;
  canContinueStep: boolean;
  sourceErrors: FetchPeopleSourceError[];
  handleRefetch: () => void;
  pmSources: string[];
  projects: ImportedProject[];
  projectSelections: Map<string, ProjectSelection>;
  getProjectKey: (project: ImportedProject) => string;
  getSelectionFor: (project: ImportedProject) => ProjectSelection;
  handleSelectionChange: (key: string, selection: ProjectSelection) => void;
}

/** Pure helper for project-import empty / all-failed routing (tested). */
export function deriveProjectImportQueryState(input: {
  isLoading: boolean;
  isError: boolean;
  projectsCount: number;
  sourceErrorsCount: number;
  pmSourcesCount: number;
}): Pick<UseOnboardingProjectsResult, 'isEmpty' | 'allSourcesFailed' | 'canContinueStep'> {
  const ready = !(input.isLoading || input.isError);
  const allSourcesFailed =
    ready && input.pmSourcesCount > 0 && input.sourceErrorsCount === input.pmSourcesCount;
  const isEmpty = ready && input.projectsCount === 0 && input.sourceErrorsCount === 0;
  const canContinueStep = ready && (input.pmSourcesCount === 0 || !allSourcesFailed);
  return {
    allSourcesFailed,
    isEmpty,
    canContinueStep,
  };
}

function makeDefaultSelection(project: ImportedProject): ProjectSelection {
  return {
    skip: false,
    name: project.name,
    steps: project.statuses.map((s, i) => ({ name: s.name, sortOrder: i })),
  };
}

function getProjectKey(project: ImportedProject): string {
  return `${project.sourceProvider}-${project.externalId}`;
}

function buildInitialProjectSelections(
  nextProjects: ImportedProject[],
): Map<string, ProjectSelection> {
  const next = new Map<string, ProjectSelection>();
  for (const project of nextProjects) {
    next.set(getProjectKey(project), makeDefaultSelection(project));
  }
  return next;
}

function mergeProjectSelections(
  nextProjects: ImportedProject[],
  previous: Map<string, ProjectSelection>,
): Map<string, ProjectSelection> {
  const next = new Map<string, ProjectSelection>();
  for (const project of nextProjects) {
    next.set(
      getProjectKey(project),
      previous.get(getProjectKey(project)) ?? makeDefaultSelection(project),
    );
  }
  return next;
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
    onStepReadinessChange,
  } = params;

  const pmSources = useMemo(
    () => selectedSources.filter(s => s === 'JIRA' || s === 'LINEAR'),
    [selectedSources],
  );

  const sourcesKey = useMemo(() => [...pmSources].sort().join(','), [pmSources]);

  const trpc = useTRPC();
  const projectsQuery = useQuery({
    ...trpc.onboardingImport.fetchProjects.queryOptions({
      sources: pmSources as ['JIRA' | 'LINEAR'],
    }),
    enabled: pmSources.length > 0,
  });

  const lastSyncedQueryKeyRef = useRef<string>('');
  const lastSourcesKeyRef = useRef(sourcesKey);

  useLayoutEffect(() => {
    if (!projectsQuery.data) return;

    const syncKey = `${sourcesKey}:${projectsQuery.dataUpdatedAt}`;
    if (lastSyncedQueryKeyRef.current === syncKey) return;
    lastSyncedQueryKeyRef.current = syncKey;

    const { projects: nextProjects } = projectsQuery.data;
    const sourcesChanged = lastSourcesKeyRef.current !== sourcesKey;
    lastSourcesKeyRef.current = sourcesKey;

    onProjectsChange(nextProjects);
    if (sourcesChanged) {
      onProjectSelectionsChange(buildInitialProjectSelections(nextProjects));
    } else {
      onProjectSelectionsChange(mergeProjectSelections(nextProjects, projectSelections));
    }
  }, [
    projectsQuery.data,
    projectsQuery.dataUpdatedAt,
    sourcesKey,
    onProjectsChange,
    onProjectSelectionsChange,
    projectSelections,
  ]);

  const handleSelectionChange = useCallback(
    (key: string, selection: ProjectSelection) => {
      const next = new Map(projectSelections);
      next.set(key, selection);
      onProjectSelectionsChange(next);
    },
    [projectSelections, onProjectSelectionsChange],
  );

  const getSelectionFor = useCallback(
    (project: ImportedProject): ProjectSelection => {
      return projectSelections.get(getProjectKey(project)) ?? makeDefaultSelection(project);
    },
    [projectSelections],
  );

  const handleRefetch = useCallback(() => {
    lastSyncedQueryKeyRef.current = '';
    void projectsQuery.refetch();
  }, [projectsQuery]);

  const queryProjects = projectsQuery.data?.projects ?? [];
  const sourceErrors = projectsQuery.data?.sourceErrors ?? [];
  const projectsForDisplay = projectsQuery.data ? queryProjects : projects;

  const isLoading = (projectsQuery.isLoading || projectsQuery.isFetching) && pmSources.length > 0;
  const { isEmpty, allSourcesFailed, canContinueStep } = deriveProjectImportQueryState({
    isLoading,
    isError: projectsQuery.isError,
    projectsCount: queryProjects.length,
    sourceErrorsCount: sourceErrors.length,
    pmSourcesCount: pmSources.length,
  });

  useEffect(() => {
    onStepReadinessChange?.({
      isLoading,
      isError: projectsQuery.isError,
      allSourcesFailed,
      canContinue: canContinueStep,
    });
  }, [onStepReadinessChange, isLoading, projectsQuery.isError, allSourcesFailed, canContinueStep]);

  return {
    isLoading,
    isError: projectsQuery.isError,
    isEmpty,
    allSourcesFailed,
    canContinueStep,
    sourceErrors,
    handleRefetch,
    pmSources,
    projects: projectsForDisplay,
    projectSelections,
    getProjectKey,
    getSelectionFor,
    handleSelectionChange,
  };
}
