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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { MergedPerson } from '@contractor-ops/validators';
import type { InvitableMemberRole } from '@contractor-ops/validators/roles';
import { invitableMemberRoleValues } from '@contractor-ops/validators/roles';
import { RefreshCw, Users } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { ConflictResolutionPopover } from './conflict-resolution-popover.js';
import type { PeopleCounts } from './hooks/use-onboarding-people.js';
import type { PersonSelection } from './import-wizard.js';

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

  return (
    <div className="space-y-6">
      <PeopleReviewHeader />

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
            {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
            <Select onValueChange={val => val && onBatchRole(val as InvitableMemberRole)}>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={onSelectAll}
                      aria-label={tAria('selectAll')}
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
                        <TableCell>
                          {isExisting ? (
                            <Checkbox checked={false} disabled aria-hidden="true" />
                          ) : (
                            <Checkbox
                              checked={checkedEmails.has(person.email)}
                              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                              onCheckedChange={() => onRowCheck(person.email)}
                              aria-label={`Select ${person.name}`}
                            />
                          )}
                        </TableCell>

                        <TableCell>
                          <span
                            className={`text-sm font-medium ${isSkipped ? 'line-through' : ''}`}>
                            {person.name}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="text-sm text-muted-foreground">{person.email}</span>
                        </TableCell>

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

                        <TableCell>
                          {person.status === 'new' && (
                            <Badge variant="success">{t('statusNew')}</Badge>
                          )}
                          {person.status === 'conflict' && (
                            <ConflictResolutionPopover
                              conflicts={person.conflicts ?? []}
                              resolvedConflicts={sel?.resolvedConflicts ?? {}}
                              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                              onResolve={(field, value) =>
                                onResolveConflict(person.email, field, value)
                              }
                            />
                          )}
                          {person.status === 'exists' && (
                            <Badge variant="info">{t('statusExists')}</Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <Select
                            value={sel?.role ?? 'readonly'}
                            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                            onValueChange={val =>
                              val && onRoleChange(person.email, val as InvitableMemberRole)
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

                        <TableCell>
                          {!isExisting && (
                            <Button
                              variant="ghost"
                              size="sm"
                              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                              onClick={() => onSkipRow(person.email)}
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
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClick={onRefetch}>
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
