// DE simple Arbeitszeugnis (einfaches Zeugnis) — DRAFT, adviser-verify. The
// qualified (free-text) Arbeitszeugnis is deferred.

import { CERT_ADVISER_VERIFY_DE } from '@contractor-ops/validators';
import type { CertRenderSnapshot } from './statutory-cert-shell';
import { StatutoryCertShell } from './statutory-cert-shell';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'arbeitszeugnis-simple' as const;

export function ArbeitszeugnisSimpleDocument({ snapshot }: { snapshot: CertRenderSnapshot }) {
  const position = typeof snapshot.position === 'string' ? snapshot.position : '—';
  return StatutoryCertShell({
    title: 'Einfaches Arbeitszeugnis',
    subtitle: 'Simple certificate of employment (Germany)',
    disclaimer: CERT_ADVISER_VERIFY_DE,
    rendererSlug: RENDERER_SLUG,
    templateVersion: TEMPLATE_VERSION,
    renderedAt: snapshot.renderedAt,
    rows: [
      { label: 'Arbeitgeber (employer)', value: snapshot.employerName },
      { label: 'Arbeitnehmer (employee)', value: snapshot.employeeName },
      { label: 'Position', value: position },
      { label: 'Beschäftigt von (from)', value: snapshot.employmentFrom ?? '—' },
      { label: 'Beschäftigt bis (to)', value: snapshot.employmentTo ?? '—' },
    ],
  });
}
