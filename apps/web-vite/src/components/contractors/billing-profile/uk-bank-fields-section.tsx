// Phase 63 · Plan 04 · D-01 — Collapsible UK bank fields section.
// Step 11 codemod port from apps/web/src/components/contractors/billing-profile/uk-bank-fields-section.tsx.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { ChevronDown, Wallet } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { SortCodeValidator } from './sort-code-validator.js';

export interface UkBankFieldsValue {
  sortCode: string;
  accountNumber: string;
}

export interface UkBankFieldsMasks {
  sortCodeMasked: string | null;
  accountNumberMasked: string | null;
}

interface UkBankFieldsSectionProps {
  countryCode: string;
  value: UkBankFieldsValue;
  onChange: (next: UkBankFieldsValue) => void;
  masks?: UkBankFieldsMasks;
  defaultOpen?: boolean;
}

function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

function displaySortCode(plain: string): string {
  if (plain.length !== 6) return plain;
  return `${plain.slice(0, 2)}-${plain.slice(2, 4)}-${plain.slice(4, 6)}`;
}

export function UkBankFieldsSection({
  countryCode,
  value,
  onChange,
  masks,
  defaultOpen,
}: UkBankFieldsSectionProps) {
  const t = useTranslations('Payments.ukBank');
  const id = useId();
  const hasExistingMasks = useMemo(
    () => Boolean(masks?.sortCodeMasked || masks?.accountNumberMasked),
    [masks?.sortCodeMasked, masks?.accountNumberMasked],
  );

  const sortCodeInputId = `${id}-sort-code`;
  const accountInputId = `${id}-account-number`;

  const handleSortCodeChange = useCallback(
    (raw: string) => {
      onChange({ ...value, sortCode: digitsOnly(raw, 6) });
    },
    [onChange, value],
  );

  const handleAccountChange = useCallback(
    (raw: string) => {
      onChange({ ...value, accountNumber: digitsOnly(raw, 8) });
    },
    [onChange, value],
  );

  if (countryCode !== 'GB') return null;

  return (
    <Collapsible defaultOpen={defaultOpen ?? hasExistingMasks} className="space-y-3">
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Wallet aria-hidden="true" className="size-4" />
              {t('sectionTitle')}
            </span>
            <ChevronDown aria-hidden="true" className="size-4 transition-transform" />
          </Button>
        }
      />

      <CollapsibleContent className="space-y-4 rounded-md border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor={sortCodeInputId}>{t('sortCodeLabel')}</Label>
          {masks?.sortCodeMasked && !value.sortCode ? (
            <p className="text-xs font-mono text-muted-foreground">
              {t('currentlySaved', { value: masks.sortCodeMasked })}
            </p>
          ) : null}
          <Input
            id={sortCodeInputId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="123456"
            maxLength={9}
            value={displaySortCode(value.sortCode)}
            onChange={e => handleSortCodeChange(e.target.value)}
            className="tabular-nums font-mono"
          />
          <p className="text-xs text-muted-foreground">{t('sortCodeHelper')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={accountInputId}>{t('accountNumberLabel')}</Label>
          {masks?.accountNumberMasked && !value.accountNumber ? (
            <p className="text-xs font-mono text-muted-foreground">
              {t('currentlySaved', { value: masks.accountNumberMasked })}
            </p>
          ) : null}
          <Input
            id={accountInputId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="12345678"
            maxLength={8}
            value={value.accountNumber}
            onChange={e => handleAccountChange(e.target.value)}
            className="tabular-nums font-mono"
          />
          <p className="text-xs text-muted-foreground">{t('accountNumberHelper')}</p>
        </div>

        <SortCodeValidator sortCode={value.sortCode} accountNumber={value.accountNumber} />
      </CollapsibleContent>
    </Collapsible>
  );
}
