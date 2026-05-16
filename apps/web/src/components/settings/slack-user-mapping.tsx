'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAvatarInitials } from '@/lib/avatar-initials';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserMapping = {
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

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { labelKey: string; className: string }> = {
  auto_matched: {
    labelKey: 'statusAutoMatched',
    className: 'bg-emerald-500/10 text-emerald-500',
  },
  manually_linked: {
    labelKey: 'statusManuallyLinked',
    className: 'bg-blue-500/10 text-blue-500',
  },
  unmatched: {
    labelKey: 'statusUnmatched',
    className: 'bg-amber-500/10 text-amber-500',
  },
};

// ---------------------------------------------------------------------------
// Link User Popover
// ---------------------------------------------------------------------------

function LinkUserPopover({ userId, onLinked }: { userId: string; onLinked: () => void }) {
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

  function handleSelect(externalId: string) {
    linkMutation.mutate({ userId, externalId });
  }

  // For now, manual Slack user input (since we don't have a Slack users list endpoint)
  // The user types a Slack user ID and submits
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" type="button" />}>
        {t('integrations.userMapping.linkUser')}
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('integrations.userMapping.searchPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search.length > 0 ? (
                <CommandItem
                  value={search}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  disabled={linkMutation.isPending}
                  onSelect={() => handleSelect(search)}
                  className="cursor-pointer">
                  <span className="text-sm">Link as &quot;{search}&quot;</span>
                </CommandItem>
              ) : (
                <span className="text-sm text-muted-foreground p-2">
                  {t('integrations.userMapping.searchPlaceholder')}
                </span>
              )}
            </CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlackUserMapping() {
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

  // Calculate stats
  const totalUsers = mappings.length;
  const matchedUsers = mappings.filter(m => m.status === 'linked').length;

  // Loading state
  if (mappingsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1 h-4 w-80" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={`mapping-${i}`} className="flex items-center gap-4 py-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ms-auto h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function getMappingStatus(
    mapping: UserMapping,
  ): 'auto_matched' | 'manually_linked' | 'unmatched' {
    if (!mapping.slackLink) return 'unmatched';
    // For now, treat all linked users as manually linked
    // (auto-match detection would check metadata)
    const metadata = mapping.slackLink.metadata as Record<string, unknown> | null;
    if (metadata?.autoMatched) return 'auto_matched';
    return 'manually_linked';
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-base font-semibold">{t('integrations.userMapping.heading')}</h4>
        <p className="text-sm text-muted-foreground">{t('integrations.userMapping.description')}</p>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('integrations.userMapping.mappingStats', {
          matched: matchedUsers,
          total: totalUsers,
        })}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('integrations.userMapping.columnUser')}</TableHead>
            <TableHead>{t('integrations.userMapping.columnEmail')}</TableHead>
            <TableHead>{t('integrations.userMapping.columnSlackUser')}</TableHead>
            <TableHead>{t('integrations.userMapping.columnStatus')}</TableHead>
            <TableHead>{t('integrations.userMapping.columnAction')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map(mapping => {
            const status = getMappingStatus(mapping);
            const statusConfig = STATUS_BADGE[status];
            const slackMetadata = mapping.slackLink?.metadata as Record<string, unknown> | null;
            const slackDisplayName =
              (slackMetadata?.displayName as string) ?? mapping.slackLink?.externalId ?? '---';

            return (
              <TableRow key={mapping.userId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarImage src={mapping.user.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getAvatarInitials(mapping.user.name, mapping.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{mapping.user.name ?? 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{mapping.user.email}</TableCell>
                <TableCell className="text-sm">{slackDisplayName}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusConfig.className}>
                    {t(
                      `integrations.userMapping.${statusConfig.labelKey}` as Parameters<
                        typeof t
                      >[0],
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  {mapping.slackLink ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => {
                        if (!window.confirm(t('integrations.userMapping.unlinkConfirm'))) return;
                        unlinkMutation.mutate({
                          externalLinkId: mapping.slackLink?.externalLinkId ?? '',
                        });
                      }}
                      disabled={unlinkMutation.isPending}>
                      {t('integrations.userMapping.unlinkUser')}
                    </Button>
                  ) : (
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    <LinkUserPopover userId={mapping.userId} onLinked={() => undefined} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
