// ---------------------------------------------------------------------------
// Classification assessment list — Phase 58 Plan 05 Task 2.
// ---------------------------------------------------------------------------
// Renders the cross-engagement assessment history for a given contractor.
//   - ≥ 1024 px → shadcn Table with Engagement | Country | Rule-set | Verdict
//     pill | Completed at | Actions columns.
//   - < 1024 px → vertical card list with the same payload stacked.
// The API already returns rows sorted draft-first then completedAt DESC
// (see classification.ts `listByContractor`).

import type { Ir35Outcome, ScheinselbstandigkeitOutcome } from '@contractor-ops/classification';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import type { AssessmentRow } from './hooks/use-classification-assessment-list.js';

export interface ClassificationAssessmentListViewProps {
  readonly contractorId: string;
  readonly rows: readonly AssessmentRow[];
}

export function ClassificationAssessmentListSkeleton() {
  return (
    <Card role="status" aria-live="polite" aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ClassificationAssessmentListEmpty() {
  const t = useTranslations('Classification');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t('list.heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
      </CardContent>
    </Card>
  );
}

function readVerdictLabel(
  row: AssessmentRow,
  t: ReturnType<typeof useTranslations>,
): { label: string; tone: 'success' | 'warning' | 'destructive' | 'neutral' } {
  if (row.status !== 'completed') {
    return { label: t('list.notCompleted'), tone: 'neutral' };
  }
  const outcome = row.outcome as Ir35Outcome | ScheinselbstandigkeitOutcome | null;
  if (!outcome) return { label: t('list.notCompleted'), tone: 'neutral' };
  if (outcome.kind === 'IR35') {
    switch (outcome.verdict) {
      case 'outside':
        return { label: t('outcome.ir35.verdict.outside'), tone: 'success' };
      case 'inside':
        return { label: t('outcome.ir35.verdict.inside'), tone: 'destructive' };
      case 'indeterminate':
        return { label: t('outcome.ir35.verdict.indeterminate'), tone: 'warning' };
    }
  }
  switch (outcome.verdict) {
    case 'green':
      return { label: t('outcome.drv.verdict.green'), tone: 'success' };
    case 'amber':
      return { label: t('outcome.drv.verdict.amber'), tone: 'warning' };
    case 'red':
      return { label: t('outcome.drv.verdict.red'), tone: 'destructive' };
  }
  // Defensive fallback — verdict outside the documented enum (legacy rows,
  // partially-saved drafts, schema drift) used to return `undefined` which
  // then crashed the table cell on `.tone` access.
  return { label: t('list.notCompleted'), tone: 'neutral' };
}

const TONE_CLASSES: Record<'success' | 'warning' | 'destructive' | 'neutral', string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'border-border bg-muted text-foreground',
};

export function ClassificationAssessmentListView(props: ClassificationAssessmentListViewProps) {
  const { contractorId, rows } = props;
  const t = useTranslations('Classification');
  const { formatDateTime } = useDateFormatter();

  const formatDate = (raw: Date | string | null): string => {
    if (!raw) return t('list.notCompleted');
    const d = raw instanceof Date ? raw : new Date(raw);
    return formatDateTime(d);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('list.heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('list.subtitle')}</p>
      </div>

      {/* Desktop table (≥ 1024 px) */}
      <div className="hidden rounded-lg border lg:block">
        <Table>
          <TableCaption className="sr-only">{t('list.caption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t('list.column.engagement')}</TableHead>
              <TableHead scope="col">{t('list.column.country')}</TableHead>
              <TableHead scope="col">{t('list.column.ruleSet')}</TableHead>
              <TableHead scope="col">{t('list.column.verdict')}</TableHead>
              <TableHead scope="col">{t('list.column.completedAt')}</TableHead>
              <TableHead scope="col" className="text-end">
                {t('list.column.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const verdict = readVerdictLabel(row, t);
              const isDraft = row.status !== 'completed';
              return (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">
                    <span className="font-medium">{row.contractorAssignmentId}</span>
                    {isDraft ? (
                      <Badge variant="secondary" className="ms-2">
                        {t('list.draftBadge')}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{row.countryCode}</TableCell>
                  <TableCell className="text-sm tabular-nums">{row.ruleSetVersion}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      data-tone={verdict.tone}
                      className={TONE_CLASSES[verdict.tone]}>
                      {verdict.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(row.completedAt)}</TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <Link
                          href={
                            isDraft
                              ? `/contractors/${contractorId}/engagements/${row.contractorAssignmentId}/classification`
                              : `/contractors/${contractorId}/engagements/${row.contractorAssignmentId}/classification/${row.id}`
                          }
                        />
                      }>
                      {isDraft ? t('list.resume') : t('list.open')}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list (< 1024 px) */}
      <ul className="flex flex-col gap-3 lg:hidden" aria-label={t('list.caption')}>
        {rows.map(row => {
          const verdict = readVerdictLabel(row, t);
          const isDraft = row.status !== 'completed';
          return (
            <li key={row.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="truncate">{row.contractorAssignmentId}</span>
                    <Badge
                      variant="outline"
                      data-tone={verdict.tone}
                      className={TONE_CLASSES[verdict.tone]}>
                      {verdict.label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <span>{t('list.column.country')}</span>
                    <span className="text-foreground">{row.countryCode}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{t('list.column.ruleSet')}</span>
                    <span className="text-foreground tabular-nums">{row.ruleSetVersion}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{t('list.column.completedAt')}</span>
                    <span className="text-foreground">{formatDate(row.completedAt)}</span>
                  </div>
                  {isDraft ? (
                    <Badge variant="secondary" className="self-start">
                      {t('list.draftBadge')}
                    </Badge>
                  ) : null}
                  <div className="mt-1 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <Link
                          href={
                            isDraft
                              ? `/contractors/${contractorId}/engagements/${row.contractorAssignmentId}/classification`
                              : `/contractors/${contractorId}/engagements/${row.contractorAssignmentId}/classification/${row.id}`
                          }
                        />
                      }>
                      {isDraft ? t('list.resume') : t('list.open')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
