// Initial backfill content for the `legal-documents` collection.
//
// Source of truth was previously `apps/web/src/app/[locale]/(legal)/legal/**`:
// - privacy/(content)/{eu,de,gb}/page.tsx — full hand-authored content
// - terms/page.tsx, sub-processors/page.tsx, breach-notification/page.tsx —
//   rendered from next-intl `Legal.*` JSON in apps/web/messages/.
//
// This catalog captures a faithful summary of each notice so the migration
// script seeds Payload with non-empty, well-structured bodies. Editors then
// extend / localise each entry via the Payload admin UI. Once a doc lives
// in CMS, this catalog is no longer authoritative — only the initial seed.

import { a, b, doc, h1, h2, p, ul } from './lexical.js';

export type LegalEntry = {
  type: 'privacy' | 'terms' | 'sub-processors' | 'breach-notification';
  jurisdiction: 'eu' | 'gb' | 'de' | 'ae' | 'sa';
  locale: 'en' | 'pl' | 'de' | 'ar';
  title: string;
  version: string;
  effectiveDate: string; // ISO date
  body: ReturnType<typeof doc>;
};

const EFFECTIVE = '2026-01-01';
const VERSION = '1.0.0';

const privacyEu: LegalEntry = {
  type: 'privacy',
  jurisdiction: 'eu',
  locale: 'en',
  title: 'Privacy Notice (EU/EEA — GDPR)',
  version: VERSION,
  effectiveDate: EFFECTIVE,
  body: doc(
    h1('Privacy Notice'),
    p(
      'Version 1.0 · Effective 1 January 2026 · Governing law: General Data Protection Regulation (GDPR, Regulation (EU) 2016/679).',
    ),
    h2('Data controller'),
    p(
      'Contractor-Ops is the data controller for personal data collected through your organisation’s workspace. Your organisation administrator can confirm the specific controller entity and Data Protection Officer contact. General privacy enquiries: ',
      b('privacy@contractorops.com'),
      '.',
    ),
    h2('Data Protection Officer'),
    p(
      'Where required by Article 37 GDPR, a Data Protection Officer has been appointed and can be reached at ',
      b('dpo@contractorops.com'),
      '. Formal correspondence should be routed through the controller.',
    ),
    h2('Purposes of processing'),
    p(
      'We process personal data to deliver the Contractor-Ops platform, process invoices and payments, maintain audit trails, deliver transactional notifications, comply with legal obligations, and secure the service. Optional features (analytics, third-party integrations) are processed only with explicit consent.',
    ),
    h2('Lawful bases'),
    p('Processing is based on Article 6 GDPR:'),
    ul(
      [b('Performance of a contract'), ' — Art. 6(1)(b)'],
      [b('Legal obligation'), ' — Art. 6(1)(c)'],
      [
        b('Legitimate interests'),
        ' — Art. 6(1)(f): security, fraud prevention, service improvement',
      ],
      [b('Consent'), ' — Art. 6(1)(a) for optional features'],
    ),
    h2('International transfers'),
    p(
      'Data is primarily stored in the EEA. Where a sub-processor operates outside the EEA we rely on adequacy decisions or Standard Contractual Clauses (Art. 46(2)(c) GDPR) together with supplementary measures as appropriate.',
    ),
    h2('Retention'),
    p(
      'Personal data is retained for the duration of the contractual relationship plus statutory retention periods (typically 6–10 years for tax and accounting records). Non-retained data is deleted or anonymised within 90 days of subscription termination.',
    ),
    h2('Your rights'),
    p('Under Articles 15–22 GDPR you have the right to:'),
    ul(
      ['Access your personal data'],
      ['Rectify inaccurate data'],
      ['Request erasure (subject to legal retention)'],
      ['Restrict or object to processing'],
      ['Data portability'],
      ['Withdraw consent'],
      ['Not be subject to solely automated decisions with legal or similar effect'],
    ),
    p(
      'To exercise a right, email ',
      b('privacy@contractorops.com'),
      ' — we respond within one calendar month.',
    ),
    h2('Complaints'),
    p(
      'You have the right under Article 77 GDPR to lodge a complaint with a supervisory authority, in particular the authority of the Member State of your habitual residence, place of work, or the place of the alleged infringement.',
    ),
  ),
};

