import { AtelierEmptyState, ContractsIllustration, SectionLabel } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { ChevronDown, ChevronRight, FileText, Plus } from 'lucide-react';
import { useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import type {
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

type AmendmentsTabProps = {
  contract: {
    id: string;
    title: string | null;
    startDate: string | Date | null;
    createdAt: string | Date;
    amendments: Amendment[];
  };
  tab: ReturnType<typeof useContractAmendmentsTab>;
  addDialog: ReturnType<typeof useAddAmendmentDialog>;
};

function AddAmendmentDialog({
  open,
  onOpenChange,
  addDialog,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addDialog: ReturnType<typeof useAddAmendmentDialog>;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            {t('addTitle')}
          </DialogTitle>
        </DialogHeader>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={`${id}-amendment-title`} className="text-sm font-medium">
              {t('fields.title')}
            </label>
            <input
              id={`${id}-amendment-title`}
              type="text"
              value={title}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setTitle(e.target.value)}
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
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setEffectiveDate(e.target.value)}
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
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setDescription(e.target.value)}
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder={t('fields.descriptionPlaceholder')}
            />
          </div>
          <DialogFooter>
            {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

function TimelineNode({
  amendment,
  isFirst,
  isLast,
}: {
  amendment: Amendment;
  isFirst: boolean;
  isLast: boolean;
}) {
  const t = useTranslations('ContractDetail.amendments');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`shrink-0 rounded-full ${
            isFirst ? 'size-3 bg-primary' : 'size-2 bg-muted-foreground/40'
          }`}
        />
        {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border" />}
      </div>

      <div className="min-w-0 flex-1 pb-6">
        <button
          type="button"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-start">
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {amendment.title}
              <span className="ms-2 text-xs text-muted-foreground">
                {amendment.amendmentNumber}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('effective', {
                date: formatDate(amendment.effectiveDate),
              })}
            </p>
          </div>
        </button>

        {!!expanded && (
          <div className="mt-3 ms-5 space-y-2 rounded-md border bg-muted/50 p-3">
            {!!amendment.description && <p className="text-sm">{amendment.description}</p>}
            <p className="text-xs text-muted-foreground">
              {t('created', { date: formatDate(amendment.createdAt) })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AmendmentsTab({ contract, tab, addDialog }: AmendmentsTabProps) {
  const t = useTranslations('ContractDetail.amendments');

  const amendments = (contract.amendments ?? []) as Amendment[];

  const sorted = [...amendments].sort((a, b) => {
    const dateA = typeof a.effectiveDate === 'string' ? new Date(a.effectiveDate) : a.effectiveDate;
    const dateB = typeof b.effectiveDate === 'string' ? new Date(b.effectiveDate) : b.effectiveDate;
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={FileText}>{t('heading')}</SectionLabel>
        </div>
        <Button size="sm" onClick={tab.openDialog}>
          <Plus className="me-1.5 size-3.5" />
          {t('addCta')}
        </Button>
      </div>
      {sorted.length === 0 ? (
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
          renderAction={(action, variant) => {
            const Icon = action.icon;
            return (
              <Button
                variant={variant === 'secondary' ? 'outline' : 'default'}
                onClick={action.onClick}>
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {action.label}
              </Button>
            );
          }}
        />
      ) : (
        <div className="ms-1">
          {sorted.map((amendment, i) => (
            <TimelineNode
              key={amendment.id}
              amendment={amendment}
              isFirst={i === 0}
              isLast={false}
            />
          ))}
          <div className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <div className="size-2 shrink-0 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <p className="text-sm text-muted-foreground">{t('originalContract')}</p>
              {!!contract.startDate && (
                <p className="text-xs text-muted-foreground/70">{formatDate(contract.startDate)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <AddAmendmentDialog
        open={tab.dialogOpen}
        onOpenChange={tab.setDialogOpen}
        addDialog={addDialog}
      />
    </div>
  );
}
