import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type UserMapping = {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  role: string;
  slackLink: {
    externalLinkId: string;
    externalId: string;
    externalUrl: string | null;
    metadata: unknown;
  } | null;
  status: 'linked' | 'unlinked';
};

export function useLinkUserPopover(userId: string, onLinked: () => void) {
  const trpc = useTRPC();
  const t = useTranslations('Settings');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const linkMutation = useMutation(
    trpc.integration.linkUser.mutationOptions({
      onSuccess: () => {
        toast.success(t('integrations.toasts.userLinked'));
        queryClient.invalidateQueries({
          queryKey: trpc.integration.listUserMappings.queryKey(),
        });
        setOpen(false);
        onLinked();
      },
      onError: () => {
        toast.error(t('integrations.toasts.linkFailed'));
      },
    }),
  );

  const handleSelect = (externalId: string) => {
    linkMutation.mutate({ userId, externalId });
  };

  return {
    t,
    open,
    setOpen,
    search,
    setSearch,
    handleSelect,
    isLinkPending: linkMutation.isPending,
  } as const;
}

export function useSlackUserMapping() {
  const trpc = useTRPC();
  const t = useTranslations('Settings');
  const queryClient = useQueryClient();

  const mappingsQuery = useQuery(trpc.integration.listUserMappings.queryOptions());
  const mappings = (mappingsQuery.data?.mappings ?? []) as UserMapping[];

  const unlinkMutation = useMutation(
    trpc.integration.unlinkUser.mutationOptions({
      onSuccess: () => {
        toast.success(t('integrations.toasts.userUnlinked'));
        queryClient.invalidateQueries({
          queryKey: trpc.integration.listUserMappings.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('integrations.toasts.linkFailed'));
      },
    }),
  );

  const totalUsers = mappings.length;
  const matchedUsers = mappings.filter(m => m.status === 'linked').length;

  const handleUnlink = (externalLinkId: string) => {
    unlinkMutation.mutate({ externalLinkId });
  };

  return {
    t,
    isLoading: mappingsQuery.isLoading,
    mappings,
    totalUsers,
    matchedUsers,
    handleUnlink,
    isUnlinkPending: unlinkMutation.isPending,
  } as const;
}
