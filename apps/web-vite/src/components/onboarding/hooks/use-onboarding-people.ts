import type { FetchPeopleSourceError, MergedPerson } from '@contractor-ops/validators';
import type { InvitableMemberRole } from '@contractor-ops/validators/roles';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';
import type { PersonSelection } from '../import-wizard.js';

export interface UseOnboardingPeopleParams {
  selectedSources: string[];
  mergedPeople: MergedPerson[];
  onMergedPeopleChange: (people: MergedPerson[]) => void;
  personSelections: Map<string, PersonSelection>;
  onPersonSelectionsChange: (selections: Map<string, PersonSelection>) => void;
  onStepReadinessChange?: (readiness: PeopleStepReadiness) => void;
}

export interface PeopleStepReadiness {
  isLoading: boolean;
  isError: boolean;
  allSourcesFailed: boolean;
  canContinue: boolean;
}

export interface PeopleCounts {
  new: number;
  conflict: number;
  exists: number;
  total: number;
}

export interface UseOnboardingPeopleResult {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  allSourcesFailed: boolean;
  canContinueStep: boolean;
  sourceErrors: FetchPeopleSourceError[];
  handleRefetch: () => void;
  filteredPeople: MergedPerson[];
  counts: PeopleCounts;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  checkedEmails: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  handleSelectAll: () => void;
  handleRowCheck: (email: string) => void;
  handleSkipRow: (email: string) => void;
  handleRoleChange: (email: string, role: InvitableMemberRole) => void;
  handleResolveConflict: (email: string, field: string, value: string) => void;
  handleBatchImport: () => void;
  handleBatchSkip: () => void;
  handleBatchRole: (role: InvitableMemberRole) => void;
}

/** Pure helper for people-review empty / all-failed routing (tested). */
export function derivePeopleReviewQueryState(input: {
  isLoading: boolean;
  isError: boolean;
  peopleCount: number;
  sourceErrorsCount: number;
  selectedSourcesCount: number;
}): Pick<UseOnboardingPeopleResult, 'isEmpty' | 'allSourcesFailed' | 'canContinueStep'> {
  const ready = !input.isLoading && !input.isError;
  const allSourcesFailed =
    ready &&
    input.selectedSourcesCount > 0 &&
    input.sourceErrorsCount === input.selectedSourcesCount;
  const isEmpty = ready && input.peopleCount === 0 && input.sourceErrorsCount === 0;
  return {
    allSourcesFailed,
    isEmpty,
    canContinueStep: ready && !allSourcesFailed,
  };
}

function deriveCounts(people: MergedPerson[]): PeopleCounts {
  const c: PeopleCounts = { new: 0, conflict: 0, exists: 0, total: people.length };
  for (const p of people) {
    if (p.status === 'new') c.new++;
    else if (p.status === 'conflict') c.conflict++;
    else if (p.status === 'exists') c.exists++;
  }
  return c;
}

function defaultSelectionFor(person: MergedPerson): PersonSelection {
  return {
    role: 'readonly',
    skip: person.status === 'exists',
    resolvedConflicts: {},
  };
}

function buildInitialSelections(people: MergedPerson[]): Map<string, PersonSelection> {
  const next = new Map<string, PersonSelection>();
  for (const person of people) {
    next.set(person.email, defaultSelectionFor(person));
  }
  return next;
}

function mergeSelections(
  people: MergedPerson[],
  previous: Map<string, PersonSelection>,
): Map<string, PersonSelection> {
  const next = new Map<string, PersonSelection>();
  for (const person of people) {
    next.set(person.email, previous.get(person.email) ?? defaultSelectionFor(person));
  }
  return next;
}

