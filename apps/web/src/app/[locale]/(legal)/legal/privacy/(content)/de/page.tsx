import {
  GDPR_COMPLAINT_HEADING,
  GDPR_CONTROLLER_LABEL,
  GDPR_DPO_LABEL,
  GDPR_RIGHTS_HEADING,
  TAX_HANDELSREGISTER_LABEL,
  TAX_KLEINUNTERNEHMER_LABEL,
  TAX_SOZIALVERSICHERUNGSNUMMER_LABEL,
  TAX_STEUERNUMMER_LABEL,
  TAX_USTIDNR_LABEL,
} from '@contractor-ops/validators';
import { PrivacyNoticeLayout } from '@/components/legal/privacy-notice-layout';
import { H1, H2, Li, P, Strong, Ul } from '@/components/legal/privacy-prose';

export default function DePrivacyPage() {
  return (
    <PrivacyNoticeLayout jurisdiction="DE" versionLabel="Version 1.0 · gültig ab 1. Januar 2026">
      <H1>Datenschutzerklärung</H1>

      <P>
        Version 1.0 · gültig ab 1. Januar 2026 · Rechtsgrundlage: DSGVO (Verordnung (EU) 2016/679)
        und BDSG.
      </P>

      <H2 id="verantwortlicher">{GDPR_CONTROLLER_LABEL}</H2>
      <P>
        Die in dieser Datenschutzerklärung genannte Organisation ist {GDPR_CONTROLLER_LABEL} für die
        Verarbeitung Ihrer personenbezogenen Daten. Die Kontaktdaten des Verantwortlichen werden
        Ihnen von Ihrem Organisations-Administrator zur Verfügung gestellt. Anfragen zum Datenschutz
        richten Sie bitte an <Strong>privacy@contractorops.com</Strong>.
      </P>

      <H2 id="datenschutzbeauftragter">{GDPR_DPO_LABEL}</H2>
      <P>
        Unser {GDPR_DPO_LABEL} ist unter der E-Mail-Adresse <Strong>dpo@contractorops.com</Strong>{' '}
        erreichbar. Für formelle Korrespondenz wenden Sie sich bitte über Ihren
        Organisations-Administrator an den Verantwortlichen.
      </P>

      <H2 id="verarbeitungszwecke">Verarbeitungszwecke</H2>
      <P>
        Wir verarbeiten Ihre personenbezogenen Daten zur Erfüllung des Vertrags mit Ihrer
        Organisation (Art. 6 Abs. 1 lit. b DSGVO), zur Wahrung berechtigter Interessen wie
        IT-Sicherheit und Plattformverbesserung (Art. 6 Abs. 1 lit. f DSGVO), zur Erfüllung
        gesetzlicher Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO) sowie – soweit erforderlich
        – auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).
      </P>

      <H2 id="rechtsgrundlagen">Rechtsgrundlagen</H2>
      <P>
        Die Rechtsgrundlagen der Verarbeitung ergeben sich aus Art. 6 Abs. 1 DSGVO in Verbindung mit
        den ergänzenden Vorschriften des BDSG. Eine erteilte Einwilligung können Sie jederzeit mit
        Wirkung für die Zukunft widerrufen, ohne dass die Rechtmäßigkeit der aufgrund der
        Einwilligung bis zum Widerruf erfolgten Verarbeitung berührt wird.
      </P>

      <H2 id="datenkategorien">Datenkategorien</H2>
      <P>
        Bei Selbstständigen und Auftragnehmern verarbeiten wir insbesondere folgende steuerrelevante
        Identifikatoren:
      </P>
      <Ul>
        <Li>
          <Strong>{TAX_STEUERNUMMER_LABEL}</Strong>
        </Li>
        <Li>
          <Strong>{TAX_USTIDNR_LABEL}</Strong>
        </Li>
        <Li>
          <Strong>{TAX_HANDELSREGISTER_LABEL}</Strong>
        </Li>
        <Li>
          <Strong>{TAX_SOZIALVERSICHERUNGSNUMMER_LABEL}</Strong>
        </Li>
        <Li>
          Status als <Strong>{TAX_KLEINUNTERNEHMER_LABEL}</Strong>
        </Li>
      </Ul>
      <P>
        Darüber hinaus verarbeiten wir Stammdaten (Name, Anschrift, E-Mail-Adresse),
        Bankverbindungsdaten, Rechnungsdaten und technische Nutzungsdaten.
      </P>

      <H2 id="drittlandtransfer">Übermittlung in Drittländer</H2>
      <P>
        Eine Übermittlung personenbezogener Daten in Drittländer außerhalb des Europäischen
        Wirtschaftsraums findet nur statt, soweit dies zur Vertragserfüllung erforderlich ist. In
        diesen Fällen stützen wir die Übermittlung auf einen Angemessenheitsbeschluss der
        Europäischen Kommission oder auf Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO.
      </P>

      <H2 id="empfaenger">Empfänger</H2>
      <P>
        Empfänger Ihrer Daten sind ausschließlich sorgfältig ausgewählte Auftragsverarbeiter gemäß
        Art. 28 DSGVO (Hosting: Vercel; Datenbank: Neon; Speicher: Cloudflare R2; Abrechnung:
        Stripe; Transaktions-E-Mail: Resend; Fehlerüberwachung: Sentry; Protokollierung: Axiom). Mit
        jedem Auftragsverarbeiter ist ein schriftlicher Vertrag zur Auftragsverarbeitung
        geschlossen.
      </P>

      <H2 id="aufbewahrungsfristen">Aufbewahrungsfristen</H2>
      <P>
        Wir speichern Ihre personenbezogenen Daten für die Dauer der Geschäftsbeziehung zuzüglich
        der gesetzlichen Aufbewahrungsfristen. Rechnungs- und Steuerunterlagen werden gemäß § 147 AO
        und § 257 HGB zehn Jahre aufbewahrt. Nicht gesetzlich aufbewahrungspflichtige Daten werden
        nach Beendigung der Geschäftsbeziehung gelöscht.
      </P>

      <H2 id="ihre-rechte">{GDPR_RIGHTS_HEADING}</H2>
      <P>
        Sie haben nach Art. 15–22 DSGVO das Recht auf Auskunft über die Sie betreffenden
        personenbezogenen Daten, auf Berichtigung unrichtiger Daten, auf Löschung („Recht auf
        Vergessenwerden"), auf Einschränkung der Verarbeitung, auf Datenübertragbarkeit sowie auf
        Widerspruch gegen die Verarbeitung. Ein erteilter Widerspruch gegen eine auf Art. 6 Abs. 1
        lit. f DSGVO gestützte Verarbeitung wird umgehend umgesetzt.
      </P>

      <H2 id="beschwerderecht">{GDPR_COMPLAINT_HEADING}</H2>
      <P>
        Unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs
        steht Ihnen nach Art. 77 DSGVO das Recht zu, sich bei einer Aufsichtsbehörde – insbesondere
        beim Bundesbeauftragten für den Datenschutz und die Informationsfreiheit (BfDI) oder der für
        Ihren gewöhnlichen Aufenthaltsort zuständigen Landesdatenschutzbehörde – zu beschweren.
      </P>

      <H2 id="kontakt">Kontakt</H2>
      <P>
        Für datenschutzrechtliche Anfragen, zur Ausübung Ihrer Rechte oder zur Kontaktaufnahme mit
        unserem {GDPR_DPO_LABEL} wenden Sie sich bitte an <Strong>privacy@contractorops.com</Strong>
        . Wir bearbeiten Ihre Anfrage unverzüglich, spätestens innerhalb eines Monats nach Eingang.
      </P>
    </PrivacyNoticeLayout>
  );
}
