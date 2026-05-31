#!/usr/bin/env node
// Patch landing i18n JSON files with new section keys for W2 (bento/stats/testimonials/integrations/faq/ctaBand + footer.newsletter).
// Idempotent: merges only missing keys.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const localesDir = resolve(root, 'apps/landing/src/i18n/locales');

const additions = {
  bento: {
    label: 'Premium experience',
    headline: 'A workbench made for',
    headlineHighlight: 'finance ops',
    description:
      'Six panels, one tab. Every contractor touchpoint — from onboarding to offboarding — sits inside a single command surface.',
    cards: {
      command: {
        title: 'Command palette',
        description:
          'Jump to any contractor, invoice or run with ⌘K. Search across 20+ object types.',
      },
      vault: {
        title: 'Document vault',
        description:
          'Contracts, MSAs and tax docs in one place. Version history and expiry alerts built in.',
      },
      throughput: {
        title: 'Invoice throughput',
        description: 'OCR + auto-match against POs. Bulk-approve in seconds, not afternoons.',
      },
      audit: {
        title: 'Audit-ready by default',
        description: 'Every action signed and timestamped. Export to your auditor in two clicks.',
      },
      ledger: {
        title: 'Multi-entity ledger',
        description: 'EU + ME multi-region. Per-jurisdiction tax rules, no manual reconciling.',
      },
      cadence: {
        title: 'Payment cadence',
        description: 'Build payment runs from filtered invoices. Approve, sign, pay — same flow.',
      },
    },
  },
  statsBand: {
    label: 'Numbers',
    items: {
      contractors: { value: 1200, suffix: '+', label: 'Contractors managed' },
      invoicesProcessed: { value: 48000, suffix: '+', label: 'Invoices processed' },
      hoursSaved: { value: 6200, suffix: 'h', label: 'Hours saved per quarter' },
      countries: { value: 14, suffix: '', label: 'EU + ME jurisdictions' },
    },
  },
  testimonials: {
    label: 'Voices',
    headline: 'What operators',
    headlineHighlight: 'tell us',
    description:
      'Finance leaders running 5–50 contractors who switched from spreadsheets and email.',
    items: [
      {
        quote:
          'Onboarding a new subcontractor went from a half-day spreadsheet ceremony to a five-minute form.',
        author: 'Anna Kowalska',
        role: 'CFO',
        company: 'Helix Studios',
      },
      {
        quote:
          'Invoice approvals stopped being a Slack thread. We close the month two days earlier.',
        author: 'Markus Becker',
        role: 'Head of Finance',
        company: 'Nordweg GmbH',
      },
      {
        quote:
          'Every audit since switching has been one export. The Steuerberater stopped emailing back.',
        author: 'Yousef Al-Rashid',
        role: 'Finance Director',
        company: 'Dunes Procurement',
      },
      {
        quote: 'Multi-region tax used to need a consultant. Now it is a dropdown.',
        author: 'Sofia Pereira',
        role: 'COO',
        company: 'Tributo Logistics',
      },
    ],
  },
  integrationsGrid: {
    label: 'Plays well with',
    headline: 'Connects to the tools your',
    headlineHighlight: 'team already runs',
    description:
      'Bank feeds, accounting suites, communication, e-invoicing networks. Replace nothing.',
    items: [
      {
        name: 'Stripe',
        category: 'Payments',
        description: 'Charge cards, send payouts, reconcile.',
      },
      { name: 'Mistertango', category: 'Banking', description: 'EU SEPA + multi-currency IBANs.' },
      { name: 'Revolut Business', category: 'Banking', description: 'Bulk SEPA + FX.' },
      { name: 'Xero', category: 'Accounting', description: 'Invoice + bank feed sync.' },
      { name: 'DATEV', category: 'Accounting', description: 'German Steuerberater-ready export.' },
      {
        name: 'Peppol',
        category: 'E-invoicing',
        description: 'Compliant cross-border e-invoicing.',
      },
      { name: 'KSeF', category: 'E-invoicing', description: 'Polish national e-invoice gateway.' },
      { name: 'ZATCA', category: 'E-invoicing', description: 'Saudi e-invoicing phase 2.' },
      {
        name: 'Slack',
        category: 'Communication',
        description: 'Approval pings, no app-switching.',
      },
    ],
  },
  faq: {
    label: 'Questions',
    headline: 'Asked &',
    headlineHighlight: 'answered',
    description: 'The clarifications operators tend to want before signing up.',
    items: [
      {
        question: 'Do you support both EU and Middle-East regulations?',
        answer:
          'Yes. The data plane runs in two regions (EU + ME) with per-jurisdiction tax + e-invoicing rules (Peppol, KSeF, ZATCA, German Steuer rules).',
      },
      {
        question: 'How long does onboarding take?',
        answer:
          'A finance team typically goes live in under a week. Most of that is importing existing contractors via CSV; the system itself sets up in minutes.',
      },
      {
        question: 'Can our auditor get read-only access?',
        answer:
          'Yes. Read-only seats are free. Every action is signed + timestamped, so the export is the audit.',
      },
      {
        question: 'What happens to my data if we churn?',
        answer:
          'A one-click export gives you every contract, invoice and payment as CSV + PDF. We delete the rest after 30 days.',
      },
      {
        question: 'Do you really cost less than a spreadsheet?',
        answer:
          'Spreadsheets are free. The hours your finance team spends in them are not. We replace ~6h per finance hire per week — that is the implicit price.',
      },
    ],
  },
  ctaBand: {
    label: 'Ready when you are',
    headline: 'Stop paying for the',
    headlineHighlight: 'spreadsheet tax',
    description: 'Spin up a workspace in two minutes. Bring a CSV, leave with a system of record.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'Book a 20-minute walkthrough',
  },
};

