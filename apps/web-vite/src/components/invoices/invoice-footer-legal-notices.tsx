/**
 * Invoice footer legal notices — composes the three locked phrases from
 * `@contractor-ops/validators` per D-11 / D-14 precedence rules. No
 * codemod swaps needed (no next-intl / next imports).
 */

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
