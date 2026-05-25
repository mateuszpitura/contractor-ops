import type { MergedPerson } from '@contractor-ops/validators';
import type { InvitableMemberRole } from '@contractor-ops/validators/roles';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';
import type { PersonSelection } from '../import-wizard.js';

export interface UseOnboardingPeopleParams {
  selectedSources: string[];
  mergedPeople: MergedPerson[];
  onMergedPeopleChange: (people: MergedPerson[]) => void;
  personSelections: Map<string, PersonSelection>;
  onPersonSelectionsChange: (selections: Map<string, PersonSelection>) => void;
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

/**
 * Compute people counts grouped by status. Pure helper so consumers can
 * memoize without re-importing react.
 */
function deriveCounts(people: MergedPerson[]): PeopleCounts {
  const c: PeopleCounts = { new: 0, conflict: 0, exists: 0, total: people.length };
  for (const p of people) {
    if (p.status === 'new') c.new++;
    else if (p.status === 'conflict') c.conflict++;
    else if (p.status === 'exists') c.exists++;
  }
  return c;
}

export function useOnboardingPeople(params: UseOnboardingPeopleParams): UseOnboardingPeopleResult {
  const {
    selectedSources,
    mergedPeople,
    onMergedPeopleChange,
    personSelections,
    onPersonSelectionsChange,
  } = params;

  const trpc = useTRPC();
  const peopleQuery = useQuery({
    ...trpc.onboardingImport.fetchPeople.queryOptions({
      sources: selectedSources as ['JIRA' | 'LINEAR' | 'GOOGLE_WORKSPACE' | 'SLACK'],
    }),
    enabled: selectedSources.length > 0,
  });

  const [activeFilter, setActiveFilter] = useState('all');
  const [checkedEmails, setCheckedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (peopleQuery.data && mergedPeople.length === 0) {
      const data = peopleQuery.data as MergedPerson[];
      onMergedPeopleChange(data);

      const next = new Map<string, PersonSelection>();
      for (const person of data) {
        next.set(person.email, {
          role: 'readonly',
          skip: person.status === 'exists',
          resolvedConflicts: {},
        });
      }
      onPersonSelectionsChange(next);
    }
  }, [peopleQuery.data, mergedPeople.length, onMergedPeopleChange, onPersonSelectionsChange]);

  const filteredPeople = useMemo(() => {
    if (activeFilter === 'all') return mergedPeople;
    return mergedPeople.filter(p => p.status === activeFilter);
  }, [mergedPeople, activeFilter]);

  const counts = useMemo(() => deriveCounts(mergedPeople), [mergedPeople]);

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
    void peopleQuery.refetch();
  }, [peopleQuery]);

  return {
    isLoading: peopleQuery.isLoading && selectedSources.length > 0,
    isError: peopleQuery.isError,
    isEmpty: !(peopleQuery.isLoading || peopleQuery.isError) && mergedPeople.length === 0,
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
