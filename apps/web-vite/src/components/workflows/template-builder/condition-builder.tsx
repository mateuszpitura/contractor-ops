/**
 * ConditionBuilder — task-card condition rules editor.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import {
  complianceRiskLevelEnum,
  contractorLifecycleStageEnum,
  contractorTypeEnum,
  contractStatusEnum,
  contractTypeEnum,
} from '@contractor-ops/validators';
import { Plus, X } from 'lucide-react';
import { memo, useCallback } from 'react';

import { tDynLoose, tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';

interface ConditionRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'startsWith';
  value: string;
}

interface ConditionGroup {
  combinator: 'AND' | 'OR';
  rules: ConditionRule[];
}

interface ConditionBuilderProps {
  value: ConditionGroup | null;
  onChange: (value: ConditionGroup | null) => void;
}

const CONDITION_FIELDS = [
  'contractor.type',
  'contractor.status',
  'contractor.billingModel',
  'contractor.team',
  'contractor.complianceRiskLevel',
  'contract.type',
  'contract.status',
  'contract.currency',
] as const;

const OPERATORS = ['equals', 'notEquals', 'contains', 'startsWith'] as const;

const ENUM_VALUE_FIELDS: Record<string, string[]> = {
  'contractor.type': [...contractorTypeEnum.options],
  'contractor.status': [...contractorLifecycleStageEnum.options],
  'contractor.complianceRiskLevel': [...complianceRiskLevelEnum.options],
  'contract.type': [...contractTypeEnum.options],
  'contract.status': [...contractStatusEnum.options],
  'contract.currency': ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK'],
};

interface RuleRowProps {
  index: number;
  rule: ConditionRule;
  combinator: ConditionGroup['combinator'];
  showCombinator: boolean;
  t: ReturnType<typeof useTranslations>;
  onToggleCombinator: () => void;
  onUpdate: (index: number, partial: Partial<ConditionRule>) => void;
  onRemove: (index: number) => void;
}

const RuleRow = memo(function RuleRow({
  index,
  rule,
  combinator,
  showCombinator,
  t,
  onToggleCombinator,
  onUpdate,
  onRemove,
}: RuleRowProps) {
  const handleFieldChange = useCallback(
    (val: string | null) => onUpdate(index, { field: val ?? '', value: '' }),
    [index, onUpdate],
  );
  const handleOperatorChange = useCallback(
    (val: string | null) => {
      if (val) onUpdate(index, { operator: val as ConditionRule['operator'] });
    },
    [index, onUpdate],
  );
  const handleValueSelectChange = useCallback(
    (val: string | null) => onUpdate(index, { value: val ?? '' }),
    [index, onUpdate],
  );
  const handleValueInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, { value: e.target.value }),
    [index, onUpdate],
  );
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  const enumValues = rule.field ? ENUM_VALUE_FIELDS[rule.field] : undefined;

  return (
    <div>
      {!!showCombinator && (
        <div className="flex items-center justify-center py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs font-medium"
            onClick={onToggleCombinator}>
            <Badge variant="outline" className="cursor-pointer text-xs">
              {combinator === 'AND' ? t('conditionAnd') : t('conditionOr')}
            </Badge>
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={rule.field} onValueChange={handleFieldChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('conditionFieldPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_FIELDS.map(field => (
              <SelectItem key={field} value={field}>
                {tKey(t, `conditionField.${field}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={rule.operator} onValueChange={handleOperatorChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map(op => (
              <SelectItem key={op} value={op}>
                {tDynLoose(t, 'operator', enumKey(op))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {enumValues ? (
          <Select value={rule.value} onValueChange={handleValueSelectChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('conditionValuePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {enumValues.map(v => (
                <SelectItem key={v} value={v}>
                  {tDynLoose(t, 'conditionValue', enumKey(v))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="w-[160px]"
            placeholder={t('conditionValuePlaceholder')}
            value={rule.value}
            onChange={handleValueInputChange}
          />
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}>
          <X className="size-3.5" />
          <span className="sr-only">{t('removeCondition')}</span>
        </Button>
      </div>
    </div>
  );
});

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const t = useTranslations('Workflows');

  const addRule = useCallback(() => {
    if (value) {
      onChange({
        ...value,
        rules: [...value.rules, { field: '', operator: 'equals', value: '' }],
      });
    } else {
      onChange({
        combinator: 'AND',
        rules: [{ field: '', operator: 'equals', value: '' }],
      });
    }
  }, [value, onChange]);

  const removeRule = useCallback(
    (index: number) => {
      if (!value) return;
      const newRules = value.rules.filter((_, i) => i !== index);
      if (newRules.length === 0) {
        onChange(null);
      } else {
        onChange({ ...value, rules: newRules });
      }
    },
    [value, onChange],
  );

  const updateRule = useCallback(
    (index: number, partial: Partial<ConditionRule>) => {
      if (!value) return;
      const newRules = value.rules.map((rule, i) => (i === index ? { ...rule, ...partial } : rule));
      onChange({ ...value, rules: newRules });
    },
    [value, onChange],
  );

  const toggleCombinator = useCallback(() => {
    if (!value) return;
    onChange({
      ...value,
      combinator: value.combinator === 'AND' ? 'OR' : 'AND',
    });
  }, [value, onChange]);

  if (!value || value.rules.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('noConditions')}</p>
        <Button type="button" variant="outline" size="sm" onClick={addRule}>
          <Plus className="me-1.5 size-3.5" />
          {t('addCondition')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {value.rules.map((rule, index) => (
        <RuleRow
          // biome-ignore lint/suspicious/noArrayIndexKey: editable form rows with no identity — field/operator/value all collide for fresh rows ({'',equals,''}), so no composite key is stable; persisted contract is ConditionGroup, adding a client id would change the form shape
          key={`rule-${index}`}
          index={index}
          rule={rule}
          combinator={value.combinator}
          showCombinator={index > 0}
          t={t}
          onToggleCombinator={toggleCombinator}
          onUpdate={updateRule}
          onRemove={removeRule}
        />
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="me-1.5 size-3.5" />
        {t('addCondition')}
      </Button>
    </div>
  );
}

export function getConditionSummary(
  conditions: ConditionGroup | null,
  t: (key: string, values?: Record<string, string | number>) => string,
): string | null {
  if (!conditions || conditions.rules.length === 0) return null;

  if (conditions.rules.length === 1) {
    const rule = conditions.rules[0];
    if (!rule) return null;
    return t('conditionBadge', {
      summary: `${rule.field.split('.')[1] ?? rule.field} ${rule.operator} ${rule.value}`,
    });
  }

  return t('conditionBadgeMulti', {
    count: conditions.rules.length,
  });
}
