import { complianceState } from '@contractor-ops/einvoice/compliance';
import { IntegrationsIllustration } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { CheckCircle2, FileCheck, XCircle } from 'lucide-react';
import { useId } from 'react';
import type { useEinvoiceComplianceDetail } from './hooks/use-einvoice-compliance-detail.js';

const stateBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  sandbox: 'secondary',
  degraded: 'secondary',
  onboarding: 'secondary',
  suspended: 'outline',
  error: 'destructive',
  [complianceState.notConnected]: 'outline',
};

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full transition-all ${color}`} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{score}%</span>
    </div>
  );
}

function CapabilityItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${
        enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/40'
      }`}>
      {enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}

export function EInvoiceComplianceDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

type ComplianceDetailHookResult = ReturnType<typeof useEinvoiceComplianceDetail>;

type HeadingProps = {
  t: ComplianceDetailHookResult['t'];
  id: string;
};

function DetailHeading({ t, id }: HeadingProps) {
  return (
    <div id={id}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <FileCheck className="h-5 w-5 text-muted-foreground" />
        {t('heading')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subline')}</p>
    </div>
  );
}

export type EInvoiceComplianceDetailEmptyProps = {
  t: ComplianceDetailHookResult['t'];
};

export function EInvoiceComplianceDetailEmpty({ t }: EInvoiceComplianceDetailEmptyProps) {
  const reactId = useId();
  return (
    <div className="space-y-6" id={`${reactId}-einvoice`}>
      <DetailHeading t={t} id={`${reactId}-einvoice-heading`} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <IntegrationsIllustration className="h-24 w-24" />
          <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export type EInvoiceComplianceDetailViewProps = ComplianceDetailHookResult;

export function EInvoiceComplianceDetailView({
  statuses,
  stateLabels,
  formatTimeAgo,
  t,
}: EInvoiceComplianceDetailViewProps) {
  const reactId = useId();

  return (
    <div className="space-y-6" id={`${reactId}-einvoice`}>
      <DetailHeading t={t} id={`${reactId}-einvoice-heading`} />
      <div className="space-y-4">
        {statuses.map(status => {
          const badgeVariant = stateBadgeVariant[status.state] ?? 'outline';
          const label = stateLabels[status.state] ?? status.state;

          return (
            <Card key={status.profileId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-base">
                    {status.displayName}
                    <Badge variant={badgeVariant}>{label}</Badge>
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{status.country}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t('health')}</p>
                  <HealthBar score={status.healthScore} />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="font-medium text-muted-foreground">{t('lastSync')}</span>{' '}
                    {formatTimeAgo(status.lastSyncAt as Date | undefined)}
                  </div>
                  {!!status.lastErrorMessage && (
                    <div className="col-span-2 truncate text-destructive">
                      <span className="font-medium">{t('error')}</span> {status.lastErrorMessage}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {t('capabilities')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <CapabilityItem
                      label={t('capGenerate')}
                      enabled={status.capabilities.canGenerate}
                    />
                    <CapabilityItem label={t('capParse')} enabled={status.capabilities.canParse} />
                    <CapabilityItem label={t('capSign')} enabled={status.capabilities.canSign} />
                    <CapabilityItem
                      label={t('capQrCode')}
                      enabled={status.capabilities.canQRCode}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
