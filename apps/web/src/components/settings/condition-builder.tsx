'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Condition = {
  field: 'amount' | 'contractorType';
  operator: 'gt' | 'lt' | 'eq';
  value: string | number;
};

type ConditionBuilderProps = {
  value: Condition[];
  onChange: (conditions: Condition[]) => void;
};

// ---------------------------------------------------------------------------
// Field / operator label maps
// ---------------------------------------------------------------------------

const FIELD_OPTIONS: { value: Condition['field']; labelKey: string }[] = [
  { value: 'amount', labelKey: 'approvals.editor.fieldAmount' },
  { value: 'contractorType', labelKey: 'approvals.editor.fieldContractorType' },
];

const OPERATOR_OPTIONS: { value: Condition['operator']; labelKey: string }[] = [
  { value: 'gt', labelKey: 'approvals.editor.operatorGt' },
  { value: 'lt', labelKey: 'approvals.editor.operatorLt' },
  { value: 'eq', labelKey: 'approvals.editor.operatorEq' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const t = useTranslations('Settings');

  const fieldItems = FIELD_OPTIONS.map(opt => ({
    value: opt.value,
    label: t(opt.labelKey as Parameters<typeof t>[0]),
  }));

  const operatorItems = OPERATOR_OPTIONS.map(opt => ({
    value: opt.value,
    label: t(opt.labelKey as Parameters<typeof t>[0]),
  }));
  function handleAdd() {
    onChange([...value, { field: 'amount', operator: 'gt', value: '' }]);
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleUpdate(index: number, patch: Partial<Condition>) {
    onChange(
      value.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, ...patch };
        // Reset value when field changes
        if (patch.field && patch.field !== c.field) {
          updated.value = '';
        }
        return updated;
      }),
    );
  }

  return (
    <div className="space-y-3">
      {value.map((condition, index) => (
        <div key={`condition-${index}`} className="flex h-10 items-center gap-2">
          {/* Field select */}
          <Select
            value={condition.field}
            onValueChange={v => handleUpdate(index, { field: v as Condition['field'] })}
            items={fieldItems}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('approvals.editor.conditionField')} />
            </SelectTrigger>
            <SelectContent>
              {fieldItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator select */}
          <Select
            value={condition.operator}
            onValueChange={v => handleUpdate(index, { operator: v as Condition['operator'] })}
            items={operatorItems}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('approvals.editor.conditionOperator')} />
            </SelectTrigger>
            <SelectContent>
              {operatorItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value input */}
          <Input
            type={condition.field === 'amount' ? 'number' : 'text'}
            value={condition.value}
            onChange={e =>
              handleUpdate(index, {
                value:
                  condition.field === 'amount'
                    ? e.target.value === ''
                      ? ''
                      : Number(e.target.value)
                    : e.target.value,
              })
            }
            placeholder={t('approvals.editor.conditionValue')}
            className="flex-1"
            min={condition.field === 'amount' ? 0 : undefined}
          />

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => handleRemove(index)}
            aria-label={t('approvals.editor.removeCondition')}>
            <X className="size-4" />
          </Button>
        </div>
      ))}

      {/* Add condition */}
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="me-1.5 size-3.5" />
        {t('approvals.editor.addCondition')}
      </Button>

      <p className="text-xs text-muted-foreground">{t('approvals.editor.conditionsHelp')}</p>
    </div>
  );
}
