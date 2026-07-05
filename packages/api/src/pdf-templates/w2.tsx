// US Form W-2 (wage and tax statement) — DRAFT, adviser-verify.

import { CERT_ADVISER_VERIFY_EN } from '@contractor-ops/validators';
import type { CertRenderSnapshot } from './statutory-cert-shell';
import { StatutoryCertShell } from './statutory-cert-shell';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'w2' as const;

export function W2Document({ snapshot }: { snapshot: CertRenderSnapshot }) {
  const taxYear = typeof snapshot.taxYear === 'number' ? String(snapshot.taxYear) : '—';
  return StatutoryCertShell({
    title: 'Form W-2 — Wage and Tax Statement',
    subtitle: 'United States (Internal Revenue Service)',
    disclaimer: CERT_ADVISER_VERIFY_EN,
    rendererSlug: RENDERER_SLUG,
    templateVersion: TEMPLATE_VERSION,
    renderedAt: snapshot.renderedAt,
    rows: [
      { label: 'Employer', value: snapshot.employerName },
      { label: 'Employee', value: snapshot.employeeName },
      { label: 'SSN', value: snapshot.ssnLast4 ? `•••-••-${snapshot.ssnLast4}` : '—' },
      { label: 'Tax year', value: taxYear },
    ],
  });
}
