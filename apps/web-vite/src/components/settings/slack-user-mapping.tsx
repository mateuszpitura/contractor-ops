import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { getAvatarInitials } from '../../lib/avatar-initials';
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';
import type {
  UserMapping,
  useSlackUserMapping as UseSlackUserMapping,
} from './hooks/use-slack-user-mapping.js';
import { useSlackUserMapping } from './hooks/use-slack-user-mapping.js';
import { LinkUserPopover } from './link-user-popover.js';

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
    className: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  },
};

const noopOnLinked = () => undefined;

export type SlackUserMappingProps = ReturnType<typeof UseSlackUserMapping>;

interface UnlinkButtonProps {
  externalLinkId: string;
  confirmMessage: string;
  label: string;
  disabled: boolean;
  onUnlink: (id: string) => void;
}

function UnlinkButton({
  externalLinkId,
  confirmMessage,
  label,
  disabled,
  onUnlink,
}: UnlinkButtonProps) {
  const handleClick = useCallback(() => {
    if (!window.confirm(confirmMessage)) return;
    onUnlink(externalLinkId);
  }, [confirmMessage, externalLinkId, onUnlink]);
  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={disabled}>
      {label}
    </Button>
  );
}

function getMappingStatus(mapping: UserMapping): 'auto_matched' | 'manually_linked' | 'unmatched' {
  if (!mapping.slackLink) return 'unmatched';
  const metadata = mapping.slackLink.metadata as Record<string, unknown> | null;
  if (metadata?.autoMatched) return 'auto_matched';
  return 'manually_linked';
}

export function SlackUserMappingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-1 h-4 w-80" />
      </div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function SlackUserMappingView({
  t,
  mappings,
  totalUsers,
  matchedUsers,
  handleUnlink,
  isUnlinkPending,
}: SlackUserMappingProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<UserMapping, unknown>[]>(
    () => [
      {
        id: 'user',
        accessorFn: row => row.user.name ?? row.user.email ?? '',
        header: t('integrations.userMapping.columnUser'),
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarImage src={m.user.image ?? undefined} />
                <AvatarFallback className="text-xs">
                  {getAvatarInitials(m.user.name, m.user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{m.user.name ?? 'Unknown'}</span>
            </div>
          );
        },
      },
      {
        id: 'email',
        accessorFn: row => row.user.email,
        header: t('integrations.userMapping.columnEmail'),
        cell: ({ row }) => <span className="text-sm">{row.original.user.email}</span>,
      },
      {
        id: 'slackUser',
        accessorFn: row => {
          const meta = row.slackLink?.metadata as Record<string, unknown> | null;
          return (meta?.displayName as string) ?? row.slackLink?.externalId ?? '';
        },
        header: t('integrations.userMapping.columnSlackUser'),
        cell: ({ row }) => {
          const m = row.original;
          const meta = m.slackLink?.metadata as Record<string, unknown> | null;
          const slackDisplayName = (meta?.displayName as string) ?? m.slackLink?.externalId ?? '—';
          return <span className="text-sm">{slackDisplayName}</span>;
        },
      },
      {
        id: 'status',
        accessorFn: row => getMappingStatus(row),
        header: t('integrations.userMapping.columnStatus'),
        cell: ({ row }) => {
          const status = getMappingStatus(row.original);
          const cfg = STATUS_BADGE[status];
          return (
            <Badge variant="secondary" className={cfg.className}>
              {tDynLoose(t, 'integrations.userMapping', cfg.labelKey)}
            </Badge>
          );
        },
      },
      {
        id: 'action',
        header: t('integrations.userMapping.columnAction'),
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          if (m.slackLink) {
            return (
              <UnlinkButton
                externalLinkId={m.slackLink.externalLinkId ?? ''}
                confirmMessage={t('integrations.userMapping.unlinkConfirm')}
                label={t('integrations.userMapping.unlinkUser')}
                disabled={isUnlinkPending}
                onUnlink={handleUnlink}
              />
            );
          }
          return <LinkUserPopover userId={m.userId} onLinked={noopOnLinked} />;
        },
      },
    ],
    [t, handleUnlink, isUnlinkPending],
  );

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

      <WorkbenchDataTable
        sectionClassName=""
        columns={columns}
        data={mappings}
        totalRows={mappings.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={size => {
          setPageSize(size);
          setPageIndex(0);
        }}
        constrainHeight={false}
        hideDensityToggle
        entityLabel={t('integrations.userMapping.entityLabel', { count: mappings.length })}
        emptyTitle={t('integrations.userMapping.emptyTitle')}
        emptyDescription={t('integrations.userMapping.emptyBody')}
        noResultsTitle={t('integrations.userMapping.emptyTitle')}
        noResultsDescription={t('integrations.userMapping.emptyBody')}
      />
    </div>
  );
}

export function SlackUserMapping() {
  const mapping = useSlackUserMapping();
  if (mapping.isLoading) return <SlackUserMappingSkeleton />;
  return <SlackUserMappingView {...mapping} />;
}
