/**
 * AuditTimeline — chronological audit trail for an invoice's approval flow.
 *
 * Ported from apps/web/src/components/approvals/audit-timeline.tsx with
 * the SPA codemod swaps:
 *   - next-intl `useTranslations` → ../../i18n/useTranslations.js
 *   - @/i18n/typed-keys `tKey` → ../../i18n/typed-keys.js
 *   - @/trpc/init `trpc` → useTRPC() proxy from providers/trpc-provider
 *   - @/lib/avatar-initials → ../../lib/avatar-initials.js
 *   - @/lib/utils `cn` → ../../lib/utils.js
 */

import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { approvalAuditSystemLabel } from '@contractor-ops/validators';
import { ArrowRightLeft, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../lib/avatar-initials.js';
import { cn } from '../../lib/utils.js';

interface AuditEvent {
  type: 'system' | 'decision';
  label: string;
  timestamp: string;
  actor?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  comment?: string | null;
  levelName?: string;
  chainName?: string;
}

const DECISION_CONFIG: Record<
  string,
  {
    className: string;
    icon: React.ComponentType<{ className?: string }>;
    labelKey: string;
  }
> = {
  approve: {
    className: 'bg-green-500/10 text-green-800 dark:text-green-400',
    icon: CheckCircle2,
    labelKey: 'auditTrail.decisionApproved',
  },
  reject: {
    className: 'bg-destructive/10 text-destructive',
    icon: XCircle,
    labelKey: 'auditTrail.decisionRejected',
  },
  request_changes: {
    className: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
    icon: HelpCircle,
    labelKey: 'auditTrail.decisionClarification',
  },
  delegate: {
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: ArrowRightLeft,
    labelKey: 'auditTrail.decisionDelegated',
  },
};

type TranslateFn = (key: string, params?: Record<string, string>) => string;

function getSystemEventLabel(event: AuditEvent, t: TranslateFn): string {
  switch (event.label) {
    case 'submitted':
      return t('auditTrail.submitted');
    case 'routed':
      return t('auditTrail.routed', { chainName: event.chainName ?? 'Unknown' });
    case approvalAuditSystemLabel.slaBreached:
      return t('auditTrail.slaBreached', { levelName: event.levelName ?? 'unknown' });
    case 'approved':
      return t('auditTrail.flowApproved');
    case 'rejected':
      return t('auditTrail.flowRejected');
    default:
      return event.label;
  }
}

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function AuditTimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={`audit-entry-${i}`} className="flex gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CommentText({ text, t }: { text: string; t: TranslateFn }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p className={cn('text-sm text-foreground', !expanded && 'line-clamp-3')}>{text}</p>
      {text.length > 150 && (
        <button
          type="button"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => setExpanded(prev => !prev)}
          className="mt-0.5 text-[12px] font-medium text-primary hover:underline">
          {expanded ? t('auditTrail.showLess') : t('auditTrail.showMore')}
        </button>
      )}
    </div>
  );
}

function HumanEntry({ event, t }: { event: AuditEvent; t: TranslateFn }) {
  const config = DECISION_CONFIG[event.label];

  if (!(config && event.actor)) return null;

  const Icon = config.icon;

  return (
    <div className="relative flex gap-3 ps-0">
      <Avatar className="shrink-0">
        {!!event.actor.image && <AvatarImage src={event.actor.image} />}
        <AvatarFallback>{getAvatarInitials(event.actor.name, event.actor.email)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{event.actor.name ?? event.actor.email}</span>
          <Badge variant="secondary" className={cn('gap-1', config.className)}>
            <Icon className="h-3 w-3" />
            {t(config.labelKey)}
          </Badge>
        </div>

        {!!event.comment && <CommentText text={event.comment} t={t} />}

        <p className="text-[12px] text-muted-foreground">{getRelativeTime(event.timestamp)}</p>
      </div>
    </div>
  );
}

function SystemEntry({ event, t }: { event: AuditEvent; t: TranslateFn }) {
  return (
    <div className="relative flex items-start gap-3 ps-0">
      <div className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-border" />
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-[12px] text-muted-foreground">{getSystemEventLabel(event, t)}</p>
        <p className="text-[12px] text-muted-foreground/70">{getRelativeTime(event.timestamp)}</p>
      </div>
    </div>
  );
}

interface AuditTimelineProps {
  events: AuditEvent[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  const t = useTranslations('Approvals');

  const tFn = (key: string, params?: Record<string, string>) => tKey(t, key, params);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t('auditTrail.heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('auditTrail.empty')}</p>
        ) : (
          <div className="relative space-y-4">
            <div className="absolute start-4 top-0 bottom-0 w-[2px] bg-border" />

            {events.map((event, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: audit events may share label+timestamp
              <div key={`${event.label}-${event.timestamp}-${idx}`} className="relative">
                {event.type === 'decision' ? (
                  <HumanEntry event={event} t={tFn} />
                ) : (
                  <SystemEntry event={event} t={tFn} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
