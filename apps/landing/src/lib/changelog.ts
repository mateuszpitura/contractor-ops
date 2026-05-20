export type ChangelogTag = 'feature' | 'fix' | 'breaking' | 'security';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  tags: readonly ChangelogTag[];
  summary: string;
  bullets?: readonly string[];
}

export const changelog: readonly ChangelogEntry[] = [
  {
    version: 'v1.7.0',
    date: '2026-05-15',
    title: 'Multi-region tax engine, e-invoicing for ZATCA phase 2',
    tags: ['feature'],
    summary:
      'New tax engine routes every invoice through a per-jurisdiction rules pipeline. Saudi ZATCA phase 2 is now a checkbox at workspace creation.',
    bullets: [
      'Per-jurisdiction tax adapters now ship for KSeF, ZATCA phase 2, Peppol BIS, German Steuer.',
      'Receipt PDF templates localised for AR + DE + PL + EN.',
      'Workspace setup wizard now branches on jurisdiction before showing any invoice fields.',
    ],
  },
  {
    version: 'v1.6.3',
    date: '2026-04-22',
    title: 'Approval flow speedups + ⌘K command palette',
    tags: ['feature', 'fix'],
    summary:
      'Approving a 200-invoice batch now takes one keystroke. The command palette ships globally, including in the portal.',
    bullets: [
      '⌘K palette mounted in all (dashboard) and (portal) layouts.',
      'Bulk-approve no longer round-trips per invoice; 8× speedup at 200-invoice scale.',
      'Fixed: focus loss after closing the bulk-approve confirm sheet.',
    ],
  },
  {
    version: 'v1.6.0',
    date: '2026-03-30',
    title: 'Payment run wizard, Stripe + Revolut + Mistertango outputs',
    tags: ['feature', 'breaking'],
    summary:
      'Payment runs are now a guided wizard. Output destinations include Stripe, Revolut Business, Mistertango. Manual SEPA XML download remains.',
    bullets: [
      'Breaking: the legacy /api/payments/run-csv export is removed. Use /api/payments/run-package instead.',
      'Stepper UI ships in packages/ui.',
      'New: confetti on completion of the first successful payment run.',
    ],
  },
  {
    version: 'v1.5.1',
    date: '2026-02-12',
    title: 'Security hardening, EU residency switch',
    tags: ['security'],
    summary: 'Region pinning at workspace creation. Field-level encryption on tax IDs and IBANs.',
  },
];
