// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 · Task 2 — Invoice footer legal notices
// ---------------------------------------------------------------------------
//
// Pure render component that composes the three locked legal phrases from
// `@contractor-ops/validators` according to D-11 / D-14 precedence rules:
//
//   1. DE org with Kleinunternehmerregelung → § 19 UStG notice
//      (KU supersedes RC — see Plan 57-03 Task 3 precedence)
//   2. DE-side reverse charge → Steuerschuldnerschaft des Leistungsempfängers
//   3. UK-side reverse charge → "Reverse charge: Customer to pay the VAT to HMRC"
//
// The phrases themselves are imported — they are NEVER loaded from
// messages/*.json (locked-phrases-guard CI test enforces this).
// ---------------------------------------------------------------------------

import {
  TAX_KLEINUNTERNEHMER_NOTICE,
  TAX_STEUERSCHULDNERSCHAFT,
  TAX_UK_REVERSE_CHARGE_NOTICE,
} from '@contractor-ops/validators';

type SupportedCountry = 'GB' | 'DE' | string;

interface InvoiceFooterLegalNoticesProps {
  isReverseCharge: boolean;
  isKleinunternehmer: boolean;
  orgCountry: SupportedCountry | null | undefined;
}

export function InvoiceFooterLegalNotices({
  isReverseCharge,
  isKleinunternehmer,
  orgCountry,
}: InvoiceFooterLegalNoticesProps) {
  // (1) Kleinunternehmer wins (DE-only, supersedes RC)
  if (isKleinunternehmer && orgCountry === 'DE') {
    return (
      <p
        lang="de"
        className="text-sm text-muted-foreground mt-4 border-t pt-3"
        data-testid="invoice-footer-legal-notice"
        data-notice="kleinunternehmer">
        {TAX_KLEINUNTERNEHMER_NOTICE}
      </p>
    );
  }

  // (2) DE reverse charge
  if (isReverseCharge && orgCountry === 'DE') {
    return (
      <p
        lang="de"
        className="text-sm text-muted-foreground mt-4 border-t pt-3"
        data-testid="invoice-footer-legal-notice"
        data-notice="de-reverse-charge">
        {TAX_STEUERSCHULDNERSCHAFT}
      </p>
    );
  }

  // (3) UK reverse charge
  if (isReverseCharge && orgCountry === 'GB') {
    return (
      <p
        lang="en"
        className="text-sm text-muted-foreground mt-4 border-t pt-3"
        data-testid="invoice-footer-legal-notice"
        data-notice="uk-reverse-charge">
        {TAX_UK_REVERSE_CHARGE_NOTICE}
      </p>
    );
  }

  return null;
}