export function useOnboardingPeople(params: UseOnboardingPeopleParams): UseOnboardingPeopleResult {
  const {
    selectedSources,
    mergedPeople,
    onMergedPeopleChange,
    personSelections,
    onPersonSelectionsChange,
    onStepReadinessChange,
  } = params;

  const trpc = useTRPC();
  const sourcesKey = useMemo(
    () => [...selectedSources].sort().join(','),
    [selectedSources],
  );

  const peopleQuery = useQuery({
    ...trpc.onboardingImport.fetchPeople.queryOptions({
      sources: selectedSources as ['JIRA' | 'LINEAR' | 'GOOGLE_WORKSPACE' | 'SLACK'],
    }),
    enabled: selectedSources.length > 0,
  });

  const [activeFilter, setActiveFilter] = useState('all');
  const [checkedEmails, setCheckedEmails] = useState<Set<string>>(new Set());
  const lastSyncedQueryKeyRef = useRef<string>('');
  const lastSourcesKeyRef = useRef(sourcesKey);

  useLayoutEffect(() => {
    if (!peopleQuery.data) return;

    const syncKey = `${sourcesKey}:${peopleQuery.dataUpdatedAt}`;
    if (lastSyncedQueryKeyRef.current === syncKey) return;
    lastSyncedQueryKeyRef.current = syncKey;

    const { people } = peopleQuery.data;
    const sourcesChanged = lastSourcesKeyRef.current !== sourcesKey;
    lastSourcesKeyRef.current = sourcesKey;

    onMergedPeopleChange(people);
    if (sourcesChanged) {
      onPersonSelectionsChange(buildInitialSelections(people));
      setCheckedEmails(new Set());
    } else {
      onPersonSelectionsChange(mergeSelections(people, personSelections));
      setCheckedEmails(new Set());
    }
  }, [
    peopleQuery.data,
    peopleQuery.dataUpdatedAt,
    sourcesKey,
    onMergedPeopleChange,
    onPersonSelectionsChange,
    personSelections,
  ]);

  const queryPeople = peopleQuery.data?.people ?? [];
  const sourceErrors = peopleQuery.data?.sourceErrors ?? [];
  const peopleForDisplay = peopleQuery.data ? queryPeople : mergedPeople;

  const filteredPeople = useMemo(() => {
    if (activeFilter === 'all') return peopleForDisplay;
    return peopleForDisplay.filter(p => p.status === activeFilter);
  }, [peopleForDisplay, activeFilter]);

  const counts = useMemo(() => deriveCounts(peopleForDisplay), [peopleForDisplay]);

  const selectableFiltered = useMemo(
    () => filteredPeople.filter(p => p.status !== 'exists'),
    [filteredPeople],
  );

  const allSelected =
    selectableFiltered.length > 0 && selectableFiltered.every(p => checkedEmails.has(p.email));
  const someSelected = !allSelected && selectableFiltered.some(p => checkedEmails.has(p.email));

  const handleSelectAll = useCallback(() => {
    const next = new Set(checkedEmails);
    if (allSelected) {
      for (const p of selectableFiltered) next.delete(p.email);
    } else {
      for (const p of selectableFiltered) next.add(p.email);
    }
    setCheckedEmails(next);
  }, [allSelected, selectableFiltered, checkedEmails]);

  const handleRowCheck = useCallback(
    (email: string) => {
      const next = new Set(checkedEmails);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      setCheckedEmails(next);
    },
    [checkedEmails],
  );

  const updateSelection = useCallback(
    (email: string, update: Partial<PersonSelection>) => {
      const next = new Map(personSelections);
      const current = next.get(email) ?? {
        role: 'readonly' as InvitableMemberRole,
        skip: false,
        resolvedConflicts: {},
      };
      next.set(email, { ...current, ...update });
      onPersonSelectionsChange(next);
    },
    [personSelections, onPersonSelectionsChange],
  );

  const handleSkipRow = useCallback(
    (email: string) => updateSelection(email, { skip: true }),
    [updateSelection],
  );

  const handleRoleChange = useCallback(
    (email: string, role: InvitableMemberRole) => updateSelection(email, { role }),
    [updateSelection],
  );

  const handleResolveConflict = useCallback(
    (email: string, field: string, value: string) => {
      const current = personSelections.get(email);
      const resolved = { ...(current?.resolvedConflicts ?? {}), [field]: value };
      updateSelection(email, { resolvedConflicts: resolved });
    },
    [personSelections, updateSelection],
  );

  const handleBatchImport = useCallback(() => {
    const next = new Map(personSelections);
    for (const email of checkedEmails) {
      const current = next.get(email);
      if (current) next.set(email, { ...current, skip: false });
    }
    onPersonSelectionsChange(next);
    setCheckedEmails(new Set());
  }, [checkedEmails, personSelections, onPersonSelectionsChange]);

  const handleBatchSkip = useCallback(() => {
    const next = new Map(personSelections);
    for (const email of checkedEmails) {
      const current = next.get(email);
      if (current) next.set(email, { ...current, skip: true });
    }
    onPersonSelectionsChange(next);
    setCheckedEmails(new Set());
  }, [checkedEmails, personSelections, onPersonSelectionsChange]);

  const handleBatchRole = useCallback(
    (role: InvitableMemberRole) => {
      const next = new Map(personSelections);
      for (const email of checkedEmails) {
        const current = next.get(email);
        if (current) next.set(email, { ...current, role });
      }
      onPersonSelectionsChange(next);
    },
    [checkedEmails, personSelections, onPersonSelectionsChange],
  );

  const handleRefetch = useCallback(() => {
    lastSyncedQueryKeyRef.current = '';
    void peopleQuery.refetch();
  }, [peopleQuery]);

  const isLoading =
    (peopleQuery.isLoading || peopleQuery.isFetching) && selectedSources.length > 0;
  const { isEmpty, allSourcesFailed, canContinueStep } = derivePeopleReviewQueryState({
    isLoading,
    isError: peopleQuery.isError,
    peopleCount: queryPeople.length,
    sourceErrorsCount: sourceErrors.length,
    selectedSourcesCount: selectedSources.length,
  });

  useEffect(() => {
    onStepReadinessChange?.({
      isLoading,
      isError: peopleQuery.isError,
      allSourcesFailed,
      canContinue: canContinueStep,
    });
  }, [
    onStepReadinessChange,
    isLoading,
    peopleQuery.isError,
    allSourcesFailed,
    canContinueStep,
  ]);

  return {
    isLoading,
    isError: peopleQuery.isError,
    isEmpty,
    allSourcesFailed,
    canContinueStep,
    sourceErrors,
    handleRefetch,
    filteredPeople,
    counts,
    activeFilter,
    setActiveFilter,
    checkedEmails,
    allSelected,
    someSelected,
    handleSelectAll,
    handleRowCheck,
    handleSkipRow,
    handleRoleChange,
    handleResolveConflict,
    handleBatchImport,
    handleBatchSkip,
    handleBatchRole,
  };
}
