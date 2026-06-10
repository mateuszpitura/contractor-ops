import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { FetchPeopleSourceError, MergedPerson } from '@contractor-ops/validators';
import type { InvitableMemberRole } from '@contractor-ops/validators/roles';
import { invitableMemberRoleValues } from '@contractor-ops/validators/roles';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';
import { ConflictResolutionPopover } from './conflict-resolution-popover.js';
import type { PeopleCounts, PeopleStepReadiness } from './hooks/use-onboarding-people.js';
import { useOnboardingPeople } from './hooks/use-onboarding-people.js';
import type { PersonSelection } from './import-wizard.js';
import { PeopleReviewSkeleton } from './onboarding-skeletons.js';

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

/** Strip registry `[PROVIDER]` prefix before showing errors in UI. */
export function formatSourceErrorMessage(error: string): string {
  return error.replace(/^\[[A-Z_]+\]\s*/, '');
}

function isInvitableMemberRole(value: string): value is InvitableMemberRole {
  return (invitableMemberRoleValues as readonly string[]).includes(value);
}

export interface PeopleReviewStepProps {
  filteredPeople: MergedPerson[];
  counts: PeopleCounts;
  activeFilter: string;
  setActiveFilter: (value: string) => void;
  personSelections: Map<string, PersonSelection>;
  checkedEmails: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onRowCheck: (email: string) => void;
  onSkipRow: (email: string) => void;
  onRoleChange: (email: string, role: InvitableMemberRole) => void;
  onResolveConflict: (email: string, field: string, value: string) => void;
  onBatchImport: () => void;
  onBatchSkip: () => void;
  onBatchRole: (role: InvitableMemberRole) => void;
  sourceErrors?: FetchPeopleSourceError[];
}

interface RoleOption {
  value: InvitableMemberRole;
  label: string;
}

interface PersonSelectCellProps {
  person: MergedPerson;
  checked: boolean;
  isExisting: boolean;
  onRowCheck: (email: string) => void;
}

function PersonSelectCell({ person, checked, isExisting, onRowCheck }: PersonSelectCellProps) {
  const handleCheck = useCallback(() => onRowCheck(person.email), [person.email, onRowCheck]);
  if (isExisting) {
    return <Checkbox checked={false} disabled aria-hidden="true" />;
  }
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={handleCheck}
      aria-label={`Select ${person.name}`}
    />
  );
}

interface PersonStatusCellProps {
  person: MergedPerson;
  selection: PersonSelection | undefined;
  labels: { statusNew: string; statusExists: string };
  onResolveConflict: (email: string, field: string, value: string) => void;
}

function PersonStatusCell({ person, selection, labels, onResolveConflict }: PersonStatusCellProps) {
  const handleResolve = useCallback(
    (field: string, value: string) => onResolveConflict(person.email, field, value),
    [person.email, onResolveConflict],
  );
  if (person.status === 'new') return <Badge variant="success">{labels.statusNew}</Badge>;
  if (person.status === 'conflict') {
    return (
      <ConflictResolutionPopover
        conflicts={person.conflicts ?? []}
        resolvedConflicts={selection?.resolvedConflicts ?? {}}
        onResolve={handleResolve}
      />
    );
  }
  return <Badge variant="info">{labels.statusExists}</Badge>;
}

interface PersonRoleCellProps {
  person: MergedPerson;
  selection: PersonSelection | undefined;
  roleOptions: RoleOption[];
  disabled: boolean;
  onRoleChange: (email: string, role: InvitableMemberRole) => void;
}

