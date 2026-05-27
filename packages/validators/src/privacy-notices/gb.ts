// Phase 56 · Plan 07 — UK GDPR privacy notice content (FOUND-05).
//
// Structured per ICO guidance on Article 13 required information. Content is
// the single source of truth consumed by:
//   - apps/cms (Payload `legal-documents` collection — `jurisdiction=gb` rows)
//   - packages/pdf (React-PDF GdprPrivacyNoticeTemplate — GB branch)
//
// Legal basis: UK GDPR (retained Regulation (EU) 2016/679) + Data Protection
// Act 2018. Must cover all Article 13(1) and 13(2) elements (8 sections).

import type { PrivacyNoticeStructured } from './types.js';

export const gbPrivacyNotice: PrivacyNoticeStructured = {
  jurisdiction: 'GB',
  legalReference: 'UK GDPR (retained Regulation (EU) 2016/679) and Data Protection Act 2018',
  sections: [
    {
      title: 'Who we are',
      content:
        'Contractor Ops is the data controller for personal data you provide when your organisation uses our platform. Our UK representative and data-protection enquiries can be reached at privacy@contractorops.com. Your organisation administrator can confirm the specific controller entity for your workspace.',
    },
    {
      title: 'What data we process',
      content:
        'We process: identity and contact data (name, email, phone, role), contractor data (legal name, UTR, Companies House number, National Insurance number where provided, bank account details, invoice history), platform usage data (IP, session, audit trail), and integration tokens (Slack, Jira, Google Calendar). Sensitive or special-category data is not collected.',
    },
    {
      title: 'Lawful bases',
      content:
        'We process personal data under Article 6 UK GDPR on the following lawful bases: (a) performance of a contract — delivering the platform you or your organisation subscribes to; (b) legitimate interests — securing the service, fraud prevention, platform improvement; (c) legal obligation — HMRC record-keeping, statutory retention; and (d) consent — for optional integrations and analytics, which you may withdraw at any time.',
    },
    {
      title: 'Recipients',
      content:
        'Personal data is shared with sub-processors strictly as needed to deliver the service: Vercel (hosting), Neon (database), Cloudflare R2 (storage), Stripe (subscription billing), Resend (email delivery), Sentry (error monitoring), and Axiom (log aggregation). Each sub-processor is bound by a written data-processing agreement. We do not sell personal data.',
    },
    {
      title: 'Retention',
      content:
        'Account and platform data is retained for the duration of the subscription plus 30 days, after which soft-deleted records are permanently purged within 90 days. Financial records (invoices, payment runs, WHT certificates) are retained for 6 years per HMRC record-keeping requirements. Audit logs are retained for 7 years.',
    },
    {
      title: 'International transfers',
      content:
        'Your data is primarily stored in the EU (Cloudflare R2 and Neon EU regions). Where a sub-processor operates outside the UK or EEA, we rely on the UK International Data Transfer Addendum to the EU Standard Contractual Clauses or on adequacy regulations issued by the UK Government. A list of current sub-processors and their locations is available on request.',
    },
    {
      title: 'Your rights',
      content:
        'Under the UK GDPR you have the right to access your personal data, rectify inaccurate data, request erasure (subject to legal retention), restrict or object to processing, data portability, withdraw consent, and not be subject to solely automated decisions. To exercise a right, email privacy@contractorops.com — we will respond within one calendar month.',
    },
    {
      title: 'Complaints & contact',
      content:
        'If you believe your data-protection rights have been infringed you may lodge a complaint with the UK Information Commissioner (ICO) at ico.org.uk or by calling 0303 123 1113. Before escalating we invite you to contact us at privacy@contractorops.com so we can investigate and resolve the concern promptly.',
    },
  ],
} as const;
