import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type ProviderFilter = 'all' | 'notion' | 'confluence';

export interface DocSearchResult {
  id: string;
  title: string;
  icon?: string | null;
  subtitle: string;
  url: string;
  provider: 'notion' | 'confluence';
}

export interface UseAttachDocDialogParams {
  workflowTaskRunId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useAttachDocDialog({
  workflowTaskRunId,
  open,
  onOpenChange,
}: UseAttachDocDialogParams) {
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const queryClient = useQueryClient();
  const t = useTranslations('Integrations');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setProviderFilter('all');
    }
  }, [open]);

  const searchQuery = useQuery({
    ...trpc.docs.search.queryOptions({
      query: debouncedQuery,
      provider: providerFilter,
    }),
    enabled: open && debouncedQuery.length > 0,
  });

  const results = (searchQuery.data ?? []) as DocSearchResult[];

  const attachMutation = useMutation({
    ...trpc.docs.attach.mutationOptions(),
    onSuccess: (_data, variables) => {
      const metadata = variables.metadata as { title?: string };
      toast.success(
        t('docs.attachDialog.toast.linked', {
          title: metadata.title ?? t('docs.section.untitled'),
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: trpc.docs.list.queryKey({ workflowTaskRunId }),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('docs.attachDialog.toast.attachFailed'));
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

  return {
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
  } as const;
}
