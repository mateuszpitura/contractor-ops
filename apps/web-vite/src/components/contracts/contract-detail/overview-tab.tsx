import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Check, Pencil, X } from 'lucide-react';

import { Link } from '../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { formatDate } from '../../../lib/format-date.js';
import type { useExpiryRemindersEditor } from '../hooks/use-expiry-reminders-editor.js';

type OverviewTabProps = {
  contract: {
    id: string;
    title: string | null;
    type: string;
    status: string;
    startDate: string | Date | null;
    endDate: string | Date | null;
    noticePeriodDays: number | null;
    autoRenewal: boolean;
    renewalTerms: string | null;
    currency: string;
    billingModel: string | null;
    rateType: string | null;
    rateValueMinor: number | null;
    retainerAmountMinor: number | null;
    paymentTermsDays: number | null;
    invoiceCycle: string | null;
    notes: string | null;
    metadataJson: unknown;
    contractor: {
      id: string;
      legalName: string;
      displayName: string;
      status: string;
    } | null;
  };
  reminders: ReturnType<typeof useExpiryRemindersEditor>;
};

function formatCurrency(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function getDaysRemaining(endDate: string | Date): number {
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-[13px]' : ''}`}>{value}</span>
    </div>
  );
}

function ExpiryRemindersEditor({
  currentReminders,
  reminders,
}: {
  currentReminders: number[];
  reminders: ReturnType<typeof useExpiryRemindersEditor>;
}) {
  const t = useTranslations('ContractDetail.overview');
  const {
    editing,
    handleCancel,
    handleSave,
    isPending,
    reminders: remindersText,
    setReminders,
    startEditing,
  } = reminders;

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {currentReminders.length > 0
            ? t('reminders.display', {
                days: currentReminders.join(', '),
              })
            : t('reminders.none')}
        </span>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button variant="ghost" size="icon-sm" onClick={startEditing}>
          <Pencil className="size-3" />
          <span className="sr-only">{t('reminders.edit')}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={remindersText}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
        onChange={e => setReminders(e.target.value)}
        className="h-7 w-40 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder={t('remindersPlaceholder')}
      />
      {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
      <Button variant="ghost" size="icon-sm" onClick={handleSave} disabled={isPending}>
        <Check className="size-3" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={handleCancel}>
        <X className="size-3" />
      </Button>
    </div>
  );
}

function getDaysRemainingColor(days: number | null): string {
  if (days === null) return '';
  if (days > 60) return 'text-green-600 dark:text-green-400';
  if (days > 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function getNoticeDeadline(endDate: string | Date | null, noticeDays: number | null): Date | null {
  if (!(endDate && noticeDays)) return null;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return new Date(end.getTime() - noticeDays * 24 * 60 * 60 * 1000);
}

function translateEnum(
  value: string | null | undefined,
  prefix: string,
  tEnum: LooseTranslator,
): string | null {
  return value ? tEnum(`${prefix}.${enumKey(value)}` as string) : null;
}

export function OverviewTab({ contract, reminders }: OverviewTabProps) {
  const t = useTranslations('ContractDetail.overview');
  const tEnum = useTranslations('Contracts');
  const tContractor = useTranslations('Contractors');

  const metadata = (contract.metadataJson as Record<string, unknown>) ?? {};
  const reminderDaysBefore = (metadata.reminderDaysBefore as number[]) ?? [];

  const daysRemaining = contract.endDate ? getDaysRemaining(contract.endDate) : null;
  const daysColor = getDaysRemainingColor(daysRemaining);
  const noticeDeadline = getNoticeDeadline(contract.endDate, contract.noticePeriodDays);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('contractDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FieldRow
            label={t('fields.type')}
            value={translateEnum(contract.type, 'type', tEnum as LooseTranslator)}
          />
          <FieldRow
            label={t('fields.autoRenewal')}
            value={contract.autoRenewal ? t('fields.yes') : t('fields.no')}
          />
          {contract.noticePeriodDays != null && (
            <FieldRow
              label={t('fields.noticePeriod')}
              value={t('fields.noticePeriodDays', {
                days: contract.noticePeriodDays,
              })}
            />
          )}
          {!!contract.renewalTerms && (
            <FieldRow label={t('fields.renewalTerms')} value={contract.renewalTerms} />
          )}
          <FieldRow label={t('fields.notes')} value={contract.notes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('financialTerms')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {contract.rateValueMinor != null && (
            <FieldRow
              label={t('fields.rate')}
              value={formatCurrency(contract.rateValueMinor, contract.currency)}
              mono
            />
          )}
          <FieldRow label={t('fields.currency')} value={contract.currency} />
          <FieldRow
            label={t('fields.billingModel')}
            value={translateEnum(contract.billingModel, 'billingModel', tEnum as LooseTranslator)}
          />
          <FieldRow
            label={t('fields.rateType')}
            value={translateEnum(contract.rateType, 'rateType', tEnum as LooseTranslator)}
          />
          {contract.paymentTermsDays != null && (
            <FieldRow
              label={t('fields.paymentTerms')}
              value={t('fields.paymentTermsDays', {
                days: contract.paymentTermsDays,
              })}
            />
          )}
          <FieldRow
            label={t('fields.invoiceCycle')}
            value={translateEnum(contract.invoiceCycle, 'invoiceCycle', tEnum as LooseTranslator)}
          />
          {contract.retainerAmountMinor != null && (
            <FieldRow
              label={t('fields.retainerAmount')}
              value={formatCurrency(contract.retainerAmountMinor, contract.currency)}
              mono
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('keyDates')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!!contract.startDate && (
            <FieldRow label={t('fields.startDate')} value={formatDate(contract.startDate)} />
          )}
          {!!contract.endDate && (
            <FieldRow label={t('fields.endDate')} value={formatDate(contract.endDate)} />
          )}
          {!!noticeDeadline && (
            <FieldRow label={t('fields.noticeDeadline')} value={formatDate(noticeDeadline)} />
          )}
          {daysRemaining !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t('fields.daysRemaining')}</span>
              <span className={`text-sm font-medium ${daysColor}`}>
                {daysRemaining > 0
                  ? t('expiresIn', { days: daysRemaining })
                  : t('expiredAgo', { days: Math.abs(daysRemaining) })}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t('reminders.label')}</span>
            <ExpiryRemindersEditor currentReminders={reminderDaysBefore} reminders={reminders} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('linkedContractor')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {contract.contractor ? (
            <>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t('fields.contractorName')}</span>
                <Link
                  href={`/contractors/${contract.contractor.id}`}
                  className="text-sm text-primary hover:underline">
                  {contract.contractor.displayName}
                </Link>
              </div>
              <FieldRow label={t('fields.legalName')} value={contract.contractor.legalName} />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {t('fields.contractorStatus')}
                </span>
                <Badge variant="secondary" className="w-fit">
                  {tContractor(
                    `lifecycle.${enumKey(contract.contractor.status)}` as Parameters<
                      typeof tContractor
                    >[0],
                  )}
                </Badge>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noContractor')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
