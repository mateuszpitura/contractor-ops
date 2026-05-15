'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalQueueToolbarProps {
  /** Currently active status filters (multi-select) */
  activeStatuses: string[];
  /** Callback to change the status filters */
  onStatusChange: (statuses: string[]) => void;
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
// Status filter options
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: 'pending', labelKey: 'chips.pending' },
  { value: 'overdue', labelKey: 'chips.overdue' },
  { value: 'approved', labelKey: 'chips.approved' },
  { value: 'rejected', labelKey: 'chips.rejected' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar for the approval queue page.
 * Contains status filter popover, search input, and floating bulk action toolbar.
 */
export function ApprovalQueueToolbar({
  activeStatuses,
  onStatusChange,
  search,
  onSearchChange,
  isSearching,
  selectedIds,
  onClearSelection,
}: ApprovalQueueToolbarProps) {
  const t = useTranslations('Approvals');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();
  const reactId = useId();

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

  // Filter toggle
  const toggleFilter = useCallback(
    (value: string) => {
      if (activeStatuses.includes(value)) {
        onStatusChange(activeStatuses.filter(s => s !== value));
      } else {
        onStatusChange([...activeStatuses, value]);
      }
    },
    [activeStatuses, onStatusChange],
  );

  const removeFilter = useCallback(
    (value: string) => {
      onStatusChange(activeStatuses.filter(s => s !== value));
    },
    [activeStatuses, onStatusChange],
  );

  const clearAllFilters = useCallback(() => {
    onStatusChange([]);
  }, [onStatusChange]);

  const activeFilterCount = activeStatuses.length;

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
        {/* Search + filter row */}
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={localSearch}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => handleSearchInput(e.target.value)}
              className="h-9 ps-9 pe-8"
            />
            {!!isSearching && (
              <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Status filter — standalone select */}
          <Popover>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="lg">
                  {t('columns.status')}
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              )}
            />
            <PopoverContent className="w-56 p-0" align="start">
              <div className="p-4 space-y-2">
                <h4 className="text-[13px] font-medium text-foreground">{t('columns.status')}</h4>
                <div className="space-y-1">
                  {STATUS_OPTIONS.map(option => (
                    <label
                      key={option.value}
                      htmlFor={`${reactId}-filter-${option.value}`}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                      <Checkbox
                        id={`${reactId}-filter-${option.value}`}
                        checked={activeStatuses.includes(option.value)}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                        onCheckedChange={() => toggleFilter(option.value)}
                      />
                      <span>{t(option.labelKey as Parameters<typeof t>[0])}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active filter badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeStatuses.map(s => (
              <Badge key={s} variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
                <span className="text-xs">{t(`chips.${s}` as Parameters<typeof t>[0])}</span>
                <button
                  type="button"
                  className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => removeFilter(s)}
                  aria-label={tAria('removeFilter', {
                    label: t(`chips.${s}` as Parameters<typeof t>[0]),
                  })}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <button
              type="button"
              className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
              onClick={clearAllFilters}>
              {t('clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* Floating bulk action toolbar */}
      {count > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="flex h-14 items-center gap-3 rounded-xl bg-background/95 px-4 shadow-lg backdrop-blur-sm ring-1 ring-border">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {t('bulk.selectedCount', { count })}
            </span>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <Button size="sm" onClick={handleBulkApprove} disabled={bulkApproveMutation.isPending}>
              {!!bulkApproveMutation.isPending && (
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
              )}
              {t('bulk.approve', { count })}
            </Button>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <Button variant="destructive" size="sm" onClick={() => setBulkRejectOpen(true)}>
              <XCircle className="me-1.5 size-4" />
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
            <label
              htmlFor={`${reactId}-bulk-reject-comment`}
              className="text-[12px] font-medium text-muted-foreground">
              {t('bulkRejectDialog.commentLabel')}
            </label>
            <Textarea
              id={`${reactId}-bulk-reject-comment`}
              value={bulkRejectComment}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
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
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                setBulkRejectOpen(false);
                setBulkRejectComment('');
              }}>
              {t('bulkRejectDialog.dismiss')}
            </Button>
            <Button
              variant="destructive"
              disabled={bulkRejectComment.length < 10 || bulkRejectMutation.isPending}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={handleBulkReject}>
              {!!bulkRejectMutation.isPending && (
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
