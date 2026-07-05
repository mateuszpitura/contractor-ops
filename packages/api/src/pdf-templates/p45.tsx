// UK P45 (leaver statement) — DRAFT, adviser-verify.

import { CERT_ADVISER_VERIFY_EN } from '@contractor-ops/validators';
import type { CertRenderSnapshot } from './statutory-cert-shell';
import { StatutoryCertShell } from './statutory-cert-shell';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'p45' as const;

export function P45Document({ snapshot }: { snapshot: CertRenderSnapshot }) {
  return StatutoryCertShell({
    title: 'P45 — Details of employee leaving work',
    subtitle: 'PAYE leaver statement (United Kingdom)',
    disclaimer: CERT_ADVISER_VERIFY_EN,
    rendererSlug: RENDERER_SLUG,
    templateVersion: TEMPLATE_VERSION,
    renderedAt: snapshot.renderedAt,
    rows: [
      { label: 'Employer', value: snapshot.employerName },
      { label: 'Employee', value: snapshot.employeeName },
      {
        label: 'National Insurance number',
        value: snapshot.ninoLast4 ? `•••• ${snapshot.ninoLast4}` : '—',
      },
      { label: 'Leaving date', value: snapshot.employmentTo ?? '—' },
    ],
  });
}
