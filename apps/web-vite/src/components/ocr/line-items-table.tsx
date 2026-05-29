/**
 * Line items table. Step 10 batch port from
 * apps/web/src/components/ocr/line-items-table.tsx:
 *   - `'use client'` stripped (SPA default)
 *   - `next-intl#useTranslations` → `../../i18n/useTranslations.js`
 *   - `@/components/ocr/confidence-badge` → `./confidence-badge.js`
 *   - `@/lib/utils` → `../../lib/utils.js`
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Plus, Trash2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import { ConfidenceBadge } from './confidence-badge.js';

interface LineItem {
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

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
}

function formatMinorUnits(minor: number | null): string {
  if (minor == null) return '';
  return (minor / 100).toFixed(2);
}

function parseToMinorUnits(display: string): number | null {
  const value = Number.parseFloat(display);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function formatNumber(value: number | null): string {
  if (value == null) return '';
  return String(value);
}

function parseNumber(display: string): number | null {
  const value = Number.parseFloat(display);
  if (Number.isNaN(value)) return null;
  return value;
}

export function LineItemsTable({ items, onChange, readOnly = false }: LineItemsTableProps) {
  const t = useTranslations('OcrReview.lineItems');
  const updateItem = useCallback(
    (index: number, field: keyof LineItem, value: string) => {
      const updated = [...items];
      const item = { ...updated[index] };

      switch (field) {
        case 'description':
        case 'unit':
        case 'vatRate':
          (item[field] as string | null) = value || null;
          break;
        case 'quantity':
          item.quantity = parseNumber(value);
          break;
        case 'unitPriceMinor':
        case 'netAmountMinor':
        case 'vatAmountMinor':
        case 'grossAmountMinor':
          (item[field] as number | null) = parseToMinorUnits(value);
          break;
        default:
          break;
      }

      updated[index] = item;
      onChange(updated);
    },
    [items, onChange],
  );

  const removeItem = useCallback(
    (index: number) => {
      const updated = items.filter((_, i) => i !== index);
      onChange(updated);
    },
    [items, onChange],
  );

  const addItem = useCallback(() => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      description: '',
      quantity: null,
      unit: null,
      unitPriceMinor: null,
      netAmountMinor: null,
      vatRate: null,
      vatAmountMinor: null,
      grossAmountMinor: null,
      confidence: 0,
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="text-xl font-semibold">{t('heading')}</h3>
        <Badge variant="secondary">{t('itemsCount', { count: items.length })}</Badge>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">{t('colDescription')}</TableHead>
              <TableHead className="w-20">{t('colQty')}</TableHead>
              <TableHead className="w-20">{t('colUnit')}</TableHead>
              <TableHead className="w-28">{t('colUnitPrice')}</TableHead>
              <TableHead className="w-28">{t('colNet')}</TableHead>
              <TableHead className="w-24">{t('colVatRate')}</TableHead>
              <TableHead className="w-28">{t('colVatAmount')}</TableHead>
              <TableHead className="w-28">{t('colGross')}</TableHead>
              <TableHead className="w-16">{t('colConf')}</TableHead>
              {!readOnly && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <LineItemRow
                key={item.id}
                item={item}
                index={index}
                readOnly={readOnly}
                updateItem={updateItem}
                removeItem={removeItem}
                t={t}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {!readOnly && (
        <Button variant="ghost" size="sm" onClick={addItem} className="w-fit">
          <Plus />
          {t('addLineItem')}
        </Button>
      )}
    </div>
  );
}

function InlineInput({
  value,
  onChange,
  readOnly,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  placeholder?: string;
  className?: string;
}) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );

  if (readOnly) {
    return (
      <span className={cn('text-sm', className)}>
        {value || <span className="text-muted-foreground">&mdash;</span>}
      </span>
    );
  }

  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(
        'h-7 border-transparent bg-transparent text-sm shadow-none hover:border-input focus-visible:border-input',
        className,
      )}
    />
  );
}

interface LineItemRowProps {
  item: LineItem;
  index: number;
  readOnly: boolean;
  updateItem: (index: number, field: keyof LineItem, value: string) => void;
  removeItem: (index: number) => void;
  t: ReturnType<typeof useTranslations>;
}

function LineItemRow({ item, index, readOnly, updateItem, removeItem, t }: LineItemRowProps) {
  const onDescription = useCallback(
    (v: string) => updateItem(index, 'description', v),
    [index, updateItem],
  );
  const onQuantity = useCallback(
    (v: string) => updateItem(index, 'quantity', v),
    [index, updateItem],
  );
  const onUnit = useCallback((v: string) => updateItem(index, 'unit', v), [index, updateItem]);
  const onUnitPrice = useCallback(
    (v: string) => updateItem(index, 'unitPriceMinor', v),
    [index, updateItem],
  );
  const onNetAmount = useCallback(
    (v: string) => updateItem(index, 'netAmountMinor', v),
    [index, updateItem],
  );
  const onVatRate = useCallback(
    (v: string) => updateItem(index, 'vatRate', v),
    [index, updateItem],
  );
  const onVatAmount = useCallback(
    (v: string) => updateItem(index, 'vatAmountMinor', v),
    [index, updateItem],
  );
  const onGrossAmount = useCallback(
    (v: string) => updateItem(index, 'grossAmountMinor', v),
    [index, updateItem],
  );
  const onRemove = useCallback(() => removeItem(index), [index, removeItem]);

  return (
    <TableRow className="animate-in fade-in-0 duration-200">
      <TableCell>
        <InlineInput
          value={item.description}
          onChange={onDescription}
          readOnly={readOnly}
          placeholder={t('placeholderDescription')}
        />
      </TableCell>
      <TableCell>
        <InlineInput
          value={formatNumber(item.quantity)}
          onChange={onQuantity}
          readOnly={readOnly}
          placeholder="0"
          className="text-end"
        />
      </TableCell>
      <TableCell>
        <InlineInput
          value={item.unit ?? ''}
          onChange={onUnit}
          readOnly={readOnly}
          placeholder={t('placeholderUnit')}
        />
      </TableCell>
      <TableCell>
        <InlineInput
          value={formatMinorUnits(item.unitPriceMinor)}
          onChange={onUnitPrice}
          readOnly={readOnly}
          placeholder="0.00"
          className="text-end"
        />
      </TableCell>
      <TableCell>
        <InlineInput
          value={formatMinorUnits(item.netAmountMinor)}
          onChange={onNetAmount}
          readOnly={readOnly}
          placeholder="0.00"
          className="text-end"
        />
      </TableCell>
      <TableCell>
        <InlineInput
          value={item.vatRate ?? ''}
          onChange={onVatRate}
          readOnly={readOnly}
          placeholder={t('placeholderVatRate')}
        />
      </TableCell>
      <TableCell>
        <InlineInput
          value={formatMinorUnits(item.vatAmountMinor)}
          onChange={onVatAmount}
          readOnly={readOnly}
          placeholder="0.00"
          className="text-end"
        />
      </TableCell>
      <TableCell>
        <InlineInput
          value={formatMinorUnits(item.grossAmountMinor)}
          onChange={onGrossAmount}
          readOnly={readOnly}
          placeholder="0.00"
          className="text-end"
        />
      </TableCell>
      <TableCell>
        <ConfidenceBadge confidence={item.confidence} showPercentage={false} />
      </TableCell>
      {!readOnly && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={t('removeItemAriaLabel')}>
            <Trash2 className="text-muted-foreground" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
