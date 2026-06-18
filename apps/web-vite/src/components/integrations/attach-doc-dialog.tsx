import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Search } from 'lucide-react';
import { memo, useCallback } from 'react';
import type { DocSearchResult } from './hooks/use-attach-doc-dialog.js';
import { useAttachDocDialog } from './hooks/use-attach-doc-dialog.js';
import { ConfluenceIcon, NotionIcon } from './provider-icons.js';

const DOC_SKELETON_KEYS = ['d1', 'd2', 'd3'] as const;

export type AttachDocDialogViewProps = ReturnType<typeof useAttachDocDialog> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

interface FilterButtonProps {
  value: 'all' | 'notion' | 'confluence';
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onSelect: (value: 'all' | 'notion' | 'confluence') => void;
}

const FilterButton = memo(function FilterButton({
  value,
  label,
  icon,
  active,
  onSelect,
}: FilterButtonProps) {
  const handleClick = useCallback(() => onSelect(value), [value, onSelect]);
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-7 px-2.5 text-xs"
      onClick={handleClick}>
      {!!icon && <span className="me-1">{icon}</span>}
      {label}
    </Button>
  );
});

interface SearchResultButtonProps {
  result: DocSearchResult;
  onSelect: (result: DocSearchResult) => void;
  disabled: boolean;
}

const SearchResultButton = memo(function SearchResultButton({
  result,
  onSelect,
  disabled,
}: SearchResultButtonProps) {
  const ProviderIcon = result.provider === 'notion' ? NotionIcon : ConfluenceIcon;
  const handleClick = useCallback(() => onSelect(result), [result, onSelect]);
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md p-2 text-start transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      onClick={handleClick}
      disabled={disabled}>
      <ProviderIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="text-sm font-medium flex-1 truncate">{result.title}</span>
      <span className="text-xs text-muted-foreground shrink-0">{result.subtitle}</span>
    </button>
  );
});

export function AttachDocDialogView({
  open,
  onOpenChange,
  query,
  setQuery,
  debouncedQuery,
  providerFilter,
  setProviderFilter,
  searchQuery,
  results,
  attachMutation,
  handleSelect,
  t,
}: AttachDocDialogViewProps) {
  const filterButtons: { value: typeof providerFilter; label: string; icon?: React.ReactNode }[] = [
    { value: 'all', label: t('docs.attachDialog.filterAll') },
    {
      value: 'notion',
      label: t('docs.attachDialog.filterNotion'),
      icon: <NotionIcon className="h-3.5 w-3.5" />,
    },
    {
      value: 'confluence',
      label: t('docs.attachDialog.filterConfluence'),
      icon: <ConfluenceIcon className="h-3.5 w-3.5" />,
    },
  ];

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    [setQuery],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('docs.attachDialog.title')}</DialogTitle>
          <DialogDescription>{t('docs.attachDialog.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('docs.attachDialog.searchPlaceholder')}
              value={query}
              onChange={handleQueryChange}
              className="ps-9"
            />
          </div>

          <div className="flex gap-1">
            {filterButtons.map(btn => (
              <FilterButton
                key={btn.value}
                value={btn.value}
                label={btn.label}
                icon={btn.icon}
                active={providerFilter === btn.value}
                onSelect={setProviderFilter}
              />
            ))}
          </div>

          {searchQuery.isLoading && debouncedQuery.length > 0 ? (
            <div className="space-y-2 p-1">
              {DOC_SKELETON_KEYS.map(key => (
                <div key={key} className="flex items-center gap-2 p-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-[60%]" />
                  <Skeleton className="h-3 w-[30%] ms-auto" />
                </div>
              ))}
            </div>
          ) : debouncedQuery.length === 0 ? null : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('docs.attachDialog.noResults')}
            </p>
          ) : (
            <div className="space-y-0.5 p-1">
              {results.map(result => (
                <SearchResultButton
                  key={`${result.provider}-${result.id}`}
                  result={result}
                  onSelect={handleSelect}
                  disabled={attachMutation.isPending}
                />
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

interface AttachDocDialogProps {
  workflowTaskRunId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachDocDialog(props: AttachDocDialogProps) {
  const hookProps = useAttachDocDialog(props);
  return <AttachDocDialogView {...hookProps} {...props} />;
}
