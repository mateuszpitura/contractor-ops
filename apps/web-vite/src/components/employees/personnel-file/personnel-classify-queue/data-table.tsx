import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, CheckCircle, FileText, XCircle } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

import { tDynLoose } from '../../../../i18n/typed-keys.js';
import { useFormatter } from '../../../../i18n/useFormatter.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { getConfidenceConfig } from '../../../ocr/confidence-badge.js';
import { WorkbenchDataTable } from '../../../table-kit/workbench-data-table.js';
import type {
  ClassifyRejectReason,
  ClassifySection,
  PersonnelClassifyQueueRow,
} from '../hooks/use-personnel-classify-queue.js';
import { usePersonnelClassifyQueue } from '../hooks/use-personnel-classify-queue.js';
import type { SectionJurisdiction } from '../personnel-file-section-card.js';
import { PersonnelClassifyReviewDialog } from './personnel-classify-review-dialog.js';

const SECTION_LABEL_JURISDICTIONS: readonly SectionJurisdiction[] = ['PL', 'DE', 'UK', 'US'];

/**
 * The section-label taxonomy is defined for PL/DE/UK/US only; any other
 * jurisdiction (KSA/UAE) or a null one falls back to the UK organizational
 * groupings so the queue never renders a raw section code (mirrors the shell).
 */
export function resolveSectionJurisdiction(jurisdiction: string | null): SectionJurisdiction {
  return jurisdiction && (SECTION_LABEL_JURISDICTIONS as readonly string[]).includes(jurisdiction)
    ? (jurisdiction as SectionJurisdiction)
    : 'UK';
}

function confidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence > 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

/**
 * Confidence badge for the admin AI guess — reuses the shipped threshold →
 * colour/icon mapping but supplies a translated tooltip rather than the OCR
 * component's hardcoded English string (this surface is locale-sensitive).
 */
function ClassifyConfidenceBadge({ confidence }: { confidence: number }) {
  const t = useTranslations('PersonnelFile.classifyReview');
  const { variant, icon: Icon } = getConfidenceConfig(confidence);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge variant={variant} className="cursor-default">
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">{confidence}%</span>
            </Badge>
          }
        />
        <TooltipContent className="text-xs">
          {tDynLoose(t, 'confidence', confidenceLevel(confidence), { confidence })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AiGuessCell({ row }: { row: PersonnelClassifyQueueRow }) {
  const t = useTranslations('PersonnelFile.classifyReview');
  const tSections = useTranslations('PersonnelFile');
  if (!row.aiSectionGuess) {
    return <span className="text-sm text-muted-foreground">{t('none')}</span>;
  }
  const label = tDynLoose(
    tSections,
    `sections.${resolveSectionJurisdiction(row.jurisdiction)}.${row.aiSectionGuess}`,
    'label',
  );
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{label}</span>
      {row.aiConfidence != null && <ClassifyConfidenceBadge confidence={row.aiConfidence} />}
    </div>
  );
}

function DocumentCell({ row }: { row: PersonnelClassifyQueueRow }) {
  const t = useTranslations('PersonnelFile.classifyReview');
  return (
    <div className="flex min-w-0 items-center gap-2">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate text-sm" title={row.fileName ?? undefined}>
        {row.fileName ?? t('none')}
      </span>
    </div>
  );
}

interface RowActionsProps {
  row: PersonnelClassifyQueueRow;
  approveLabel: string;
  rejectLabel: string;
  disabled: boolean;
  onReview: (row: PersonnelClassifyQueueRow, tab: 'approve' | 'reject') => void;
}

const RowActions = memo(function RowActions({
  row,
  approveLabel,
  rejectLabel,
  disabled,
  onReview,
}: RowActionsProps) {
  const handleApprove = useCallback(() => onReview(row, 'approve'), [row, onReview]);
  const handleReject = useCallback(() => onReview(row, 'reject'), [row, onReview]);
  return (
    <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
      <Button size="sm" variant="default" disabled={disabled} onClick={handleApprove}>
        <CheckCircle className="me-1.5 size-3.5" />
        {approveLabel}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        disabled={disabled}
        onClick={handleReject}>
        <XCircle className="me-1.5 size-3.5" />
        {rejectLabel}
      </Button>
    </div>
  );
});

export interface PersonnelClassifyQueueTableProps {
  rows: PersonnelClassifyQueueRow[];
  isLoading: boolean;
  isMutating: boolean;
  onReview: (row: PersonnelClassifyQueueRow, tab: 'approve' | 'reject') => void;
  sectionClassName?: string;
}

