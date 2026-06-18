import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { formControlPopoverRender } from '@contractor-ops/ui/components/shadcn/form-control-trigger';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { cn } from '@contractor-ops/ui/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usePermissions } from '../../../hooks/use-permissions.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useFlag } from '../../layout/feature-flag-context.js';
import type { InvoiceAction } from '../actions.js';
import { getDetailInvoiceActions } from '../actions.js';
import { useInvoiceMetadataForm } from '../hooks/use-invoice-metadata-form.js';
import { LateInterestCard } from '../late-interest/late-interest-card.js';
import { SkontoFormSection } from '../skonto/skonto-form-section.js';
import { VatRateSelector } from '../vat-rate-selector.js';

// ---------------------------------------------------------------------------
// Local Zod schema (mirrors invoiceUpdateSchema to avoid cross-package dep)
// ---------------------------------------------------------------------------

function createInvoiceMetadataSchema(tv: LooseTranslator) {
  return z.object({
    invoiceNumber: z.string().min(1, tv('invoiceNumberRequired')).max(100),
    issueDate: z.string().min(1, tv('issueDateRequired')),
    dueDate: z.string().min(1, tv('dueDateRequired')),
    servicePeriodStart: z.string().optional(),
    servicePeriodEnd: z.string().optional(),
    sellerTaxId: z.string().max(50).optional(),
    subtotalMinor: z.number().int().min(1, tv('netAmountPositive')),
    vatRate: z.string().optional(),
    vatAmountMinor: z.number().int().min(0).optional(),
    totalMinor: z.number().int().min(1, tv('grossAmountPositive')),
    withholdingMinor: z.number().int().min(0).optional(),
    amountToPayMinor: z.number().int().min(0),
    currency: z.string().length(3),
    sellerBankAccount: z.string().max(34).optional(),
  });
}

type InvoiceMetadataValues = z.infer<ReturnType<typeof createInvoiceMetadataSchema>>;

// ---------------------------------------------------------------------------
// VAT rate options
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = [
  { value: 'PLN', label: 'PLN' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { displayToMinor, minorToDisplay } from '../../../lib/currency-conversion.js';
import { canViewSensitivePii, maskBankAccount, maskTaxId } from '../../../lib/mask-pii.js';

/** Format a Date to ISO date string (YYYY-MM-DD) */
function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceMetadataMutations = ReturnType<typeof useInvoiceMetadataForm>;

export type InvoiceMetadataFormViewProps = {
  mutations: InvoiceMetadataMutations;
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string | Date | null;
    dueDate: string | Date | null;
    servicePeriodStart: string | Date | null;
    servicePeriodEnd: string | Date | null;
    sellerTaxId: string | null;
    subtotalMinor: number;
    vatRate: string | null;
    vatAmountMinor: number | null;
    totalMinor: number;
    withholdingMinor: number | null;
    amountToPayMinor: number;
    currency: string;
    sellerBankAccount: string | null;
    status: string;
    contractor?: {
      countryCode?: string | null;
      isBusinessCustomer?: boolean | null;
    } | null;
  };
  onSubmittedForMatching?: () => void;
  detailSidecars?: ReactNode;
};

/**
 * Convert a date-ish field (string | Date | null | undefined) into a
 * YYYY-MM-DD string suitable for `<input type="date">` and Zod schema.
 */
function dateFieldToString(value: string | Date | null | undefined): string {
  if (value instanceof Date) return toDateString(value);
  return value ?? '';
}

/**
 * Like `dateFieldToString` but preserves null/undefined as `undefined`
 * for fields that are optional in the form schema.
 */
function dateFieldToOptionalString(value: string | Date | null | undefined): string | undefined {
  if (value === null || value === undefined) return;
  return value instanceof Date ? toDateString(value) : value;
}

/**
 * Maps the raw invoice resource into the form's `defaultValues` / `reset`
 * payload. Centralises the null/undefined coalescing for every optional
 * field so the component body stays simple.
 */
function getDefaultFormValues(
  invoice: InvoiceMetadataFormViewProps['invoice'],
): InvoiceMetadataValues {
  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: dateFieldToString(invoice.issueDate),
    dueDate: dateFieldToString(invoice.dueDate),
    servicePeriodStart: dateFieldToOptionalString(invoice.servicePeriodStart),
    servicePeriodEnd: dateFieldToOptionalString(invoice.servicePeriodEnd),
    sellerTaxId: invoice.sellerTaxId ?? undefined,
    subtotalMinor: invoice.subtotalMinor,
    vatRate: invoice.vatRate ?? undefined,
    vatAmountMinor: invoice.vatAmountMinor ?? undefined,
    totalMinor: invoice.totalMinor,
    withholdingMinor: invoice.withholdingMinor ?? undefined,
    amountToPayMinor: invoice.amountToPayMinor,
    currency: invoice.currency,
    sellerBankAccount: invoice.sellerBankAccount ?? undefined,
  };
}

