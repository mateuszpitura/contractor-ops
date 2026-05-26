import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../i18n/useTranslations.js';
import type { SettingsTabKey } from '../lib/settings-tabs.js';
import { useTRPC } from '../providers/trpc-provider.js';

const PIN_KIND = 'settings-tab' as const;

type PinnedView = { kind: string; key: string; pinnedAt: Date };

/**
 * Shared TanStack Query wiring for settings-tab pins.
 *
 * Both the `/settings` page and the dedicated routed sub-pages
 * (`/settings/members`, `/settings/workflow-roles`) need the same optimistic
 * toggle + sonner error semantics, so we centralise them here. The cache is
 * keyed on the same `kind: 'settings-tab'` query, so multiple consumers stay
 * in sync after any toggle.
 */
export function useSettingsTabPins() {
  const trpc = useTRPC();
  const tPin = useTranslations('Settings.pin');
  const queryClient = useQueryClient();

  const queryOpts = trpc.user.pins.list.queryOptions({ kind: PIN_KIND });
  const queryKey = trpc.user.pins.list.queryKey({ kind: PIN_KIND });
  const query = useQuery(queryOpts);

  const pinnedKeys = useMemo(() => {
    const set = new Set<SettingsTabKey>();
    for (const pin of query.data ?? []) {
      if (pin.kind === PIN_KIND) set.add(pin.key as SettingsTabKey);
    }
    return set;
  }, [query.data]);

  const mutation = useMutation(
    trpc.user.pins.toggle.mutationOptions({
      onMutate: async variables => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData<PinnedView[]>(queryKey) ?? [];
        const exists = previous.some(p => p.kind === variables.kind && p.key === variables.key);
        const next: PinnedView[] = exists
          ? previous.filter(p => !(p.kind === variables.kind && p.key === variables.key))
          : [...previous, { kind: variables.kind, key: variables.key, pinnedAt: new Date() }];
        queryClient.setQueryData(queryKey, next);
        return { previous };
      },
      onError: (_err, _variables, context) => {
        if (context && 'previous' in context) {
          queryClient.setQueryData(queryKey, context.previous);
        }
        toast.error(tPin('error'));
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey });
      },
    }),
  );

  const toggle = useCallback(
    (key: SettingsTabKey) => {
      mutation.mutate({ kind: PIN_KIND, key });
    },
    [mutation],
  );

  const isPinned = useCallback((key: SettingsTabKey) => pinnedKeys.has(key), [pinnedKeys]);

  return {
    pinnedKeys,
    isPinned,
    toggle,
    isPending: mutation.isPending,
    isLoaded: !query.isLoading,
  };
}
