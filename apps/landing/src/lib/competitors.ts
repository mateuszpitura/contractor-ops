export interface CompetitorRow {
  feature: string;
  contractorOps: string | boolean;
  competitor: string | boolean;
}

export interface CompetitorConfig {
  name: string;
  tagline: string;
  positioning: string;
  rows: readonly CompetitorRow[];
}

export const COMPETITORS: Record<string, CompetitorConfig> = {
  spreadsheet: {
    name: 'Excel & email',
    tagline: 'The free option that costs you a finance hire.',
    positioning:
      'Most teams running 5–50 contractors still operate out of spreadsheets and email threads. It looks free; the hidden price is the people-hours it absorbs.',
    rows: [
      { feature: 'Multi-region tax engine', contractorOps: true, competitor: false },
      { feature: 'OCR invoice ingest', contractorOps: true, competitor: false },
      { feature: 'Audit-grade signed log', contractorOps: true, competitor: false },
      {
        feature: 'Bulk approvals (200+ invoices)',
        contractorOps: 'One keystroke',
        competitor: 'Three days',
      },
      { feature: 'Payment run wizard', contractorOps: true, competitor: false },
      {
        feature: 'Read-only auditor seats',
        contractorOps: 'Free, unlimited',
        competitor: 'CC the auditor on emails',
      },
      { feature: 'Setup cost', contractorOps: 'Hours', competitor: '€0 — but never finished' },
      {
        feature: 'Monthly cost',
        contractorOps: 'Sub-€500 typical',
        competitor: '€0 (excluding salary cost)',
      },
    ],
  },
  generic: {
    name: 'Generic competitor',
    tagline: 'A category leader that solves the developer use case, not yours.',
    positioning:
      'A capable platform built for global contractor management. Solid choice if your roster is freelance developers paid in USD. Less of a fit when your operations are SEPA, KSeF, ZATCA, and a Steuerberater needs read access.',
    rows: [
      { feature: 'EU + ME multi-region', contractorOps: true, competitor: 'EU only' },
      {
        feature: 'KSeF + ZATCA + Peppol e-invoicing',
        contractorOps: true,
        competitor: 'Peppol only',
      },
      { feature: 'DATEV export', contractorOps: true, competitor: false },
      { feature: 'Region-pinned data', contractorOps: true, competitor: false },
      { feature: 'Audit-grade signed log', contractorOps: true, competitor: 'Partial' },
      {
        feature: 'Per-jurisdiction tax rules',
        contractorOps: true,
        competitor: 'Global default only',
      },
      { feature: 'Onboarding time', contractorOps: '< 1 week', competitor: '2–6 weeks' },
      { feature: 'Pricing model', contractorOps: 'Per workspace', competitor: 'Per contractor' },
    ],
  },
};
