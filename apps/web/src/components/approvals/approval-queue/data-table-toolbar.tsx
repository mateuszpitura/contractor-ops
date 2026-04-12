'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalQueueToolbarProps {
  /** Currently active status filter */
  activeStatus: string;
  /** Callback to change the status filter */
  onStatusChange: (status: string) => void;
  /** Current search value */
  search: string;
  /** Callback to change the search */
  onSearchChange: (value: string) => void;
  /** Whether a search is in progress */
  isSearching?: boolean;
  /** IDs of selected rows for bulk actions */
  selectedIds: string[];
  /** Callback to clear selection */
  onClearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Status chip definitions
// ---------------------------------------------------------------------------

const STATUS_CHIPS = [
  { key: 'all', labelKey: 'chips.all' },
  { key: 'pending', labelKey: 'chips.pending' },
  { key: 'overdue', labelKey: 'chips.overdue' },
  { key: 'approved', labelKey: 'chips.approved' },
  { key: 'rejected', labelKey: 'chips.rejected' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar for the approval queue page.
 * Contains status chip bar, search input, and floating bulk action toolbar.
 */
export function ApprovalQueueToolbar({
  activeStatus,
  onStatusChange,
  search,
  onSearchChange,
  isSearching,
  selectedIds,
  onClearSelection,
}: ApprovalQueueToolbarProps) {
  const t = useTranslations('Approvals');
  const queryClient = useQueryClient();

  // Debounced search
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value.length >= 2 ? value : '');
      }, 300);
    },
    [onSearchChange],
  );

  // Bulk approve mutation
  const bulkApproveMutation = useMutation(
    trpc.approval.bulkApprove.mutationOptions({
      onSuccess: data => {
        const result = data as { succeeded: number; failed: number };
        toast.success(t('toast.bulkApproved', { count: result.succeeded }));
        onClearSelection();
        void queryClient.invalidateQueries({
          queryKey: [['approval', 'listPending']],
        });
      },
      onError: () => {
        toast.error(t('errors.failedToApprove'));
      },
    }),
  );

  // Bulk reject dialog state
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectComment, setBulkRejectComment] = useState('');

  const bulkRejectMutation = useMutation(
    trpc.approval.bulkReject.mutationOptions({
      onSuccess: data => {
        const result = data as { succeeded: number; failed: number };
        toast.success(t('toast.bulkRejected', { count: result.succeeded }));
        setBulkRejectOpen(false);
        setBulkRejectComment('');
        onClearSelection();
        void queryClient.invalidateQueries({
          queryKey: [['approval', 'listPending']],
        });
      },
      onError: () => {
        toast.error(t('errors.failedToReject'));
      },
    }),
  );

  const handleBulkApprove = () => {
    bulkApproveMutation.mutate({ stepIds: selectedIds });
  };

  const handleBulkReject = () => {
    if (bulkRejectComment.length >= 10) {
      bulkRejectMutation.mutate({
        stepIds: selectedIds,
        comment: bulkRejectComment,
      });
    }
  };

  const count = selectedIds.length;

  return (
    <>
      <div className="space-y-3">
        {/* Status chip bar */}
        <div className="relative">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {STATUS_CHIPS.map(chip => {
              const isActive = activeStatus === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onStatusChange(chip.key)}
                  className="shrink-0">
                  <Badge
                    variant="secondary"
                    className={`cursor-pointer px-3 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary hover:bg-primary/15'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}>
                    {t(chip.labelKey as Parameters<typeof t>[0])}
                  </Badge>
                </button>
              );
            })}
          </div>
          {/* Fade gradient for overflow on narrow screens */}
          <div className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-l from-background to-transparent xl:hidden" />
        </div>

        {/* Search input */}
        <div className="relative max-w-sm">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={localSearch}
            onChange={e => handleSearchInput(e.target.value)}
            className="h-9 ps-9 pe-8"
          />
          {isSearching && (
            <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Floating bulk action toolbar */}
      {count > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="flex h-14 items-center gap-3 rounded-xl bg-background/95 px-4 shadow-lg backdrop-blur-sm ring-1 ring-border">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {t('bulk.selectedCount', { count })}
            </span>
            <Button size="sm" onClick={handleBulkApprove} disabled={bulkApproveMutation.isPending}>
              {bulkApproveMutation.isPending && (
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
              )}
              {t('bulk.approve', { count })}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkRejectOpen(true)}>
              {t('bulk.reject', { count })}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              {t('bulk.clear')}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk reject dialog */}
      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bulkRejectDialog.heading', { count })}</DialogTitle>
            <DialogDescription>{t('bulkRejectDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t('bulkRejectDialog.commentLabel')}
            </label>
            <Textarea
              value={bulkRejectComment}
              onChange={e => setBulkRejectComment(e.target.value)}
              placeholder={t('bulkRejectDialog.commentPlaceholder')}
              className="min-h-[100px]"
            />
            {bulkRejectComment.length > 0 && bulkRejectComment.length < 10 && (
              <p className="text-[12px] text-destructive">{t('rejectPopover.minChars')}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setBulkRejectOpen(false);
                setBulkRejectComment('');
              }}>
              {t('bulkRejectDialog.dismiss')}
            </Button>
            <Button
              variant="destructive"
              disabled={bulkRejectComment.length < 10 || bulkRejectMutation.isPending}
              onClick={handleBulkReject}>
              {bulkRejectMutation.isPending && (
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
              )}
              {t('bulkRejectDialog.confirm', { count })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
