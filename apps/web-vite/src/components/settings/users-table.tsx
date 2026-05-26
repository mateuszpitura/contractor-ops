import type { MemberStatusInput } from '@contractor-ops/ui';
import {
  AtelierStatusPill,
  AtelierTableShell,
  statusToVariant,
  TableChrome,
} from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { ShieldCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { DeactivateDialogContainer } from './deactivate-dialog-container.js';
import type { useUsersTable } from './hooks/use-users-table.js';
import {
  assignableRoles,
  displayName,
  displayStatus,
  roleBadgeColors,
} from './hooks/use-users-table.js';
import { UserConsentSheetContainer } from './user-consent-sheet-container.js';

export type UsersTableProps = ReturnType<typeof useUsersTable>;

const KNOWN_MEMBER_STATUSES = new Set<MemberStatusInput>([
  'active',
  'invited',
  'disabled',
  'banned',
]);

interface MemberActionsCellProps {
  memberId: string;
  memberName: string;
  isSelf: boolean;
  isDisabled: boolean;
  canManageMembers: boolean;
  canDeleteMembers: boolean;
  canReadConsent: boolean;
  reactivatePending: boolean;
  onReactivate: (userId: string) => void;
  onDeactivate: (userId: string, name: string) => void;
  onViewConsent: (userId: string, name: string) => void;
  t: LooseTranslator;
}

function MemberActionsCell({
  memberId,
  memberName,
  isSelf,
  isDisabled,
  canManageMembers,
  canDeleteMembers,
  canReadConsent,
  reactivatePending,
  onReactivate,
  onDeactivate,
  onViewConsent,
  t,
}: MemberActionsCellProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {!!canReadConsent && (
        <Button
          variant="ghost"
          size="sm"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => onViewConsent(memberId, memberName)}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t('actions.viewConsent')}
        </Button>
      )}
      {isDisabled && canManageMembers ? (
        <Button
          variant="outline"
          size="sm"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => onReactivate(memberId)}
          disabled={reactivatePending}>
          {t('actions.reactivate')}
        </Button>
      ) : !(isDisabled || isSelf) && canDeleteMembers ? (
        <Button
          variant="destructive"
          size="sm"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => onDeactivate(memberId, memberName)}>
          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
          {t('actions.deactivate')}
        </Button>
      ) : null}
    </div>
  );
}

export function UsersTable({
  t,
  membersQuery,
  members,
  showActionsColumn,
  canManageMembers,
  canDeleteMembers,
  canReadConsent,
  currentUserId,
  updateRoleMutation,
  reactivateMutation,
}: UsersTableProps) {
  const tAria = useTranslations('Common.aria');

  const [deactivateTarget, setDeactivateTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [consentTarget, setConsentTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  if (membersQuery.isLoading) {
    return (
      <AtelierTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.email')}</TableHead>
              <TableHead>{t('columns.role')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              {showActionsColumn && (
                <TableHead className="text-end">{t('columns.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <TableRow key={`skel-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                {showActionsColumn && (
                  <TableCell>
                    <Skeleton className="h-8 w-20 ms-auto" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AtelierTableShell>
    );
  }

  if (members.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card py-16 text-center">
        <h3 className="text-[16px] font-medium">{t('emptyState.heading')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('emptyState.body')}</p>
      </div>
    );
  }

  const roleLabel = (role: string) => tDynLoose(t, 'roles', enumKey(role)) ?? role;

  const roleDescription = (role: string) => tDynLoose(t, 'roleDescriptions', enumKey(role));

  const statusLabel = (status: string) => tDynLoose(t, 'status', enumKey(status)) ?? status;

  return (
    <>
      <AtelierTableShell
        isLoading={membersQuery.isFetching && !membersQuery.isLoading}
        chrome={
          <TableChrome
            totalCount={members.length}
            entityLabel={t('entityLabel', { count: members.length })}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.email')}</TableHead>
              <TableHead>{t('columns.role')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              {showActionsColumn && (
                <TableHead className="text-end">{t('columns.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, idx) => {
              const status = displayStatus(m);
              const memberId = m.id ?? m.userId ?? '';
              const isSelf = m.userId === currentUserId;
              const isDisabled = status === 'disabled';

              return (
                <TableRow key={memberId || String(idx)}>
                  <TableCell className="font-medium">{displayName(m)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email ?? '\u2014'}</TableCell>
                  <TableCell>
                    {canManageMembers ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="cursor-pointer focus:outline-none"
                          disabled={updateRoleMutation.isPending}>
                          <Badge
                            variant="secondary"
                            className={`${roleBadgeColors[m.role ?? ''] ?? ''} cursor-pointer hover:opacity-80 transition-opacity`}>
                            {roleLabel(m.role ?? '')}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {assignableRoles.map(role => (
                            <DropdownMenuItem
                              key={role}
                              // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                              onSelect={() => {
                                if (role !== m.role) {
                                  updateRoleMutation.mutate({
                                    userId: memberId,
                                    role,
                                  });
                                }
                              }}
                              className={`${role === m.role ? 'font-semibold' : ''} flex flex-col items-start gap-0.5`}>
                              <span>{roleLabel(role)}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {roleDescription(role)}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge variant="secondary" className={roleBadgeColors[m.role ?? ''] ?? ''}>
                        {roleLabel(m.role ?? '')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {KNOWN_MEMBER_STATUSES.has(status as MemberStatusInput) ? (
                      <AtelierStatusPill
                        variant={statusToVariant('member', status as MemberStatusInput)}>
                        {statusLabel(status)}
                      </AtelierStatusPill>
                    ) : (
                      <Badge variant="secondary">{statusLabel(status)}</Badge>
                    )}
                  </TableCell>
                  {showActionsColumn && (
                    <TableCell className="text-end">
                      <MemberActionsCell
                        memberId={memberId}
                        memberName={displayName(m)}
                        isSelf={isSelf}
                        isDisabled={isDisabled}
                        canManageMembers={canManageMembers}
                        canDeleteMembers={canDeleteMembers}
                        canReadConsent={canReadConsent}
                        reactivatePending={reactivateMutation.isPending}
                        // biome-ignore lint/nursery/noJsxPropsBind: stable callback
                        onReactivate={uid => reactivateMutation.mutate({ userId: uid })}
                        // biome-ignore lint/nursery/noJsxPropsBind: stable callback
                        onDeactivate={(uid, name) => setDeactivateTarget({ userId: uid, name })}
                        // biome-ignore lint/nursery/noJsxPropsBind: stable callback
                        onViewConsent={(uid, name) => setConsentTarget({ userId: uid, name })}
                        t={t}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AtelierTableShell>

      {!!deactivateTarget && (
        <DeactivateDialogContainer
          open={!!deactivateTarget}
          // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
          onOpenChange={open => {
            if (!open) setDeactivateTarget(null);
          }}
          userId={deactivateTarget.userId}
          userName={deactivateTarget.name}
        />
      )}

      <UserConsentSheetContainer
        userId={consentTarget?.userId ?? null}
        userName={consentTarget?.name ?? ''}
        open={!!consentTarget}
        // biome-ignore lint/nursery/noJsxPropsBind: sheet state handler
        onOpenChange={openState => {
          if (!openState) setConsentTarget(null);
        }}
      />
    </>
  );
}
