import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { getAvatarInitials } from '../../lib/avatar-initials';
import type { UserMapping, useSlackUserMapping } from './hooks/use-slack-user-mapping.js';
import { LinkUserPopoverContainer } from './link-user-popover-container.js';

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

export type SlackUserMappingProps = ReturnType<typeof useSlackUserMapping>;

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

export function SlackUserMapping({
  t,
  mappings,
  totalUsers,
  matchedUsers,
  handleUnlink,
  isUnlinkPending,
}: SlackUserMappingProps) {
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
                        handleUnlink(mapping.slackLink?.externalLinkId ?? '');
                      }}
                      disabled={isUnlinkPending}>
                      {t('integrations.userMapping.unlinkUser')}
                    </Button>
                  ) : (
                    <LinkUserPopoverContainer userId={mapping.userId} onLinked={() => undefined} />
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