/** Presentational admin classify-review queue — row-level Approve/Reject only. */
export function PersonnelClassifyQueueTable({
  rows,
  isLoading,
  isMutating,
  onReview,
  sectionClassName,
}: PersonnelClassifyQueueTableProps) {
  const t = useTranslations('PersonnelFile.classifyReview');
  const format = useFormatter();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const columns = useMemo<ColumnDef<PersonnelClassifyQueueRow, unknown>[]>(
    () => [
      {
        id: 'employee',
        accessorFn: row => row.workerId,
        header: t('columns.employee'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground" title={row.original.workerId}>
            {row.original.workerId}
          </span>
        ),
      },
      {
        id: 'jurisdiction',
        accessorFn: row => row.jurisdiction ?? '',
        header: t('columns.jurisdiction'),
        cell: ({ row }) =>
          row.original.jurisdiction ? (
            <Badge variant="secondary">{row.original.jurisdiction}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">{t('none')}</span>
          ),
      },
      {
        id: 'document',
        accessorFn: row => row.fileName ?? '',
        header: t('columns.document'),
        cell: ({ row }) => <DocumentCell row={row.original} />,
      },
      {
        id: 'uploaded',
        accessorFn: row => new Date(row.uploadedAt).getTime(),
        header: t('columns.uploaded'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format.dateTime(row.original.uploadedAt, 'medium')}
          </span>
        ),
      },
      {
        id: 'aiGuess',
        enableSorting: false,
        header: t('columns.aiGuess'),
        cell: ({ row }) => <AiGuessCell row={row.original} />,
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => <span className="block text-end">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            row={row.original}
            approveLabel={t('approve')}
            rejectLabel={t('reject')}
            disabled={isMutating}
            onReview={onReview}
          />
        ),
      },
    ],
    [t, format, isMutating, onReview],
  );

  const rowClassName = useCallback(() => 'group', []);

  return (
    <WorkbenchDataTable
      sectionClassName={sectionClassName}
      columns={columns}
      data={rows}
      totalRows={rows.length}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={handlePageSizeChange}
      isLoading={isLoading}
      fill
      entityLabel={t('entityLabel')}
      emptyTitle={t('empty.heading')}
      emptyDescription={t('empty.body')}
      noResultsTitle={t('empty.heading')}
      noResultsDescription={t('empty.body')}
      rowClassName={rowClassName}
    />
  );
}

/** Queue-level error block — scoped to the whole list (single-query surface). */
function ClassifyQueueError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('PersonnelFile.classifyReview');
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border text-center">
      <AlertTriangle className="size-8 text-[var(--status-warning-fg)]" aria-hidden="true" />
      <h3 className="text-sm font-medium">{t('error.heading')}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{t('error.body')}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
        {t('error.retry')}
      </Button>
    </div>
  );
}

/**
 * Stateful container for the admin classify-review queue: reads the queue via
 * the hook (the sole tRPC boundary), owns which row is under review, and wires
 * the approve/reject dialog. Renders loading/empty (via the table) and a
 * queue-level error with Retry.
 */
export function PersonnelClassifyQueuePanel({ sectionClassName }: { sectionClassName?: string }) {
  const [reviewRow, setReviewRow] = useState<PersonnelClassifyQueueRow | null>(null);
  const [reviewTab, setReviewTab] = useState<'approve' | 'reject'>('approve');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClose = useCallback(() => setDialogOpen(false), []);
  const queue = usePersonnelClassifyQueue(handleClose);

  const openReview = useCallback((row: PersonnelClassifyQueueRow, tab: 'approve' | 'reject') => {
    setReviewRow(row);
    setReviewTab(tab);
    setDialogOpen(true);
  }, []);

  const handleApprove = useCallback(
    ({ section }: { section: ClassifySection }) => {
      if (reviewRow)
        queue.approve({ personnelFileDocumentId: reviewRow.personnelFileDocumentId, section });
    },
    [queue, reviewRow],
  );

  const handleReject = useCallback(
    ({ reason, note }: { reason: ClassifyRejectReason; note?: string }) => {
      if (reviewRow)
        queue.reject({ personnelFileDocumentId: reviewRow.personnelFileDocumentId, reason, note });
    },
    [queue, reviewRow],
  );

  if (queue.isError) {
    return <ClassifyQueueError onRetry={queue.retry} />;
  }

  return (
    <>
      <PersonnelClassifyQueueTable
        rows={queue.rows}
        isLoading={queue.isLoading}
        isMutating={queue.isMutating}
        onReview={openReview}
        sectionClassName={sectionClassName}
      />
      <PersonnelClassifyReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        row={reviewRow}
        jurisdiction={resolveSectionJurisdiction(reviewRow?.jurisdiction ?? null)}
        initialTab={reviewTab}
        isPending={queue.isMutating}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </>
  );
}
