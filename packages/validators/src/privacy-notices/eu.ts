// Phase 56 · Plan 07 — EU GDPR privacy notice fallback (FOUND-05/06).
//
// Rendered for authenticated users whose organization countryCode is not
// GB/DE/AE/SA (resolved via `resolveJurisdiction` in the privacy-notice
// service) and for unauthenticated visitors selecting the EU option on the
// jurisdiction picker. Must satisfy Article 13 GDPR so the fallback is
// legally viable on its own.

import type { PrivacyNoticeStructured } from './types.js';

export const euPrivacyNotice: PrivacyNoticeStructured = {
  jurisdiction: 'EU',
  legalReference: 'General Data Protection Regulation (GDPR, Regulation (EU) 2016/679)',
  sections: [
    {
      title: 'Data controller',
      content:
        'Contractor Ops is the data controller for personal data collected through your organisation\'s workspace. Your organisation administrator can confirm the specific controller entity and relevant data protection officer contact details. General privacy enquiries can be directed to privacy@contractorops.com.',
    },
    {
      title: 'Data protection officer',
      content:
        'Where required by Article 37 GDPR, a Data Protection Officer has been appointed and can be reached at dpo@contractorops.com. Formal correspondence should be routed through the controller — your organisation administrator.',
    },
    {
      title: 'Purposes of processing',
      content:
        'We process personal data to deliver the Contractor Ops platform, process invoices and payments, maintain audit trails, deliver transactional notifications, comply with legal obligations, and secure the service. Optional features (analytics, third-party integrations) are processed only with explicit consent.',
    },
    {
      title: 'Lawful bases',
      content:
        'Processing is based on Article 6 GDPR: performance of a contract (Art. 6(1)(b)), legal obligations (Art. 6(1)(c)), legitimate interests (Art. 6(1)(f) — platform security, fraud prevention, service improvement), and consent (Art. 6(1)(a)) for optional features. You may withdraw consent at any time without affecting processing carried out prior to withdrawal.',
    },
    {
      title: 'Data categories',
      content:
        'We process identity and contact data, professional data (contracts, work history), financial data (bank details, tax identifiers, invoices), usage data (platform interactions, audit logs), and integration tokens for connected services. We do not process special categories of personal data under Article 9 GDPR.',
    },
    {
      title: 'Recipients and sub-processors',
      content:
        'Personal data is disclosed only to sub-processors under an Article 28 data-processing agreement: Vercel (hosting), Neon (database), Cloudflare R2 (storage), Stripe (billing), Resend (email), Sentry (error monitoring), Axiom (logs). We do not sell or share personal data for behavioural advertising.',
    },
    {
      title: 'International transfers',
      content:
        'Data is primarily stored in the EEA. Where a sub-processor operates outside the EEA we rely on an adequacy decision issued by the European Commission or on Standard Contractual Clauses (Art. 46(2)(c) GDPR) together with supplementary measures as appropriate.',
    },
    {
      title: 'Retention',
      content:
        'Personal data is retained for the duration of the contractual relationship plus statutory retention periods (typically 6–10 years for tax and accounting records). Non-retained data is deleted or anonymised within 90 days of subscription termination.',
    },
    {
      title: 'Your rights',
      content:
        'Under Articles 15–22 GDPR you have the right to access, rectify, erase, restrict or object to processing, withdraw consent, and data portability. You also have the right not to be subject to solely automated decisions with legal or similar effect. To exercise a right, email privacy@contractorops.com — we respond within one calendar month.',
    },
    {
      title: 'Complaints',
      content:
        'Without prejudice to any other administrative or judicial remedy, you have the right under Article 77 GDPR to lodge a complaint with a supervisory authority, in particular the authority of the Member State of your habitual residence, place of work, or the place of the alleged infringement.',
    },
    {
      title: 'Contact',
      content:
        'For any privacy-related enquiry, to exercise your rights, or to contact our Data Protection Officer, please email privacy@contractorops.com. We will respond within one month of receipt of your request.',
    },
  ],
} as const;
