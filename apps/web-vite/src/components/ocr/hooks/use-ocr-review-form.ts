/**
 * Form-state hook for the OCR review panel.
 *
 * Lifts the per-field React state, the populate-from-result effect, the
 * cascade-reveal animation, and the accept callback out of the
 * presentational `OcrReviewPanel`. Container composes this with
 * `useOcrExtractionResult` and feeds a single props bag to the panel.
 *
 * Boundary: no tRPC / React Query here — pure form state + derived values.
 */

import type { OcrExtractionResult, OcrLineItem } from '@contractor-ops/integrations/types/ocr';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';

export interface LineItemFormData {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceMinor: number | null;
  netAmountMinor: number | null;
  vatRate: string | null;
  vatAmountMinor: number | null;
  grossAmountMinor: number | null;
  confidence: number;
}

export interface ExtractedInvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalMinor: number;
  vatAmountMinor: number;
  totalMinor: number;
  sellerTaxId: string;
  sellerName: string;
  buyerTaxId: string;
  buyerName: string;
  sellerBankAccount: string;
  lineItems: LineItemFormData[];
}

interface UseOcrReviewFormArgs {
  resultJson: OcrExtractionResult | null | undefined;
  isComplete: boolean;
  onAccept: (data: ExtractedInvoiceData) => void;
}

export interface OcrReviewFormState {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalMinor: string;
  vatAmountMinor: string;
  totalMinor: string;
  sellerTaxId: string;
  sellerName: string;
  buyerTaxId: string;
  buyerName: string;
  sellerBankAccount: string;
  lineItems: LineItemFormData[];
}

export interface OcrReviewFormSetters {
  setInvoiceNumber: (value: string) => void;
  setIssueDate: (value: string) => void;
  setDueDate: (value: string) => void;
  setCurrency: (value: string) => void;
  setSubtotalMinor: (value: string) => void;
  setVatAmountMinor: (value: string) => void;
  setTotalMinor: (value: string) => void;
  setSellerTaxId: (value: string) => void;
  setSellerName: (value: string) => void;
  setBuyerTaxId: (value: string) => void;
  setBuyerName: (value: string) => void;
  setSellerBankAccount: (value: string) => void;
  setLineItems: (items: LineItemFormData[]) => void;
}

export interface OcrReviewFormDerived {
  fieldCount: number;
  totalFields: number;
  visibleFields: Set<string>;
  isPopulated: boolean;
  handleAccept: () => void;
}

const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP'] as const;
export const OCR_CURRENCIES = CURRENCIES;

const FIELD_ORDER = [
  'invoiceNumber',
  'issueDate',
  'dueDate',
  'currency',
  'sellerTaxId',
  'buyerTaxId',
  'sellerName',
  'buyerName',
  'subtotalMinor',
  'vatAmountMinor',
  'totalMinor',
  'sellerBankAccount',
] as const;

function getFieldValue(
  fields: Record<string, { value: string | number | null }> | undefined,
  key: string,
): string {
  const field = fields?.[key];
  if (!field || field.value == null) return '';
  return String(field.value);
}

function getNumericFieldMinor(
  fields: Record<string, { value: string | number | null }> | undefined,
  key: string,
): number {
  const field = fields?.[key];
  if (!field || field.value == null) return 0;
  const num = typeof field.value === 'number' ? field.value : parseFloat(field.value);
  return Number.isNaN(num) ? 0 : num;
}

function formatMinorUnits(minor: number): string {
  if (minor === 0) return '';
  return (minor / 100).toFixed(2);
}

