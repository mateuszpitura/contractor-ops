import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const linkMutation = useResourceMutation(
    trpc.integration.linkUser.mutationOptions({
      onSuccess: () => {
        onLinked();
      },
    }),
    {
      invalidate: [trpc.integration.listUserMappings.queryKey()],
      successMessage: t('integrations.toasts.userLinked'),
      errorMessage: t('integrations.toasts.linkFailed'),
      onClose: () => setOpen(false),
    },
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

  const mappingsQuery = useQuery(trpc.integration.listUserMappings.queryOptions());
  const mappings = (mappingsQuery.data?.mappings ?? []) as UserMapping[];

  const unlinkMutation = useResourceMutation(trpc.integration.unlinkUser.mutationOptions(), {
    invalidate: [trpc.integration.listUserMappings.queryKey()],
    successMessage: t('integrations.toasts.userUnlinked'),
    errorMessage: t('integrations.toasts.linkFailed'),
  });

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