/**
 * Builds the `{id, data}` payload accepted by `invoice.update`, normalising
 * empty strings to `undefined` for optional fields.
 */
function _buildUpdatePayload(values: InvoiceMetadataValues, invoiceId: string) {
  return {
    id: invoiceId,
    data: {
      invoiceNumber: values.invoiceNumber,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      servicePeriodStart: values.servicePeriodStart || undefined,
      servicePeriodEnd: values.servicePeriodEnd || undefined,
      sellerTaxId: values.sellerTaxId || undefined,
      subtotalMinor: values.subtotalMinor,
      vatRate: (values.vatRate as '23' | '8' | '5' | '0' | 'ZW' | 'NP') || undefined,
      vatAmountMinor: values.vatAmountMinor,
      totalMinor: values.totalMinor,
      withholdingMinor: values.withholdingMinor,
      amountToPayMinor: values.amountToPayMinor,
      currency: values.currency,
      sellerBankAccount: values.sellerBankAccount || undefined,
    },
  };
}

/**
 * Resolves an action label using the namespace declared on the action itself.
 * Translator instances are passed in so the helper stays free of React deps.
 */
function resolveActionLabel(
  action: InvoiceAction,
  translators: {
    t: LooseTranslator;
    tDetail: LooseTranslator;
    tBulk: LooseTranslator;
  },
): string {
  if (action.i18nNamespace === 'Invoices.detail') {
    return translators.tDetail(action.labelKey);
  }
  if (action.i18nNamespace === 'Invoices.bulkActions') {
    return translators.tBulk(action.labelKey);
  }
  return translators.t(action.labelKey);
}

// ---------------------------------------------------------------------------
// Action bar sub-component (registry-driven save / submit / void)
// ---------------------------------------------------------------------------

interface InvoiceActionBarProps {
  editAction: InvoiceAction | undefined;
  submitForMatchingAction: InvoiceAction | undefined;
  voidAction: InvoiceAction | undefined;
  isSubmitting: boolean;
  isSaving: boolean;
  isSubmittingForMatching: boolean;
  onSaveDraft: () => void;
  onSubmitForMatching: () => void;
  onOpenVoidDialog: () => void;
  resolveLabel: (action: InvoiceAction) => string;
  moreActionsLabel: string;
}

