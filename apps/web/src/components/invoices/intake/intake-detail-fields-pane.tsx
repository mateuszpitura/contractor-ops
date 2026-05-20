'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ProfileLevel } from './intake-profile-level-badge';
import { IntakeProfileLevelBadge } from './intake-profile-level-badge';

interface IntakeDetailFieldsPaneProps {
  intakeId?: string;
  supplierName: string | null;
  supplierVatId: string | null;
  supplierLeitwegId: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | string | null;
  currency: string | null;
  totalMinor: number | bigint | string | null;
  lineCount: number | null;
  profileLevel: ProfileLevel | null;
  unmappedFields?: unknown;
  className?: string;
}

/**
 * Parsed-field definition list. Mono/tabular-nums for numeric identifiers
 * and totals (UI-SPEC § Typography). Collapsible "Advanced / technical"
 * section at the bottom surfaces the raw `unmappedFieldsJson` blob for
 * EXTENDED-profile invoices where the parser could not map every sender
 * field onto the canonical CII envelope.
 */
export function IntakeDetailFieldsPane({
  supplierName,
  supplierVatId,
  supplierLeitwegId,
  invoiceNumber,
  invoiceDate,
  currency,
  totalMinor,
  lineCount,
  profileLevel,
  unmappedFields,
  className,
}: IntakeDetailFieldsPaneProps) {
  const t = useTranslations('EInvoice.intake');
  const tField = useTranslations('EInvoice.intake.field');
  const format = useFormatter();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const formattedTotal = formatTotal(totalMinor, currency);
  const formattedDate = invoiceDate ? format.dateTime(new Date(invoiceDate), 'short') : '—';

  const hasUnmapped = unmappedFields !== null && unmappedFields !== undefined;

  return (
    <Card className={className} data-slot="intake-detail-fields-pane" id="parsed-fields">
      <CardHeader>
        <CardTitle className="text-base">{tField('supplierName')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[max-content_1fr]">
          <Field label={tField('supplierName')} value={supplierName} />
          <Field label={tField('vatId')} value={supplierVatId} mono />
          <Field label={tField('leitwegId')} value={supplierLeitwegId} mono />
          <Field label={tField('invoiceNumber')} value={invoiceNumber} mono />
          <Field label={tField('date')} value={formattedDate} />
          <Field label={tField('currency')} value={currency} mono />
          <Field
            label={tField('totalGross')}
            value={formattedTotal}
            className="font-mono tabular-nums"
          />
          <Field
            label={tField('lineCount')}
            value={lineCount !== null && lineCount !== undefined ? String(lineCount) : null}
            mono
          />
          <dt className="text-muted-foreground">{tField('profileLevel')}</dt>
          <dd>{profileLevel ? <IntakeProfileLevelBadge level={profileLevel} /> : '—'}</dd>
        </dl>

        {hasUnmapped && (
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen(prev => !prev)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-expanded={advancedOpen}
              aria-controls="intake-unmapped-fields">
              <span className="flex items-center gap-1">
                {advancedOpen ? (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                )}
                {t('advancedSectionHeading')}
              </span>
            </button>
            {advancedOpen && (
              <div id="intake-unmapped-fields" className="mt-2">
                <p className="mb-2 text-xs text-muted-foreground">{t('unmappedFieldsHeading')}</p>
                <pre className="max-h-60 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-[11px]">
                  {JSON.stringify(unmappedFields, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FieldProps {
  label: string;
  value: string | null;
  mono?: boolean;
  className?: string;
}

function Field({ label, value, mono, className }: FieldProps) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${mono ? 'font-mono text-xs' : ''} ${className ?? ''}`}>{value ?? '—'}</dd>
    </>
  );
}

function formatTotal(
  totalMinor: number | bigint | string | null,
  currency: string | null,
): string | null {
  if (totalMinor === null || totalMinor === undefined) return null;
  let minor: number;
  if (typeof totalMinor === 'bigint') minor = Number(totalMinor);
  else if (typeof totalMinor === 'string') minor = Number(totalMinor);
  else minor = totalMinor;
  if (!Number.isFinite(minor)) return null;
  const safeCurrency = currency ?? 'EUR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${safeCurrency}`;
  }
}