function parseMinorUnits(display: string): number {
  const value = parseFloat(display);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

function mapLineItems(items: OcrLineItem[]): LineItemFormData[] {
  return items.map(item => ({
    id: crypto.randomUUID(),
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceMinor: item.unitPriceMinor,
    netAmountMinor: item.netAmountMinor,
    vatRate: item.vatRate,
    vatAmountMinor: item.vatAmountMinor,
    grossAmountMinor: item.grossAmountMinor,
    confidence: item.confidence,
  }));
}

function useCascadeAnimation(isReady: boolean) {
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isReady) {
      setVisibleFields(new Set());
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    FIELD_ORDER.forEach((field, index) => {
      const timer = setTimeout(() => {
        setVisibleFields(prev => new Set([...prev, field]));
      }, index * 50);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [isReady]);

  return visibleFields;
}

export function useOcrReviewForm({ resultJson, isComplete, onAccept }: UseOcrReviewFormArgs): {
  state: OcrReviewFormState;
  setters: OcrReviewFormSetters;
  derived: OcrReviewFormDerived;
} {
  const t = useTranslations('OcrReview');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('PLN');
  const [subtotalMinor, setSubtotalMinor] = useState('');
  const [vatAmountMinor, setVatAmountMinor] = useState('');
  const [totalMinor, setTotalMinor] = useState('');
  const [sellerTaxId, setSellerTaxId] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [buyerTaxId, setBuyerTaxId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [sellerBankAccount, setSellerBankAccount] = useState('');
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);
  const [hasPopulated, setHasPopulated] = useState(false);

  const visibleFields = useCascadeAnimation(isComplete && hasPopulated);

  useEffect(() => {
    if (!resultJson || hasPopulated) return;
    if (resultJson.status !== 'EXTRACTED' && resultJson.status !== 'PARTIAL') return;

    const fields = resultJson.fields;

    setInvoiceNumber(getFieldValue(fields, 'invoiceNumber'));
    setIssueDate(getFieldValue(fields, 'issueDate'));
    setDueDate(getFieldValue(fields, 'dueDate'));
    setCurrency(getFieldValue(fields, 'currency') || 'PLN');
    setSubtotalMinor(formatMinorUnits(getNumericFieldMinor(fields, 'totalNet')));
    setVatAmountMinor(formatMinorUnits(getNumericFieldMinor(fields, 'totalTax')));
    setTotalMinor(formatMinorUnits(getNumericFieldMinor(fields, 'totalGross')));
    setSellerTaxId(getFieldValue(fields, 'sellerNip'));
    setSellerName(getFieldValue(fields, 'sellerName'));
    setBuyerTaxId(getFieldValue(fields, 'buyerNip'));
    setBuyerName(getFieldValue(fields, 'buyerName'));
    setSellerBankAccount(getFieldValue(fields, 'bankAccount'));
    setLineItems(mapLineItems(resultJson.lineItems));
    setHasPopulated(true);

    toast.success(t('toastExtracted'));
  }, [resultJson, hasPopulated, t]);

  const fieldCount = resultJson
    ? Object.values(resultJson.fields).filter(f => f.value != null).length
    : 0;
  const totalFields = resultJson ? Object.keys(resultJson.fields).length : 0;

  const handleAccept = useCallback(() => {
    onAccept({
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      subtotalMinor: parseMinorUnits(subtotalMinor),
      vatAmountMinor: parseMinorUnits(vatAmountMinor),
      totalMinor: parseMinorUnits(totalMinor),
      sellerTaxId,
      sellerName,
      buyerTaxId,
      buyerName,
      sellerBankAccount,
      lineItems,
    });
  }, [
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    subtotalMinor,
    vatAmountMinor,
    totalMinor,
    sellerTaxId,
    sellerName,
    buyerTaxId,
    buyerName,
    sellerBankAccount,
    lineItems,
    onAccept,
  ]);

  return {
    state: {
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      subtotalMinor,
      vatAmountMinor,
      totalMinor,
      sellerTaxId,
      sellerName,
      buyerTaxId,
      buyerName,
      sellerBankAccount,
      lineItems,
    },
    setters: {
      setInvoiceNumber,
      setIssueDate,
      setDueDate,
      setCurrency,
      setSubtotalMinor,
      setVatAmountMinor,
      setTotalMinor,
      setSellerTaxId,
      setSellerName,
      setBuyerTaxId,
      setBuyerName,
      setSellerBankAccount,
      setLineItems,
    },
    derived: {
      fieldCount,
      totalFields,
      visibleFields,
      isPopulated: hasPopulated,
      handleAccept,
    },
  };
}
