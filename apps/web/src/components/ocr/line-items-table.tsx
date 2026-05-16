'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ConfidenceBadge } from '@/components/ocr/confidence-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
      {/* Heading */}
      <div className="flex items-center gap-3">
        <h3 className="text-xl font-semibold">{t('heading')}</h3>
        <Badge variant="secondary">{t('itemsCount', { count: items.length })}</Badge>
      </div>

      {/* Table */}
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
              <TableRow key={item.id} className="animate-in fade-in-0 duration-200">
                <TableCell>
                  <InlineInput
                    value={item.description}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'description', v)}
                    readOnly={readOnly}
                    placeholder={t('placeholderDescription')}
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatNumber(item.quantity)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'quantity', v)}
                    readOnly={readOnly}
                    placeholder="0"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={item.unit ?? ''}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'unit', v)}
                    readOnly={readOnly}
                    placeholder={t('placeholderUnit')}
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.unitPriceMinor)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'unitPriceMinor', v)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.netAmountMinor)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'netAmountMinor', v)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={item.vatRate ?? ''}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'vatRate', v)}
                    readOnly={readOnly}
                    placeholder={t('placeholderVatRate')}
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.vatAmountMinor)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'vatAmountMinor', v)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.grossAmountMinor)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={v => updateItem(index, 'grossAmountMinor', v)}
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
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => removeItem(index)}
                      aria-label={t('removeItemAriaLabel')}>
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add line item */}
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
      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-7 border-transparent bg-transparent text-sm shadow-none hover:border-input focus-visible:border-input',
        className,
      )}
    />
  );
}