function InvoiceActionBar({
  editAction,
  submitForMatchingAction,
  voidAction,
  isSubmitting,
  isSaving,
  isSubmittingForMatching,
  onSaveDraft,
  onSubmitForMatching,
  onOpenVoidDialog,
  resolveLabel,
  moreActionsLabel,
}: InvoiceActionBarProps) {
  const VoidIcon = voidAction?.icon;
  return (
    <div className="flex items-center justify-between gap-2 border-t pt-4">
      <div className="flex items-center gap-2">
        {!!editAction && (
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onSaveDraft}>
            {!!isSaving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {resolveLabel(editAction)}
          </Button>
        )}
        {!!submitForMatchingAction && (
          <Button type="button" disabled={isSubmitting} onClick={onSubmitForMatching}>
            {!!isSubmittingForMatching && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {resolveLabel(submitForMatchingAction)}
          </Button>
        )}
      </div>

      {!!voidAction && !!VoidIcon && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">{moreActionsLabel}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onOpenVoidDialog}>
              <VoidIcon className="me-1.5 h-3.5 w-3.5" />
              {resolveLabel(voidAction)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Void confirmation dialog
// ---------------------------------------------------------------------------

interface VoidConfirmDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  labels: {
    title: string;
    body: string;
    cancel: string;
    confirm: string;
  };
}

function VoidConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  labels,
}: VoidConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4" />
            {labels.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{labels.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {!!isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {labels.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cohesive metadata form render with many permission/PII/validation-gated field sections closing over component scope
export function InvoiceMetadataFormView({
  invoice,
  mutations,
  detailSidecars,
}: InvoiceMetadataFormViewProps) {
  const t = useTranslations('Invoices');
  const tDetail = useTranslations('Invoices.detail');
  const tBulk = useTranslations('Invoices.bulkActions');
  const tMeta = useTranslations('Invoices.metadata');
  const tv = useTranslations('Validation.invoice');
  const id = useId();
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const isEditable = invoice.status === 'RECEIVED';
  // ---- Registry-driven action inventory (single source of truth) --------
  // Resolves visible detail actions purely from `actions.ts`. Each action
  // supplies its own label + icon + variant; the consumer wires the
  // matching mutation by `action.key`. Keeps the action bar in lockstep
  // with the registry and future bulk / row-menu surfaces.
  const detailActions = useMemo(
    () => getDetailInvoiceActions({ id: invoice.id, status: invoice.status }),
    [invoice.id, invoice.status],
  );

  const actionByKey = useMemo(
    () => new Map<string, InvoiceAction>(detailActions.map(a => [a.key, a])),
    [detailActions],
  );
  const editAction = actionByKey.get('edit');
  const submitForMatchingAction = actionByKey.get('submitForMatching');
  const voidAction = actionByKey.get('void');

  const resolveLabel = useCallback(
    (action: InvoiceAction) =>
      resolveActionLabel(action, {
        t: (key: string) => tKey(t, key),
        tDetail: (key: string) => tKey(tDetail, key),
        tBulk: (key: string) => tKey(tBulk, key),
      }),
    [t, tDetail, tBulk],
  );

  const invoiceMetadataSchema = createInvoiceMetadataSchema((key: string) => tKey(tv, key));
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const {
    onSaveDraft,
    onSubmitForMatching,
    onVoid,
    isSaving,
    isSubmittingForMatching,
    isVoiding,
    isSubmitting,
  } = mutations;

  const openVoidDialog = useCallback(() => setVoidDialogOpen(true), []);
  const onConfirmVoid = useCallback(() => {
    onVoid();
    setVoidDialogOpen(false);
  }, [onVoid]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InvoiceMetadataValues>({
    resolver: zodResolver(invoiceMetadataSchema),
    defaultValues: getDefaultFormValues(invoice),
  });

  const onIssueDateChange = useCallback((date: string) => setValue('issueDate', date), [setValue]);
  const onDueDateChange = useCallback((date: string) => setValue('dueDate', date), [setValue]);
  const onServicePeriodStartChange = useCallback(
    (date: string) => setValue('servicePeriodStart', date || undefined),
    [setValue],
  );
  const onServicePeriodEndChange = useCallback(
    (date: string) => setValue('servicePeriodEnd', date || undefined),
    [setValue],
  );
  const onSubtotalChange = useCallback(
    (minor: number) => setValue('subtotalMinor', minor),
    [setValue],
  );
  const onVatRateChange = useCallback((code: string) => setValue('vatRate', code), [setValue]);
  const onVatAmountChange = useCallback(
    (minor: number) => setValue('vatAmountMinor', minor),
    [setValue],
  );
  const onTotalChange = useCallback((minor: number) => setValue('totalMinor', minor), [setValue]);
  const onWithholdingChange = useCallback(
    (minor: number) => setValue('withholdingMinor', minor),
    [setValue],
  );
  const onAmountToPayChange = useCallback(
    (minor: number) => setValue('amountToPayMinor', minor),
    [setValue],
  );
  const onCurrencyChange = useCallback(
    (val: string | null) => {
      if (val) setValue('currency', val);
    },
    [setValue],
  );

  // Reset form when invoice data changes (e.g. after submission)
  useEffect(() => {
    reset(getDefaultFormValues(invoice));
  }, [invoice, reset]);

  // Watched values for date pickers
  const issueDateValue = watch('issueDate');
  const dueDateValue = watch('dueDate');
  const servicePeriodStartValue = watch('servicePeriodStart');
  const servicePeriodEndValue = watch('servicePeriodEnd');
  const vatRateValue = watch('vatRate');
  const currencyValue = watch('currency');
  const sellerTaxIdValue = watch('sellerTaxId');
  const sellerBankAccountValue = watch('sellerBankAccount');

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4">
            {/* Invoice number */}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-invoiceNumber`}>{t('detail.invoiceNumber')}</Label>
              <Input
                id={`${id}-invoiceNumber`}
                className="font-mono text-[13px]"
                placeholder={t('detail.invoiceNumberPlaceholder')}
                disabled={!isEditable}
                {...register('invoiceNumber')}
              />
              {!!errors.invoiceNumber && (
                <p className="text-xs text-destructive">{errors.invoiceNumber.message}</p>
              )}
            </div>

            {/* Issue date + Due date row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t('detail.issueDate')}</Label>
                <DatePicker
                  value={issueDateValue}
                  onChange={onIssueDateChange}
                  disabled={!isEditable}
                  pickDateLabel={tMeta('pickDate')}
                />
                {!!errors.issueDate && (
                  <p className="text-xs text-destructive">{errors.issueDate.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('detail.dueDate')}</Label>
                <DatePicker
                  value={dueDateValue}
                  onChange={onDueDateChange}
                  disabled={!isEditable}
                  pickDateLabel={tMeta('pickDate')}
                />
                {!!errors.dueDate && (
                  <p className="text-xs text-destructive">{errors.dueDate.message}</p>
                )}
              </div>
            </div>

            {/* Service period row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t('detail.servicePeriodStart')}</Label>
                <DatePicker
                  value={servicePeriodStartValue ?? ''}
                  onChange={onServicePeriodStartChange}
                  disabled={!isEditable}
                  pickDateLabel={tMeta('pickDate')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('detail.servicePeriodEnd')}</Label>
                <DatePicker
                  value={servicePeriodEndValue ?? ''}
                  onChange={onServicePeriodEndChange}
                  disabled={!isEditable}
                  pickDateLabel={tMeta('pickDate')}
                />
              </div>
            </div>

            {/* Seller NIP */}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-sellerTaxId`}>{t('detail.sellerNip')}</Label>
              {showPii ? (
                <Input
                  id={`${id}-sellerTaxId`}
                  className="font-mono text-[13px]"
                  placeholder={t('detail.sellerNipPlaceholder')}
                  disabled={!isEditable}
                  {...register('sellerTaxId')}
                />
              ) : (
                <Input
                  id={`${id}-sellerTaxId`}
                  className="font-mono text-[13px]"
                  value={maskTaxId(sellerTaxIdValue ?? invoice.sellerTaxId) ?? '—'}
                  disabled
                  readOnly
                />
              )}
            </div>

            {/* Net amount + VAT rate row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-netAmount`}>{t('detail.netAmount')}</Label>
                <CurrencyInput
                  id={`${id}-netAmount`}
                  value={watch('subtotalMinor')}
                  onChange={onSubtotalChange}
                  disabled={!isEditable}
                />
                {!!errors.subtotalMinor && (
                  <p className="text-xs text-destructive">{errors.subtotalMinor.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('detail.vatRate')}</Label>
                <VatRateSelector
                  value={vatRateValue ?? undefined}
                  onChange={onVatRateChange}
                  disabled={!isEditable}
                />
              </div>
            </div>

            {/* VAT amount + Gross amount row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-vatAmount`}>{t('detail.vatAmount')}</Label>
                <CurrencyInput
                  id={`${id}-vatAmount`}
                  value={watch('vatAmountMinor') ?? 0}
                  onChange={onVatAmountChange}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-grossAmount`}>{t('detail.grossAmount')}</Label>
                <CurrencyInput
                  id={`${id}-grossAmount`}
                  value={watch('totalMinor')}
                  onChange={onTotalChange}
                  disabled={!isEditable}
                />
                {!!errors.totalMinor && (
                  <p className="text-xs text-destructive">{errors.totalMinor.message}</p>
                )}
              </div>
            </div>

            {/* Withholding + Amount to pay row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-withholding`}>{t('detail.withholding')}</Label>
                <CurrencyInput
                  id={`${id}-withholding`}
                  value={watch('withholdingMinor') ?? 0}
                  onChange={onWithholdingChange}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-amountToPay`}>{t('detail.amountToPay')}</Label>
                <CurrencyInput
                  id={`${id}-amountToPay`}
                  value={watch('amountToPayMinor')}
                  onChange={onAmountToPayChange}
                  disabled={!isEditable}
                />
              </div>
            </div>

            {/* Currency + Bank account row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('detail.currency')}</Label>
                <Select
                  value={currencyValue}
                  onValueChange={onCurrencyChange}
                  disabled={!isEditable}>
                  <SelectTrigger aria-label={t('detail.currency')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-bankAccount`}>{t('detail.bankAccount')}</Label>
                {showPii ? (
                  <Input
                    id={`${id}-bankAccount`}
                    className="font-mono text-[13px]"
                    placeholder={t('detail.bankAccountPlaceholder')}
                    disabled={!isEditable}
                    {...register('sellerBankAccount')}
                  />
                ) : (
                  <Input
                    id={`${id}-bankAccount`}
                    className="font-mono text-[13px]"
                    value={
                      maskBankAccount(sellerBankAccountValue ?? invoice.sellerBankAccount) ?? '—'
                    }
                    disabled
                    readOnly
                  />
                )}
              </div>
            </div>

            {/* Action bar — sourced from getDetailInvoiceActions() */}
            <InvoiceActionBar
              editAction={editAction}
              submitForMatchingAction={submitForMatchingAction}
              voidAction={voidAction}
              isSubmitting={isSubmitting}
              isSaving={isSaving}
              isSubmittingForMatching={isSubmittingForMatching}
              onSaveDraft={handleSubmit(onSaveDraft)}
              onSubmitForMatching={handleSubmit(onSubmitForMatching)}
              onOpenVoidDialog={openVoidDialog}
              resolveLabel={resolveLabel}
              moreActionsLabel={t('detail.moreActions')}
            />
          </form>
        </CardContent>
      </Card>

      {detailSidecars}

      <VoidConfirmDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        onConfirm={onConfirmVoid}
        isPending={isVoiding}
        labels={{
          title: t('detail.voidConfirmTitle'),
          body: t('detail.voidConfirmBody'),
          cancel: t('detail.cancel'),
          confirm: t('detail.voidInvoiceCta'),
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// DatePicker sub-component
// ---------------------------------------------------------------------------

function DatePicker({
  value,
  onChange,
  disabled,
  pickDateLabel,
}: {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  pickDateLabel?: string;
}) {
  const parsed = value ? new Date(value) : undefined;
  const isValid = parsed && !Number.isNaN(parsed.getTime());

  const handleSelect = useCallback(
    (date: Date | undefined) => {
      if (date) onChange(toDateString(date));
    },
    [onChange],
  );

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        render={formControlPopoverRender(cn('text-start', !isValid && 'text-muted-foreground'))}>
        <CalendarIcon className="me-2 h-4 w-4" />
        {isValid ? format(parsed, 'yyyy-MM-dd') : (pickDateLabel ?? 'Pick a date')}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={isValid ? parsed : undefined} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// CurrencyInput sub-component (minor <-> display)
// ---------------------------------------------------------------------------

function CurrencyInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: number;
  onChange: (minor: number) => void;
  disabled?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(minorToDisplay(value));

  // Sync display when external value changes
  useEffect(() => {
    setDisplayValue(minorToDisplay(value));
  }, [value]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (/^[0-9]*[.,]?[0-9]{0,2}$/.test(raw) || raw === '') {
      setDisplayValue(raw);
    }
  }, []);

  const handleBlur = useCallback(() => {
    const minor = displayToMinor(displayValue.replace(',', '.'));
    onChange(minor);
    setDisplayValue(minorToDisplay(minor));
  }, [displayValue, onChange]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className="font-mono text-[13px] text-end"
      value={displayValue}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

type InvoiceMetadataFormProps = {
  invoice: InvoiceMetadataFormViewProps['invoice'];
  onSubmittedForMatching?: () => void;
};

export function InvoiceMetadataForm({ invoice, onSubmittedForMatching }: InvoiceMetadataFormProps) {
  const mutations = useInvoiceMetadataForm(invoice.id, onSubmittedForMatching);
  const skontoEnabled = useFlag('payments.skonto-enabled');
  const lateInterestEnabled = useFlag('payments.late-interest-enabled');
  const contractor = invoice.contractor;
  const country = contractor?.countryCode ?? '';
  const isBiz = contractor?.isBusinessCustomer ?? false;

  return (
    <InvoiceMetadataFormView
      invoice={invoice}
      mutations={mutations}
      detailSidecars={
        <>
          <LateInterestCard
            invoiceId={invoice.id}
            featureEnabled={lateInterestEnabled}
            contractorCountryCode={country}
            isBusinessCustomer={isBiz}
            currency={invoice.currency}
          />
          <SkontoFormSection
            invoiceId={invoice.id}
            featureEnabled={skontoEnabled}
            contractorCountryCode={country}
          />
        </>
      }
    />
  );
}
