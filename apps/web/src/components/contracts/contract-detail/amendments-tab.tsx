'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Amendment = {
  id: string;
  amendmentNumber: string;
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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Add amendment dialog
// ---------------------------------------------------------------------------

function AddAmendmentDialog({
  contractId,
  open,
  onOpenChange,
}: {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('ContractDetail.amendments');
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation(
    trpc.contract.createAmendment.mutationOptions({
      onSuccess: () => {
        toast.success(t('addSuccess'));
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.contract.listAmendments.queryKey(),
        });
        onOpenChange(false);
        setTitle('');
        setEffectiveDate('');
        setDescription('');
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || t('addError'));
      },
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(title.trim() && effectiveDate)) return;

    createMutation.mutate({
      contractId,
      title: title.trim(),
      effectiveDate: new Date(effectiveDate).toISOString(),
      description: description.trim() || undefined,
      changesSummaryJson: {},
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addTitle')}</DialogTitle>
        </DialogHeader>
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="amendment-title" className="text-sm font-medium">
              {t('fields.title')}
            </label>
            <input
              id="amendment-title"
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
            <label htmlFor="amendment-effective-date" className="text-sm font-medium">
              {t('fields.effectiveDate')}
            </label>
            <input
              id="amendment-effective-date"
              type="date"
              value={effectiveDate}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setEffectiveDate(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="amendment-description" className="text-sm font-medium">
              {t('fields.description')}
            </label>
            <textarea
              id="amendment-description"
              value={description}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setDescription(e.target.value)}
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder={t('fields.descriptionPlaceholder')}
            />
          </div>
          <DialogFooter>
            // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !title.trim() || !effectiveDate}>
              {createMutation.isPending ? t('adding') : t('add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Timeline node
// ---------------------------------------------------------------------------

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
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={`shrink-0 rounded-full ${
            isFirst ? 'size-3 bg-primary' : 'size-2 bg-muted-foreground/40'
          }`}
        />
        {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border" />}
      </div>

      {/* Content */}
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AmendmentsTab({ contract }: AmendmentsTabProps) {
  const t = useTranslations('ContractDetail.amendments');
  const [dialogOpen, setDialogOpen] = useState(false);

  const amendments = (contract.amendments ?? []) as Amendment[];

  // Sort newest first
  const sorted = [...amendments].sort((a, b) => {
    const dateA = typeof a.effectiveDate === 'string' ? new Date(a.effectiveDate) : a.effectiveDate;
    const dateB = typeof b.effectiveDate === 'string' ? new Date(b.effectiveDate) : b.effectiveDate;
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="space-y-6">
      {/* Header with CTA */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('heading')}</h3>
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="me-1.5 size-3.5" />
          {t('addCta')}
        </Button>
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
          <FileText className="size-8 text-muted-foreground/50" />
          <h4 className="text-sm font-medium text-muted-foreground">{t('empty.title')}</h4>
          <p className="max-w-sm text-sm text-muted-foreground">{t('empty.description')}</p>
        </div>
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
          {/* Original contract at bottom */}
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

      {/* Add amendment dialog */}
      <AddAmendmentDialog contractId={contract.id} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
