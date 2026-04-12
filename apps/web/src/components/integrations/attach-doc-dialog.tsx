'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { ConfluenceIcon, NotionIcon } from './provider-icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderFilter = 'all' | 'notion' | 'confluence';

interface DocSearchResult {
  id: string;
  title: string;
  icon?: string | null;
  subtitle: string;
  url: string;
  provider: 'notion' | 'confluence';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AttachDocDialogProps {
  workflowTaskRunId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachDocDialog({ workflowTaskRunId, open, onOpenChange }: AttachDocDialogProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const queryClient = useQueryClient();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setProviderFilter('all');
    }
  }, [open]);

  // Search query
  const searchQuery = useQuery({
    ...trpc.docs.search.queryOptions({
      query: debouncedQuery,
      provider: providerFilter,
    }),
    enabled: open && debouncedQuery.length > 0,
  });

  const results = (searchQuery.data ?? []) as DocSearchResult[];

  // Attach mutation
  const attachMutation = useMutation({
    ...trpc.docs.attach.mutationOptions(),
    onSuccess: (_data, variables) => {
      const metadata = variables.metadata as { title?: string };
      toast.success(`"${metadata.title ?? 'Document'}" linked to this step`);
      void queryClient.invalidateQueries({
        queryKey: trpc.docs.list.queryKey({ workflowTaskRunId }),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to attach document');
    },
  });

  const handleSelect = (result: DocSearchResult) => {
    const externalType = result.provider === 'notion' ? 'NOTION_PAGE' : 'CONFLUENCE_PAGE';

    const metadata =
      result.provider === 'notion'
        ? {
            title: result.title,
            icon: result.icon ?? null,
            lastEditedTime: new Date().toISOString(),
          }
        : {
            title: result.title,
            spaceKey: '',
            spaceName: result.subtitle,
          };

    attachMutation.mutate({
      workflowTaskRunId,
      externalId: result.id,
      externalUrl: result.url,
      externalType: externalType as 'NOTION_PAGE' | 'CONFLUENCE_PAGE',
      metadata,
    });
  };

  const filterButtons: { value: ProviderFilter; label: string; icon?: React.ReactNode }[] = [
    { value: 'all', label: 'All' },
    { value: 'notion', label: 'Notion', icon: <NotionIcon className="h-3.5 w-3.5" /> },
    { value: 'confluence', label: 'Confluence', icon: <ConfluenceIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach Document</DialogTitle>
          <DialogDescription>Search for a page to link to this step.</DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Notion and Confluence pages..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="ps-9"
          />
        </div>

        {/* Provider filter */}
        <div className="flex gap-1">
          {filterButtons.map(btn => (
            <Button
              key={btn.value}
              variant={providerFilter === btn.value ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setProviderFilter(btn.value)}>
              {btn.icon && <span className="me-1">{btn.icon}</span>}
              {btn.label}
            </Button>
          ))}
        </div>

        {/* Results */}
        <ScrollArea className="max-h-80">
          {searchQuery.isLoading && debouncedQuery.length > 0 ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`doc-${i}`} className="flex items-center gap-2 p-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-[60%]" />
                  <Skeleton className="h-3 w-[30%] ms-auto" />
                </div>
              ))}
            </div>
          ) : debouncedQuery.length === 0 ? null : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pages found matching your search.
            </p>
          ) : (
            <div className="space-y-0.5 p-1">
              {results.map(result => {
                const ProviderIcon = result.provider === 'notion' ? NotionIcon : ConfluenceIcon;

                return (
                  <button
                    key={`${result.provider}-${result.id}`}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md p-2 text-start transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => handleSelect(result)}
                    disabled={attachMutation.isPending}>
                    <ProviderIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{result.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {result.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
