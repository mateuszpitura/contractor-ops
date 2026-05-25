import { complianceState } from '@contractor-ops/einvoice/compliance';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { FileCheck } from 'lucide-react';
import { Link } from '../../i18n/navigation.js';
import { PeppolComplianceWidget } from '../peppol/peppol-compliance-widget.js';
import type { useEinvoiceComplianceWidget } from './hooks/use-einvoice-compliance-widget.js';

const stateStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  sandbox: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  degraded: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  onboarding: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  suspended: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground/40',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  [complianceState.notConnected]: {
    bg: 'bg-muted/50',
    text: 'text-muted-foreground/60',
    dot: 'bg-muted-foreground/30',
  },
};

export function EInvoiceComplianceWidgetSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export type EInvoiceComplianceWidgetViewProps = ReturnType<typeof useEinvoiceComplianceWidget>;

export function EInvoiceComplianceWidgetView({
  statuses,
  peppolState,
  stateLabels,
  t,
}: EInvoiceComplianceWidgetViewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <FileCheck className="h-4 w-4 text-muted-foreground" />
          {t('ComplianceWidget.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {statuses.map(status => {
          const style = stateStyles[status.state] ?? stateStyles[complianceState.notConnected];
          const label = stateLabels[status.state] ?? status.state;
          return (
            <Link
              key={status.profileId}
              href="/settings#einvoice"
              className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:opacity-80 ${style.bg}`}>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${style.dot}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{status.displayName}</span>
              </div>
              <span className={`text-xs font-medium ${style.text}`}>{label}</span>
            </Link>
          );
        })}
        {!!peppolState && (
          <PeppolComplianceWidget
            status={{
              state: peppolState,
              healthScore: peppolState === 'active' ? 100 : peppolState === 'onboarding' ? 50 : 0,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
