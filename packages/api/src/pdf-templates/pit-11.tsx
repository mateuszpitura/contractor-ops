// PL PIT-11 (annual information return) — DRAFT, adviser-verify.

import { CERT_ADVISER_VERIFY_PL } from '@contractor-ops/validators';
import type { CertRenderSnapshot } from './statutory-cert-shell';
import { StatutoryCertShell } from './statutory-cert-shell';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'pit-11' as const;

export function Pit11Document({ snapshot }: { snapshot: CertRenderSnapshot }) {
  const taxYear = typeof snapshot.taxYear === 'number' ? String(snapshot.taxYear) : '—';
  return StatutoryCertShell({
    title: 'PIT-11',
    subtitle: 'Information return on income and advances (Poland)',
    disclaimer: CERT_ADVISER_VERIFY_PL,
    rendererSlug: RENDERER_SLUG,
    templateVersion: TEMPLATE_VERSION,
    renderedAt: snapshot.renderedAt,
    rows: [
      { label: 'Płatnik (payer)', value: snapshot.employerName },
      { label: 'Podatnik (taxpayer)', value: snapshot.employeeName },
      { label: 'PESEL', value: snapshot.peselLast4 ? `•••• ${snapshot.peselLast4}` : '—' },
      { label: 'Rok podatkowy (tax year)', value: taxYear },
    ],
  });
}
