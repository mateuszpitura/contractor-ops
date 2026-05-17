import { PrivacyNoticeLayout } from '@/components/legal/privacy-notice-layout';
import { A, H1, H2, Li, P, Strong, Ul } from '@/components/legal/privacy-prose';

export default function GbPrivacyPage() {
  return (
    <PrivacyNoticeLayout jurisdiction="GB" versionLabel="Version 1.0 · Effective 1 January 2026">
      <H1>Privacy Notice</H1>

      <P>
        Version 1.0 · Effective 1 January 2026 · Governing law: UK GDPR (retained Regulation (EU)
        2016/679) and the Data Protection Act 2018.
      </P>

      <H2 id="who-we-are">Who we are</H2>
      <P>
        Contractor Ops is the data controller for personal data you provide when your organisation
        uses our platform. General data-protection enquiries can be raised at{' '}
        <Strong>privacy@contractorops.com</Strong>. Your organisation administrator can confirm the
        specific controller entity for your workspace.
      </P>

      <H2 id="what-data-we-process">What data we process</H2>
      <P>
        We process identity and contact data (name, email, phone, role), contractor data (legal
        name, UTR, Companies House number, National Insurance number where provided, bank account
        details, invoice history), platform usage data (IP, session, audit trail), and integration
        tokens for connected tools (Slack, Jira, Google Calendar). Sensitive or special-category
        data is not collected.
      </P>

      <H2 id="lawful-bases">Lawful bases</H2>
      <P>We process personal data under Article 6 UK GDPR on the following lawful bases:</P>
      <Ul>
        <Li>
          <Strong>Performance of a contract</Strong> — delivering the platform you or your
          organisation subscribes to.
        </Li>
        <Li>
          <Strong>Legitimate interests</Strong> — securing the service, fraud prevention, platform
          improvement.
        </Li>
        <Li>
          <Strong>Legal obligation</Strong> — HMRC record-keeping, statutory retention.
        </Li>
        <Li>
          <Strong>Consent</Strong> — optional integrations and analytics, which you may withdraw at
          any time.
        </Li>
      </Ul>

      <H2 id="recipients">Recipients</H2>
      <P>
        Personal data is shared with sub-processors strictly as needed to deliver the service:
        Vercel (hosting), Neon (database), Cloudflare R2 (storage), Stripe (subscription billing),
        Resend (email delivery), Sentry (error monitoring), and Axiom (log aggregation). Each
        sub-processor is bound by a written data-processing agreement. We do not sell personal data.
      </P>

      <H2 id="retention">Retention</H2>
      <P>
        Account and platform data is retained for the duration of the subscription plus 30 days,
        after which soft-deleted records are permanently purged within 90 days. Financial records
        (invoices, payment runs, WHT certificates) are retained for <Strong>6 years</Strong> per
        HMRC record-keeping requirements. Audit logs are retained for <Strong>7 years</Strong>.
      </P>

      <H2 id="international-transfers">International transfers</H2>
      <P>
        Your data is primarily stored in the EU (Cloudflare R2 and Neon EU regions). Where a
        sub-processor operates outside the UK or EEA, we rely on the UK International Data Transfer
        Addendum to the EU Standard Contractual Clauses or on adequacy regulations issued by the UK
        Government. A current list of sub-processors and their locations is available on request.
      </P>

      <H2 id="your-rights">Your rights</H2>
      <P>Under the UK GDPR you have the right to:</P>
      <Ul>
        <Li>Access your personal data;</Li>
        <Li>Rectify inaccurate data;</Li>
        <Li>Request erasure (subject to legal retention);</Li>
        <Li>Restrict or object to processing;</Li>
        <Li>Data portability;</Li>
        <Li>Withdraw consent;</Li>
        <Li>Not be subject to solely automated decisions with legal or similar effect.</Li>
      </Ul>
      <P>
        To exercise a right, email <Strong>privacy@contractorops.com</Strong> — we will respond
        within one calendar month.
      </P>

      <H2 id="complaints-and-contact">Complaints &amp; contact</H2>
      <P>
        If you believe your data-protection rights have been infringed, you may lodge a complaint
        with the UK Information Commissioner (ICO) at <A href="https://ico.org.uk">ico.org.uk</A> or
        by calling 0303 123 1113. Before escalating, we invite you to contact us at{' '}
        <Strong>privacy@contractorops.com</Strong> so we can investigate and resolve the concern
        promptly.
      </P>
    </PrivacyNoticeLayout>
  );
}
