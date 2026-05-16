'use client';

// User Consent admin side sheet.
//
// Wires `consent.adminGetUserConsent` and `consent.adminGetUserConsentHistory`
// into a small read-only surface mounted from the Users table. Lets a
// settings admin inspect a single user's consent state + an audit-style
// timeline of grants/revokes without leaving the members page.

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, History, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConsentMapEntry = {
  purpose: string;
  granted: boolean;
  version: number;
  lastUpdated: Date | string;
};

type ConsentHistoryRow = {
  id: string;
  purpose: string;
  granted: boolean;
  version: number;
  grantedAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
};

interface UserConsentSheetProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Current consent — list of purposes with granted / not granted pill
// ---------------------------------------------------------------------------

function CurrentConsentList({
  userId,
  enabled,
  t,
  formatDate,
}: {
  userId: string;
  enabled: boolean;
  t: ReturnType<typeof useTranslations<'Settings.userConsent'>>;
  formatDate: (value: Date | string | null | undefined) => string;
}) {
  const consentQuery = useQuery({
    ...trpc.consent.adminGetUserConsent.queryOptions({ userId }),
    enabled,
  });
  // BE returns a `Record<string, ConsentState>` (purpose -> state) serialised
  // via superjson; cast through `unknown` because the inferred FE shape
  // doesn't structurally match our local re-declaration of ConsentState.
  const entries = Object.entries(
    (consentQuery.data ?? {}) as unknown as Record<string, ConsentMapEntry>,
  );

  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-medium text-muted-foreground">{t('currentHeading')}</h4>
      {consentQuery.isLoading ? (
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
                  className="bg-green-500/10 text-green-600 dark:text-green-400">
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

// ---------------------------------------------------------------------------
// Consent history timeline
// ---------------------------------------------------------------------------

function ConsentHistoryTimeline({
  userId,
  enabled,
  t,
  formatDate,
}: {
  userId: string;
  enabled: boolean;
  t: ReturnType<typeof useTranslations<'Settings.userConsent'>>;
  formatDate: (value: Date | string | null | undefined) => string;
}) {
  const historyQuery = useQuery({
    ...trpc.consent.adminGetUserConsentHistory.queryOptions({ userId }),
    enabled,
  });
  // Same rationale as in CurrentConsentList: superjson-serialised Date fields
  // round-trip cleanly at runtime but TypeScript needs an `unknown` cast.
  const rows = (historyQuery.data ?? []) as unknown as ConsentHistoryRow[];

  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />
        {t('historyHeading')}
      </h4>
      {historyQuery.isLoading ? (
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

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export function UserConsentSheet({ userId, userName, open, onOpenChange }: UserConsentSheetProps) {
  const t = useTranslations('Settings.userConsent');
  const { formatDate } = useDateFormatter();
  const enabled = !!userId && open;

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
              <CurrentConsentList userId={userId} enabled={enabled} t={t} formatDate={formatDate} />
              <ConsentHistoryTimeline
                userId={userId}
                enabled={enabled}
                t={t}
                formatDate={formatDate}
              />
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
