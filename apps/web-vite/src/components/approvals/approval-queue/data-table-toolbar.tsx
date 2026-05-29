import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { Loader2, Search, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useApprovalQueueBulkActions } from '../hooks/use-approval-queue-bulk-actions.js';

interface ApprovalQueueToolbarProps {
  activeStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  selectedIds: string[];
  onClearSelection: () => void;
  isLoading?: boolean;
  bulkActions: ReturnType<typeof useApprovalQueueBulkActions>;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', labelKey: 'chips.pending' },
  { value: 'OVERDUE', labelKey: 'chips.overdue' },
  { value: 'APPROVED', labelKey: 'chips.approved' },
  { value: 'REJECTED', labelKey: 'chips.rejected' },
] as const;

export function ApprovalQueueToolbar({
  activeStatuses,
  onStatusChange,
  search,
  onSearchChange,
  isSearching,
  selectedIds,
  onClearSelection,
  isLoading,
  bulkActions,
}: ApprovalQueueToolbarProps) {
  const t = useTranslations('Approvals');
  const tAria = useTranslations('Common.aria');
  const reactId = useId();

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

  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectComment, setBulkRejectComment] = useState('');

  const handleBulkApprove = () => {
    bulkActions.onBulkApprove(selectedIds);
  };

  const handleBulkReject = () => {
    if (bulkRejectComment.length >= 10) {
      bulkActions.onBulkReject(selectedIds, bulkRejectComment);
      setBulkRejectOpen(false);
      setBulkRejectComment('');
    }
  };

  const count = selectedIds.length;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={localSearch}
              disabled={isLoading}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => handleSearchInput(e.target.value)}
              className="h-9 ps-9 pe-8"
            />
            {!!isSearching && (
              <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <Popover>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="lg" disabled={isLoading}>
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
                      <span>{t(option.labelKey)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeStatuses.map(s => (
              <Badge key={s} variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
                <span className="text-xs">{tDynLoose(t, 'chips', s)}</span>
                <button
                  type="button"
                  className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => removeFilter(s)}
                  aria-label={tAria('removeFilter', {
                    label: tDynLoose(t, 'chips', s),
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

      {count > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="flex h-14 items-center gap-3 rounded-xl bg-background/95 px-4 shadow-lg backdrop-blur-sm ring-1 ring-border">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {t('bulk.selectedCount', { count })}
            </span>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <Button size="sm" onClick={handleBulkApprove} disabled={bulkActions.isBulkApproving}>
              {!!bulkActions.isBulkApproving && (
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
              disabled={bulkRejectComment.length < 10 || bulkActions.isBulkRejecting}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={handleBulkReject}>
              {!!bulkActions.isBulkRejecting && (
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