function PersonRoleCell({
  person,
  selection,
  roleOptions,
  disabled,
  onRoleChange,
}: PersonRoleCellProps) {
  const handleRoleChange = useCallback(
    (val: string | null) => {
      if (val && isInvitableMemberRole(val)) onRoleChange(person.email, val);
    },
    [person.email, onRoleChange],
  );
  return (
    <Select
      value={selection?.role ?? 'readonly'}
      onValueChange={handleRoleChange}
      disabled={disabled}>
      <SelectTrigger size="sm" className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleOptions.map(r => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface PersonSkipCellProps {
  email: string;
  isSkipped: boolean;
  skipLabel: string;
  onSkipRow: (email: string) => void;
}

function PersonSkipCell({ email, isSkipped, skipLabel, onSkipRow }: PersonSkipCellProps) {
  const handleSkip = useCallback(() => onSkipRow(email), [email, onSkipRow]);
  return (
    <Button variant="ghost" size="sm" onClick={handleSkip} disabled={isSkipped}>
      {skipLabel}
    </Button>
  );
}

export function PeopleReviewStep({
  filteredPeople,
  counts,
  activeFilter,
  setActiveFilter,
  personSelections,
  checkedEmails,
  allSelected,
  someSelected,
  onSelectAll,
  onRowCheck,
  onSkipRow,
  onRoleChange,
  onResolveConflict,
  onBatchImport,
  onBatchSkip,
  onBatchRole,
  sourceErrors,
}: PeopleReviewStepProps) {
  const t = useTranslations('OnboardingImport.step2');
  const tRoles = useTranslations('Users.roles');
  const tAria = useTranslations('Common.aria');

  const ROLE_OPTIONS = invitableMemberRoleValues.map(value => {
    const roleKeyMap: Record<InvitableMemberRole, Parameters<typeof tRoles>[0]> = {
      admin: 'admin',
      finance_admin: 'financeAdmin',
      ops_manager: 'opsManager',
      team_manager: 'teamManager',
      legal_compliance_viewer: 'legalComplianceViewer',
      it_admin: 'itAdmin',
      external_accountant: 'externalAccountant',
      readonly: 'readonly',
    };
    return { value, label: tRoles(roleKeyMap[value]) };
  });

  const handleBatchRoleChange = useCallback(
    (val: string | null) => {
      if (val && isInvitableMemberRole(val)) onBatchRole(val);
    },
    [onBatchRole],
  );

  const rowLabels = {
    statusNew: t('statusNew'),
    statusExists: t('statusExists'),
    skipRow: t('skipRow'),
  };

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<MergedPerson, unknown>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onCheckedChange={onSelectAll}
            aria-label={tAria('selectAll')}
          />
        ),
        enableSorting: false,
        size: 40,
        cell: ({ row }) => (
          <PersonSelectCell
            person={row.original}
            checked={checkedEmails.has(row.original.email)}
            isExisting={row.original.status === 'exists'}
            onRowCheck={onRowCheck}
          />
        ),
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: t('columnName'),
        cell: ({ row }) => {
          const isSkipped = personSelections.get(row.original.email)?.skip ?? false;
          return (
            <span className={`text-sm font-medium ${isSkipped ? 'line-through' : ''}`}>
              {row.original.name}
            </span>
          );
        },
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: t('columnEmail'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        id: 'sources',
        header: t('columnSources'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="hidden flex-wrap gap-1 md:flex">
            {row.original.sources.map(s => (
              <Badge
                key={s.source}
                variant="secondary"
                className={`text-[10px] ${SOURCE_COLORS[s.source] ?? ''}`}>
                {SOURCE_LABELS[s.source] ?? s.source}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('columnStatus'),
        cell: ({ row }) => (
          <PersonStatusCell
            person={row.original}
            selection={personSelections.get(row.original.email)}
            labels={{ statusNew: rowLabels.statusNew, statusExists: rowLabels.statusExists }}
            onResolveConflict={onResolveConflict}
          />
        ),
      },
      {
        id: 'role',
        header: t('columnRole'),
        enableSorting: false,
        cell: ({ row }) => {
          const selection = personSelections.get(row.original.email);
          const isSkipped = selection?.skip ?? false;
          const isExisting = row.original.status === 'exists';
          return (
            <PersonRoleCell
              person={row.original}
              selection={selection}
              roleOptions={ROLE_OPTIONS}
              disabled={isExisting || isSkipped}
              onRoleChange={onRoleChange}
            />
          );
        },
      },
      {
        id: 'action',
        header: t('columnAction'),
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.status === 'exists') return null;
          const selection = personSelections.get(row.original.email);
          return (
            <PersonSkipCell
              email={row.original.email}
              isSkipped={selection?.skip ?? false}
              skipLabel={rowLabels.skipRow}
              onSkipRow={onSkipRow}
            />
          );
        },
      },
    ],
    [
      t,
      tAria,
      allSelected,
      someSelected,
      onSelectAll,
      checkedEmails,
      onRowCheck,
      personSelections,
      rowLabels.statusNew,
      rowLabels.statusExists,
      rowLabels.skipRow,
      onResolveConflict,
      ROLE_OPTIONS,
      onRoleChange,
      onSkipRow,
    ],
  );

  const rowClassName = useCallback(
    (row: MergedPerson) => {
      const selection = personSelections.get(row.email);
      const isSkipped = selection?.skip ?? false;
      const isExisting = row.status === 'exists';
      return isSkipped || isExisting ? 'opacity-50' : '';
    },
    [personSelections],
  );

  return (
    <div className="space-y-6">
      <PeopleReviewHeader />

      {sourceErrors && sourceErrors.length > 0 && (
        <PeopleReviewPartialSourceErrors sourceErrors={sourceErrors} />
      )}

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

      <Tabs value={activeFilter} onValueChange={setActiveFilter}>
        <TabsList>
          <TabsTrigger value="all">{t('filterAll')}</TabsTrigger>
          <TabsTrigger value="new">{t('filterNew')}</TabsTrigger>
          <TabsTrigger value="conflict">{t('filterConflicts')}</TabsTrigger>
          <TabsTrigger value="exists">{t('filterExisting')}</TabsTrigger>
        </TabsList>

        {checkedEmails.size > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
            aria-live="polite">
            <span className="text-sm font-medium">
              {t('selectedCount', { count: checkedEmails.size })}
            </span>
            <Button size="sm" onClick={onBatchImport}>
              {t('batchImport')}
            </Button>
            <Button size="sm" variant="outline" onClick={onBatchSkip}>
              {t('batchSkip')}
            </Button>
            <Select onValueChange={handleBatchRoleChange}>
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

        <TabsContent value={activeFilter}>
          <WorkbenchDataTable
            sectionClassName=""
            columns={columns}
            data={filteredPeople}
            totalRows={filteredPeople.length}
            clientPagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={size => {
              setPageSize(size);
              setPageIndex(0);
            }}
            constrainHeight={false}
            hideDensityToggle
            hideChrome
            getRowId={row => row.email}
            rowClassName={rowClassName}
            entityLabel={t('summaryTotal')}
            emptyTitle={t('emptyHeading')}
            emptyDescription={t('emptyBody')}
            noResultsTitle={t('emptyHeading')}
            noResultsDescription={t('emptyBody')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function PeopleReviewHeader() {
  const t = useTranslations('OnboardingImport.step2');
  return (
    <div>
      <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('heading')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
    </div>
  );
}

export interface PeopleReviewErrorProps {
  onRefetch: () => void;
}

export function PeopleReviewError({ onRefetch }: PeopleReviewErrorProps) {
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRefetch}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {tErr('retry')}
      </Button>
    </div>
  );
}

export function PeopleReviewEmpty() {
  const t = useTranslations('OnboardingImport.step2');
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <Users className="size-12 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-lg font-semibold">{t('emptyHeading')}</h3>
      <p className="max-w-md text-center text-sm text-muted-foreground">{t('emptyBody')}</p>
    </div>
  );
}

export interface PeopleReviewPartialSourceErrorsProps {
  sourceErrors: FetchPeopleSourceError[];
  copyNamespace?: 'OnboardingImport.step2' | 'OnboardingImport.step3';
}

export function PeopleReviewPartialSourceErrors({
  sourceErrors,
  copyNamespace = 'OnboardingImport.step2',
}: PeopleReviewPartialSourceErrorsProps) {
  const t = useTranslations(copyNamespace);

  return (
    <Alert
      variant="default"
      role="status"
      className="border-amber-300/50 bg-amber-500/5"
      data-testid="people-review-partial-source-errors">
      <AlertTriangle aria-hidden="true" className="size-5 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-700 dark:text-amber-400">
        {t('partialSourceErrorsTitle')}
      </AlertTitle>
      <AlertDescription className="mt-2 text-sm text-muted-foreground">
        <p>{t('partialSourceErrorsBody')}</p>
        <ul className="mt-2 list-disc space-y-1 ps-4">
          {sourceErrors.map(err => (
            <li key={`${err.source}-${err.code}`}>
              <span className="font-medium text-foreground">
                {SOURCE_LABELS[err.source] ?? err.source}
              </span>
              : {formatSourceErrorMessage(err.error)}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export interface PeopleReviewSourceErrorsProps {
  sourceErrors: FetchPeopleSourceError[];
  onRefetch: () => void;
}

export function PeopleReviewSourceErrors({
  sourceErrors,
  onRefetch,
}: PeopleReviewSourceErrorsProps) {
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <ul className="max-w-lg space-y-2 text-sm text-muted-foreground">
        {sourceErrors.map(err => (
          <li key={`${err.source}-${err.code}`}>
            <span className="font-medium text-foreground">
              {SOURCE_LABELS[err.source] ?? err.source}
            </span>
            : {formatSourceErrorMessage(err.error)}
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRefetch}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {tErr('retry')}
      </Button>
    </div>
  );
}

type PeopleReviewStepContainerProps = {
  selectedSources: string[];
  mergedPeople: MergedPerson[];
  onMergedPeopleChange: (people: MergedPerson[]) => void;
  personSelections: Map<string, PersonSelection>;
  onPersonSelectionsChange: (selections: Map<string, PersonSelection>) => void;
  onStepReadinessChange?: (readiness: PeopleStepReadiness) => void;
};

export function PeopleReviewStepContainer(props: PeopleReviewStepContainerProps) {
  const section = useOnboardingPeople(props);

  if (section.isLoading) {
    return (
      <div className="space-y-6">
        <PeopleReviewHeader />
        <PeopleReviewSkeleton />
      </div>
    );
  }

  if (section.isError) {
    return (
      <div className="space-y-6">
        <PeopleReviewHeader />
        <PeopleReviewError onRefetch={section.handleRefetch} />
      </div>
    );
  }

  if (section.allSourcesFailed) {
    return (
      <div className="space-y-6">
        <PeopleReviewHeader />
        <PeopleReviewSourceErrors
          sourceErrors={section.sourceErrors}
          onRefetch={section.handleRefetch}
        />
      </div>
    );
  }

  if (section.isEmpty) {
    return (
      <div className="space-y-6">
        <PeopleReviewHeader />
        <PeopleReviewEmpty />
      </div>
    );
  }

  return (
    <PeopleReviewStep
      filteredPeople={section.filteredPeople}
      counts={section.counts}
      activeFilter={section.activeFilter}
      setActiveFilter={section.setActiveFilter}
      personSelections={props.personSelections}
      checkedEmails={section.checkedEmails}
      allSelected={section.allSelected}
      someSelected={section.someSelected}
      onSelectAll={section.handleSelectAll}
      onRowCheck={section.handleRowCheck}
      onSkipRow={section.handleSkipRow}
      onRoleChange={section.handleRoleChange}
      onResolveConflict={section.handleResolveConflict}
      onBatchImport={section.handleBatchImport}
      onBatchSkip={section.handleBatchSkip}
      onBatchRole={section.handleBatchRole}
      sourceErrors={section.sourceErrors.length > 0 ? section.sourceErrors : undefined}
    />
  );
}
