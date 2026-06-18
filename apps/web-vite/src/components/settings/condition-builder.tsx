import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Plus, X } from 'lucide-react';
import type * as React from 'react';
import { useCallback } from 'react';
import { tKey } from '../../i18n/typed-keys';
import { useTranslations } from '../../i18n/useTranslations.js';

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

interface ConditionRowProps {
  index: number;
  condition: Condition;
  fieldItems: { value: Condition['field']; label: string }[];
  operatorItems: { value: Condition['operator']; label: string }[];
  fieldPlaceholder: string;
  operatorPlaceholder: string;
  valuePlaceholder: string;
  removeLabel: string;
  onUpdate: (index: number, patch: Partial<Condition>) => void;
  onRemove: (index: number) => void;
}

function ConditionRow({
  index,
  condition,
  fieldItems,
  operatorItems,
  fieldPlaceholder,
  operatorPlaceholder,
  valuePlaceholder,
  removeLabel,
  onUpdate,
  onRemove,
}: ConditionRowProps) {
  const handleFieldChange = useCallback(
    (v: Condition['field'] | null) => {
      if (v) onUpdate(index, { field: v });
    },
    [onUpdate, index],
  );
  const handleOperatorChange = useCallback(
    (v: Condition['operator'] | null) => {
      if (v) onUpdate(index, { operator: v });
    },
    [onUpdate, index],
  );
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onUpdate(index, {
        value:
          condition.field === 'amount'
            ? e.target.value === ''
              ? ''
              : Number(e.target.value)
            : e.target.value,
      }),
    [onUpdate, index, condition.field],
  );
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);

  return (
    <div className="flex h-10 items-center gap-2">
      <Select value={condition.field} onValueChange={handleFieldChange} items={fieldItems}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={fieldPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {fieldItems.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={condition.operator} onValueChange={handleOperatorChange} items={operatorItems}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={operatorPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {operatorItems.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type={condition.field === 'amount' ? 'number' : 'text'}
        value={condition.value}
        onChange={handleValueChange}
        placeholder={valuePlaceholder}
        className="flex-1"
        min={condition.field === 'amount' ? 0 : undefined}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-destructive hover:text-destructive"
        onClick={handleRemove}
        aria-label={removeLabel}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const t = useTranslations('Settings');

  const fieldItems = FIELD_OPTIONS.map(opt => ({
    value: opt.value,
    label: tKey(t, opt.labelKey),
  }));

  const operatorItems = OPERATOR_OPTIONS.map(opt => ({
    value: opt.value,
    label: tKey(t, opt.labelKey),
  }));
  const handleAdd = useCallback(
    () => onChange([...value, { field: 'amount', operator: 'gt', value: '' }]),
    [onChange, value],
  );

  const handleRemove = useCallback(
    (index: number) => onChange(value.filter((_, i) => i !== index)),
    [onChange, value],
  );

  const handleUpdate = useCallback(
    (index: number, patch: Partial<Condition>) => {
      onChange(
        value.map((c, i) => {
          if (i !== index) return c;
          const updated = { ...c, ...patch };
          if (patch.field && patch.field !== c.field) {
            updated.value = '';
          }
          return updated;
        }),
      );
    },
    [onChange, value],
  );

  return (
    <div className="space-y-3">
      {value.map((condition, index) => (
        <ConditionRow
          // biome-ignore lint/suspicious/noArrayIndexKey: editable form rows with no identity — field/operator/value all collide for fresh rows ({amount,gt,''}), so no composite key is stable; persisted contract is Condition[], adding a client id would change the form shape
          key={`condition-${index}`}
          index={index}
          condition={condition}
          fieldItems={fieldItems}
          operatorItems={operatorItems}
          fieldPlaceholder={t('approvals.editor.conditionField')}
          operatorPlaceholder={t('approvals.editor.conditionOperator')}
          valuePlaceholder={t('approvals.editor.conditionValue')}
          removeLabel={t('approvals.editor.removeCondition')}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />
      ))}

      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="me-1.5 size-3.5" />
        {t('approvals.editor.addCondition')}
      </Button>

      <p className="text-xs text-muted-foreground">{t('approvals.editor.conditionsHelp')}</p>
    </div>
  );
}