const privacyGb: LegalEntry = {
  type: 'privacy',
  jurisdiction: 'gb',
  locale: 'en',
  title: 'Privacy Notice (United Kingdom — UK GDPR)',
  version: VERSION,
  effectiveDate: EFFECTIVE,
  body: doc(
    h1('Privacy Notice'),
    p(
      'Version 1.0 · Effective 1 January 2026 · Governing law: UK GDPR (retained Regulation (EU) 2016/679) and the Data Protection Act 2018.',
    ),
    h2('Who we are'),
    p(
      'Contractor-Ops is the data controller for personal data you provide when your organisation uses our platform. General enquiries: ',
      b('privacy@contractorops.com'),
      '.',
    ),
    h2('What data we process'),
    p(
      'Identity and contact data (name, email, phone, role), contractor data (legal name, UTR, Companies House number, National Insurance number where provided, bank account details, invoice history), platform usage data (IP, session, audit trail), and integration tokens for connected tools. Sensitive or special-category data is not collected.',
    ),
    h2('Lawful bases'),
    p('We process personal data under Article 6 UK GDPR on the following lawful bases:'),
    ul(
      [
        b('Performance of a contract'),
        ' — delivering the platform you or your organisation subscribes to',
      ],
      [
        b('Legitimate interests'),
        ' — securing the service, fraud prevention, platform improvement',
      ],
      [b('Legal obligation'), ' — HMRC record-keeping, statutory retention'],
      [b('Consent'), ' — optional integrations and analytics, which you may withdraw at any time'],
    ),
    h2('Retention'),
    p(
      'Account and platform data is retained for the duration of the subscription plus 30 days, after which soft-deleted records are permanently purged within 90 days. Financial records (invoices, payment runs, WHT certificates) are retained for ',
      b('6 years'),
      ' per HMRC requirements. Audit logs are retained for ',
      b('7 years'),
      '.',
    ),
    h2('International transfers'),
    p(
      'Where a sub-processor operates outside the UK or EEA, we rely on the UK International Data Transfer Addendum to the EU Standard Contractual Clauses or on adequacy regulations issued by the UK Government.',
    ),
    h2('Complaints'),
    p(
      'If you believe your data-protection rights have been infringed, you may lodge a complaint with the UK Information Commissioner (ICO) at ',
      a('ico.org.uk', 'https://ico.org.uk'),
      ' or by calling 0303 123 1113.',
    ),
  ),
};

const privacyDe: LegalEntry = {
  type: 'privacy',
  jurisdiction: 'de',
  locale: 'en',
  title: 'Privacy Notice (Germany — DSGVO / BDSG)',
  version: VERSION,
  effectiveDate: EFFECTIVE,
  body: doc(
    h1('Privacy Notice'),
    p(
      'Version 1.0 · Effective 1 January 2026 · Governing law: DSGVO (Regulation (EU) 2016/679) and BDSG (Bundesdatenschutzgesetz).',
    ),
    h2('Controller (Verantwortlicher)'),
    p(
      'The organisation named in this notice is the controller (Verantwortlicher) for the processing of your personal data. Contact: ',
      b('privacy@contractorops.com'),
      '.',
    ),
    h2('Data Protection Officer'),
    p(
      'Our DPO (Datenschutzbeauftragter) is reachable at ',
      b('dpo@contractorops.com'),
      '. Formal correspondence should be routed through the controller.',
    ),
    h2('Tax-relevant identifiers'),
    p('For self-employed contractors we may process the following identifiers:'),
    ul(
      [b('Steuernummer')],
      [b('Umsatzsteuer-Identifikationsnummer (USt-IdNr.)')],
      [b('Handelsregister number')],
      [b('Sozialversicherungsnummer')],
      ['Kleinunternehmer status (§19 UStG)'],
    ),
    h2('Retention'),
    p(
      'Invoice and tax records are retained for ten years pursuant to § 147 AO and § 257 HGB. Other data is deleted after the end of the business relationship unless statutory retention applies.',
    ),
    h2('Complaints'),
    p(
      'You may lodge a complaint with the Federal Commissioner for Data Protection and Freedom of Information (BfDI) or the relevant Land supervisory authority.',
    ),
  ),
};

const termsEu: LegalEntry = {
  type: 'terms',
  jurisdiction: 'eu',
  locale: 'en',
  title: 'Terms of Service',
  version: VERSION,
  effectiveDate: EFFECTIVE,
  body: doc(
    h1('Terms of Service'),
    p('Version 1.0 — Effective 1 January 2026.'),
    h2('Acceptance of terms'),
    p(
      'By accessing or using Contractor-Ops you agree to be bound by these Terms. If you are accepting on behalf of an organisation you represent that you have authority to do so.',
    ),
    h2('Service description'),
    p(
      'Contractor-Ops is a workflow platform for cross-border independent contractors covering invoicing, contracts, tax artefacts, and integrations. Specific features are listed on the product website.',
    ),
    h2('Accounts'),
    p(
      'You are responsible for maintaining the confidentiality of your credentials and for all activities under your account. Notify ',
      b('security@contractorops.com'),
      ' immediately of any unauthorised use.',
    ),
    h2('Data processing'),
    p(
      'Personal data is processed in accordance with the Privacy Notice applicable to your jurisdiction. Where a data-processing agreement (DPA) is required, the standard DPA is incorporated by reference.',
    ),
    h2('Acceptable use'),
    p(
      'You may not use the Service to violate any law, infringe IP rights, transmit malware, or attempt to bypass security controls. We reserve the right to suspend accounts found in breach.',
    ),
    h2('Intellectual property'),
    p(
      'All platform IP remains owned by Contractor-Ops. You retain ownership of the data you submit. Each party grants the other a limited licence required to operate the Service.',
    ),
    h2('Liability'),
    p(
      'To the maximum extent permitted by law, Contractor-Ops’ aggregate liability is limited to the fees paid by your organisation in the twelve months preceding the event giving rise to liability.',
    ),
    h2('Software is not legal advice'),
    p(
      'Contractor-Ops is a software platform and not a substitute for professional tax, legal, or accounting advice. Always consult a qualified adviser before relying on platform output.',
    ),
    h2('Termination'),
    p(
      'Either party may terminate for material breach uncured after 30 days’ written notice. On termination we will retain personal data only as required by statutory retention or for active dispute resolution.',
    ),
    h2('Governing law'),
    p(
      'These Terms are governed by the law specified in your order form. In the absence of an order form, the laws of Estonia apply, without regard to conflict-of-laws principles.',
    ),
    h2('Contact'),
    p('Questions about these Terms: ', b('legal@contractorops.com'), '.'),
  ),
};

