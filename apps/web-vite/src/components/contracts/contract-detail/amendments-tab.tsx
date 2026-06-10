import type { AtelierEmptyStateAction } from '@contractor-ops/ui';
import { AtelierEmptyState, ContractsIllustration, SectionLabel } from '@contractor-ops/ui';
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@contractor-ops/ui/components/reui/timeline';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormLayoutClassName,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { ChevronDown, ChevronRight, FileText, Plus } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import {
  useAddAmendmentDialog,
  useContractAmendmentsTab,
} from '../hooks/use-contract-amendments-tab.js';

type Amendment = {
  id: string;
  amendmentNumber: string | null;
  title: string;
  effectiveDate: string | Date;
  description: string | null;
  changesSummaryJson: unknown;
  createdAt: string | Date;
};

type AmendmentContract = {
  id: string;
  title: string | null;
  startDate: string | Date | null;
  createdAt: string | Date;
  amendments: Amendment[];
};

type Tab = ReturnType<typeof useContractAmendmentsTab>;
type AddDialog = ReturnType<typeof useAddAmendmentDialog>;

type AmendmentsTabProps = {
  contract: AmendmentContract;
  tab: Tab;
  addDialog: AddDialog;
};

function renderAmendmentsEmptyAction(
  action: AtelierEmptyStateAction,
  variant: 'primary' | 'secondary',
) {
  const Icon = action.icon;
  return (
    <Button variant={variant === 'secondary' ? 'outline' : 'default'} onClick={action.onClick}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {action.label}
    </Button>
  );
}

