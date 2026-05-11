/**
 * German translation map — Part 6 (final).
 * Covers: Legal (privacy/terms/subProcessors/breachNotification), CookieConsent,
 * GoogleWorkspace, Teams, OnboardingImport, Billing, Time, Zatca, Peppol,
 * Integrations.jira/linear, Api, Layout, organization, Classification, EInvoice,
 * Offboarding.
 */

export const TRANSLATIONS_PART6: Record<string, string> = {
  // ─── Legal.privacy ─────────────────────────────────────────────────────────
  'Legal.privacy.title': 'Datenschutzerklärung',
  'Legal.privacy.lastUpdated': 'Zuletzt aktualisiert: April 2026',
  'Legal.privacy.sections.introduction.body':
    'Contractor Ops („wir“, „uns“, „unser“) betreibt die Plattform contractorops.com. Diese Datenschutzerklärung erläutert, wie wir Ihre personenbezogenen Daten erheben, verwenden, speichern und schützen, wenn Sie unsere Dienste nutzen. Wir verpflichten uns zum Schutz Ihrer Privatsphäre gemäß der Datenschutz-Grundverordnung (DSGVO), dem polnischen Datenschutzgesetz und anderen anwendbaren Datenschutzgesetzen.',
  'Legal.privacy.sections.dataCollected.body':
    'Wir erheben folgende Kategorien personenbezogener Daten: Kontodaten (Name, E-Mail-Adresse, Name der Organisation); Auftragnehmerdaten (Firmenname, Steueridentifikationsnummern (NIP), Bankverbindungen, Anschriften, Telefonnummern, E-Mail-Adressen); Rechnungs- und Zahlungsdaten (Rechnungsnummern, Beträge, Zahlungsdetails); Nutzungsdaten (IP-Adressen, Browsertyp, Zugriffszeiten, besuchte Seiten); Integrationsdaten (Tokens und Kennungen für verbundene Dienste wie Slack, Jira, Google Calendar).',
  'Legal.privacy.sections.purpose.body':
    'Wir verarbeiten personenbezogene Daten zu folgenden Zwecken: Bereitstellung und Betrieb unserer Plattform zur Auftragnehmer-Verwaltung; Verarbeitung von Rechnungen und Erleichterung von Zahlungs-Workflows; Verwaltung von Onboarding- und Offboarding-Workflows; Versand transaktionaler Benachrichtigungen (Freigabeanfragen, Rechnungswarnungen, Vertragserinnerungen); Gewährleistung von Sicherheit und Betrugsprävention; Erfüllung gesetzlicher Pflichten (Steuermeldung, Auditanforderungen).',
  'Legal.privacy.sections.legalBasis.body':
    'Wir verarbeiten Ihre Daten auf folgenden Rechtsgrundlagen: Vertragserfüllung (Bereitstellung unserer Dienste an Sie); berechtigte Interessen (Verbesserung unserer Plattform, Gewährleistung der Sicherheit); gesetzliche Pflichten (Steuer-Compliance, Aufbewahrung finanzieller Aufzeichnungen); Einwilligung (für optionale Funktionen wie Analytics und Marketing-Kommunikation, die Sie jederzeit widerrufen können).',
  'Legal.privacy.sections.dataSharing.body':
    'Wir geben Daten an folgende Kategorien von Dritten weiter, soweit dies zur Erbringung unserer Dienste erforderlich ist: Cloud-Infrastruktur-Anbieter (Vercel, Neon, Cloudflare) für Hosting und Datenspeicherung; Zahlungsdienstleister (Stripe) für die Abonnementabrechnung; E-Mail-Dienste (Resend) für transaktionale Benachrichtigungen; Error-Monitoring (Sentry) für die Anwendungszuverlässigkeit; Log-Aggregation (Axiom) für den operativen Betrieb. Wir verkaufen Ihre personenbezogenen Daten nicht. Alle Unterauftragsverarbeiter sind durch Auftragsverarbeitungsverträge an die Einhaltung der DSGVO gebunden.',
  'Legal.privacy.sections.retention.body':
    'Wir bewahren Ihre personenbezogenen Daten für die Dauer Ihres Abonnements zuzüglich 30 Tagen auf. Finanzielle Aufzeichnungen (Rechnungen, Zahlungsdaten) werden für die gesetzlich vorgeschriebene Dauer (typischerweise 5–10 Jahre je nach Rechtsordnung) aufbewahrt. Sie können jederzeit eine frühere Löschung nicht gesetzlich vorgeschriebener Daten verlangen. Gelöschte Daten werden sofort soft-deleted und innerhalb von 90 Tagen endgültig entfernt.',
  'Legal.privacy.sections.security.body':
    'Wir setzen geeignete technische und organisatorische Maßnahmen zum Schutz Ihrer Daten ein, darunter: Verschlüsselung im Ruhezustand (auf Datenbankebene und auf Anwendungsebene für sensible Felder wie Bankkonten); Verschlüsselung bei der Übertragung (TLS 1.2+ für alle Verbindungen); rollenbasierte Zugriffskontrolle nach dem Prinzip der geringsten Rechte; Audit-Protokollierung aller Zugriffe auf sensible Daten; regelmäßige Sicherheitsprüfungen; Virenscans hochgeladener Dokumente.',
  'Legal.privacy.sections.rights.body':
    'Nach der DSGVO haben Sie folgende Rechte: Auskunft über Ihre personenbezogenen Daten; Berichtigung unrichtiger Daten; Löschung Ihrer Daten („Recht auf Vergessenwerden“); Einschränkung der Verarbeitung; Datenübertragbarkeit (Erhalt Ihrer Daten in strukturierter, maschinenlesbarer Form); Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen; jederzeitiger Widerruf einer Einwilligung. Zur Ausübung dieser Rechte wenden Sie sich an uns unter privacy@contractorops.com. Wir antworten innerhalb von 30 Tagen.',
  'Legal.privacy.sections.cookies.body':
    'Wir verwenden ausschließlich notwendige Cookies zur Authentifizierung und Sitzungsverwaltung. Diese Cookies sind für die Funktion der Plattform unverzichtbar und können nicht deaktiviert werden. Wir nutzen keine Tracking- oder Werbe-Cookies Dritter. Sitzungs-Cookies laufen nach 24 Stunden Inaktivität ab.',
  'Legal.privacy.sections.contact.body':
    'Bei datenschutzbezogenen Anfragen wenden Sie sich an unseren Datenschutzbeauftragten unter privacy@contractorops.com. Wenn Sie der Ansicht sind, dass Ihre Datenschutzrechte verletzt wurden, haben Sie das Recht, sich bei Ihrer örtlichen Aufsichtsbehörde zu beschweren. In Polen ist dies der Präsident des Amtes für den Schutz personenbezogener Daten (UODO).',

  // ─── Legal.terms ───────────────────────────────────────────────────────────
  'Legal.terms.title': 'Nutzungsbedingungen',
  'Legal.terms.lastUpdated': 'Zuletzt aktualisiert: April 2026',
  'Legal.terms.sections.acceptance.body':
    'Indem Sie auf Contractor Ops („den Dienst“) zugreifen oder ihn nutzen, erklären Sie sich an diese Nutzungsbedingungen gebunden. Wenn Sie den Dienst im Namen einer Organisation nutzen, sichern Sie zu, dass Sie berechtigt sind, diese Organisation an diese Bedingungen zu binden. Wenn Sie nicht zustimmen, dürfen Sie den Dienst nicht nutzen.',
  'Legal.terms.sections.serviceDescription.body':
    'Contractor Ops ist eine SaaS-Plattform zur Verwaltung von Auftragnehmer-Beziehungen, einschließlich Onboarding, Vertragsverwaltung, Rechnungsverarbeitung, Freigabe-Workflows und Zahlungsabwicklung. Der Dienst wird „wie besehen“ bereitgestellt. Wir behalten uns vor, Funktionen mit angemessener Vorankündigung zu ändern, auszusetzen oder einzustellen.',
  'Legal.terms.sections.accounts.body':
    'Sie sind für die Vertraulichkeit Ihrer Konto-Anmeldedaten verantwortlich. Sie müssen uns unverzüglich über jeden unbefugten Zugriff informieren. Jedes Benutzerkonto ist für eine einzelne Person bestimmt und darf nicht geteilt werden. Organisationsadministratoren sind für die Verwaltung von Benutzerzugang und Berechtigungen innerhalb ihrer Organisation verantwortlich.',
  'Legal.terms.sections.dataProcessing.body':
    'Sie handeln als Verantwortlicher für die über unsere Plattform verarbeiteten Auftragnehmerdaten. Wir handeln als Auftragsverarbeiter. Unsere Verarbeitungstätigkeiten unterliegen unserem Auftragsverarbeitungsvertrag (AVV), der auf Anfrage erhältlich ist. Sie sind dafür verantwortlich sicherzustellen, dass Sie über eine rechtmäßige Grundlage zur Verarbeitung von personenbezogenen Daten der Auftragnehmer über unsere Plattform verfügen.',
  'Legal.terms.sections.acceptableUse.body':
    'Sie verpflichten sich, den Dienst nicht für rechtswidrige Zwecke zu nutzen; keine schädlichen Dateien hochzuladen oder die Sicherheit der Plattform zu kompromittieren; keinen Zugriff auf Daten anderer Organisationen zu versuchen; keine angemessenen Nutzungslimits zu überschreiten oder API-Endpunkte zu missbrauchen; den Dienst nicht zu reverse-engineeren, dekompilieren oder den Quellcode zu extrahieren.',
  'Legal.terms.sections.intellectualProperty.body':
    'Der Dienst, einschließlich Code, Design und Dokumentation, ist Eigentum von Contractor Ops. Sie behalten das Eigentum an allen Daten, die Sie in den Dienst hochladen. Wir beanspruchen keine Schutzrechte an Ihren Auftragnehmerdaten, Rechnungen oder Dokumenten.',
  'Legal.terms.sections.liability.body':
    'Soweit gesetzlich zulässig, haftet Contractor Ops nicht für indirekte, beiläufige, besondere, Folge- oder Strafschäden, einschließlich entgangenen Gewinns, Datenverlust oder verlorener Geschäftschancen. Unsere Gesamthaftung übersteigt den von Ihnen in den 12 Monaten vor dem Anspruch gezahlten Betrag nicht. Diese Beschränkung gilt nicht für Haftung, die gesetzlich nicht ausgeschlossen werden kann.',
  'Legal.terms.sections.termination.body':
    'Beide Parteien können diese Vereinbarung jederzeit kündigen. Nach Kündigung: Ihr Zugang zum Dienst wird widerrufen; Ihre Daten werden 30 Tage aufbewahrt und danach endgültig gelöscht; Sie können vor der Kündigung einen Datenexport anfordern. Wir können Ihr Konto sofort aussetzen oder kündigen, wenn Sie gegen diese Bedingungen verstoßen.',
  'Legal.terms.sections.governingLaw.body':
    'Diese Bedingungen unterliegen dem Recht der Republik Polen und werden entsprechend ausgelegt. Streitigkeiten aus diesen Bedingungen unterliegen der ausschließlichen Zuständigkeit der Gerichte in Warschau, Polen. Für EU-Verbraucher bleibt das Recht unberührt, Verfahren in Ihrem Wohnsitzland anzustrengen.',
  'Legal.terms.sections.contact.body':
    'Bei Fragen zu diesen Bedingungen wenden Sie sich an uns unter legal@contractorops.com.',

  // ─── Legal.subProcessors ───────────────────────────────────────────────────
  'Legal.subProcessors.lastUpdated': 'Zuletzt aktualisiert: April 2026',
  'Legal.subProcessors.table.dataProcessed': 'Verarbeitete Daten',
  'Legal.subProcessors.sections.introduction.body':
    'Contractor Ops nutzt folgende Unterauftragsverarbeiter, um unsere Dienste zu erbringen. Jeder Unterauftragsverarbeiter ist durch einen Auftragsverarbeitungsvertrag an die Einhaltung der DSGVO gebunden. Wir teilen nur die für die Funktion des jeweiligen Verarbeiters erforderlichen Mindestdaten.',
  'Legal.subProcessors.sections.processors.heading': 'Aktuelle Unterauftragsverarbeiter',
  'Legal.subProcessors.sections.changes.heading': 'Änderungen bei Unterauftragsverarbeitern',
  'Legal.subProcessors.sections.changes.body':
    'Wir werden Kunden mindestens 30 Tage im Voraus über Änderungen dieser Liste informieren. Benachrichtigungen werden per E-Mail an Organisationsadministratoren gesendet. Wenn Sie einem neuen Unterauftragsverarbeiter widersprechen, können Sie Ihr Abonnement vor Inkrafttreten der Änderung kündigen.',
  'Legal.subProcessors.sections.contact.body':
    'Bei Fragen zu unseren Unterauftragsverarbeitern oder Datenverarbeitungspraktiken wenden Sie sich an uns unter privacy@contractorops.com.',
  'Legal.subProcessors.processors.vercel.name': 'Vercel Inc.',
  'Legal.subProcessors.processors.vercel.purpose':
    'Anwendungs-Hosting, serverlose Funktionen, Edge-Netzwerk',
  'Legal.subProcessors.processors.vercel.data': 'HTTP-Anfragen, IP-Adressen, Sitzungs-Tokens',
  'Legal.subProcessors.processors.vercel.location': 'Vereinigte Staaten (EU-Datenregion verfügbar)',
  'Legal.subProcessors.processors.neon.name': 'Neon Inc.',
  'Legal.subProcessors.processors.neon.purpose': 'PostgreSQL-Datenbank-Hosting',
  'Legal.subProcessors.processors.neon.data': 'Alle Anwendungsdaten (im Ruhezustand verschlüsselt)',
  'Legal.subProcessors.processors.neon.location': 'EU (Frankfurt)',
  'Legal.subProcessors.processors.cloudflare.name': 'Cloudflare Inc.',
  'Legal.subProcessors.processors.cloudflare.purpose':
    'Objektspeicher (R2) für Dokumente und Dateien',
  'Legal.subProcessors.processors.cloudflare.data':
    'Hochgeladene Dokumente, Verträge, Rechnungen (im Ruhezustand verschlüsselt)',
  'Legal.subProcessors.processors.cloudflare.location': 'Automatisch (nächstgelegene Region)',
  'Legal.subProcessors.processors.stripe.name': 'Stripe Inc.',
  'Legal.subProcessors.processors.stripe.purpose': 'Abonnementabrechnung und Zahlungsabwicklung',
  'Legal.subProcessors.processors.stripe.data':
    'Organisationsname, Abrechnungs-E-Mail, Abonnementdetails',
  'Legal.subProcessors.processors.stripe.location': 'Vereinigte Staaten / Irland',
  'Legal.subProcessors.processors.resend.name': 'Resend Inc.',
  'Legal.subProcessors.processors.resend.purpose':
    'Versand transaktionaler E-Mails und Verarbeitung eingehender E-Mails',
  'Legal.subProcessors.processors.resend.data':
    'E-Mail-Adressen, Benachrichtigungsinhalte, E-Mail-Anhänge von Rechnungen',
  'Legal.subProcessors.processors.resend.location': 'Vereinigte Staaten',
  'Legal.subProcessors.processors.sentry.name': 'Sentry (Functional Software Inc.)',
  'Legal.subProcessors.processors.sentry.purpose': 'Error-Monitoring und Performance-Tracking',
  'Legal.subProcessors.processors.sentry.data':
    'Fehler-Stacktraces, Anfrage-Metadaten, Benutzer-IDs (keine personenbezogenen Daten)',
  'Legal.subProcessors.processors.sentry.location': 'Vereinigte Staaten',
  'Legal.subProcessors.processors.axiom.name': 'Axiom Inc.',
  'Legal.subProcessors.processors.axiom.purpose': 'Log-Aggregation und operatives Monitoring',
  'Legal.subProcessors.processors.axiom.data':
    'Strukturierte Anwendungslogs, Anfrage-IDs, Performance-Kennzahlen',
  'Legal.subProcessors.processors.axiom.location': 'Vereinigte Staaten',
  'Legal.subProcessors.processors.upstash.name': 'Upstash Inc.',
  'Legal.subProcessors.processors.upstash.purpose': 'Redis-basiertes Rate-Limiting und Caching',
  'Legal.subProcessors.processors.upstash.data':
    'Rate-Limit-Zähler, IP-Adressen, Benutzer-/Organisations-IDs',
  'Legal.subProcessors.processors.upstash.location': 'EU (Frankfurt)',
  'Legal.subProcessors.processors.cronitor.name': 'Cronitor Inc.',
  'Legal.subProcessors.processors.cronitor.purpose': 'Cron-Job-Monitoring und Alerting',
  'Legal.subProcessors.processors.cronitor.data':
    'Job-Ausführungsstatus, Zeitstempel (keine Nutzerdaten)',
  'Legal.subProcessors.processors.cronitor.location': 'Vereinigte Staaten',
  'Legal.subProcessors.processors.uptimerobot.purpose': 'Externes Uptime-Monitoring',
  'Legal.subProcessors.processors.uptimerobot.data':
    'Health-Endpoint-Antworten (keine Nutzerdaten)',
  'Legal.subProcessors.processors.uptimerobot.location': 'Vereinigte Staaten',
  'Legal.subProcessors.processors.qstash.name': 'Upstash QStash',
  'Legal.subProcessors.processors.qstash.purpose':
    'Asynchrone Nachrichtenwarteschlange für Webhook-Verarbeitung',
  'Legal.subProcessors.processors.qstash.data': 'Webhook-Payloads, Zustell-Metadaten',
  'Legal.subProcessors.processors.qstash.location': 'EU (Frankfurt)',

  // ─── Legal.breachNotification ──────────────────────────────────────────────
  'Legal.breachNotification.title': 'Verfahren zur Meldung von Datenschutzverletzungen',
  'Legal.breachNotification.lastUpdated': 'Zuletzt aktualisiert: April 2026',
  'Legal.breachNotification.sections.introduction.body':
    'Dieses Dokument beschreibt das Verfahren von Contractor Ops zur Erkennung, Bewertung und Meldung von Datenschutzverletzungen gemäß Artikel 33 und 34 der Datenschutz-Grundverordnung (DSGVO).',
  'Legal.breachNotification.sections.definition.body':
    'Eine Datenschutzverletzung ist eine Verletzung der Sicherheit, die zur versehentlichen oder unrechtmäßigen Vernichtung, zum Verlust, zur Veränderung, zur unbefugten Offenlegung von oder zum unbefugten Zugang zu personenbezogenen Daten führt, die übermittelt, gespeichert oder anderweitig verarbeitet werden. Dies umfasst: unbefugten Zugriff auf Benutzerkonten oder Organisationsdaten; versehentliche Offenlegung personenbezogener Daten an unbeabsichtigte Empfänger; Verlust oder Diebstahl von Datenträgern oder Backups; bösartige Angriffe mit Datenabfluss; versehentliche Löschung von Daten ohne Backup-Wiederherstellungsmöglichkeit.',
  'Legal.breachNotification.sections.detection.body':
    'Wir setzen mehrere Monitoring-Ebenen zur Erkennung möglicher Verletzungen ein: automatisiertes Sicherheitsmonitoring über Sentry (Error-Tracking und Anomalie-Erkennung); strukturiertes Logging über Axiom (Analyse von Zugriffsmustern); Audit-Logs aller Zugriffe auf sensible Daten; externes Uptime-Monitoring über UptimeRobot; Health-Monitoring von Hintergrundjobs für die Integrität der Webhook-Verarbeitung. Jedes Teammitglied, das eine Datenschutzverletzung vermutet, muss diese unverzüglich dem Sicherheitsteam unter security@contractorops.com melden.',
  'Legal.breachNotification.sections.assessment.body':
    'Nach Erkennung wird unser Incident-Response-Team: prüfen, ob eine Verletzung vorliegt; den Umfang und die Art der betroffenen Daten ermitteln; das Risiko für die Rechte und Freiheiten der Betroffenen bewerten; Ursache feststellen und sofortige Eindämmungsmaßnahmen einleiten; die Schwere (niedrig, mittel, hoch, kritisch) anhand von Datensensibilität, Anzahl der Betroffenen und Schadenspotenzial klassifizieren.',
  'Legal.breachNotification.sections.authorityNotification.body':
    'Wenn die Verletzung voraussichtlich ein Risiko für die Rechte und Freiheiten der Betroffenen darstellt, werden wir die zuständige Aufsichtsbehörde innerhalb von 72 Stunden nach Kenntniserlangung benachrichtigen. Für Kunden in Polen ist dies der Präsident des Amtes für den Schutz personenbezogener Daten (UODO). Die Meldung umfasst: Art der Verletzung und ungefähre Zahl der Betroffenen; Kategorien der betroffenen Daten; wahrscheinliche Folgen; ergriffene oder geplante Maßnahmen.',
  'Legal.breachNotification.sections.customerNotification.body':
    'Wir benachrichtigen betroffene Kunden (Verantwortliche) unverzüglich über: E-Mail an alle Organisationsadministratoren; In-App-Benachrichtigungsbanner für betroffene Organisationen; Aktualisierung der dedizierten Statusseite. Die Benachrichtigung beschreibt: was geschehen ist und wann; welche Daten betroffen sind; was wir zur Eindämmung der Verletzung unternommen haben; welche Schritte Kunden ergreifen sollten; Kontaktinformationen unseres Sicherheitsteams. Bei hohem Risiko für Betroffene unterstützen wir Kunden bei der Benachrichtigung der betroffenen Personen.',
  'Legal.breachNotification.sections.timeline.body':
    'Unser angestrebter Reaktionszeitplan: Sofort (0–1 Stunden): Eindämmung und erste Bewertung; Innerhalb von 4 Stunden: internes Incident-Team zusammengestellt, Umfang ermittelt; Innerhalb von 24 Stunden: Ursache identifiziert, Abhilfeplan steht; Innerhalb von 72 Stunden: Aufsichtsbehörde benachrichtigt (falls erforderlich); Innerhalb von 7 Tagen: vollständiger Vorfallsbericht an betroffene Kunden; Innerhalb von 30 Tagen: Post-Incident-Review abgeschlossen und Präventivmaßnahmen umgesetzt.',
  'Legal.breachNotification.sections.documentation.body':
    'Wir dokumentieren alle Datenschutzverletzungen, einschließlich solcher, die keine Meldung erfordern: Fakten der Verletzung; ihre Auswirkungen; ergriffene Abhilfemaßnahmen; Begründung der Entscheidungen zur Meldung. Diese Aufzeichnungen werden mindestens 5 Jahre aufbewahrt und stehen den Aufsichtsbehörden auf Anfrage zur Verfügung.',
  'Legal.breachNotification.sections.contact.body':
    'Um eine vermutete Datenschutzverletzung zu melden oder Fragen zu diesem Verfahren zu stellen, wenden Sie sich an unser Sicherheitsteam unter security@contractorops.com. Für allgemeine Datenschutzanfragen wenden Sie sich an privacy@contractorops.com.',

  // ─── CookieConsent ─────────────────────────────────────────────────────────
  'CookieConsent.message':
    'Diese Website verwendet ausschließlich notwendige Cookies für Authentifizierung und Sitzungsverwaltung. Es werden keine Tracking- oder Werbe-Cookies verwendet.',
  'CookieConsent.accept': 'Verstanden',
  'CookieConsent.learnMore': 'Datenschutzerklärung',

  // ─── GoogleWorkspace ───────────────────────────────────────────────────────
  'GoogleWorkspace.import.title': 'Google-Workspace-Benutzer importieren',
  'GoogleWorkspace.import.step1Title': 'Verzeichnis prüfen',
  'GoogleWorkspace.import.step2Title': 'Rollen zuweisen',
  'GoogleWorkspace.import.step3Title': 'Prüfen und importieren',
  'GoogleWorkspace.import.summaryFound': '{total} Benutzer gefunden',
  'GoogleWorkspace.import.summaryExisting': '{count} bereits importiert',
  'GoogleWorkspace.import.summaryNew': '{count} neu',
  'GoogleWorkspace.import.summarySelected': '{count} ausgewählt',
  'GoogleWorkspace.import.searchPlaceholder': 'Benutzer suchen ...',
  'GoogleWorkspace.import.orgUnitFilter': 'Organisationseinheit',
  'GoogleWorkspace.import.allOrgUnits': 'Alle Organisationseinheiten',
  'GoogleWorkspace.import.alreadyExists': 'Bereits vorhanden',
  'GoogleWorkspace.import.alreadyExistsTooltip':
    'Dieser Benutzer ist bereits Mitglied Ihrer Organisation.',
  'GoogleWorkspace.import.selectAll': 'Alle Benutzer auswählen',
  'GoogleWorkspace.import.nextRoles': 'Weiter: Rollen',
  'GoogleWorkspace.import.nextReview': 'Weiter: Prüfen',
  'GoogleWorkspace.import.defaultRoleLabel': 'Standardrolle für alle importierten Benutzer:',
  'GoogleWorkspace.import.groupMappingTitle': 'Gruppen-zu-Rolle-Zuordnung (optional)',
  'GoogleWorkspace.import.groupMappingFound':
    '{count} Google-Gruppen unter den ausgewählten Benutzern gefunden:',
  'GoogleWorkspace.import.groupMappingHint':
    'Benutzer in zugeordneten Gruppen erhalten diese Rolle anstelle der Standardrolle.',
  'GoogleWorkspace.import.readyToImport': 'Bereit zum Import von {count} Benutzern',
  'GoogleWorkspace.import.roleBreakdown': 'Aufschlüsselung nach Rollen:',
  'GoogleWorkspace.import.roleCount': '{count} als {role}',
  'GoogleWorkspace.import.inviteNotice':
    'Jeder importierte Benutzer erhält eine Einladungs-E-Mail.',
  'GoogleWorkspace.import.importCta': '{count} Benutzer importieren',
  'GoogleWorkspace.import.importing': 'Benutzer werden importiert ...',
  'GoogleWorkspace.import.successToast': '{count} Benutzer erfolgreich importiert',
  'GoogleWorkspace.import.partialError':
    '{succeeded} von {total} Benutzern importiert. {failed} fehlgeschlagen – Fehler prüfen und erneut versuchen.',
  'GoogleWorkspace.import.retryFailed': 'Fehlgeschlagene erneut versuchen',
  'GoogleWorkspace.import.emptyNoUsers': 'Keine Benutzer gefunden',
  'GoogleWorkspace.import.emptyNoUsersBody':
    'Das verbundene Google-Workspace-Verzeichnis enthält keine Benutzer, oder dem Administrator-Konto fehlt der Verzeichnis-Zugriff.',
  'GoogleWorkspace.import.emptyAllImported': 'Alle Benutzer importiert',
  'GoogleWorkspace.import.emptyAllImportedBody':
    'Jeder Benutzer im Google-Workspace-Verzeichnis ist bereits Mitglied dieser Organisation.',
  'GoogleWorkspace.import.fetchError':
    'Das Verzeichnis konnte nicht geladen werden. Prüfen Sie, ob das verbundene Konto über Admin-SDK-Zugriff verfügt, und versuchen Sie es erneut.',
  'GoogleWorkspace.sync.lastSynced': 'Zuletzt synchronisiert: {time}',
  'GoogleWorkspace.sync.nextSync': 'Nächste: Morgen 2:00 Uhr',
  'GoogleWorkspace.sync.syncNow': 'Jetzt synchronisieren',
  'GoogleWorkspace.sync.importUsers': 'Benutzer importieren',
  'GoogleWorkspace.sync.syncStarted': 'Verzeichnis-Synchronisierung gestartet',
  'GoogleWorkspace.sync.syncComplete':
    'Synchronisierung abgeschlossen — {count} Änderungen erkannt',
  'GoogleWorkspace.sync.syncNoChanges': 'Keine Änderungen erkannt',
  'GoogleWorkspace.sync.syncError':
    'Synchronisierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
  'GoogleWorkspace.notifications.newHire':
    'Neues Teammitglied erkannt: {name} ({email}) wurde zu Google Workspace hinzugefügt.',
  'GoogleWorkspace.notifications.departure':
    '{name} ({email}) wurde aus Google Workspace entfernt oder gesperrt.',
  'GoogleWorkspace.disconnect.title': 'Google Workspace trennen',
  'GoogleWorkspace.disconnect.body':
    'Dies beendet die Verzeichnis-Synchronisierung und entfernt gespeicherte Zugangsdaten. Bereits importierte Benutzer sind nicht betroffen. Fortfahren?',

  // ─── Teams ─────────────────────────────────────────────────────────────────
  'Teams.cards.approvalTitle': 'Rechnungsfreigabe erforderlich',
  'Teams.cards.rejectModalTitle': 'Rechnung ablehnen',
  'Teams.cards.rejectCommentLabel': 'Begründung für Ablehnung (erforderlich)',
  'Teams.cards.rejectCommentPlaceholder': 'Erläutern Sie, warum diese Rechnung abgelehnt wird ...',
  'Teams.cards.rejectSubmit': 'Rechnung ablehnen',
  'Teams.cards.viewInApp': 'In Contractor Ops anzeigen',
  'Teams.cards.reminderTitle': 'Erinnerung an überfällige Freigabe',
  'Teams.cards.overdueLabel': 'Seit {days} Tagen überfällig',

  // ─── OnboardingImport ──────────────────────────────────────────────────────
  'OnboardingImport.pageTitle': 'Ihr Team importieren',
  'OnboardingImport.pageSubtitle':
    'Übernehmen Sie Teammitglieder und Projekte aus Ihren verbundenen Tools. Sie können später jederzeit weitere hinzufügen.',
  'OnboardingImport.step1.heading': 'Wo verwalten Sie Ihr Team?',
  'OnboardingImport.step1.subtitle':
    'Wählen Sie die Tools, aus denen Sie importieren möchten. Sie können neue Tools hier direkt verbinden.',
  'OnboardingImport.step1.skipLink': 'Überspringen – ich lade Personen manuell ein',
  'OnboardingImport.step2.heading': 'Teammitglieder prüfen',
  'OnboardingImport.step2.subtitle':
    'Wir haben Personen in Ihren verbundenen Tools gefunden. Prüfen und bestätigen Sie, wen Sie importieren möchten.',
  'OnboardingImport.step2.batchImport': 'Ausgewählte importieren',
  'OnboardingImport.step2.batchSkip': 'Ausgewählte überspringen',
  'OnboardingImport.step2.batchRole': 'Rolle zuweisen',
  'OnboardingImport.step2.emptyHeading': 'Keine Teammitglieder gefunden',
  'OnboardingImport.step2.emptyBody':
    'Die gewählten Quellen haben keine Teammitglieder geliefert. Verbinden Sie ein anderes Tool oder laden Sie Personen manuell ein.',
  'OnboardingImport.step2.conflictTooltip': 'Datenkonflikt – klicken zum Lösen',
  'OnboardingImport.step2.conflictCustom': 'Benutzerdefinierter Wert',
  'OnboardingImport.step3.heading': 'Projekte importieren',
  'OnboardingImport.step3.subtitle':
    'Diese Projekte werden zu Workflow-Vorlagen, deren Status zu Schritten werden.',
  'OnboardingImport.step3.editSteps': 'Schritte bearbeiten',
  'OnboardingImport.step3.skipProject': 'Dieses Projekt überspringen',
  'OnboardingImport.step3.syncNote':
    'Bidirektionale Synchronisierung wird auf Basis der importierten Status automatisch konfiguriert.',
  'OnboardingImport.step3.addStep': 'Schritt hinzufügen',
  'OnboardingImport.step3.emptyHeading': 'Keine Projekte gefunden',
  'OnboardingImport.step3.emptyBody':
    'In den gewählten PM-Tools wurden keine Projekte gefunden. Sie können Workflow-Vorlagen später manuell erstellen.',
  'OnboardingImport.step4.heading': 'Bereit für den Import',
  'OnboardingImport.step4.subtitle':
    'Prüfen Sie Ihre Auswahl und starten Sie den Import. Dies kann einen Moment dauern.',
  'OnboardingImport.step4.peopleCard': 'Zu importierende Personen',
  'OnboardingImport.step4.projectsCard': 'Anzulegende Projekte',
  'OnboardingImport.step4.startImport': 'Import starten',
  'OnboardingImport.step4.progressLabel': 'Importiere {current} von {total} ...',
  'OnboardingImport.step4.completeHeading': 'Import abgeschlossen',
  'OnboardingImport.step4.completeBody':
    '{imported} Personen und {projects} Projekte erfolgreich importiert.',
  'OnboardingImport.step4.completeCta': 'Zum Dashboard',
  'OnboardingImport.nav.step1Label': 'Quellen wählen',
  'OnboardingImport.nav.step2Label': 'Personen prüfen',
  'OnboardingImport.nav.step3Label': 'Projekte importieren',
  'OnboardingImport.nav.step4Label': 'Bestätigen & Importieren',
  'OnboardingImport.sourceCard.notConnected': 'Nicht verbunden',
  'OnboardingImport.sourceCard.importToggle': 'Aus {tool} importieren',
  'OnboardingImport.oauthError':
    'Verbindung zu {tool} fehlgeschlagen. Prüfen Sie Ihre Berechtigungen und versuchen Sie es erneut.',
  'OnboardingImport.settingsReimport': 'Aus Tools erneut importieren',

  // ─── Billing ───────────────────────────────────────────────────────────────
  'Billing.gate.requiresTier': '{feature} erfordert {tier}.',
  'Billing.gate.pageHeading': 'Diese Funktion erfordert ein Upgrade',
  'Billing.gate.pageBody':
    'Ihr aktueller Tarif enthält {feature} nicht. Upgraden Sie auf {tier}, um die Funktion freizuschalten.',
  'Billing.gate.upgradePlan': 'Tarif upgraden',
  'Billing.gate.tierErrorToast': 'Diese Funktion erfordert den {tier}-Tarif.',
  'Billing.usage.currentPlan': 'Aktueller Tarif',
  'Billing.usage.activeSeats': 'Aktive Lizenzen',
  'Billing.usage.ocrCredits': 'OCR-Guthaben',
  'Billing.usage.nextBillingDate': 'Nächstes Abrechnungsdatum',
  'Billing.usage.active': '{active} aktiv / {included} enthalten',
  'Billing.usage.overage': '{overage} zusätzliche Lizenzen zu {price}/Lizenz abgerechnet',
  'Billing.usage.renewsOn': 'Verlängert am',
  'Billing.usage.trialEnds': 'Testphase endet',
  'Billing.usage.manageBilling': 'Abrechnung verwalten',
  'Billing.usage.noSubscription': 'Kein aktives Abonnement',
  'Billing.usage.noSubscriptionBody':
    'Wählen Sie einen Tarif, um alle Funktionen für Ihre Organisation freizuschalten. Ihre Daten aus der Testphase bleiben erhalten.',
  'Billing.usage.choosePlan': 'Tarif wählen',
  'Billing.credits.remaining': '{remaining} von {total} Guthaben verbleibend',
  'Billing.credits.exhausted':
    'Kein Guthaben mehr – kaufen Sie weiteres Guthaben, um die OCR-Verarbeitung fortzusetzen',
  'Billing.credits.buyMore': 'Mehr kaufen',
  'Billing.topUp.title': 'OCR-Guthaben kaufen',
  'Billing.topUp.description':
    'Wählen Sie ein Guthaben-Paket. Sie werden zu Stripe weitergeleitet, um den Kauf abzuschließen.',
  'Billing.topUp.selectPlaceholder': 'Paketgröße wählen',
  'Billing.topUp.priceNote': 'Der genaue Preis wird auf der Stripe-Checkout-Seite bestätigt.',
  'Billing.topUp.confirm': 'Weiter zur Kasse',
  'Billing.topUp.errors.priceNotConfigured': 'Aufladepreis nicht konfiguriert.',
  'Billing.overlay.paymentFailed': 'Zahlung fehlgeschlagen.',
  'Billing.overlay.paymentFailedBody':
    'Aktualisieren Sie Ihre Zahlungsmethode, um eine Serviceunterbrechung zu vermeiden.',
  'Billing.overlay.goToBilling': 'Zur Abrechnung',

  // ─── Time ──────────────────────────────────────────────────────────────────
  'Time.pageTitle': 'Zeiterfassung',
  'Time.tabs.pendingReviews': 'Ausstehende Prüfungen',
  'Time.tabs.allEntries': 'Alle Einträge',
  'Time.filters.allStatuses': 'Alle Status',
  'Time.columns.totalHours': 'Stunden gesamt',
  'Time.emptyStates.noPendingReviewsHeading': 'Keine ausstehenden Prüfungen',
  'Time.emptyStates.noPendingReviewsBody':
    'Alle Zeiterfassungen wurden geprüft. Schauen Sie wieder vorbei, wenn Auftragnehmer neue Einträge einreichen.',
  'Time.emptyStates.noTimeEntriesHeading': 'Keine Zeiteinträge',
  'Time.emptyStates.noTimeEntriesBody':
    'Zeiteinträge erscheinen hier, sobald Auftragnehmer Stunden erfassen.',
  'Time.toast.approved': 'Zeiterfassung freigegeben',
  'Time.toast.rejected': 'Zeiterfassung abgelehnt',
  'Time.toast.bulkApproved': '{count} Zeiterfassung(en) freigegeben',
  'Time.toast.bulkRejected': '{count} Zeiterfassung(en) abgelehnt',
  'Time.detail.notFoundHeading': 'Zeiterfassung nicht gefunden',
  'Time.detail.notFoundBody':
    'Die angeforderte Zeiterfassung wurde nicht gefunden. Sie wurde möglicherweise entfernt oder die URL ist falsch.',
  'Time.detail.backToTimeTracking': 'Zurück zur Zeiterfassung',

  // ─── Zatca ─────────────────────────────────────────────────────────────────
  'Zatca.onboarding.title': 'ZATCA-Onboarding',
  'Zatca.onboarding.steps.taxDetails': 'Steuerdaten',
  'Zatca.onboarding.steps.csrGeneration': 'CSR-Erstellung',
  'Zatca.onboarding.steps.complianceCsid': 'Compliance-CSID',
  'Zatca.onboarding.steps.complianceChecks': 'Compliance-Prüfungen',
  'Zatca.onboarding.steps.productionCertificate': 'Produktionszertifikat',
  'Zatca.csrGeneration.title': 'Schritt 2 von 5: Zertifikatsanforderung erstellen',
  'Zatca.csrGeneration.description':
    'Eine Certificate Signing Request wird anhand Ihrer Steuerdaten aus Schritt 1 erstellt.',
  'Zatca.csrGeneration.keyType': 'Schlüsseltyp:',
  'Zatca.csrGeneration.keyTypeValue': 'ECDSA P-256 (von ZATCA empfohlen)',
  'Zatca.csrGeneration.privateKeyNote':
    'Der private Schlüssel wird sicher im Secret-Tresor Ihrer Organisation gespeichert. Er verlässt den Server nicht.',
  'Zatca.csrGeneration.csrPreviewLabel': 'CSR-Vorschau (schreibgeschützt)',
  'Zatca.csrGeneration.generateCsr': 'CSR erstellen',
  'Zatca.csrGeneration.toast.success': 'CSR erfolgreich erstellt',
  'Zatca.complianceChecks.title': 'Schritt 4 von 5: Compliance-Prüfungen durchführen',
  'Zatca.complianceChecks.runChecks': 'Compliance-Prüfungen durchführen',
  'Zatca.complianceChecks.resultsLabel': 'Ergebnisse der Compliance-Prüfung',
  'Zatca.complianceChecks.testLabels.standardTaxInvoice': 'Standard-Steuerrechnung',
  'Zatca.complianceChecks.testLabels.standardCreditNote': 'Standard-Gutschrift',
  'Zatca.complianceChecks.testLabels.standardDebitNote': 'Standard-Lastschrift',
  'Zatca.complianceChecks.testLabels.simplifiedInvoice': 'Vereinfachte Rechnung',
  'Zatca.complianceChecks.testLabels.simplifiedCreditNote': 'Vereinfachte Gutschrift',
  'Zatca.complianceChecks.testLabels.simplifiedDebitNote': 'Vereinfachte Lastschrift',
  'Zatca.complianceChecks.toast.allPassed':
    'Alle 6 Compliance-Prüfungen bestanden. Ihre Einrichtung ist produktionsbereit.',
  'Zatca.complianceChecks.toast.someFailed':
    'Compliance-Prüfung fehlgeschlagen: {failedCount} Test(s) nicht bestanden. Prüfen Sie Ihre Steuerdaten und versuchen Sie es erneut.',

  // ─── Peppol ────────────────────────────────────────────────────────────────
  'Peppol.statusCard.title': 'Peppol-Netzwerk',
  'Peppol.statusCard.notConnected': 'Nicht mit Peppol verbunden',
  'Peppol.statusCard.connectDescription':
    'Verbinden Sie sich mit dem Peppol-Netzwerk, um E-Rechnungen mit UAE-Handelspartnern zu senden und zu empfangen. Sie benötigen Ihre TRN und ASP-Zugangsdaten.',
  'Peppol.statusCard.connect': 'Mit Peppol verbinden',
  'Peppol.statusCard.participantId': 'Teilnehmer-ID',
  'Peppol.statusCard.aspProvider': 'ASP-Anbieter',
  'Peppol.statusCard.lastSync': 'Letzte Synchronisierung',
  'Peppol.statusCard.disconnectTitle': 'Peppol trennen',
  'Peppol.statusCard.disconnectDescription':
    'Ihre Teilnehmer-ID wird abgemeldet und Sie können keine Peppol-Rechnungen mehr senden oder empfangen. Fortfahren?',
  'Peppol.statusCard.toast.disconnected': 'Vom Peppol-Netzwerk getrennt',
  'Peppol.transmission.title': 'Peppol-Übertragung',
  'Peppol.transmission.aspRef': 'ASP-Ref.:',
  'Peppol.transmission.retryTransmission': 'Übertragung wiederholen',
  'Peppol.transmission.toast.retryQueued': 'Übertragung zur Wiederholung eingereiht',
  'Peppol.transmission.toast.retryFailed': 'Wiederholung fehlgeschlagen',

  // ─── Integrations.jira / Integrations.linear ───────────────────────────────
  'Integrations.jira.taskConfig.configSaved': 'Jira-Aufgabenkonfiguration gespeichert',
  'Integrations.jira.taskConfig.enableToggle': 'Jira-Issue erstellen, wenn Aufgabe aktiviert wird',
  'Integrations.jira.taskConfig.notConfigured': 'Nicht konfiguriert',
  'Integrations.jira.taskConfig.configure': 'Jira konfigurieren',
  'Integrations.jira.statusMapping.title': 'Statuszuordnung',
  'Integrations.jira.statusMapping.description':
    'Ordnen Sie Workflow-Aufgabenstatus den Jira-Transitionen für {projectName} zu.',
  'Integrations.jira.statusMapping.descriptionDefault':
    'Ordnen Sie Workflow-Aufgabenstatus den Jira-Transitionen zu.',
  'Integrations.jira.statusMapping.jiraProject': 'Jira-Projekt',
  'Integrations.jira.statusMapping.selectProject': 'Projekt auswählen',
  'Integrations.jira.statusMapping.workflowStatus': 'Workflow-Status',
  'Integrations.jira.statusMapping.jiraTransition': 'Jira-Transition',
  'Integrations.jira.statusMapping.notMapped': 'Nicht zugeordnet',
  'Integrations.jira.statusMapping.unmappedTooltip':
    'Nicht zugeordnet – Statusänderungen für diesen Zustand werden ignoriert',
  'Integrations.jira.statusMapping.discardChanges': 'Änderungen verwerfen',
  'Integrations.jira.statusMapping.saveMapping': 'Zuordnung speichern',
  'Integrations.jira.statusMapping.toast.saved': 'Statuszuordnung gespeichert',
  'Integrations.linear.taskConfig.configSaved': 'Linear-Aufgabenkonfiguration gespeichert',
  'Integrations.linear.taskConfig.notConfigured': 'Nicht konfiguriert',
  'Integrations.linear.statusMapping.toast.saved': 'Statuszuordnung gespeichert',

  // ─── Api ───────────────────────────────────────────────────────────────────
  'Api.email.subject.approvalRequest': 'Aktion erforderlich: Rechnung {invoiceNumber} freigeben',
  'Api.email.subject.approvalDecision': 'Rechnung {invoiceNumber} {decision}',
  'Api.email.subject.taskAssigned': 'Neue Aufgabe zugewiesen: {taskName}',
  'Api.email.subject.taskOverdue': 'Überfällig: {taskName} ist fällig',
  'Api.email.subject.contractExpiring': 'Vertrag läuft bald ab: {contractTitle}',
  'Api.email.subject.invoiceReceived': 'Neue Rechnung erhalten von {contractorName}',
  'Api.email.labels.viewInApp': 'In Contractor Ops anzeigen',
  'Api.email.labels.managePrefs': 'Benachrichtigungseinstellungen verwalten',
  'Api.email.labels.footerText': 'Contractor Ops – Plattform für Auftragnehmer-Verwaltung',
  'Api.email.labels.reviewAndApprove': 'Prüfen & Freigeben',
  'Api.email.labels.wasDue': 'War fällig',
  'Api.notifications.equipment.returnApproved.title': 'Rückgabeanfrage freigegeben',
  'Api.notifications.equipment.returnApproved.body':
    'Ihre Rückgabeanfrage wurde freigegeben. Ein Versandlabel wurde erstellt.',
  'Api.notifications.equipment.returnRejected.title': 'Rückgabeanfrage abgelehnt',
  'Api.notifications.equipment.returnRejected.body': 'Ihre Rückgabeanfrage wurde abgelehnt.',
  'Api.notifications.equipment.returnRequested.title': 'Neue Anfrage zur Geräterückgabe',
  'Api.notifications.equipment.returnRequested.body':
    'Ein Auftragnehmer hat eine Geräterückgabe angefragt.',
  'Api.workflow.templates.onboarding.collectNda': 'NDA einholen',
  'Api.workflow.templates.onboarding.signContract': 'Vertrag unterzeichnen',
  'Api.workflow.templates.onboarding.setupItAccess': 'IT-Zugang einrichten',
  'Api.workflow.templates.onboarding.setupFinance': 'Finanz-Einrichtung',
  'Api.workflow.templates.onboarding.provisionEquipment': 'Ausrüstung bereitstellen',
  'Api.workflow.templates.onboarding.teamIntroMeeting': 'Team-Vorstellungstermin',
  'Api.workflow.templates.onboarding.knowledgeTransfer': 'Wissenstransfer',
  'Api.workflow.templates.offboarding.knowledgeTransfer': 'Wissenstransfer',
  'Api.workflow.templates.offboarding.revokeItAccess': 'IT-Zugang entziehen',
  'Api.workflow.templates.offboarding.returnEquipment': 'Ausrüstung zurückgeben',
  'Api.workflow.templates.offboarding.financeWrapUp': 'Finanz-Abschluss',
  'Api.workflow.templates.offboarding.finalDocumentation': 'Abschlussdokumentation',
  'Api.errors.tenant.noActiveOrganization':
    'Keine aktive Organisation. Bitte wählen Sie zuerst eine Organisation aus.',
  'Api.errors.upload.rateLimitExceeded':
    'Upload-Rate-Limit überschritten. Maximal 10 Uploads pro Minute. Bitte versuchen Sie es in Kürze erneut.',
  'Api.errors.zatca.apiClientUnavailable':
    'ZATCA-API-Client nicht verfügbar. Stellen Sie sicher, dass die E-Invoicing-Engine konfiguriert ist.',
  'Api.errors.zatca.taxDetailsRequired':
    'Steuerdaten müssen vor der CSR-Erstellung gespeichert werden.',
  'Api.errors.zatca.csrRequired':
    'CSR muss vor der Anforderung der Compliance-CSID erstellt werden.',
  'Api.errors.zatca.taxDetailsRequiredForCompliance':
    'Für Compliance-Prüfungen sind Steuerdaten erforderlich.',
  'Api.errors.zatca.complianceCsidRequired':
    'Compliance-CSID muss vor der Durchführung von Compliance-Prüfungen vorliegen.',
  'Api.errors.zatca.complianceChecksMustPass':
    'Compliance-Prüfungen müssen bestanden sein, bevor das Produktionszertifikat angefordert werden kann.',
  'Api.errors.timesheet.weekStartDateMustBeMonday': 'Das Wochenstartdatum muss ein Montag sein.',
  'Api.errors.timesheet.notFound': 'Zeiterfassung nicht gefunden.',
  'Api.errors.timesheet.canOnlyEditDraftOrRejected':
    'Nur Zeiterfassungen mit Status ENTWURF oder ABGELEHNT können bearbeitet werden.',
  'Api.errors.timesheet.entryNotFound': 'Zeiteintrag nicht gefunden.',
  'Api.errors.timesheet.cannotEditImportedEntries':
    'Importierte Einträge können nicht bearbeitet werden.',
  'Api.errors.timesheet.cannotSubmit':
    'Zeiterfassung kann nicht eingereicht werden (falscher Status oder nicht gefunden).',
  'Api.errors.timesheet.cannotApprove':
    'Zeiterfassung kann nicht freigegeben werden (muss EINGEREICHT sein).',
  'Api.errors.timesheet.cannotReject':
    'Zeiterfassung kann nicht abgelehnt werden (muss EINGEREICHT sein).',
  'Api.errors.approval.noUserWithRole': 'Kein Benutzer mit der erforderlichen Rolle gefunden.',

  // ─── Layout / organization / Classification / EInvoice / Offboarding ──────
  'Layout.footer.copyright': '© 2026 Contractor Ops',
  'organization.kleinunternehmer.toggleLabel': 'Kleinunternehmerregelung (§ 19 UStG)',
  'Classification._NOTE':
    'Rechtlich gesperrte Formulierungen liegen in packages/validators/src/legal/{de,disclaimers}.ts. CLASSIFICATION_*- oder DISCLAIMER_*-Werte hier NICHT duplizieren.',
  'Classification.rationale.counter': '{current} / {max}',
  'Classification.documents.byteSize': '{kb} KB',
  'Classification.ExpertHelp.gb.hmrc.title': 'HMRC Employment Status Manual',
  'EInvoice.InvoiceTab.transmissionEventPattern': '{occurredAt} — {eventType} {detailsOneLiner}',
  'EInvoice.PeppolDialog.schemeHelper':
    '`0060` = UK Companies House, `0088` = GLN, `0106` = Dun & Bradstreet.',
  'Offboarding.Templates.ProductManager.displayName': 'Product Manager',
};
