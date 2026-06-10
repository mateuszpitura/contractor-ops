// User Consent admin side sheet.
//
// Wires `consent.adminGetUserConsent` and `consent.adminGetUserConsentHistory`
// into a small read-only surface mounted from the Users table. Lets a
// settings admin inspect a single user's consent state + an audit-style
// timeline of grants/revokes without leaving the members page.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { CheckCircle2, History, XCircle } from 'lucide-react';

import type { LooseTranslator } from '../../i18n/typed-keys.js';
import type {
  ConsentHistoryRow,
  ConsentMapEntry,
  useUserConsentSheet as UseUserConsentSheet,
} from './hooks/use-user-consent-sheet.js';
import { useUserConsentSheet } from './hooks/use-user-consent-sheet.js';

interface UserConsentSheetBaseProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type UserConsentSheetProps = UserConsentSheetBaseProps &
  ReturnType<typeof UseUserConsentSheet>;

function CurrentConsentList({
  t,
  formatDate,
  isLoading,
  entries,
}: {
  t: LooseTranslator;
  formatDate: (value: Date | string | null | undefined) => string;
  isLoading: boolean;
  entries: [string, ConsentMapEntry][];
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-medium text-muted-foreground">{t('currentHeading')}</h4>
      {isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t('currentEmpty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map(([purpose, value]) => (
            <li key={purpose} className="flex items-center justify-between gap-2 text-[13px]">
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{purpose}</span>
                {!!value.lastUpdated && (
                  <span className="text-[12px] text-muted-foreground">
                    {t('lastUpdated', { date: formatDate(value.lastUpdated) })}
                    {value.version > 0 ? ` · v${value.version}` : ''}
                  </span>
                )}
              </div>
              {value.granted ? (
                <Badge
                  variant="secondary"
                  className="bg-green-500/10 text-green-800 dark:text-green-400">
                  <CheckCircle2 className="me-1 h-3 w-3" />
                  {t('granted')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  <XCircle className="me-1 h-3 w-3" />
                  {t('notGranted')}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConsentHistoryTimeline({
  t,
  formatDate,
  isLoading,
  rows,
}: {
  t: LooseTranslator;
  formatDate: (value: Date | string | null | undefined) => string;
  isLoading: boolean;
  rows: ConsentHistoryRow[];
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />
        {t('historyHeading')}
      </h4>
      {isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t('historyEmpty')}</p>
      ) : (
        <ol className="relative border-s border-border ps-4 space-y-2">
          {rows.map(row => (
            <li key={row.id} className="relative">
              <span
                className={`absolute -start-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background ${row.granted ? 'bg-green-500' : 'bg-muted-foreground'}`}
                aria-hidden="true"
              />
              <div className="text-[13px]">
                <span className="font-medium text-foreground">{row.purpose}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {row.granted ? t('granted') : t('revoked')}
                </span>
                {row.version > 0 ? (
                  <span className="text-muted-foreground"> · v{row.version}</span>
                ) : null}
              </div>
              <div className="text-[12px] text-muted-foreground">{formatDate(row.createdAt)}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function UserConsentSheetView({
  userId,
  userName,
  open,
  onOpenChange,
  t,
  formatDate,
  current,
  history,
}: UserConsentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('title', { name: userName })}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-4">
          {userId ? (
            <>
              <CurrentConsentList
                t={t}
                formatDate={formatDate}
                isLoading={current.isLoading}
                entries={current.entries}
              />
              <ConsentHistoryTimeline
                t={t}
                formatDate={formatDate}
                isLoading={history.isLoading}
                rows={history.rows}
              />
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UserConsentSheet({
  userId,
  userName,
  open,
  onOpenChange,
}: UserConsentSheetBaseProps) {
  const sheet = useUserConsentSheet(userId, open);
  return (
    <UserConsentSheetView
      userId={userId}
      userName={userName}
      open={open}
      onOpenChange={onOpenChange}
      {...sheet}
    />
  );
}
