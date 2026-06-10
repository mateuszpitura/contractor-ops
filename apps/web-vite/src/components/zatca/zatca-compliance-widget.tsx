import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ShieldCheck } from 'lucide-react';
import type { useZatcaComplianceWidget as UseZatcaComplianceWidget } from './hooks/use-zatca-compliance-widget.js';
import { useZatcaComplianceWidget } from './hooks/use-zatca-compliance-widget.js';

export type ZatcaComplianceWidgetProps = {
  connectionStatus?: string;
  environment?: string;
  certificateExpiresAt?: string;
};

export function ZatcaComplianceWidget(props: ZatcaComplianceWidgetProps) {
  const { isLoading, ...rest } = useZatcaComplianceWidget(
    props.connectionStatus ?? 'production',
    props.environment ?? 'Production',
    props.certificateExpiresAt,
  );
  if (isLoading) return <ZatcaComplianceWidgetSkeleton />;
  return <ZatcaComplianceWidgetView {...rest} />;
}

const STATUS_DOTS: Record<string, string> = {
  production: 'bg-green-500',
  sandbox: 'bg-amber-500',
  error: 'bg-red-500',
  disconnected: 'bg-muted-foreground/30',
};

export function ZatcaComplianceWidgetSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

export type ZatcaComplianceWidgetViewProps = Omit<
  ReturnType<typeof UseZatcaComplianceWidget>,
  'isLoading'
>;

export function ZatcaComplianceWidgetView({
  connectionStatus,
  environment,
  certificateExpiresAt,
  expiryDays,
  expiryColor,
  stats,
  healthPercent,
  t,
}: ZatcaComplianceWidgetViewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-5 w-5" />
          {t('cardTitle')}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span>{t('status')}</span>
            <span className="flex items-center gap-1.5 font-medium capitalize">
              {connectionStatus}
              <span
                className={`inline-block h-2 w-2 rounded-full ${STATUS_DOTS[connectionStatus ?? ''] ?? STATUS_DOTS.disconnected}`}
                aria-hidden="true"
              />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t('environment')}</span>
            <span className="font-medium">{environment}</span>
          </div>
        </div>

        {expiryDays !== null && (
          <div className="text-sm">
            <span className="text-muted-foreground">{t('certificateExpires')}</span>
            <span className={expiryColor}>
              {certificateExpiresAt?.slice(0, 10)} ({expiryDays} days)
            </span>
            {expiryDays < 30 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {t('certificateExpiryWarning', { expiryDays })}
              </p>
            )}
          </div>
        )}

        {!!stats && (
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-muted-foreground">{t('thisPeriod')}</p>
            <div className="space-y-1 ps-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('cleared')}</span>
                <span className="font-mono text-sm">{t('invoices', { count: stats.cleared })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('reported')}</span>
                <span className="font-mono text-sm">
                  {t('invoices', { count: stats.reported })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('pending')}</span>
                <span className="font-mono text-sm">{t('invoices', { count: stats.pending })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('rejected')}</span>
                <span className="font-mono text-sm">
                  {t('invoices', { count: stats.rejected })}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('health')}</span>
            <span className="font-mono text-xs">{healthPercent}%</span>
          </div>
          <Progress value={healthPercent} />
        </div>
      </CardContent>
    </Card>
  );
}
