/**
 * Staff read/track surface for a contractor's US W-form status. Advisory only:
 * staff see the status, treaty claim, and expiry, and can request a form — never
 * an on-behalf signing path. The full SSN stays behind the gated reveal
 * (`SsnMaskedReveal`); the snapshot and full TIN never reach this component.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { AlertTriangle, CheckCircle2, Clock, FileText, Info, XCircle } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { SsnMaskedReveal } from '../compliance/ssn-masked-reveal.js';
import type { DerivedFormStatus, TaxFormSubmissionRow } from './hooks/use-tax-form-status.js';
import { deriveFormStatus, useTaxFormStatus } from './hooks/use-tax-form-status.js';

export interface TaxFormStatusCardProps {
  contractorId: string;
  /** Last 4 of the stored SSN for W-9 records, or null when none on file. */
  ssnLast4: string | null;
  /** Whether the active role holds `contractorPii:read`. */
  canRevealPii: boolean;
}

interface StatusMeta {
  labelKey: string;
  tooltipKey: string;
  badgeVariant: 'success' | 'warning' | 'secondary' | 'destructive' | 'info';
  icon: ReactNode;
}

const STATUS_MAP: Record<DerivedFormStatus, StatusMeta> = {
  active: {
    labelKey: 'status.active',
    tooltipKey: 'statusTooltip.active',
    badgeVariant: 'success',
    icon: <CheckCircle2 className="size-3" aria-hidden />,
  },
  draft: {
    labelKey: 'status.draft',
    tooltipKey: 'statusTooltip.draft',
    badgeVariant: 'info',
    icon: <FileText className="size-3" aria-hidden />,
  },
  superseded: {
    labelKey: 'status.superseded',
    tooltipKey: 'statusTooltip.superseded',
    badgeVariant: 'secondary',
    icon: <XCircle className="size-3" aria-hidden />,
  },
  expiring: {
    labelKey: 'status.expiring',
    tooltipKey: 'statusTooltip.expiring',
    badgeVariant: 'warning',
    icon: <Clock className="size-3" aria-hidden />,
  },
  expired: {
    labelKey: 'status.expired',
    tooltipKey: 'statusTooltip.expired',
    badgeVariant: 'warning',
    icon: <AlertTriangle className="size-3" aria-hidden />,
  },
};

function FormStatusPill({ status }: { status: DerivedFormStatus }) {
  const t = useTranslations('TaxFormStaff');
  const meta = STATUS_MAP[status];
  const label = t(meta.labelKey);

  const pill = (
    <Badge
      variant={meta.badgeVariant}
      data-testid="tax-form-status-pill"
      data-status={status}
      aria-label={t('pillAriaLabel', { status: label })}>
      {meta.icon}
      <span>{label}</span>
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={pill as ReactElement} />
        <TooltipContent>{t(meta.tooltipKey)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FormSummary({
  form,
  ssnLast4,
  contractorId,
  canRevealPii,
}: {
  form: TaxFormSubmissionRow;
  ssnLast4: string | null;
  contractorId: string;
  canRevealPii: boolean;
}) {
  const t = useTranslations('TaxFormStaff');
  const format = useFormatter();

  const treaty =
    form.treatyArticle && form.treatyRate !== null
      ? t('treatyValue', { rate: form.treatyRate, article: form.treatyArticle })
      : t('treatyNone');

  return (
    <div className="space-y-card-gap">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">{t('formTypeLabel')}</dt>
          <dd className="font-mono">{form.formType}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">{t('treatyLabel')}</dt>
          <dd>{treaty}</dd>
        </div>
        {form.signedAt ? (
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t('signedLabel')}</dt>
            <dd>{format.dateTime(form.signedAt, 'medium')}</dd>
          </div>
        ) : null}
        {form.expiresAt ? (
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t('expiresLabel')}</dt>
            <dd>{format.dateTime(form.expiresAt, 'medium')}</dd>
          </div>
        ) : null}
      </dl>

      {form.formType === 'W9' && ssnLast4 ? (
        <SsnMaskedReveal contractorId={contractorId} last4={ssnLast4} canReveal={canRevealPii} />
      ) : null}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t('adviserNote')}</span>
      </p>
    </div>
  );
}

export function TaxFormStatusCard({
  contractorId,
  ssnLast4,
  canRevealPii,
}: TaxFormStatusCardProps) {
  const t = useTranslations('TaxFormStaff');
  const { isPending, error, isEmpty, latest, refetch } = useTaxFormStatus(contractorId);

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <h3 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h3>
        {latest ? <FormStatusPill status={deriveFormStatus(latest)} /> : null}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3" aria-busy aria-live="polite">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t('loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              {t('reload')}
            </Button>
          </div>
        ) : isEmpty || !latest ? (
          <div className="space-y-2 py-6 text-center">
            <p className="font-display text-sm font-semibold">{t('empty.heading')}</p>
            <p className="text-sm text-muted-foreground">{t('empty.body')}</p>
          </div>
        ) : (
          <FormSummary
            form={latest}
            ssnLast4={ssnLast4}
            contractorId={contractorId}
            canRevealPii={canRevealPii}
          />
        )}
      </CardContent>
    </Card>
  );
}
