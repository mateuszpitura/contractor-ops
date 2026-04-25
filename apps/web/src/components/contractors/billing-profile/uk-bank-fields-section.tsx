// apps/web/src/components/contractors/billing-profile/uk-bank-fields-section.tsx
//
// Phase 63 · Plan 04 · D-01 — Collapsible UK bank fields section on the
// ContractorBillingProfile edit form.
//
// Visible only when `contractor.countryCode === 'GB'`. Renders two inputs:
//   - Sort code (6 digits, hyphens added on blur for display)
//   - Account number (8 digits)
//
// Includes inline validate button via <SortCodeValidator>. The Save button
// itself lives in the parent form — this section exposes a controlled
// `value`/`onChange` API and an `onValidationChange` callback.

'use client';

import { ChevronDown, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { SortCodeValidator } from './sort-code-validator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UkBankFieldsValue {
  /** 6 digits, hyphen-free. Stored canonical form. */
  sortCode: string;
  /** 8 digits. */
  accountNumber: string;
}

export interface UkBankFieldsMasks {
  /** Last 2 digits visualization e.g. `XX-XX-34`. */
  sortCodeMasked: string | null;
  /** Last 4 digits visualization e.g. `XXXX5678`. */
  accountNumberMasked: string | null;
}

interface UkBankFieldsSectionProps {
  countryCode: string;
  value: UkBankFieldsValue;
  onChange: (next: UkBankFieldsValue) => void;
  masks?: UkBankFieldsMasks;
  /**
   * Whether the section is open by default. Caller may persist this state.
   * If unset, opens automatically when masks indicate existing values.
   */
  defaultOpen?: boolean;
}

/**
 * Strips any non-digit characters from input and caps to a max length.
 * Used to coerce paste/typing of formatted sort codes (`12-34-56`) to the
 * canonical hyphen-free 6-digit form on every keystroke.
 */
function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/**
 * Formats a 6-digit sort code into UK display form `XX-XX-XX`.
 * Returns the input unchanged when not 6 digits (avoids partial hyphenation
 * during typing — only formats once the field is complete on blur).
 */
function displaySortCode(plain: string): string {
  if (plain.length !== 6) return plain;
  return `${plain.slice(0, 2)}-${plain.slice(2, 4)}-${plain.slice(4, 6)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // GB-only gate — the parent form keeps SEPA/SWIFT fields elsewhere; this
  // collapsible appears only for UK contractors per D-01.
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
              UK bank account
            </span>
            <ChevronDown aria-hidden="true" className="size-4 transition-transform" />
          </Button>
        }
      />

      <CollapsibleContent className="space-y-4 rounded-md border bg-card p-4">
        {/* Sort code */}
        <div className="space-y-2">
          <Label htmlFor={sortCodeInputId}>{t('sortCodeLabel')}</Label>
          {masks?.sortCodeMasked && !value.sortCode ? (
            <p className="text-xs font-mono text-muted-foreground">
              Currently saved: {masks.sortCodeMasked}
            </p>
          ) : null}
          <Input
            id={sortCodeInputId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="123456"
            maxLength={9} // accommodates 6 digits + 2 hyphens during typing
            value={displaySortCode(value.sortCode)}
            onChange={e => handleSortCodeChange(e.target.value)}
            className="tabular-nums font-mono"
          />
          <p className="text-xs text-muted-foreground">{t('sortCodeHelper')}</p>
        </div>

        {/* Account number */}
        <div className="space-y-2">
          <Label htmlFor={accountInputId}>{t('accountNumberLabel')}</Label>
          {masks?.accountNumberMasked && !value.accountNumber ? (
            <p className="text-xs font-mono text-muted-foreground">
              Currently saved: {masks.accountNumberMasked}
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

        {/* Inline validate button */}
        <SortCodeValidator sortCode={value.sortCode} accountNumber={value.accountNumber} />
      </CollapsibleContent>
    </Collapsible>
  );
}
