import { PrivacyNoticeLayout } from '@/components/legal/privacy-notice-layout';
import { H1, H2, Li, P, Strong, Ul } from '@/components/legal/privacy-prose';

export default function EuPrivacyPage() {
  return (
    <PrivacyNoticeLayout jurisdiction="EU" versionLabel="Version 1.0 · Effective 1 January 2026">
      <H1>Privacy Notice</H1>

      <P>
        Version 1.0 · Effective 1 January 2026 · Governing law: General Data Protection Regulation
        (GDPR, Regulation (EU) 2016/679).
      </P>

      <H2 id="data-controller">Data controller</H2>
      <P>
        Contractor Ops is the data controller for personal data collected through your
        organisation's workspace. Your organisation administrator can confirm the specific
        controller entity and relevant Data Protection Officer contact. General privacy enquiries
        can be directed to <Strong>privacy@contractorops.com</Strong>.
      </P>

      <H2 id="data-protection-officer">Data Protection Officer</H2>
      <P>
        Where required by Article 37 GDPR, a Data Protection Officer has been appointed and can be
        reached at <Strong>dpo@contractorops.com</Strong>. Formal correspondence should be routed
        through the controller — your organisation administrator.
      </P>

      <H2 id="purposes-of-processing">Purposes of processing</H2>
      <P>
        We process personal data to deliver the Contractor Ops platform, process invoices and
        payments, maintain audit trails, deliver transactional notifications, comply with legal
        obligations, and secure the service. Optional features (analytics, third-party integrations)
        are processed only with explicit consent.
      </P>

      <H2 id="lawful-bases">Lawful bases</H2>
      <P>Processing is based on Article 6 GDPR:</P>
      <Ul>
        <Li>
          <Strong>Performance of a contract</Strong> — Art. 6(1)(b);
        </Li>
        <Li>
          <Strong>Legal obligation</Strong> — Art. 6(1)(c);
        </Li>
        <Li>
          <Strong>Legitimate interests</Strong> — Art. 6(1)(f): platform security, fraud prevention,
          service improvement;
        </Li>
        <Li>
          <Strong>Consent</Strong> — Art. 6(1)(a) for optional features.
        </Li>
      </Ul>
      <P>
        You may withdraw consent at any time without affecting processing carried out prior to
        withdrawal.
      </P>

      <H2 id="data-categories">Data categories</H2>
      <P>
        We process identity and contact data, professional data (contracts, work history), financial
        data (bank details, tax identifiers, invoices), usage data (platform interactions, audit
        logs), and integration tokens for connected services. We do not process special categories
        of personal data under Article 9 GDPR.
      </P>

      <H2 id="recipients-and-sub-processors">Recipients and sub-processors</H2>
      <P>
        Personal data is disclosed only to sub-processors under an Article 28 data-processing
        agreement: Vercel (hosting), Neon (database), Cloudflare R2 (storage), Stripe (billing),
        Resend (email), Sentry (error monitoring), Axiom (logs). We do not sell or share personal
        data for behavioural advertising.
      </P>

      <H2 id="international-transfers">International transfers</H2>
      <P>
        Data is primarily stored in the EEA. Where a sub-processor operates outside the EEA we rely
        on an adequacy decision issued by the European Commission or on Standard Contractual Clauses
        (Art. 46(2)(c) GDPR) together with supplementary measures as appropriate.
      </P>

      <H2 id="retention">Retention</H2>
      <P>
        Personal data is retained for the duration of the contractual relationship plus statutory
        retention periods (typically 6–10 years for tax and accounting records). Non-retained data
        is deleted or anonymised within 90 days of subscription termination.
      </P>

      <H2 id="your-rights">Your rights</H2>
      <P>Under Articles 15–22 GDPR you have the right to:</P>
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
        To exercise a right, email <Strong>privacy@contractorops.com</Strong> — we respond within
        one calendar month.
      </P>

      <H2 id="complaints">Complaints</H2>
      <P>
        Without prejudice to any other administrative or judicial remedy, you have the right under
        Article 77 GDPR to lodge a complaint with a supervisory authority, in particular the
        authority of the Member State of your habitual residence, place of work, or the place of the
        alleged infringement.
      </P>

      <H2 id="contact">Contact</H2>
      <P>
        For any privacy-related enquiry, to exercise your rights, or to contact our Data Protection
        Officer, please email <Strong>privacy@contractorops.com</Strong>. We will respond within one
        month of receipt of your request.
      </P>
    </PrivacyNoticeLayout>
  );
}
