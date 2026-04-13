'use client';

import type { MergedPerson } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/trpc/init';
import { ConflictResolutionPopover } from './conflict-resolution-popover';
import type { PersonSelection } from './import-wizard';

// ---------------------------------------------------------------------------
// Role options
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'readonly', label: 'Read Only' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'contractor_manager', label: 'Contractor Manager' },
  { value: 'approver', label: 'Approver' },
];

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, string> = {
  JIRA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  LINEAR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  GOOGLE_WORKSPACE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  SLACK: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
};

const SOURCE_LABELS: Record<string, string> = {
  JIRA: 'Jira',
  LINEAR: 'Linear',
  GOOGLE_WORKSPACE: 'GWS',
  SLACK: 'Slack',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeopleReviewStepProps {
  selectedSources: string[];
  mergedPeople: MergedPerson[];
  onMergedPeopleChange: (people: MergedPerson[]) => void;
  personSelections: Map<string, PersonSelection>;
  onPersonSelectionsChange: (selections: Map<string, PersonSelection>) => void;
}

// ---------------------------------------------------------------------------
// PeopleReviewStep
// ---------------------------------------------------------------------------

export function PeopleReviewStep({
  selectedSources,
  mergedPeople,
  onMergedPeopleChange,
  personSelections,
  onPersonSelectionsChange,
}: PeopleReviewStepProps) {
  const t = useTranslations('OnboardingImport.step2');
  const [activeFilter, setActiveFilter] = useState('all');
  const [checkedEmails, setCheckedEmails] = useState<Set<string>>(new Set());

  // Fetch people from API
  const peopleQuery = useQuery({
    ...trpc.onboardingImport.fetchPeople.queryOptions({
      sources: selectedSources as ['JIRA' | 'LINEAR' | 'GOOGLE_WORKSPACE' | 'SLACK'],
    }),
    enabled: selectedSources.length > 0,
  });

  // Initialize selections when data arrives
  useEffect(() => {
    if (peopleQuery.data && mergedPeople.length === 0) {
      const data = peopleQuery.data as MergedPerson[];
      onMergedPeopleChange(data);

      const newSelections = new Map<string, PersonSelection>();
      for (const person of data) {
        newSelections.set(person.email, {
          role: person.status === 'exists' ? 'member' : 'member',
          skip: person.status === 'exists',
          resolvedConflicts: {},
        });
      }
      onPersonSelectionsChange(newSelections);
    }
  }, [peopleQuery.data, mergedPeople.length, onMergedPeopleChange, onPersonSelectionsChange]);

  // Filtered people
  const filteredPeople = useMemo(() => {
    if (activeFilter === 'all') return mergedPeople;
    return mergedPeople.filter(p => p.status === activeFilter);
  }, [mergedPeople, activeFilter]);

  // Counts
  const counts = useMemo(() => {
    const c = { new: 0, conflict: 0, exists: 0, total: mergedPeople.length };
    for (const p of mergedPeople) {
      if (p.status === 'new') c.new++;
      else if (p.status === 'conflict') c.conflict++;
      else if (p.status === 'exists') c.exists++;
    }
    return c;
  }, [mergedPeople]);

  // Selection helpers
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

  // Person selection updaters
  const updateSelection = useCallback(
    (email: string, update: Partial<PersonSelection>) => {
      const next = new Map(personSelections);
      const current = next.get(email) ?? {
        role: 'member',
        skip: false,
        resolvedConflicts: {},
      };
      next.set(email, { ...current, ...update });
      onPersonSelectionsChange(next);
    },
    [personSelections, onPersonSelectionsChange],
  );

  const handleSkipRow = useCallback(
    (email: string) => {
      updateSelection(email, { skip: true });
    },
    [updateSelection],
  );

  const handleRoleChange = useCallback(
    (email: string, role: string) => {
      updateSelection(email, { role });
    },
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

  // Batch actions
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
    (role: string) => {
      const next = new Map(personSelections);
      for (const email of checkedEmails) {
        const current = next.get(email);
        if (current) next.set(email, { ...current, role });
      }
      onPersonSelectionsChange(next);
    },
    [checkedEmails, personSelections, onPersonSelectionsChange],
  );

  // Loading state
  if (peopleQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`skel-${i}`} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (mergedPeople.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Users className="size-12 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-lg font-semibold">{t('emptyHeading')}</h3>
        <p className="max-w-md text-center text-sm text-muted-foreground">{t('emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Summary bar */}
      <Card>
        <CardContent
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2"
          role="status"
          aria-live="polite">
          <span className="text-sm">
            <span className="font-semibold text-green-600">{counts.new}</span> {t('summaryNew')}
          </span>
          <span className="text-muted-foreground" aria-hidden="true">
            |
          </span>
          <span className="text-sm">
            <span className="font-semibold text-amber-600">{counts.conflict}</span>{' '}
            {t('summaryConflicts')}
          </span>
          <span className="text-muted-foreground" aria-hidden="true">
            |
          </span>
          <span className="text-sm">
            <span className="font-semibold text-blue-600">{counts.exists}</span>{' '}
            {t('summaryExisting')}
          </span>
          <span className="text-muted-foreground" aria-hidden="true">
            |
          </span>
          <span className="text-sm">
            <span className="font-semibold">{counts.total}</span> {t('summaryTotal')}
          </span>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <Tabs value={activeFilter} onValueChange={setActiveFilter}>
        <TabsList variant="line">
          <TabsTrigger value="all">{t('filterAll')}</TabsTrigger>
          <TabsTrigger value="new">{t('filterNew')}</TabsTrigger>
          <TabsTrigger value="conflict">{t('filterConflicts')}</TabsTrigger>
          <TabsTrigger value="exists">{t('filterExisting')}</TabsTrigger>
        </TabsList>

        {/* Batch toolbar */}
        {checkedEmails.size > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
            aria-live="polite">
            <span className="text-sm font-medium">{checkedEmails.size} selected</span>
            <Button size="sm" onClick={handleBatchImport}>
              {t('batchImport')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleBatchSkip}>
              {t('batchSkip')}
            </Button>
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
            <Select onValueChange={val => val && handleBatchRole(val as string)}>
              <SelectTrigger size="sm" className="w-36">
                <SelectValue>{t('batchRole')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Table content (shared across all tabs via filtering) */}
        <TabsContent value={activeFilter}>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>{t('columnName')}</TableHead>
                  <TableHead>{t('columnEmail')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('columnSources')}</TableHead>
                  <TableHead>{t('columnStatus')}</TableHead>
                  <TableHead>{t('columnRole')}</TableHead>
                  <TableHead>{t('columnAction')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeople.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {t('emptyHeading')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPeople.map(person => {
                    const sel = personSelections.get(person.email);
                    const isSkipped = sel?.skip ?? false;
                    const isExisting = person.status === 'exists';

                    return (
                      <TableRow
                        key={person.email}
                        className={isSkipped || isExisting ? 'opacity-50' : ''}>
                        {/* Checkbox */}
                        <TableCell>
                          {isExisting ? (
                            <Checkbox checked={false} disabled aria-hidden="true" />
                          ) : (
                            <Checkbox
                              checked={checkedEmails.has(person.email)}
                              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                              onCheckedChange={() => handleRowCheck(person.email)}
                              aria-label={`Select ${person.name}`}
                            />
                          )}
                        </TableCell>

                        {/* Name */}
                        <TableCell>
                          <span
                            className={`text-sm font-medium ${isSkipped ? 'line-through' : ''}`}>
                            {person.name}
                          </span>
                        </TableCell>

                        {/* Email */}
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{person.email}</span>
                        </TableCell>

                        {/* Sources (hidden on mobile) */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {person.sources.map(s => (
                              <Badge
                                key={s.source}
                                variant="secondary"
                                className={`text-[10px] ${SOURCE_COLORS[s.source] ?? ''}`}>
                                {SOURCE_LABELS[s.source] ?? s.source}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {person.status === 'new' && <Badge variant="success">New</Badge>}
                          {person.status === 'conflict' && (
                            <ConflictResolutionPopover
                              conflicts={person.conflicts ?? []}
                              resolvedConflicts={sel?.resolvedConflicts ?? {}}
                              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                              onResolve={(field, value) =>
                                handleResolveConflict(person.email, field, value)
                              }
                            />
                          )}
                          {person.status === 'exists' && <Badge variant="info">Exists</Badge>}
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          <Select
                            value={sel?.role ?? 'member'}
                            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                            onValueChange={val =>
                              val && handleRoleChange(person.email, val as string)
                            }
                            disabled={isExisting || isSkipped}>
                            <SelectTrigger size="sm" className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map(r => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Action */}
                        <TableCell>
                          {!isExisting && (
                            <Button
                              variant="ghost"
                              size="sm"
                              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                              onClick={() => handleSkipRow(person.email)}
                              disabled={isSkipped}>
                              {t('skipRow')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