const subProcessorsEu: LegalEntry = {
  type: 'sub-processors',
  jurisdiction: 'eu',
  locale: 'en',
  title: 'Sub-processors',
  version: VERSION,
  effectiveDate: EFFECTIVE,
  body: doc(
    h1('Sub-processors'),
    p('Version 1.0 — Effective 1 January 2026.'),
    h2('Introduction'),
    p(
      'We engage carefully vetted sub-processors to deliver Contractor-Ops. Each sub-processor is bound by a written data-processing agreement, applicable Standard Contractual Clauses, and a security review.',
    ),
    h2('Current sub-processors'),
    ul(
      [b('Vercel'), ' — hosting (EU/US)'],
      [b('Neon'), ' — PostgreSQL database (EU regional projects)'],
      [b('Cloudflare R2'), ' — object storage (EU)'],
      [b('Stripe'), ' — subscription billing (EU/US)'],
      [b('Resend'), ' — transactional email (EU)'],
      [b('Sentry'), ' — error monitoring (EU/US)'],
      [b('Axiom'), ' — log aggregation (EU)'],
      [b('Upstash Redis'), ' — rate limiting + cache (EU)'],
      [b('QStash (Upstash)'), ' — webhook queue (EU)'],
      [b('Cronitor'), ' — cron monitoring (EU/US)'],
    ),
    h2('Changes'),
    p(
      'Material additions of sub-processors are announced at least 14 days in advance via the customer admin console and on this page. You may object on legitimate grounds; if we cannot mitigate the concern you may terminate the affected service.',
    ),
    h2('Contact'),
    p('Questions: ', b('privacy@contractorops.com'), '.'),
  ),
};

const breachNotificationEu: LegalEntry = {
  type: 'breach-notification',
  jurisdiction: 'eu',
  locale: 'en',
  title: 'Personal-data Breach Notification Procedure',
  version: VERSION,
  effectiveDate: EFFECTIVE,
  body: doc(
    h1('Breach Notification Procedure'),
    p('Version 1.0 — Effective 1 January 2026.'),
    h2('Scope'),
    p(
      'This procedure documents how Contractor-Ops detects, assesses, and notifies personal-data breaches under Articles 33–34 GDPR (and equivalent regional law). It applies to all personnel and sub-processors.',
    ),
    h2('Definition'),
    p(
      'A "personal-data breach" is a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data processed in the Service.',
    ),
    h2('Detection'),
    p(
      'Detection sources include Sentry alerts, structured Pino logs piped to Axiom, automated security alerts, and reports from customers, sub-processors, or independent researchers.',
    ),
    h2('Assessment'),
    p(
      'Within 24 hours of detection the on-call engineer triages severity, scope, and personal-data categories impacted. A Data Protection Officer review is convened for any High-severity event.',
    ),
    h2('Authority notification'),
    p(
      'Where required, the lead supervisory authority is notified within 72 hours of the controller becoming aware (Article 33 GDPR). Late notifications include the reason for the delay.',
    ),
    h2('Customer notification'),
    p(
      'Where a breach is likely to result in a high risk to data subjects, affected customers are notified without undue delay (Article 34). Communications use plain language and include mitigation guidance.',
    ),
    h2('Documentation'),
    p(
      'Every event is recorded in the internal breach register with timestamps, scope, mitigations applied, and lessons learned. The register is reviewed quarterly.',
    ),
    h2('Contact'),
    p('Report a suspected breach: ', b('security@contractorops.com'), '.'),
  ),
};

export const LEGAL_CATALOG: readonly LegalEntry[] = [
  privacyEu,
  privacyGb,
  privacyDe,
  termsEu,
  subProcessorsEu,
  breachNotificationEu,
];
