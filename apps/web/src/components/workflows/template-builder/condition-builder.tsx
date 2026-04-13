'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// Fields that use enum selects for values
const ENUM_VALUE_FIELDS: Record<string, string[]> = {
  'contractor.type': ['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER'],
  'contractor.status': ['DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING', 'ENDED'],
  'contractor.complianceRiskLevel': ['LOW', 'MEDIUM', 'HIGH'],
  'contract.type': [
    'B2B_MASTER_SERVICE',
    'STATEMENT_OF_WORK',
    'NDA',
    'IP_ASSIGNMENT',
    'DPA',
    'OTHER',
  ],
  'contract.status': [
    'DRAFT',
    'PENDING_SIGNATURE',
    'ACTIVE',
    'EXPIRING',
    'EXPIRED',
    'TERMINATED',
    'SUPERSEDED',
    'ARCHIVED',
  ],
  'contract.currency': ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK'],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const t = useTranslations('Workflows');

  const addRule = () => {
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
  };

  const removeRule = (index: number) => {
    if (!value) return;
    const newRules = value.rules.filter((_, i) => i !== index);
    if (newRules.length === 0) {
      onChange(null);
    } else {
      onChange({ ...value, rules: newRules });
    }
  };

  const updateRule = (index: number, partial: Partial<ConditionRule>) => {
    if (!value) return;
    const newRules = value.rules.map((rule, i) => (i === index ? { ...rule, ...partial } : rule));
    onChange({ ...value, rules: newRules });
  };

  const toggleCombinator = () => {
    if (!value) return;
    onChange({
      ...value,
      combinator: value.combinator === 'AND' ? 'OR' : 'AND',
    });
  };

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
        // biome-ignore lint/suspicious/noArrayIndexKey: dynamic form array, rules have no stable id
        <div key={`rule-${index}`}>
          {/* Combinator toggle between rows */}
          {index > 0 && (
            <div className="flex items-center justify-center py-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs font-medium"
                onClick={toggleCombinator}>
                <Badge variant="outline" className="cursor-pointer text-xs">
                  {value.combinator === 'AND' ? t('conditionAnd') : t('conditionOr')}
                </Badge>
              </Button>
            </div>
          )}

          {/* Condition row */}
          <div className="flex items-center gap-2">
            {/* Field select */}
            <Select
              value={rule.field}
              onValueChange={val => updateRule(index, { field: val as string, value: '' })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('conditionFieldPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map(field => (
                  <SelectItem key={field} value={field}>
                    {t(`conditionField_${field.replace('.', '_')}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Operator select */}
            <Select
              value={rule.operator}
              onValueChange={val =>
                updateRule(index, {
                  operator: val as ConditionRule['operator'],
                })
              }>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map(op => (
                  <SelectItem key={op} value={op}>
                    {t(`operator_${op}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Value input or select */}
            {rule.field && ENUM_VALUE_FIELDS[rule.field] ? (
              <Select
                value={rule.value}
                onValueChange={val => updateRule(index, { value: val as string })}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('conditionValuePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {ENUM_VALUE_FIELDS[rule.field]?.map(v => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="w-[160px]"
                placeholder={t('conditionValuePlaceholder')}
                value={rule.value}
                onChange={e => updateRule(index, { value: e.target.value })}
              />
            )}

            {/* Remove rule */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRule(index)}>
              <X className="size-3.5" />
              <span className="sr-only">{t('removeCondition')}</span>
            </Button>
          </div>
        </div>
      ))}

      {/* Add condition button */}
      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="me-1.5 size-3.5" />
        {t('addCondition')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge summary helper (for collapsed task card)
// ---------------------------------------------------------------------------

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
