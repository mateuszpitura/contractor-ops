// DE Lohnsteuerbescheinigung (wage-tax statement) — DRAFT, adviser-verify.

import { CERT_ADVISER_VERIFY_DE } from '@contractor-ops/validators';
import type { CertRenderSnapshot } from './statutory-cert-shell';
import { StatutoryCertShell } from './statutory-cert-shell';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'lohnsteuerbescheinigung' as const;

export function LohnsteuerbescheinigungDocument({ snapshot }: { snapshot: CertRenderSnapshot }) {
  const taxYear = typeof snapshot.taxYear === 'number' ? String(snapshot.taxYear) : '—';
  return StatutoryCertShell({
    title: 'Lohnsteuerbescheinigung',
    subtitle: 'Wage-tax statement (Germany)',
    disclaimer: CERT_ADVISER_VERIFY_DE,
    rendererSlug: RENDERER_SLUG,
    templateVersion: TEMPLATE_VERSION,
    renderedAt: snapshot.renderedAt,
    rows: [
      { label: 'Arbeitgeber (employer)', value: snapshot.employerName },
      { label: 'Arbeitnehmer (employee)', value: snapshot.employeeName },
      {
        label: 'Steuer-ID',
        value: typeof snapshot.steuerIdLast4 === 'string' ? `•••• ${snapshot.steuerIdLast4}` : '—',
      },
      { label: 'Kalenderjahr (year)', value: taxYear },
    ],
  });
}