export function AddAmendmentDialog({
  open,
  onOpenChange,
  addDialog,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addDialog: AddDialog;
}) {
  const id = useId();
  const t = useTranslations('ContractDetail.amendments');

  const {
    description,
    effectiveDate,
    handleSubmit,
    isPending,
    setDescription,
    setEffectiveDate,
    setTitle,
    title,
  } = addDialog;

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
    [setTitle],
  );
  const handleEffectiveDateChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setEffectiveDate(e.target.value),
    [setEffectiveDate],
  );
  const handleDescriptionChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value),
    [setDescription],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            {t('addTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={`${id}-amendment-title`} className="text-sm font-medium">
                {t('fields.title')}
              </label>
              <input
                id={`${id}-amendment-title`}
                type="text"
                value={title}
                onChange={handleTitleChange}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t('fields.titlePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-amendment-effective-date`} className="text-sm font-medium">
                {t('fields.effectiveDate')}
              </label>
              <input
                id={`${id}-amendment-effective-date`}
                type="date"
                value={effectiveDate}
                onChange={handleEffectiveDateChange}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-amendment-description`} className="text-sm font-medium">
                {t('fields.description')}
              </label>
              <textarea
                id={`${id}-amendment-description`}
                value={description}
                onChange={handleDescriptionChange}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder={t('fields.descriptionPlaceholder')}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !effectiveDate}>
              {isPending ? t('adding') : t('add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TimelineNode({ amendment, step }: { amendment: Amendment; step: number }) {
  const t = useTranslations('ContractDetail.amendments');
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), []);

  return (
    <TimelineItem step={step} className="group/timeline-item flex gap-4 pb-6">
      <TimelineIndicator className="size-3 bg-primary group-data-[state=inactive]/timeline-item:bg-muted-foreground/40" />
      <TimelineSeparator className="bg-border" />
      <div className="min-w-0 flex-1">
        <TimelineHeader>
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex items-center gap-2 text-start">
            {expanded ? (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <TimelineTitle className="text-sm font-medium">
                {amendment.title}
                {!!amendment.amendmentNumber && (
                  <span className="ms-2 text-xs text-muted-foreground">
                    {amendment.amendmentNumber}
                  </span>
                )}
              </TimelineTitle>
              <p className="text-xs text-muted-foreground">
                {t('effective', { date: formatDate(amendment.effectiveDate) })}
              </p>
            </div>
          </button>
        </TimelineHeader>

        {!!expanded && (
          <TimelineContent className="mt-3 ms-5 space-y-2 rounded-md border bg-muted/50 p-3">
            {!!amendment.description && <p className="text-sm">{amendment.description}</p>}
            <p className="text-xs text-muted-foreground">
              {t('created', { date: formatDate(amendment.createdAt) })}
            </p>
          </TimelineContent>
        )}
      </div>
    </TimelineItem>
  );
}

function AmendmentsTabHeader({ openDialog }: { openDialog: () => void }) {
  const t = useTranslations('ContractDetail.amendments');
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <SectionLabel icon={FileText}>{t('heading')}</SectionLabel>
      </div>
      <Button size="sm" onClick={openDialog}>
        <Plus className="me-1.5 size-3.5" />
        {t('addCta')}
      </Button>
    </div>
  );
}

export function AmendmentsTabEmpty({ tab }: { tab: Tab }) {
  const t = useTranslations('ContractDetail.amendments');
  return (
    <div className="space-y-6">
      <AmendmentsTabHeader openDialog={tab.openDialog} />
      <AtelierEmptyState
        variant="subview"
        illustration={ContractsIllustration}
        heading={t('empty.title')}
        body={t('empty.description')}
        primaryAction={{
          label: t('addCta'),
          onClick: tab.openDialog,
          icon: Plus,
        }}
        renderAction={renderAmendmentsEmptyAction}
      />
    </div>
  );
}

export function AmendmentsTabTimeline({
  contract,
  amendments,
  tab,
}: {
  contract: AmendmentContract;
  amendments: Amendment[];
  tab: Tab;
}) {
  const t = useTranslations('ContractDetail.amendments');
  return (
    <div className="space-y-6">
      <AmendmentsTabHeader openDialog={tab.openDialog} />
      <Timeline orientation="vertical" value={amendments.length} className="ms-1">
        {amendments.map((amendment, i) => (
          <TimelineNode key={amendment.id} amendment={amendment} step={i + 1} />
        ))}
        <TimelineItem step={amendments.length + 1} className="flex gap-4">
          <TimelineIndicator className="size-2 bg-muted-foreground/30" />
          <div className="min-w-0 flex-1 pb-2">
            <p className="text-sm text-muted-foreground">{t('originalContract')}</p>
            {!!contract.startDate && (
              <p className="text-xs text-muted-foreground/70">{formatDate(contract.startDate)}</p>
            )}
          </div>
        </TimelineItem>
      </Timeline>
    </div>
  );
}

export function sortAmendmentsNewestFirst(amendments: Amendment[]): Amendment[] {
  return [...amendments].sort((a, b) => {
    const dateA = typeof a.effectiveDate === 'string' ? new Date(a.effectiveDate) : a.effectiveDate;
    const dateB = typeof b.effectiveDate === 'string' ? new Date(b.effectiveDate) : b.effectiveDate;
    return dateB.getTime() - dateA.getTime();
  });
}

// Backward-compat wrapper retained for tests that still exercise the
// branch-in-view shape. New container code branches directly via
// AmendmentsTabEmpty / AmendmentsTabTimeline + AddAmendmentDialog siblings.
export function AmendmentsTab({ contract, tab, addDialog }: AmendmentsTabProps) {
  const amendments = (contract.amendments ?? []) as Amendment[];
  const sorted = sortAmendmentsNewestFirst(amendments);
  return (
    <>
      {sorted.length === 0 ? (
        <AmendmentsTabEmpty tab={tab} />
      ) : (
        <AmendmentsTabTimeline contract={contract} amendments={sorted} tab={tab} />
      )}
      <AddAmendmentDialog
        open={tab.dialogOpen}
        onOpenChange={tab.setDialogOpen}
        addDialog={addDialog}
      />
    </>
  );
}

type AmendmentsTabWiredProps = {
  contract: AmendmentsTabProps['contract'];
};

export function AmendmentsTabWired({ contract }: AmendmentsTabWiredProps) {
  const tab = useContractAmendmentsTab();
  const addDialog = useAddAmendmentDialog(contract.id, tab.dialogOpen, tab.setDialogOpen);

  return <AmendmentsTab contract={contract} tab={tab} addDialog={addDialog} />;
}
