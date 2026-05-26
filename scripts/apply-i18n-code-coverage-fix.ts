#!/usr/bin/env tsx
/**
 * Apply EN→pl/de/ar translations for the 112 code-referenced keys that
 * were missing from every locale file, plus the 2 dynamic-prefix
 * namespaces (`Consent.purposes.*`, `Payments.lateInterest.waive.types.*`).
 *
 * Generated to close the MISSING_MESSAGE gap reported by
 * `scripts/audit-i18n-code-coverage.ts` (input:
 * `.planning/translations/i18n-code-gaps-en.json`).
 *
 * Run:
 *   pnpm tsx scripts/apply-i18n-code-coverage-fix.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Translation table — every authored key + every dynamic-prefix leaf.
// All four locales authored together; vocabulary anchors from prior passes.
// ─────────────────────────────────────────────────────────────────────────────

type Quad = { en: string; pl: string; de: string; ar: string };

const TRANSLATIONS: Record<string, Quad> = {
  // ────────────────────────────────────────────────────────────────────────
  // CalendarSettings — single string
  // ────────────────────────────────────────────────────────────────────────
  'CalendarSettings.connectFailedToast': {
    en: 'Could not connect calendar. Please try again.',
    pl: 'Nie udało się połączyć kalendarza. Spróbuj ponownie.',
    de: 'Kalender konnte nicht verbunden werden. Bitte erneut versuchen.',
    ar: 'تعذر ربط التقويم. يرجى المحاولة مرة أخرى.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Classification — loading indicator
  // ────────────────────────────────────────────────────────────────────────
  'Classification.loading': {
    en: 'Loading classification…',
    pl: 'Ładowanie klasyfikacji…',
    de: 'Klassifizierung wird geladen…',
    ar: 'جارٍ تحميل التصنيف…',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Consent — toggle-state badges
  // ────────────────────────────────────────────────────────────────────────
  'Consent.optional': {
    en: 'Optional',
    pl: 'Opcjonalne',
    de: 'Optional',
    ar: 'اختياري',
  },
  'Consent.required': {
    en: 'Required',
    pl: 'Wymagane',
    de: 'Erforderlich',
    ar: 'إلزامي',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Consent.settings — management UI
  // ────────────────────────────────────────────────────────────────────────
  'Consent.settings.consentHistory': {
    en: 'Consent history',
    pl: 'Historia zgód',
    de: 'Einwilligungsverlauf',
    ar: 'سجل الموافقات',
  },
  'Consent.settings.consentUpdated': {
    en: 'Consent preferences updated',
    pl: 'Zaktualizowano preferencje zgód',
    de: 'Einwilligungseinstellungen aktualisiert',
    ar: 'تم تحديث تفضيلات الموافقة',
  },
  'Consent.settings.crossBorderDetected': {
    en: 'Cross-border transfer detected',
    pl: 'Wykryto transfer transgraniczny',
    de: 'Grenzüberschreitende Datenübermittlung erkannt',
    ar: 'تم اكتشاف نقل بيانات عبر الحدود',
  },
  'Consent.settings.crossBorderInfo': {
    en: 'Your organization data is processed in {orgRegion} and hosted in {hostingRegion}. Standard Contractual Clauses (SCCs) protect this transfer.',
    pl: 'Dane Twojej organizacji są przetwarzane w regionie {orgRegion} i hostowane w {hostingRegion}. Transfer jest chroniony Standardowymi Klauzulami Umownymi (SCC).',
    de: 'Die Daten Ihrer Organisation werden in {orgRegion} verarbeitet und in {hostingRegion} gehostet. Die Übermittlung ist durch Standardvertragsklauseln (SCC) geschützt.',
    ar: 'تتم معالجة بيانات مؤسستك في {orgRegion} واستضافتها في {hostingRegion}. يحمي هذا النقل بنود تعاقدية معيارية (SCC).',
  },
  'Consent.settings.crossBorderTitle': {
    en: 'Cross-border data transfer',
    pl: 'Transgraniczny transfer danych',
    de: 'Grenzüberschreitende Datenübermittlung',
    ar: 'نقل البيانات عبر الحدود',
  },
  'Consent.settings.downloadDPA': {
    en: 'Download DPA',
    pl: 'Pobierz DPA',
    de: 'DPA herunterladen',
    ar: 'تنزيل DPA',
  },
  'Consent.settings.downloadSCC': {
    en: 'Download SCCs',
    pl: 'Pobierz SCC',
    de: 'SCC herunterladen',
    ar: 'تنزيل SCC',
  },
  'Consent.settings.dpaDescription': {
    en: 'The Data Processing Agreement governing how we process personal data on behalf of your organization.',
    pl: 'Umowa o powierzeniu przetwarzania danych (DPA) regulująca przetwarzanie danych osobowych w imieniu Twojej organizacji.',
    de: 'Der Auftragsverarbeitungsvertrag (DPA) regelt die Verarbeitung personenbezogener Daten im Auftrag Ihrer Organisation.',
    ar: 'اتفاقية معالجة البيانات (DPA) التي تحكم كيفية معالجة البيانات الشخصية نيابةً عن مؤسستك.',
  },
  'Consent.settings.dpaDownloaded': {
    en: 'DPA downloaded',
    pl: 'Pobrano DPA',
    de: 'DPA heruntergeladen',
    ar: 'تم تنزيل DPA',
  },
  'Consent.settings.dpaTitle': {
    en: 'Data Processing Agreement (DPA)',
    pl: 'Umowa o powierzeniu przetwarzania danych (DPA)',
    de: 'Auftragsverarbeitungsvertrag (DPA)',
    ar: 'اتفاقية معالجة البيانات (DPA)',
  },
  'Consent.settings.granted': {
    en: 'Granted',
    pl: 'Udzielono',
    de: 'Erteilt',
    ar: 'ممنوحة',
  },
  'Consent.settings.historyAction': {
    en: 'Action',
    pl: 'Działanie',
    de: 'Aktion',
    ar: 'الإجراء',
  },
  'Consent.settings.historyDate': {
    en: 'Date',
    pl: 'Data',
    de: 'Datum',
    ar: 'التاريخ',
  },
  'Consent.settings.historyPurpose': {
    en: 'Purpose',
    pl: 'Cel',
    de: 'Zweck',
    ar: 'الغرض',
  },
  'Consent.settings.historyVersion': {
    en: 'Version',
    pl: 'Wersja',
    de: 'Version',
    ar: 'الإصدار',
  },
  'Consent.settings.legalDocuments': {
    en: 'Legal documents',
    pl: 'Dokumenty prawne',
    de: 'Rechtsdokumente',
    ar: 'المستندات القانونية',
  },
  'Consent.settings.noCrossBorder': {
    en: 'No cross-border data transfers detected for your organization.',
    pl: 'Nie wykryto transgranicznych transferów danych dla Twojej organizacji.',
    de: 'Für Ihre Organisation wurden keine grenzüberschreitenden Datenübermittlungen erkannt.',
    ar: 'لم يتم اكتشاف أي عمليات نقل للبيانات عبر الحدود لمؤسستك.',
  },
  'Consent.settings.notRequired': {
    en: 'Consent management is not required in your jurisdiction.',
    pl: 'Zarządzanie zgodami nie jest wymagane w Twojej jurysdykcji.',
    de: 'In Ihrer Rechtsordnung ist eine Einwilligungsverwaltung nicht erforderlich.',
    ar: 'إدارة الموافقات غير مطلوبة في نطاقك القضائي.',
  },
  'Consent.settings.revoked': {
    en: 'Revoked',
    pl: 'Cofnięto',
    de: 'Widerrufen',
    ar: 'تم السحب',
  },
  'Consent.settings.sccDescription': {
    en: 'Standard Contractual Clauses required when personal data is transferred outside your home region.',
    pl: 'Standardowe Klauzule Umowne wymagane przy transferze danych osobowych poza region macierzysty.',
    de: 'Standardvertragsklauseln, die bei der Übermittlung personenbezogener Daten außerhalb Ihrer Heimatregion erforderlich sind.',
    ar: 'بنود تعاقدية معيارية مطلوبة عند نقل البيانات الشخصية خارج منطقتك الأصلية.',
  },
  'Consent.settings.sccDownloaded': {
    en: 'SCCs downloaded',
    pl: 'Pobrano SCC',
    de: 'SCC heruntergeladen',
    ar: 'تم تنزيل SCC',
  },
  'Consent.settings.sccNotRequired': {
    en: 'SCCs are not required — no cross-border transfer detected.',
    pl: 'SCC nie są wymagane — nie wykryto transferu transgranicznego.',
    de: 'SCC sind nicht erforderlich — keine grenzüberschreitende Übermittlung erkannt.',
    ar: 'لا تُطلب بنود SCC — لم يتم اكتشاف نقل عبر الحدود.',
  },
  'Consent.settings.sccTitle': {
    en: 'Standard Contractual Clauses (SCCs)',
    pl: 'Standardowe Klauzule Umowne (SCC)',
    de: 'Standardvertragsklauseln (SCC)',
    ar: 'البنود التعاقدية المعيارية (SCC)',
  },
  'Consent.settings.yourConsents': {
    en: 'Your consents',
    pl: 'Twoje zgody',
    de: 'Ihre Einwilligungen',
    ar: 'موافقاتك',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Consent.purposes.* — dynamic-prefix leaves (one entry per enum value)
  // Source: packages/validators/src/consent.ts (lowercased + hyphenated)
  // ────────────────────────────────────────────────────────────────────────
  'Consent.purposes.contractor-data-processing.label': {
    en: 'Contractor data processing',
    pl: 'Przetwarzanie danych kontrahenta',
    de: 'Verarbeitung von Auftragnehmerdaten',
    ar: 'معالجة بيانات المقاول',
  },
  'Consent.purposes.contractor-data-processing.description': {
    en: 'Process contractor profile data (name, contact, tax IDs, banking) to manage engagements and payments.',
    pl: 'Przetwarzanie danych profilu kontrahenta (imię i nazwisko, kontakt, identyfikatory podatkowe, dane bankowe) w celu zarządzania współpracą i płatnościami.',
    de: 'Verarbeitung von Auftragnehmer-Profildaten (Name, Kontakt, Steuer-IDs, Bankdaten) zur Verwaltung von Beauftragungen und Zahlungen.',
    ar: 'معالجة بيانات ملف المقاول (الاسم وجهات الاتصال والمعرفات الضريبية والمصرفية) لإدارة العقود والمدفوعات.',
  },
  'Consent.purposes.invoice-payment-processing.label': {
    en: 'Invoice and payment processing',
    pl: 'Przetwarzanie faktur i płatności',
    de: 'Rechnungs- und Zahlungsverarbeitung',
    ar: 'معالجة الفواتير والمدفوعات',
  },
  'Consent.purposes.invoice-payment-processing.description': {
    en: 'Receive, validate and pay contractor invoices, including bank transfer execution and tax reporting.',
    pl: 'Odbiór, weryfikacja i opłacanie faktur kontrahentów, w tym realizacja przelewów bankowych i raportowanie podatkowe.',
    de: 'Empfang, Prüfung und Bezahlung von Auftragnehmerrechnungen, einschließlich Banküberweisungen und Steuermeldung.',
    ar: 'استلام فواتير المقاولين والتحقق منها وسدادها، بما في ذلك تنفيذ التحويلات المصرفية والإقرارات الضريبية.',
  },
  'Consent.purposes.analytics-reporting.label': {
    en: 'Analytics and reporting',
    pl: 'Analityka i raportowanie',
    de: 'Analyse und Berichterstattung',
    ar: 'التحليلات والتقارير',
  },
  'Consent.purposes.analytics-reporting.description': {
    en: 'Generate aggregated usage analytics and product-improvement metrics. No data is shared with third parties.',
    pl: 'Generowanie zagregowanych analiz korzystania oraz metryk usprawnień produktu. Dane nie są udostępniane podmiotom trzecim.',
    de: 'Erstellung aggregierter Nutzungsanalysen und Produktverbesserungsmetriken. Es werden keine Daten an Dritte weitergegeben.',
    ar: 'إنشاء تحليلات استخدام مجمعة ومقاييس لتحسين المنتج. لا تتم مشاركة أي بيانات مع أطراف ثالثة.',
  },
  'Consent.purposes.cross-border-transfer.label': {
    en: 'Cross-border data transfer',
    pl: 'Transgraniczny transfer danych',
    de: 'Grenzüberschreitende Datenübermittlung',
    ar: 'نقل البيانات عبر الحدود',
  },
  'Consent.purposes.cross-border-transfer.description': {
    en: 'Transfer personal data outside your home region for service delivery, protected by Standard Contractual Clauses.',
    pl: 'Przekazywanie danych osobowych poza region macierzysty w celu świadczenia usług, chronione Standardowymi Klauzulami Umownymi.',
    de: 'Übermittlung personenbezogener Daten außerhalb Ihrer Heimatregion zur Leistungserbringung, abgesichert durch Standardvertragsklauseln.',
    ar: 'نقل البيانات الشخصية خارج منطقتك الأصلية لتقديم الخدمة، مع الحماية ببنود تعاقدية معيارية.',
  },
  'Consent.purposes.integration-data-sharing.label': {
    en: 'Integration data sharing',
    pl: 'Udostępnianie danych integracjom',
    de: 'Datenfreigabe für Integrationen',
    ar: 'مشاركة البيانات مع التكاملات',
  },
  'Consent.purposes.integration-data-sharing.description': {
    en: 'Share required data with connected services (e.g. accounting, payroll, calendar, messaging) you have authorized.',
    pl: 'Udostępnianie wymaganych danych podłączonym usługom (np. księgowość, listy płac, kalendarz, komunikatory), które autoryzowałeś.',
    de: 'Freigabe erforderlicher Daten an angebundene Dienste (z. B. Buchhaltung, Lohnabrechnung, Kalender, Messaging), die Sie autorisiert haben.',
    ar: 'مشاركة البيانات المطلوبة مع الخدمات المتصلة (مثل المحاسبة وكشوف المرتبات والتقويم والمراسلة) التي قمت بترخيصها.',
  },
  'Consent.purposes.communication-notifications.label': {
    en: 'Communications and notifications',
    pl: 'Komunikacja i powiadomienia',
    de: 'Kommunikation und Benachrichtigungen',
    ar: 'الاتصالات والإشعارات',
  },
  'Consent.purposes.communication-notifications.description': {
    en: 'Send essential service notifications (approvals, payment status, security alerts) by email or in-app.',
    pl: 'Wysyłanie niezbędnych powiadomień serwisowych (zatwierdzenia, status płatności, alerty bezpieczeństwa) e-mailem lub w aplikacji.',
    de: 'Versand wesentlicher Dienstbenachrichtigungen (Freigaben, Zahlungsstatus, Sicherheitswarnungen) per E-Mail oder in der App.',
    ar: 'إرسال إشعارات الخدمة الأساسية (الموافقات وحالة الدفع وتنبيهات الأمان) عبر البريد الإلكتروني أو داخل التطبيق.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // EInvoice — single strings
  // ────────────────────────────────────────────────────────────────────────
  'EInvoice.Settings.PeppolCard.pendingHeading': {
    en: 'Registration pending',
    pl: 'Rejestracja w toku',
    de: 'Registrierung ausstehend',
    ar: 'التسجيل قيد الانتظار',
  },
  'EInvoice.intake.sendCta': {
    en: 'Send e-invoice',
    pl: 'Wyślij e-fakturę',
    de: 'E-Rechnung senden',
    ar: 'إرسال الفاتورة الإلكترونية',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Errors.unauthorized — 401/403 error page
  // ────────────────────────────────────────────────────────────────────────
  'Errors.unauthorized.body': {
    en: "You don't have permission to view this page. If you think this is a mistake, contact your administrator.",
    pl: 'Nie masz uprawnień do wyświetlenia tej strony. Jeśli uważasz, że to pomyłka, skontaktuj się z administratorem.',
    de: 'Sie haben keine Berechtigung, diese Seite anzuzeigen. Falls dies ein Fehler ist, wenden Sie sich an Ihren Administrator.',
    ar: 'ليس لديك إذن لعرض هذه الصفحة. إذا كنت تعتقد أن هذا خطأ، تواصل مع المسؤول.',
  },
  'Errors.unauthorized.code': {
    en: '403',
    pl: '403',
    de: '403',
    ar: '403',
  },
  'Errors.unauthorized.cta': {
    en: 'Back to dashboard',
    pl: 'Wróć do pulpitu',
    de: 'Zurück zum Dashboard',
    ar: 'العودة إلى لوحة التحكم',
  },
  'Errors.unauthorized.heading': {
    en: 'Access denied',
    pl: 'Brak dostępu',
    de: 'Zugriff verweigert',
    ar: 'تم رفض الوصول',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.dashboard.overdue* — overdue receivables dashboard tile
  // ────────────────────────────────────────────────────────────────────────
  'Payments.dashboard.overdueClickThrough': {
    en: 'View overdue invoices',
    pl: 'Zobacz przeterminowane faktury',
    de: 'Überfällige Rechnungen anzeigen',
    ar: 'عرض الفواتير المتأخرة',
  },
  'Payments.dashboard.overdueSubline': {
    en: '{principal} outstanding — +{interest} interest accrued',
    pl: '{principal} do zapłaty — +{interest} naliczonych odsetek',
    de: '{principal} ausstehend — +{interest} Zinsen angefallen',
    ar: '{principal} مستحقة — +{interest} فوائد متراكمة',
  },
  'Payments.dashboard.overdueTitle': {
    en: 'Overdue receivables (UK)',
    pl: 'Przeterminowane należności (UK)',
    de: 'Überfällige Forderungen (UK)',
    ar: 'الذمم المتأخرة (المملكة المتحدة)',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.lateInterest.* — top-level (heading, b2c, tooltip, etc.)
  // ────────────────────────────────────────────────────────────────────────
  'Payments.lateInterest.b2cNotApplicable': {
    en: 'Statutory interest does not apply to B2C transactions.',
    pl: 'Odsetki ustawowe nie mają zastosowania do transakcji B2C.',
    de: 'Gesetzliche Verzugszinsen gelten nicht für B2C-Transaktionen.',
    ar: 'لا تنطبق الفوائد القانونية على معاملات الأفراد (B2C).',
  },
  'Payments.lateInterest.downloadClaimLetter': {
    en: 'Download claim letter',
    pl: 'Pobierz pismo roszczenia',
    de: 'Forderungsschreiben herunterladen',
    ar: 'تنزيل خطاب المطالبة',
  },
  'Payments.lateInterest.heading': {
    en: 'Statutory late-payment interest',
    pl: 'Ustawowe odsetki za opóźnienie w płatności',
    de: 'Gesetzliche Verzugszinsen',
    ar: 'الفوائد القانونية على التأخر في السداد',
  },
  'Payments.lateInterest.notYetOverdue': {
    en: 'Invoice is not yet overdue. Interest will start accruing once payment terms expire.',
    pl: 'Faktura nie jest jeszcze przeterminowana. Odsetki zaczną być naliczane po upływie terminu płatności.',
    de: 'Die Rechnung ist noch nicht überfällig. Zinsen werden ab Ablauf der Zahlungsfrist berechnet.',
    ar: 'الفاتورة ليست متأخرة بعد. ستبدأ الفوائد بالتراكم بعد انتهاء شروط السداد.',
  },
  'Payments.lateInterest.rateTooltipAriaLabel': {
    en: 'Show rate calculation details',
    pl: 'Pokaż szczegóły obliczania stopy',
    de: 'Berechnung des Zinssatzes anzeigen',
    ar: 'إظهار تفاصيل احتساب الفائدة',
  },
  'Payments.lateInterest.rateTooltipExplanation': {
    en: 'Rate set under the Late Payment of Commercial Debts (Interest) Act 1998: Bank of England base rate + 8%, fixed on the last day of the preceding 6-month statutory period (30 June or 31 December).',
    pl: 'Stopa ustalana zgodnie z Late Payment of Commercial Debts (Interest) Act 1998: stopa bazowa Bank of England + 8%, ustalana ostatniego dnia poprzedzającego 6-miesięcznego okresu ustawowego (30 czerwca lub 31 grudnia).',
    de: 'Zinssatz nach dem Late Payment of Commercial Debts (Interest) Act 1998: Bank-of-England-Basiszinssatz + 8 %, festgelegt am letzten Tag des vorhergehenden sechsmonatigen gesetzlichen Zeitraums (30. Juni oder 31. Dezember).',
    ar: 'يُحدد المعدل وفقًا للقانون البريطاني Late Payment of Commercial Debts (Interest) Act 1998: معدل Bank of England الأساسي + 8%، ويُثبَّت في آخر يوم من الفترة القانونية السابقة البالغة 6 أشهر (30 يونيو أو 31 ديسمبر).',
  },
  'Payments.lateInterest.waiveReason': {
    en: 'Waiver reason',
    pl: 'Powód zrzeczenia',
    de: 'Verzichtsgrund',
    ar: 'سبب التنازل',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.lateInterest.claim.* — claim dialog
  // ────────────────────────────────────────────────────────────────────────
  'Payments.lateInterest.claim.cancel': {
    en: 'Cancel',
    pl: 'Anuluj',
    de: 'Abbrechen',
    ar: 'إلغاء',
  },
  'Payments.lateInterest.claim.confirm': {
    en: 'Claim interest',
    pl: 'Żądaj odsetek',
    de: 'Zinsen geltend machen',
    ar: 'المطالبة بالفوائد',
  },
  'Payments.lateInterest.claim.confirming': {
    en: 'Claiming…',
    pl: 'Składanie roszczenia…',
    de: 'Wird geltend gemacht…',
    ar: 'جارٍ تقديم المطالبة…',
  },
  'Payments.lateInterest.claim.description': {
    en: 'This will snapshot the current interest and compensation amounts, generate a PDF claim letter, and optionally issue a secondary invoice for the claim amount. The snapshot is immutable — further interest will not accrue on this claim.',
    pl: 'Spowoduje to utrwalenie bieżących kwot odsetek i rekompensaty, wygenerowanie pisma roszczenia w PDF oraz opcjonalnie wystawienie faktury dodatkowej na kwotę roszczenia. Migawka jest niezmienna — dalsze odsetki nie będą naliczane od tego roszczenia.',
    de: 'Hierdurch werden die aktuellen Zins- und Entschädigungsbeträge fixiert, ein PDF-Forderungsschreiben erstellt und optional eine Nachberechnung als zusätzliche Rechnung ausgestellt. Die Erfassung ist unveränderlich — weitere Zinsen fallen auf diese Forderung nicht mehr an.',
    ar: 'سيؤدي ذلك إلى تثبيت مبالغ الفوائد والتعويض الحالية وإنشاء خطاب مطالبة بصيغة PDF واختياريًا إصدار فاتورة ثانوية بقيمة المطالبة. اللقطة غير قابلة للتعديل — ولن تتراكم فوائد إضافية على هذه المطالبة.',
  },
  'Payments.lateInterest.claim.issueSecondaryInvoice': {
    en: 'Issue claim as a secondary invoice',
    pl: 'Wystaw roszczenie jako fakturę dodatkową',
    de: 'Forderung als Nachberechnungsrechnung ausstellen',
    ar: 'إصدار المطالبة كفاتورة ثانوية',
  },
  'Payments.lateInterest.claim.successToast': {
    en: 'Statutory interest claim submitted',
    pl: 'Zgłoszono roszczenie o odsetki ustawowe',
    de: 'Forderung auf gesetzliche Verzugszinsen eingereicht',
    ar: 'تم تقديم مطالبة بالفوائد القانونية',
  },
  'Payments.lateInterest.claim.title': {
    en: 'Claim statutory interest?',
    pl: 'Zgłosić roszczenie o odsetki ustawowe?',
    de: 'Gesetzliche Verzugszinsen geltend machen?',
    ar: 'هل تريد المطالبة بالفوائد القانونية؟',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.lateInterest.revokeWaiver.* — revoke-waiver dialog
  // ────────────────────────────────────────────────────────────────────────
  'Payments.lateInterest.revokeWaiver.cancel': {
    en: 'Cancel',
    pl: 'Anuluj',
    de: 'Abbrechen',
    ar: 'إلغاء',
  },
  'Payments.lateInterest.revokeWaiver.confirm': {
    en: 'Revoke waiver',
    pl: 'Cofnij zrzeczenie',
    de: 'Verzicht widerrufen',
    ar: 'سحب التنازل',
  },
  'Payments.lateInterest.revokeWaiver.confirming': {
    en: 'Revoking…',
    pl: 'Cofanie…',
    de: 'Wird widerrufen…',
    ar: 'جارٍ السحب…',
  },
  'Payments.lateInterest.revokeWaiver.description': {
    en: 'Reinstating this waiver will resume interest accrual from the original overdue date. Provide a reason for the audit log.',
    pl: 'Cofnięcie tego zrzeczenia wznowi naliczanie odsetek od pierwotnej daty zaległości. Podaj powód w dzienniku audytu.',
    de: 'Mit dem Widerruf dieses Verzichts wird die Zinsberechnung ab dem ursprünglichen Fälligkeitsdatum fortgesetzt. Geben Sie einen Grund für das Audit-Log an.',
    ar: 'سيؤدي سحب هذا التنازل إلى استئناف احتساب الفوائد من تاريخ الاستحقاق الأصلي. يرجى ذكر السبب لسجل التدقيق.',
  },
  'Payments.lateInterest.revokeWaiver.reasonLabel': {
    en: 'Reason for revoking',
    pl: 'Powód cofnięcia',
    de: 'Grund für den Widerruf',
    ar: 'سبب السحب',
  },
  'Payments.lateInterest.revokeWaiver.reasonMinLength': {
    en: 'Reason must be at least 10 characters.',
    pl: 'Powód musi mieć co najmniej 10 znaków.',
    de: 'Der Grund muss mindestens 10 Zeichen lang sein.',
    ar: 'يجب أن يتكون السبب من 10 أحرف على الأقل.',
  },
  'Payments.lateInterest.revokeWaiver.reasonPlaceholder': {
    en: 'e.g. customer refused negotiated settlement',
    pl: 'np. klient odmówił wynegocjowanej ugody',
    de: 'z. B. Kunde lehnte ausgehandelten Vergleich ab',
    ar: 'مثال: رفض العميل التسوية المتفاوض عليها',
  },
  'Payments.lateInterest.revokeWaiver.successToast': {
    en: 'Waiver revoked — interest accrual resumed',
    pl: 'Cofnięto zrzeczenie — wznowiono naliczanie odsetek',
    de: 'Verzicht widerrufen — Zinsberechnung wieder aufgenommen',
    ar: 'تم سحب التنازل — استؤنف احتساب الفوائد',
  },
  'Payments.lateInterest.revokeWaiver.title': {
    en: 'Revoke interest waiver?',
    pl: 'Cofnąć zrzeczenie się odsetek?',
    de: 'Zinsverzicht widerrufen?',
    ar: 'هل تريد سحب التنازل عن الفوائد؟',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.lateInterest.waive.* — waive dialog + dynamic types
  // ────────────────────────────────────────────────────────────────────────
  'Payments.lateInterest.waive.cancel': {
    en: 'Cancel',
    pl: 'Anuluj',
    de: 'Abbrechen',
    ar: 'إلغاء',
  },
  'Payments.lateInterest.waive.confirm': {
    en: 'Waive interest',
    pl: 'Zrzeknij się odsetek',
    de: 'Zinsen erlassen',
    ar: 'التنازل عن الفوائد',
  },
  'Payments.lateInterest.waive.confirming': {
    en: 'Waiving…',
    pl: 'Zrzekanie się…',
    de: 'Wird erlassen…',
    ar: 'جارٍ التنازل…',
  },
  'Payments.lateInterest.waive.description': {
    en: 'Waiving stops interest accrual and removes the statutory claim. This action is recorded in the audit log and can be revoked later.',
    pl: 'Zrzeczenie zatrzymuje naliczanie odsetek i usuwa roszczenie ustawowe. Czynność jest zapisywana w dzienniku audytu i może zostać później cofnięta.',
    de: 'Der Verzicht stoppt die Zinsberechnung und entfernt die gesetzliche Forderung. Diese Aktion wird im Audit-Log erfasst und kann später widerrufen werden.',
    ar: 'يؤدي التنازل إلى إيقاف احتساب الفوائد وإزالة المطالبة القانونية. تُسجَّل هذه العملية في سجل التدقيق ويمكن سحبها لاحقًا.',
  },
  'Payments.lateInterest.waive.reasonLabel': {
    en: 'Reason for waiving',
    pl: 'Powód zrzeczenia',
    de: 'Grund für den Verzicht',
    ar: 'سبب التنازل',
  },
  'Payments.lateInterest.waive.reasonMinLength': {
    en: 'Reason must be at least 10 characters.',
    pl: 'Powód musi mieć co najmniej 10 znaków.',
    de: 'Der Grund muss mindestens 10 Zeichen lang sein.',
    ar: 'يجب أن يتكون السبب من 10 أحرف على الأقل.',
  },
  'Payments.lateInterest.waive.reasonPlaceholder': {
    en: 'e.g. negotiated settlement with customer, goodwill gesture, admin error',
    pl: 'np. wynegocjowana ugoda z klientem, gest dobrej woli, błąd administracyjny',
    de: 'z. B. ausgehandelter Vergleich mit Kunden, Kulanz, Verwaltungsfehler',
    ar: 'مثال: تسوية متفاوض عليها مع العميل، مجاملة، خطأ إداري',
  },
  'Payments.lateInterest.waive.successToast': {
    en: 'Interest waived',
    pl: 'Zrzeczono się odsetek',
    de: 'Zinsen erlassen',
    ar: 'تم التنازل عن الفوائد',
  },
  'Payments.lateInterest.waive.title': {
    en: 'Waive statutory interest?',
    pl: 'Zrzec się odsetek ustawowych?',
    de: 'Gesetzliche Verzugszinsen erlassen?',
    ar: 'هل تريد التنازل عن الفوائد القانونية؟',
  },
  'Payments.lateInterest.waive.typeLabel': {
    en: 'What to waive',
    pl: 'Co chcesz zrzec',
    de: 'Was erlassen werden soll',
    ar: 'العنصر المراد التنازل عنه',
  },

  // dynamic-prefix leaves: Payments.lateInterest.waive.types.*
  'Payments.lateInterest.waive.types.STATUTORY_INTEREST': {
    en: 'Statutory interest only',
    pl: 'Tylko odsetki ustawowe',
    de: 'Nur gesetzliche Zinsen',
    ar: 'الفوائد القانونية فقط',
  },
  'Payments.lateInterest.waive.types.COMPENSATION': {
    en: 'Fixed compensation only',
    pl: 'Tylko rekompensata stała',
    de: 'Nur Pauschalentschädigung',
    ar: 'التعويض الثابت فقط',
  },
  'Payments.lateInterest.waive.types.BOTH': {
    en: 'Interest and compensation',
    pl: 'Odsetki i rekompensata',
    de: 'Zinsen und Entschädigung',
    ar: 'الفوائد والتعويض معًا',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.skonto.billingProfile.* — DE billing-profile default Skonto
  // ────────────────────────────────────────────────────────────────────────
  'Payments.skonto.billingProfile.deletedToast': {
    en: 'Default Skonto removed',
    pl: 'Usunięto domyślne Skonto',
    de: 'Standard-Skonto entfernt',
    ar: 'تمت إزالة Skonto الافتراضي',
  },
  'Payments.skonto.billingProfile.discountPercentLabel': {
    en: 'Discount %',
    pl: 'Rabat %',
    de: 'Skonto %',
    ar: 'نسبة الخصم %',
  },
  'Payments.skonto.billingProfile.discountPeriodLabel': {
    en: 'Discount period (days)',
    pl: 'Okres rabatu (dni)',
    de: 'Skontofrist (Tage)',
    ar: 'فترة الخصم (أيام)',
  },
  'Payments.skonto.billingProfile.heading': {
    en: 'Default early-payment discount',
    pl: 'Domyślny rabat za wcześniejszą płatność',
    de: 'Standard-Skonto (Frühzahlerrabatt)',
    ar: 'خصم السداد المبكر الافتراضي',
  },
  'Payments.skonto.billingProfile.netPeriodLabel': {
    en: 'Net period (days)',
    pl: 'Okres netto (dni)',
    de: 'Nettofrist (Tage)',
    ar: 'فترة الصافي (أيام)',
  },
  'Payments.skonto.billingProfile.removeDefault': {
    en: 'Remove default Skonto',
    pl: 'Usuń domyślne Skonto',
    de: 'Standard-Skonto entfernen',
    ar: 'إزالة Skonto الافتراضي',
  },
  'Payments.skonto.billingProfile.saveTerm': {
    en: 'Save default Skonto',
    pl: 'Zapisz domyślne Skonto',
    de: 'Standard-Skonto speichern',
    ar: 'حفظ Skonto الافتراضي',
  },
  'Payments.skonto.billingProfile.savedToast': {
    en: 'Default Skonto saved',
    pl: 'Zapisano domyślne Skonto',
    de: 'Standard-Skonto gespeichert',
    ar: 'تم حفظ Skonto الافتراضي',
  },
  'Payments.skonto.billingProfile.saving': {
    en: 'Saving…',
    pl: 'Zapisywanie…',
    de: 'Wird gespeichert…',
    ar: 'جارٍ الحفظ…',
  },
  'Payments.skonto.billingProfile.validation.daysOrdering': {
    en: 'Discount period must be shorter than the net period.',
    pl: 'Okres rabatu musi być krótszy niż okres netto.',
    de: 'Die Skontofrist muss kürzer als die Nettofrist sein.',
    ar: 'يجب أن تكون فترة الخصم أقصر من فترة الصافي.',
  },
  'Payments.skonto.billingProfile.validation.invalidDays': {
    en: 'Enter a whole number of days (1 or more).',
    pl: 'Wprowadź całkowitą liczbę dni (1 lub więcej).',
    de: 'Geben Sie eine ganze Anzahl Tage ein (mindestens 1).',
    ar: 'أدخل عددًا صحيحًا من الأيام (1 أو أكثر).',
  },
  'Payments.skonto.billingProfile.validation.percentOutOfRange': {
    en: 'Discount must be between 0 and 50%.',
    pl: 'Rabat musi mieścić się w zakresie od 0 do 50%.',
    de: 'Das Skonto muss zwischen 0 und 50 % liegen.',
    ar: 'يجب أن تتراوح نسبة الخصم بين 0 و50%.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.skonto.form.* — invoice-level Skonto form
  // ────────────────────────────────────────────────────────────────────────
  'Payments.skonto.form.addSkonto': {
    en: 'Add Skonto',
    pl: 'Dodaj Skonto',
    de: 'Skonto hinzufügen',
    ar: 'إضافة Skonto',
  },
  'Payments.skonto.form.customizeToggle': {
    en: 'Customize for this invoice',
    pl: 'Dostosuj dla tej faktury',
    de: 'Für diese Rechnung anpassen',
    ar: 'تخصيص لهذه الفاتورة',
  },
  'Payments.skonto.form.deletedToast': {
    en: 'Invoice-specific Skonto removed',
    pl: 'Usunięto Skonto przypisane do faktury',
    de: 'Rechnungsspezifisches Skonto entfernt',
    ar: 'تمت إزالة Skonto الخاص بالفاتورة',
  },
  'Payments.skonto.form.discountPercentLabel': {
    en: 'Discount %',
    pl: 'Rabat %',
    de: 'Skonto %',
    ar: 'نسبة الخصم %',
  },
  'Payments.skonto.form.discountPeriodLabel': {
    en: 'Discount period (days)',
    pl: 'Okres rabatu (dni)',
    de: 'Skontofrist (Tage)',
    ar: 'فترة الخصم (أيام)',
  },
  'Payments.skonto.form.heading': {
    en: 'Early-payment discount (Skonto)',
    pl: 'Rabat za wcześniejszą płatność (Skonto)',
    de: 'Skonto (Frühzahlerrabatt)',
    ar: 'خصم السداد المبكر (Skonto)',
  },
  'Payments.skonto.form.netPeriodLabel': {
    en: 'Net period (days)',
    pl: 'Okres netto (dni)',
    de: 'Nettofrist (Tage)',
    ar: 'فترة الصافي (أيام)',
  },
  'Payments.skonto.form.previewLine': {
    en: '{percent}% discount if paid within {discountDays} days, otherwise net {netDays} days',
    pl: 'Rabat {percent}% przy płatności w ciągu {discountDays} dni, w przeciwnym razie netto {netDays} dni',
    de: '{percent} % Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage',
    ar: 'خصم {percent}% عند السداد خلال {discountDays} يومًا، وإلا الصافي {netDays} يومًا',
  },
  'Payments.skonto.form.removeSkonto': {
    en: 'Remove Skonto',
    pl: 'Usuń Skonto',
    de: 'Skonto entfernen',
    ar: 'إزالة Skonto',
  },
  'Payments.skonto.form.resetToDefault': {
    en: 'Reset to contractor default',
    pl: 'Przywróć domyślne dla kontrahenta',
    de: 'Auf Auftragnehmerstandard zurücksetzen',
    ar: 'إعادة الضبط إلى الافتراضي للمقاول',
  },
  'Payments.skonto.form.saveTerm': {
    en: 'Save Skonto term',
    pl: 'Zapisz warunek Skonto',
    de: 'Skonto-Konditionen speichern',
    ar: 'حفظ شرط Skonto',
  },
  'Payments.skonto.form.savedToast': {
    en: 'Skonto saved',
    pl: 'Zapisano Skonto',
    de: 'Skonto gespeichert',
    ar: 'تم حفظ Skonto',
  },
  'Payments.skonto.form.saving': {
    en: 'Saving…',
    pl: 'Zapisywanie…',
    de: 'Wird gespeichert…',
    ar: 'جارٍ الحفظ…',
  },
  'Payments.skonto.form.useDefaultPill': {
    en: 'Using contractor default: {percent}% / {discountDays} days / net {netDays} days',
    pl: 'Domyślne dla kontrahenta: {percent}% / {discountDays} dni / netto {netDays} dni',
    de: 'Auftragnehmerstandard: {percent} % / {discountDays} Tage / netto {netDays} Tage',
    ar: 'الافتراضي للمقاول: {percent}% / {discountDays} يومًا / صافي {netDays} يومًا',
  },
  'Payments.skonto.form.validation.daysOrdering': {
    en: 'Discount period must be shorter than the net period.',
    pl: 'Okres rabatu musi być krótszy niż okres netto.',
    de: 'Die Skontofrist muss kürzer als die Nettofrist sein.',
    ar: 'يجب أن تكون فترة الخصم أقصر من فترة الصافي.',
  },
  'Payments.skonto.form.validation.invalidDays': {
    en: 'Enter a whole number of days (1 or more).',
    pl: 'Wprowadź całkowitą liczbę dni (1 lub więcej).',
    de: 'Geben Sie eine ganze Anzahl Tage ein (mindestens 1).',
    ar: 'أدخل عددًا صحيحًا من الأيام (1 أو أكثر).',
  },
  'Payments.skonto.form.validation.percentOutOfRange': {
    en: 'Discount must be between 0 and 50%.',
    pl: 'Rabat musi mieścić się w zakresie od 0 do 50%.',
    de: 'Das Skonto muss zwischen 0 und 50 % liegen.',
    ar: 'يجب أن تتراوح نسبة الخصم بين 0 و50%.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Payments.skonto.paymentRun.* — payment-run apply checkbox
  // ────────────────────────────────────────────────────────────────────────
  'Payments.skonto.paymentRun.applyDescription': {
    en: 'Apply {percent}% Skonto — save {amount}',
    pl: 'Zastosuj Skonto {percent}% — oszczędność {amount}',
    de: '{percent} % Skonto anwenden — Ersparnis {amount}',
    ar: 'تطبيق Skonto بنسبة {percent}% — توفير {amount}',
  },
  'Payments.skonto.paymentRun.applyLabel': {
    en: 'Apply {percent}% Skonto, saving {amount}',
    pl: 'Zastosuj Skonto {percent}%, oszczędność {amount}',
    de: '{percent} % Skonto anwenden, Ersparnis {amount}',
    ar: 'تطبيق Skonto بنسبة {percent}%، توفير {amount}',
  },
  'Payments.skonto.paymentRun.newAmount': {
    en: 'New amount: {amount}',
    pl: 'Nowa kwota: {amount}',
    de: 'Neuer Betrag: {amount}',
    ar: 'المبلغ الجديد: {amount}',
  },
  'Payments.skonto.paymentRun.pastWindowDescription': {
    en: 'Discount window expired on {date} — full amount applies',
    pl: 'Okno rabatowe wygasło {date} — obowiązuje pełna kwota',
    de: 'Skontofrist am {date} abgelaufen — voller Betrag fällig',
    ar: 'انتهت نافذة الخصم بتاريخ {date} — يُطبَّق المبلغ الكامل',
  },
  'Payments.skonto.paymentRun.pastWindowLabel': {
    en: 'Skonto unavailable — discount window expired',
    pl: 'Skonto niedostępne — okno rabatowe wygasło',
    de: 'Skonto nicht verfügbar — Skontofrist abgelaufen',
    ar: 'Skonto غير متاح — انتهت نافذة الخصم',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Settings.integrations.sync* — integration sync controls
  // ────────────────────────────────────────────────────────────────────────
  'Settings.integrations.syncFailedToast': {
    en: 'Sync failed. Please try again.',
    pl: 'Synchronizacja nie powiodła się. Spróbuj ponownie.',
    de: 'Synchronisierung fehlgeschlagen. Bitte erneut versuchen.',
    ar: 'فشلت المزامنة. يرجى المحاولة مرة أخرى.',
  },
  'Settings.integrations.syncNow': {
    en: 'Sync now',
    pl: 'Synchronizuj teraz',
    de: 'Jetzt synchronisieren',
    ar: 'المزامنة الآن',
  },
  'Settings.integrations.syncSuccessToast': {
    en: '{count, plural, =0 {Sync completed} one {Sync completed — # change} other {Sync completed — # changes}}',
    pl: '{count, plural, =0 {Synchronizacja ukończona} one {Synchronizacja ukończona — # zmiana} few {Synchronizacja ukończona — # zmiany} many {Synchronizacja ukończona — # zmian} other {Synchronizacja ukończona — # zmian}}',
    de: '{count, plural, =0 {Synchronisierung abgeschlossen} one {Synchronisierung abgeschlossen — # Änderung} other {Synchronisierung abgeschlossen — # Änderungen}}',
    ar: '{count, plural, =0 {اكتملت المزامنة} one {اكتملت المزامنة — # تغيير} other {اكتملت المزامنة — # تغييرات}}',
  },
  'Settings.integrations.syncing': {
    en: 'Syncing…',
    pl: 'Synchronizowanie…',
    de: 'Wird synchronisiert…',
    ar: 'جارٍ المزامنة…',
  },

  // ────────────────────────────────────────────────────────────────────────
  // Settings.tabs.{apiKeys,privacy}
  // ────────────────────────────────────────────────────────────────────────
  'Settings.tabs.apiKeys': {
    en: 'API keys',
    pl: 'Klucze API',
    de: 'API-Schlüssel',
    ar: 'مفاتيح API',
  },
  'Settings.tabs.privacy': {
    en: 'Privacy',
    pl: 'Prywatność',
    de: 'Datenschutz',
    ar: 'الخصوصية',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// setDeep helper — same as prior translation passes.
// ─────────────────────────────────────────────────────────────────────────────

function setDeep(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cur[key];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply
// ─────────────────────────────────────────────────────────────────────────────

const LOCALES = ['en', 'pl', 'de', 'ar'] as const;
const ROOT = resolve(process.cwd());

let applied = 0;
for (const locale of LOCALES) {
  const path = resolve(ROOT, `apps/web-vite/messages/${locale}.json`);
  const data = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  let perLocale = 0;
  for (const [key, values] of Object.entries(TRANSLATIONS)) {
    setDeep(data, key, values[locale]);
    perLocale++;
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  applied += perLocale;
  // biome-ignore lint/suspicious/noConsole: standalone script
  console.log(`[${locale}] wrote ${perLocale} translations to ${path}`);
}

// biome-ignore lint/suspicious/noConsole: standalone script
console.log(
  `\nDone — ${applied} translations applied across ${LOCALES.length} locales (${Object.keys(TRANSLATIONS).length} unique keys).`,
);