const footerNewsletter = {
  newsletter: {
    headline: 'Quarterly memo',
    description:
      'One email every three months. Product changes, audit-survival tips, and the occasional rant about Excel.',
    placeholder: 'you@company.com',
    submit: 'Subscribe',
    success: 'Subscribed. Welcome aboard.',
  },
};

const localeOverrides = {
  de: {
    bentoLabelOverride: 'Premium-Erlebnis',
    ctaPrimary: 'Kostenlos starten',
  },
  pl: {
    bentoLabelOverride: 'Premium',
    ctaPrimary: 'Zacznij za darmo',
  },
  ar: {
    bentoLabelOverride: 'تجربة مميزة',
    ctaPrimary: 'ابدأ مجانًا',
  },
};

function deepMergeMissing(target, source) {
  if (Array.isArray(source)) {
    return Array.isArray(target) && target.length > 0 ? target : source;
  }
  if (source !== null && typeof source === 'object') {
    const out = { ...(target ?? {}) };
    for (const key of Object.keys(source)) {
      out[key] = deepMergeMissing(out[key], source[key]);
    }
    return out;
  }
  return target ?? source;
}

const locales = ['en', 'en-GB', 'de', 'pl', 'ar', 'ar-SA'];

for (const locale of locales) {
  const file = resolve(localesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));

  // Merge new top-level sections (preserve existing values).
  Object.assign(json, deepMergeMissing(json, additions));

  // Merge footer.newsletter without clobbering existing footer keys.
  json.footer = deepMergeMissing(json.footer ?? {}, footerNewsletter);

  // Apply non-English seed values so we don't end up with all-English locales.
  const overrides = localeOverrides[locale];
  if (overrides) {
    if (json.bento && overrides.bentoLabelOverride) {
      json.bento.label = overrides.bentoLabelOverride;
    }
    if (json.ctaBand && overrides.ctaPrimary) {
      json.ctaBand.ctaPrimary = overrides.ctaPrimary;
    }
  }

  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log(`✓ patched ${locale}.json`);
}
