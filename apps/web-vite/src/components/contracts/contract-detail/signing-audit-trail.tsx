import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Ban, CheckCircle2, Eye, FileDown, PenLine, Send, XCircle } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate, formatDateTime } from '../../../lib/format-date.js';
import type { useSigningAuditTrail } from '../hooks/use-signing-audit-trail.js';

const EVENT_CONFIG: Record<string, { icon: typeof Send; className: string }> = {
  ENVELOPE_CREATED: { icon: Send, className: 'text-muted-foreground' },
  ENVELOPE_SENT: { icon: Send, className: 'text-muted-foreground' },
  RECIPIENT_VIEWED: { icon: Eye, className: 'text-muted-foreground' },
  RECIPIENT_SIGNED: { icon: PenLine, className: 'text-green-600' },
  RECIPIENT_DECLINED: { icon: XCircle, className: 'text-red-500' },
  ENVELOPE_VOIDED: { icon: Ban, className: 'text-red-500' },
  ENVELOPE_COMPLETED: { icon: CheckCircle2, className: 'text-green-600' },
  ENVELOPE_EXPIRED: { icon: XCircle, className: 'text-red-500' },
  SIGNED_PDF_SAVED: { icon: FileDown, className: 'text-muted-foreground' },
};

type SigningAuditTrailProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audit: ReturnType<typeof useSigningAuditTrail>;
};

/**
 * Side panel showing chronological signing events for an envelope.
 */
export function SigningAuditTrail({ open, onOpenChange, audit }: SigningAuditTrailProps) {
  const t = useTranslations('ContractDetail.signing.auditTrail');

  function formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return t('justNow');
    if (diffMinutes < 60) return t('minutesAgo', { count: diffMinutes });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays < 30) return t('daysAgo', { count: diffDays });
    return formatDate(d);
  }

  const { events, isLoading } = audit;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <div key={`audit-step-${i}`} className="flex items-start gap-3 py-2">
                  <Skeleton className="size-4 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h4 className="text-sm font-medium text-muted-foreground">{t('emptyTitle')}</h4>
              <p className="mt-1 max-w-[240px] text-sm text-muted-foreground">{t('emptyBody')}</p>
            </div>
          ) : (
            <div className="space-y-0">
              {events.map(event => {
                const config = EVENT_CONFIG[event.eventType] ?? {
                  icon: Send,
                  className: 'text-muted-foreground',
                };
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b py-2 last:border-0">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${config.className}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{event.description}</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                            render={props => (
                              <p {...props} className="text-sm text-muted-foreground">
                                {formatRelativeTime(event.occurredAt)}
                              </p>
                            )}
                          />
                          <TooltipContent>{formatDateTime(event.occurredAt)}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {!!event.actorName && (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {event.actorName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
