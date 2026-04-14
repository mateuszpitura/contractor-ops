'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CalendarIcon, Loader2, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { VatRateSelector } from '@/components/invoices/vat-rate-selector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Local Zod schema (mirrors invoiceUpdateSchema to avoid cross-package dep)
// ---------------------------------------------------------------------------

function createInvoiceMetadataSchema(tv: (key: string) => string) {
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

import { displayToMinor, minorToDisplay } from '@/lib/currency-conversion';

/** Format a Date to ISO date string (YYYY-MM-DD) */
function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceMetadataFormProps = {
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string | null;
    dueDate: string | null;
    servicePeriodStart: string | null;
    servicePeriodEnd: string | null;
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
  };
  onSubmittedForMatching?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceMetadataForm({ invoice, onSubmittedForMatching }: InvoiceMetadataFormProps) {
  const t = useTranslations('Invoices');
  const tMeta = useTranslations('Invoices.metadata');
  const tv = useTranslations('Validation.invoice');
  const id = useId();
  const queryClient = useQueryClient();
  const isEditable = invoice.status === 'RECEIVED';

  const invoiceMetadataSchema = createInvoiceMetadataSchema((key: string) =>
    tv(key as Parameters<typeof tv>[0]),
  );
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InvoiceMetadataValues>({
    resolver: zodResolver(invoiceMetadataSchema),
    defaultValues: {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate ?? '',
      dueDate: invoice.dueDate ?? '',
      servicePeriodStart: invoice.servicePeriodStart ?? undefined,
      servicePeriodEnd: invoice.servicePeriodEnd ?? undefined,
      sellerTaxId: invoice.sellerTaxId ?? undefined,
      subtotalMinor: invoice.subtotalMinor,
      vatRate: invoice.vatRate ?? undefined,
      vatAmountMinor: invoice.vatAmountMinor ?? undefined,
      totalMinor: invoice.totalMinor,
      withholdingMinor: invoice.withholdingMinor ?? undefined,
      amountToPayMinor: invoice.amountToPayMinor,
      currency: invoice.currency,
      sellerBankAccount: invoice.sellerBankAccount ?? undefined,
    },
  });

  // Reset form when invoice data changes (e.g. after submission)
  useEffect(() => {
    reset({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate ?? '',
      dueDate: invoice.dueDate ?? '',
      servicePeriodStart: invoice.servicePeriodStart ?? undefined,
      servicePeriodEnd: invoice.servicePeriodEnd ?? undefined,
      sellerTaxId: invoice.sellerTaxId ?? undefined,
      subtotalMinor: invoice.subtotalMinor,
      vatRate: invoice.vatRate ?? undefined,
      vatAmountMinor: invoice.vatAmountMinor ?? undefined,
      totalMinor: invoice.totalMinor,
      withholdingMinor: invoice.withholdingMinor ?? undefined,
      amountToPayMinor: invoice.amountToPayMinor,
      currency: invoice.currency,
      sellerBankAccount: invoice.sellerBankAccount ?? undefined,
    });
  }, [invoice, reset]);

  // Watched values for date pickers
  const issueDateValue = watch('issueDate');
  const dueDateValue = watch('dueDate');
  const servicePeriodStartValue = watch('servicePeriodStart');
  const servicePeriodEndValue = watch('servicePeriodEnd');
  const vatRateValue = watch('vatRate');
  const currencyValue = watch('currency');

  // Save draft mutation
  const saveDraftMutation = useMutation(
    trpc.invoice.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('detail.savedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: invoice.id }),
        });
      },
      onError: () => {
        toast.error(t('detail.saveError'));
      },
    }),
  );

  // Submit for matching mutation
  const submitForMatchingMutation = useMutation(
    trpc.invoice.submitForMatching.mutationOptions({
      onSuccess: () => {
        toast.success(t('detail.submittedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: invoice.id }),
        });
        onSubmittedForMatching?.();
      },
      onError: () => {
        toast.error(t('detail.submitError'));
      },
    }),
  );

  // Void invoice mutation
  const voidMutation = useMutation(
    trpc.invoice.voidInvoice.mutationOptions({
      onSuccess: () => {
        toast.success(t('detail.voidedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: invoice.id }),
        });
      },
      onError: () => {
        toast.error(t('detail.voidError'));
      },
    }),
  );

  function onSaveDraft(values: InvoiceMetadataValues) {
    saveDraftMutation.mutate({
      id: invoice.id,
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
    });
  }

  function onSubmitForMatching(values: InvoiceMetadataValues) {
    // Save first, then submit for matching
    saveDraftMutation.mutate(
      {
        id: invoice.id,
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
      },
      {
        onSuccess: () => {
          submitForMatchingMutation.mutate({ id: invoice.id });
        },
      },
    );
  }

  const isSubmitting = saveDraftMutation.isPending || submitForMatchingMutation.isPending;

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
              <div className="space-y-1.5">
                <Label>{t('detail.issueDate')}</Label>
                <DatePicker
                  value={issueDateValue}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={date => setValue('issueDate', date)}
                  disabled={!isEditable}
                  pickDateLabel={tMeta('pickDate')}
                />
                {!!errors.issueDate && (
                  <p className="text-xs text-destructive">{errors.issueDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('detail.dueDate')}</Label>
                <DatePicker
                  value={dueDateValue}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={date => setValue('dueDate', date)}
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
              <div className="space-y-1.5">
                <Label>{t('detail.servicePeriodStart')}</Label>
                <DatePicker
                  value={servicePeriodStartValue ?? ''}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={date => setValue('servicePeriodStart', date || undefined)}
                  disabled={!isEditable}
                  pickDateLabel={tMeta('pickDate')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('detail.servicePeriodEnd')}</Label>
                <DatePicker
                  value={servicePeriodEndValue ?? ''}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={date => setValue('servicePeriodEnd', date || undefined)}
                  disabled={!isEditable}
                  pickDateLabel={tMeta('pickDate')}
                />
              </div>
            </div>

            {/* Seller NIP */}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-sellerTaxId`}>{t('detail.sellerNip')}</Label>
              <Input
                id={`${id}-sellerTaxId`}
                className="font-mono text-[13px]"
                placeholder={t('detail.sellerNipPlaceholder')}
                disabled={!isEditable}
                {...register('sellerTaxId')}
              />
            </div>

            {/* Net amount + VAT rate row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-netAmount`}>{t('detail.netAmount')}</Label>
                <CurrencyInput
                  id={`${id}-netAmount`}
                  value={watch('subtotalMinor')}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={minor => setValue('subtotalMinor', minor)}
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
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={code => setValue('vatRate', code)}
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
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={minor => setValue('vatAmountMinor', minor)}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-grossAmount`}>{t('detail.grossAmount')}</Label>
                <CurrencyInput
                  id={`${id}-grossAmount`}
                  value={watch('totalMinor')}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={minor => setValue('totalMinor', minor)}
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
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={minor => setValue('withholdingMinor', minor)}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-amountToPay`}>{t('detail.amountToPay')}</Label>
                <CurrencyInput
                  id={`${id}-amountToPay`}
                  value={watch('amountToPayMinor')}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={minor => setValue('amountToPayMinor', minor)}
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
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onValueChange={val => {
                    if (val) setValue('currency', val);
                  }}
                  disabled={!isEditable}>
                  <SelectTrigger>
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
                <Input
                  id={`${id}-bankAccount`}
                  className="font-mono text-[13px]"
                  placeholder={t('detail.bankAccountPlaceholder')}
                  disabled={!isEditable}
                  {...register('sellerBankAccount')}
                />
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <div className="flex items-center gap-2">
                {isEditable && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={handleSubmit(onSaveDraft)}>
                      {!!saveDraftMutation.isPending && (
                        <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      {t('detail.saveDraft')}
                    </Button>
                    <Button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSubmit(onSubmitForMatching)}>
                      {!!submitForMatchingMutation.isPending && (
                        <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      {t('detail.submitForMatching')}
                    </Button>
                  </>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() => setVoidDialogOpen(true)}>
                    <AlertTriangle className="me-1.5 h-3.5 w-3.5" />
                    {t('detail.voidInvoice')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Void confirmation dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.voidConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('detail.voidConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('detail.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                voidMutation.mutate({ id: invoice.id });
                setVoidDialogOpen(false);
              }}>
              {!!voidMutation.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('detail.voidInvoiceCta')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={`w-full justify-start text-start font-normal ${
              isValid ? '' : 'text-muted-foreground'
            } ${disabled ? 'pointer-events-none opacity-50 bg-muted' : ''}`}
            disabled={disabled}
          />
        }>
        <CalendarIcon className="me-2 h-4 w-4" />
        {isValid ? format(parsed, 'yyyy-MM-dd') : (pickDateLabel ?? 'Pick a date')}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValid ? parsed : undefined}
          // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
          onSelect={date => {
            if (date) onChange(toDateString(date));
          }}
        />
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

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className="font-mono text-[13px] text-end"
      value={displayValue}
      disabled={disabled}
      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
      onChange={e => {
        const raw = e.target.value;
        // Allow typing decimals
        if (/^[0-9]*[.,]?[0-9]{0,2}$/.test(raw) || raw === '') {
          setDisplayValue(raw);
        }
      }}
      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
      onBlur={() => {
        const minor = displayToMinor(displayValue.replace(',', '.'));
        onChange(minor);
        setDisplayValue(minorToDisplay(minor));
      }}
    />
  );
}
