import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useCallback } from 'react';
import { Link } from '../../i18n/navigation.js';
import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { EmbeddedSigningModalWired } from './embedded-signing-modal.js';
import type {
  PendingSignatureItem,
  usePortalPendingSignaturesView,
} from './hooks/use-portal-pending-signatures-view.js';

function formatRelativeTime(
  date: Date | string,
  t: LooseTranslator,
  formatDate: (value: Date | string | null | undefined) => string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return t('time.justNow');
  if (diffMinutes < 60) return t('time.minutesAgo', { minutes: diffMinutes });
  if (diffHours < 24) return t('time.hoursAgo', { hours: diffHours });
  if (diffDays < 30) return t('time.daysAgo', { days: diffDays });
  return formatDate(d);
}

export function PendingSignaturesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <Card key={`skel-${i}`} className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function PendingSignaturesError({ onRetry }: { onRetry: () => void }) {
  const tCommon = useTranslations('Common');
  const tDocs = useTranslations('Documents');
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" onClick={onRetry}>
        {tDocs('errors.retry')}
      </Button>
    </div>
  );
}

interface PendingSignatureCardProps {
  item: PendingSignatureItem;
  title: string;
  sentLine: string | null;
  signLabel: string;
  onSign: (item: PendingSignatureItem) => void;
}

function PendingSignatureCard({
  item,
  title,
  sentLine,
  signLabel,
  onSign,
}: PendingSignatureCardProps) {
  const handleSign = useCallback(() => onSign(item), [onSign, item]);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {!!sentLine && <p className="text-sm text-muted-foreground">{sentLine}</p>}
        </div>
        <Button size="sm" onClick={handleSign}>
          {signLabel}
        </Button>
      </div>
    </Card>
  );
}

function PendingSignaturesList({
  items,
  limit,
  onSign,
}: {
  items: PendingSignatureItem[];
  limit?: number;
  onSign: (item: PendingSignatureItem) => void;
}) {
  const t = useTranslations('Portal');
  const { formatDate } = usePortalDateFormatter();

  const displayItems = limit ? items.slice(0, limit) : items;
  const hasMore = limit !== undefined && items.length > limit;
  const signLabel = t('pendingSignatures.signNow');

  return (
    <div className="space-y-3">
      {displayItems.map(item => {
        const title = `Contract #${item.contractId?.slice(-6) ?? t('pendingSignatures.na')}`;
        const sentLine = item.sentAt
          ? t('pendingSignatures.sent', { time: formatRelativeTime(item.sentAt, t, formatDate) })
          : null;
        return (
          <PendingSignatureCard
            key={item.envelopeId}
            item={item}
            title={title}
            sentLine={sentLine}
            signLabel={signLabel}
            onSign={onSign}
          />
        );
      })}

      {hasMore ? (
        <Link href="/portal/signatures" className="text-sm text-primary hover:underline">
          {t('pendingSignatures.viewAll')}
        </Link>
      ) : null}
    </div>
  );
}

function SigningModal({ view }: { view: ReturnType<typeof usePortalPendingSignaturesView> }) {
  const { signingTarget, clearSigningTarget, handleSigningComplete } = view;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) clearSigningTarget();
    },
    [clearSigningTarget],
  );

  if (!signingTarget) return null;

  return (
    <EmbeddedSigningModalWired
      envelopeId={signingTarget.envelopeId}
      recipientEmail={signingTarget.recipientEmail}
      documentTitle={signingTarget.documentTitle}
      provider="DOCUSIGN"
      usePortalAuth
      open
      onOpenChange={handleOpenChange}
      onComplete={handleSigningComplete}
    />
  );
}

type PortalPendingSignaturesViewProps = {
  view: ReturnType<typeof usePortalPendingSignaturesView>;
};

/** Loaded-state inline widget shown on the portal index when signatures exist. */
export function PortalPendingSignatures({ view }: PortalPendingSignaturesViewProps) {
  const t = useTranslations('Portal');
  const { items, handleSign } = view;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{t('pendingSignatures.title')}</h2>
          <Badge variant="secondary">{items.length}</Badge>
        </div>

        <PendingSignaturesList items={items} limit={5} onSign={handleSign} />
      </div>

      <SigningModal view={view} />
    </>
  );
}

export function PortalSignaturesPageHeader() {
  const t = useTranslations('Portal');
  return <WorkbenchPageHeader title={t('pendingSignatures.title')} />;
}

/** Loaded-state page body on `/portal/signatures` when data is ready. */
export function PortalSignaturesPage({ view }: PortalPendingSignaturesViewProps) {
  const { items, handleSign } = view;

  return (
    <>
      <PendingSignaturesList items={items} onSign={handleSign} />
      <SigningModal view={view} />
    </>
  );
}
