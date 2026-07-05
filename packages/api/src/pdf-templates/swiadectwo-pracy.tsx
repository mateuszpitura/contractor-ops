// PL świadectwo pracy (certificate of employment) — DRAFT, adviser-verify.

import { CERT_ADVISER_VERIFY_PL } from '@contractor-ops/validators';
import type { CertRenderSnapshot } from './statutory-cert-shell';
import { StatutoryCertShell } from './statutory-cert-shell';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'swiadectwo-pracy' as const;

export function SwiadectwoPracyDocument({ snapshot }: { snapshot: CertRenderSnapshot }) {
  return StatutoryCertShell({
    title: 'Świadectwo pracy',
    subtitle: 'Certificate of employment (Kodeks pracy)',
    disclaimer: CERT_ADVISER_VERIFY_PL,
    rendererSlug: RENDERER_SLUG,
    templateVersion: TEMPLATE_VERSION,
    renderedAt: snapshot.renderedAt,
    rows: [
      { label: 'Pracodawca (employer)', value: snapshot.employerName },
      { label: 'Pracownik (employee)', value: snapshot.employeeName },
      { label: 'PESEL', value: snapshot.peselLast4 ? `•••• ${snapshot.peselLast4}` : '—' },
      { label: 'Zatrudniony od (from)', value: snapshot.employmentFrom ?? '—' },
      { label: 'Zatrudniony do (to)', value: snapshot.employmentTo ?? '—' },
    ],
  });
}
