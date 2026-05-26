#!/usr/bin/env tsx
/**
 * Second-pass curated Polish translations.
 *
 * Where v1 (scripts/apply-pl-translations.ts) closed the keys that were
 * outright missing from pl.json, this v2 pass closes the keys that exist
 * in pl.json but still carry their English source value (verbatim copy
 * from en.json, never translated).
 *
 * Source of truth: .planning/translations/apps_web-pl-untranslated.json
 * (341 entries, dotted-key → English value).
 *
 * Editorial rules (same as v1):
 *   - Preserve ICU placeholders verbatim ({count}, {name}, {date}, …) and
 *     expand English `{count, plural, one … other …}` to the full Polish
 *     CLDR (one / few / many / other) where the message actually pluralizes.
 *   - Brand and product names stay in English (Stripe, Slack, Jira, Linear,
 *     Microsoft Teams, Google Drive, Acme Corp, Vercel, Neon, Cloudflare,
 *     Resend, Sentry, Axiom, Upstash, Cronitor, QStash, Peppol …).
 *   - UK statute titles and German tax terms (Steuerberater, KoSIT, XRechnung,
 *     ZUGFeRD, Leitweg-ID, Kleinunternehmerregelung …) stay in source language.
 *   - Latin-script acronyms unchanged (BACS, SEPA, IR35, HMRC, SDS, ZATCA,
 *     Peppol, OAuth, API, URL, NIP, VAT, SLA …).
 *   - UTF-8 literal diacritics — never `\uXXXX` escapes.
 *
 * Run once:
 *   pnpm tsx scripts/apply-pl-translations-v2.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PL_PATH = resolve(process.cwd(), 'apps/web-vite/messages/pl.json');

/**
 * Dotted-path → Polish value map (or English where intentional, e.g. brands).
 */
const TRANSLATIONS: Record<string, string> = {
  // ─── Auth ───────────────────────────────────────────────────────────────────
  'Auth.register.orgNamePlaceholder': 'Acme Corp', // brand placeholder — keep English

  // ─── Contractors ────────────────────────────────────────────────────────────
  'Contractors.health.atRisk': 'Zagrożony',
  'Contractors.v2.emptyState.heading': 'Brak kontrahentów',
  'Contractors.v2.emptyState.body':
    'Dodaj pierwszego kontrahenta, aby rozpocząć zarządzanie umowami, fakturami i płatnościami.',
  'Contractors.v2.emptyState.addContractor': 'Dodaj kontrahenta',
  'Contractors.v2.noMatch': 'Żaden kontrahent nie pasuje do filtrów',
  'Contractors.v2.clearAllFilters': 'Wyczyść wszystkie filtry',
  'Contractors.v2.searchPlaceholder': 'Szukaj kontrahentów...',

  // ─── ContractorProfile ──────────────────────────────────────────────────────
  'ContractorProfile.rightRail.lifecycleStage': 'Status: {stage}',

  // ─── Contracts ──────────────────────────────────────────────────────────────
  'Contracts.invoiceCycle.adHoc': 'Ad hoc',
  'Contracts.wizard.invoiceCycleOptions.adHoc': 'Ad hoc',

  // ─── Common ─────────────────────────────────────────────────────────────────
  'Common.aria.colorSwatch': '{label} ({hex})',
  'Common.orgSwitcher.namePlaceholder': 'Acme Corp', // brand placeholder
  'Common.fileSize.bytes': '{size} B',
  'Common.fileSize.kilobytes': '{size} KB',
  'Common.fileSize.megabytes': '{size} MB',

  // ─── Approvals ──────────────────────────────────────────────────────────────
  'Approvals.tabProfileChanges': 'Zmiany profilu',
  'Approvals.changeRequests.noPendingHeading': 'Brak oczekujących wniosków o zmianę',
  'Approvals.changeRequests.noPendingBody':
    'Wnioski kontrahentów o zmianę profilu pojawią się tutaj po przesłaniu.',

  // ─── Notifications ──────────────────────────────────────────────────────────
  'Notifications.itemBody.approvalRequest':
    '{contractorName} – {amount} {currency}. SLA: {slaHours}h',

  // ─── Payments ───────────────────────────────────────────────────────────────
  'Payments.summaryFormat': 'Format: {format}',
  'Payments.skonto.cellFormat': '{percent}% {discountDays}/{netDays}',

  // ─── Portal.timeTracking ────────────────────────────────────────────────────
  'Portal.timeTracking.title': 'Wpisy czasu pracy',
  'Portal.timeTracking.pastTimesheets': 'Poprzednie karty pracy',
  'Portal.timeTracking.addEntry': 'Dodaj wpis',
  'Portal.timeTracking.noEntriesHeading': 'Brak wpisów czasu pracy',
  'Portal.timeTracking.noEntriesBody':
    'Rozpocznij rejestrowanie godzin w siatce karty pracy powyżej lub dodaj pojedynczy wpis.',
  'Portal.timeTracking.columns.totalHours': 'Łącznie godzin',
  'Portal.timeTracking.toast.entryAdded': 'Wpis czasu pracy dodany',
  'Portal.timeTracking.toast.entryAddFailed': 'Nie udało się dodać wpisu czasu pracy',
  'Portal.timeTracking.toast.timesheetSubmitted': 'Karta pracy przesłana do przeglądu',
  'Portal.timeTracking.toast.timesheetSubmitFailed': 'Nie udało się przesłać karty pracy',

  // ─── Portal.submitInvoice ───────────────────────────────────────────────────
  'Portal.submitInvoice.ocrExtracted': 'Dane faktury odczytane — sprawdź przed wysłaniem',
  'Portal.submitInvoice.ocrFailed':
    'Odczytanie faktury nie powiodło się. Spróbuj ponownie lub wprowadź dane ręcznie.',
  'Portal.submitInvoice.ocrPrefillBanner':
    'Część pól została wstępnie wypełniona z Twojej faktury. Sprawdź dane przed wysłaniem.',
  'Portal.submitInvoice.viewPdf': 'Zobacz PDF',
  'Portal.submitInvoice.sellerNip': 'NIP sprzedawcy',
  'Portal.submitInvoice.buyerNip': 'NIP nabywcy',

  // ─── Portal.fileSize ────────────────────────────────────────────────────────
  'Portal.fileSize.bytes': '{size} B',
  'Portal.fileSize.kilobytes': '{size} KB',
  'Portal.fileSize.megabytes': '{size} MB',

  // ─── CalendarSettings ───────────────────────────────────────────────────────
  'CalendarSettings.googleCalendar': 'Google Calendar', // product name
  'CalendarSettings.outlookCalendar': 'Outlook Calendar', // product name

  // ─── Equipment.ups ──────────────────────────────────────────────────────────
  'Equipment.ups.expressSaver': 'Express Saver', // UPS service tier (proper noun)

  // ─── Legal.subProcessors ────────────────────────────────────────────────────
  // All entity names stay in English (legal trading names).
  'Legal.subProcessors.processors.vercel.name': 'Vercel Inc.',
  'Legal.subProcessors.processors.neon.name': 'Neon Inc.',
  'Legal.subProcessors.processors.cloudflare.name': 'Cloudflare Inc.',
  'Legal.subProcessors.processors.stripe.name': 'Stripe Inc.',
  'Legal.subProcessors.processors.resend.name': 'Resend Inc.',
  'Legal.subProcessors.processors.sentry.name': 'Sentry (Functional Software Inc.)',
  'Legal.subProcessors.processors.axiom.name': 'Axiom Inc.',
  'Legal.subProcessors.processors.upstash.name': 'Upstash Inc.',
  'Legal.subProcessors.processors.cronitor.name': 'Cronitor Inc.',
  'Legal.subProcessors.processors.qstash.name': 'Upstash QStash',

  // ─── Billing.topUp ──────────────────────────────────────────────────────────
  'Billing.topUp.title': 'Kup kredyty OCR',
  'Billing.topUp.description':
    'Wybierz pakiet kredytów. Zostaniesz przekierowany do Stripe w celu sfinalizowania zakupu.',
  'Billing.topUp.selectPlaceholder': 'Wybierz rozmiar pakietu',
  'Billing.topUp.priceNote': 'Dokładna cena zostanie potwierdzona na stronie płatności Stripe.',
  'Billing.topUp.confirm': 'Przejdź do płatności',
  'Billing.topUp.errors.checkoutFailed': 'Nie udało się rozpocząć płatności. Spróbuj ponownie.',
  'Billing.topUp.errors.priceNotConfigured': 'Cena doładowania nie została skonfigurowana.',

  // ─── Billing.overlay ────────────────────────────────────────────────────────
  'Billing.overlay.paymentFailed': 'Płatność nie powiodła się.',
  'Billing.overlay.paymentFailedBody':
    'Zaktualizuj metodę płatności, aby uniknąć przerwy w działaniu usługi.',
  'Billing.overlay.goToBilling': 'Przejdź do rozliczeń',

  // ─── Time (admin time-tracking) ─────────────────────────────────────────────
  'Time.pageTitle': 'Rejestracja czasu pracy',
  'Time.tabs.pendingReviews': 'Oczekujące do przeglądu',
  'Time.tabs.allEntries': 'Wszystkie wpisy',
  'Time.filters.allStatuses': 'Wszystkie statusy',
  'Time.columns.totalHours': 'Łącznie godzin',
  'Time.emptyStates.noPendingReviewsHeading': 'Brak oczekujących przeglądów',
  'Time.emptyStates.noPendingReviewsBody':
    'Wszystkie karty pracy zostały przejrzane. Wróć tutaj, gdy kontrahenci prześlą nowe wpisy.',
  'Time.emptyStates.noTimeEntriesHeading': 'Brak wpisów czasu pracy',
  'Time.emptyStates.noTimeEntriesBody':
    'Wpisy czasu pracy pojawią się tutaj, gdy kontrahenci zaczną rejestrować godziny.',
  'Time.toast.approved': 'Karta pracy zaakceptowana',
  'Time.toast.rejected': 'Karta pracy odrzucona',
  'Time.toast.bulkApproved':
    '{count, plural, one {# karta pracy zaakceptowana} few {# karty pracy zaakceptowane} many {# kart pracy zaakceptowanych} other {# kart pracy zaakceptowanych}}',
  'Time.toast.bulkRejected':
    '{count, plural, one {# karta pracy odrzucona} few {# karty pracy odrzucone} many {# kart pracy odrzuconych} other {# kart pracy odrzuconych}}',
  'Time.errors.failedToApprove': 'Nie udało się zaakceptować karty pracy',
  'Time.errors.failedToReject': 'Nie udało się odrzucić karty pracy',
  'Time.errors.failedToApproveTimesheets': 'Nie udało się zaakceptować kart pracy',
  'Time.errors.failedToRejectTimesheets': 'Nie udało się odrzucić kart pracy',
  'Time.detail.notFoundHeading': 'Nie znaleziono karty pracy',
  'Time.detail.notFoundBody':
    'Nie można znaleźć żądanej karty pracy. Mogła zostać usunięta lub adres URL jest nieprawidłowy.',
  'Time.detail.backToTimeTracking': 'Powrót do rejestracji czasu pracy',

  // ─── Zatca ──────────────────────────────────────────────────────────────────
  'Zatca.onboarding.title': 'Wdrożenie ZATCA',
  'Zatca.onboarding.steps.taxDetails': 'Dane podatkowe',
  'Zatca.onboarding.steps.csrGeneration': 'Generowanie CSR',
  'Zatca.onboarding.steps.complianceCsid': 'Compliance CSID',
  'Zatca.onboarding.steps.complianceChecks': 'Testy zgodności',
  'Zatca.onboarding.steps.productionCertificate': 'Certyfikat produkcyjny',
  'Zatca.csrGeneration.title': 'Krok 2 z 5: Wygeneruj wniosek o certyfikat',
  'Zatca.csrGeneration.description':
    'Wniosek o podpisanie certyfikatu (CSR) zostanie wygenerowany na podstawie danych podatkowych z kroku 1.',
  'Zatca.csrGeneration.keyType': 'Typ klucza:',
  'Zatca.csrGeneration.keyTypeValue': 'ECDSA P-256 (zalecane przez ZATCA)',
  'Zatca.csrGeneration.privateKeyNote':
    'Klucz prywatny zostanie bezpiecznie zapisany w sejfie sekretów Twojej organizacji. Nie opuszcza serwera.',
  'Zatca.csrGeneration.csrPreviewLabel': 'Podgląd CSR (tylko do odczytu)',
  'Zatca.csrGeneration.generateCsr': 'Wygeneruj CSR',
  'Zatca.csrGeneration.toast.success': 'CSR wygenerowane pomyślnie',
  'Zatca.csrGeneration.toast.error': 'Nie udało się wygenerować CSR',
  'Zatca.complianceChecks.title': 'Krok 4 z 5: Uruchom testy zgodności',
  'Zatca.complianceChecks.runChecks': 'Uruchom testy zgodności',
  'Zatca.complianceChecks.resultsLabel': 'Wyniki testów zgodności',
  'Zatca.complianceChecks.testLabels.standardTaxInvoice': 'Standardowa faktura podatkowa',
  'Zatca.complianceChecks.testLabels.standardCreditNote': 'Standardowa nota kredytowa',
  'Zatca.complianceChecks.testLabels.standardDebitNote': 'Standardowa nota debetowa',
  'Zatca.complianceChecks.testLabels.simplifiedInvoice': 'Faktura uproszczona',
  'Zatca.complianceChecks.testLabels.simplifiedCreditNote': 'Uproszczona nota kredytowa',
  'Zatca.complianceChecks.testLabels.simplifiedDebitNote': 'Uproszczona nota debetowa',
  'Zatca.complianceChecks.toast.allPassed':
    'Wszystkie 6 testów zgodności zakończonych powodzeniem. Konfiguracja jest gotowa do produkcji.',
  'Zatca.complianceChecks.toast.someFailed':
    'Testy zgodności nieudane: {failedCount} test(y) nie przeszły. Sprawdź dane podatkowe i spróbuj ponownie.',
  'Zatca.complianceChecks.toast.error': 'Nie udało się uruchomić testów zgodności',

  // ─── Peppol ─────────────────────────────────────────────────────────────────
  'Peppol.statusCard.title': 'Sieć Peppol',
  'Peppol.statusCard.notConnected': 'Brak połączenia z Peppol',
  'Peppol.statusCard.connectDescription':
    'Połącz się z siecią Peppol, aby wysyłać i odbierać e-faktury z partnerami handlowymi w ZEA. Potrzebne będą dane TRN oraz uwierzytelniające ASP.',
  'Peppol.statusCard.connect': 'Połącz z Peppol',
  'Peppol.statusCard.participantId': 'ID uczestnika',
  'Peppol.statusCard.aspProvider': 'Dostawca ASP',
  'Peppol.statusCard.lastSync': 'Ostatnia synchronizacja',
  'Peppol.statusCard.disconnectTitle': 'Rozłącz Peppol',
  'Peppol.statusCard.disconnectDescription':
    'Twój identyfikator uczestnika zostanie wyrejestrowany i nie będziesz w stanie wysyłać ani odbierać faktur Peppol. Kontynuować?',
  'Peppol.statusCard.toast.disconnected': 'Rozłączono z siecią Peppol',
  'Peppol.statusCard.toast.disconnectError': 'Nie udało się rozłączyć',
  'Peppol.transmission.title': 'Transmisja Peppol',
  'Peppol.transmission.aspRef': 'Ref. ASP:',
  'Peppol.transmission.retryTransmission': 'Ponów transmisję',
  'Peppol.transmission.toast.retryQueued': 'Transmisja zakolejkowana do ponowienia',
  'Peppol.transmission.toast.retryFailed': 'Ponowienie nie powiodło się',

  // ─── Integrations.jira ──────────────────────────────────────────────────────
  'Integrations.jira.taskConfig.configSaved': 'Konfiguracja zadania Jira zapisana',
  'Integrations.jira.taskConfig.configSaveFailed':
    'Nie udało się zapisać konfiguracji zadania Jira',
  'Integrations.jira.taskConfig.enableToggle': 'Utwórz zgłoszenie Jira po aktywacji zadania',
  'Integrations.jira.taskConfig.notConfigured': 'Nie skonfigurowano',
  'Integrations.jira.taskConfig.configure': 'Konfiguruj Jira',
  'Integrations.jira.statusMapping.title': 'Mapowanie statusów',
  'Integrations.jira.statusMapping.description':
    'Zmapuj statusy zadań workflow na przejścia Jira dla {projectName}.',
  'Integrations.jira.statusMapping.descriptionDefault':
    'Zmapuj statusy zadań workflow na przejścia Jira.',
  'Integrations.jira.statusMapping.jiraProject': 'Projekt Jira',
  'Integrations.jira.statusMapping.selectProject': 'Wybierz projekt',
  'Integrations.jira.statusMapping.workflowStatus': 'Status workflow',
  'Integrations.jira.statusMapping.jiraTransition': 'Przejście Jira',
  'Integrations.jira.statusMapping.notMapped': 'Niezmapowane',
  'Integrations.jira.statusMapping.unmappedTooltip':
    'Niezmapowane — zmiany statusu dla tego stanu będą ignorowane',
  'Integrations.jira.statusMapping.discardChanges': 'Odrzuć zmiany',
  'Integrations.jira.statusMapping.saveMapping': 'Zapisz mapowanie',
  'Integrations.jira.statusMapping.toast.saved': 'Mapowanie statusów zapisane',
  'Integrations.jira.statusMapping.toast.saveFailed': 'Nie udało się zapisać mapowania statusów',

  // ─── Integrations.linear ────────────────────────────────────────────────────
  'Integrations.linear.taskConfig.configSaved': 'Konfiguracja zadania Linear zapisana',
  'Integrations.linear.taskConfig.configSaveFailed':
    'Nie udało się zapisać konfiguracji zadania Linear',
  'Integrations.linear.taskConfig.notConfigured': 'Nie skonfigurowano',
  'Integrations.linear.statusMapping.toast.saved': 'Mapowanie statusów zapisane',
  'Integrations.linear.statusMapping.toast.saveFailed':
    'Nie udało się zapisać mapowania statusów. Spróbuj ponownie.',

  // ─── Api.email.subject ──────────────────────────────────────────────────────
  'Api.email.subject.approvalRequest': 'Wymagane działanie: zaakceptuj fakturę {invoiceNumber}',
  'Api.email.subject.approvalDecision': 'Faktura {invoiceNumber} {decision}',
  'Api.email.subject.taskAssigned': 'Nowe przypisane zadanie: {taskName}',
  'Api.email.subject.taskOverdue': 'Przeterminowane: {taskName} po terminie',
  'Api.email.subject.contractExpiring': 'Umowa wkrótce wygasa: {contractTitle}',
  'Api.email.subject.invoiceReceived': 'Nowa faktura otrzymana od {contractorName}',

  // ─── Api.email.labels ───────────────────────────────────────────────────────
  'Api.email.labels.viewInApp': 'Zobacz w Contractor Ops',
  'Api.email.labels.managePrefs': 'Zarządzaj preferencjami powiadomień',
  'Api.email.labels.footerText': 'Contractor Ops – Platforma operacyjna dla kontrahentów',
  'Api.email.labels.reviewAndApprove': 'Przejrzyj i zaakceptuj',
  'Api.email.labels.wasDue': 'Termin minął',

  // ─── Api.notifications.equipment ────────────────────────────────────────────
  'Api.notifications.equipment.returnApproved.title': 'Wniosek o zwrot zatwierdzony',
  'Api.notifications.equipment.returnApproved.body':
    'Twój wniosek o zwrot został zatwierdzony. Etykieta wysyłkowa została wygenerowana.',
  'Api.notifications.equipment.returnRejected.title': 'Wniosek o zwrot odrzucony',
  'Api.notifications.equipment.returnRejected.body': 'Twój wniosek o zwrot został odrzucony.',
  'Api.notifications.equipment.returnRequested.title': 'Nowy wniosek o zwrot sprzętu',
  'Api.notifications.equipment.returnRequested.body': 'Kontrahent zgłosił zwrot sprzętu.',

  // ─── Api.workflow.templates.onboarding ──────────────────────────────────────
  'Api.workflow.templates.onboarding.collectNda': 'Zbierz NDA',
  'Api.workflow.templates.onboarding.signContract': 'Podpisz umowę',
  'Api.workflow.templates.onboarding.setupItAccess': 'Skonfiguruj dostęp IT',
  'Api.workflow.templates.onboarding.setupFinance': 'Skonfiguruj dane finansowe',
  'Api.workflow.templates.onboarding.provisionEquipment': 'Przydziel sprzęt',
  'Api.workflow.templates.onboarding.teamIntroMeeting': 'Spotkanie zapoznawcze z zespołem',
  'Api.workflow.templates.onboarding.knowledgeTransfer': 'Przekazanie wiedzy',
  'Api.workflow.templates.offboarding.knowledgeTransfer': 'Przekazanie wiedzy',
  'Api.workflow.templates.offboarding.revokeItAccess': 'Odbierz dostęp IT',
  'Api.workflow.templates.offboarding.returnEquipment': 'Zwróć sprzęt',
  'Api.workflow.templates.offboarding.financeWrapUp': 'Zamknięcie spraw finansowych',
  'Api.workflow.templates.offboarding.finalDocumentation': 'Końcowa dokumentacja',

  // ─── Api.errors ─────────────────────────────────────────────────────────────
  'Api.errors.tenant.noActiveOrganization':
    'Brak aktywnej organizacji. Najpierw wybierz organizację.',
  'Api.errors.upload.rateLimitExceeded':
    'Przekroczono limit przesyłania plików. Maksymalnie 10 przesyłań na minutę. Spróbuj ponownie za chwilę.',
  'Api.errors.zatca.apiClientUnavailable':
    'Klient API ZATCA niedostępny. Upewnij się, że silnik e-fakturowania jest skonfigurowany.',
  'Api.errors.zatca.taxDetailsRequired':
    'Dane podatkowe muszą zostać zapisane przed wygenerowaniem CSR.',
  'Api.errors.zatca.csrRequired': 'CSR musi zostać wygenerowane przed wnioskiem o compliance CSID.',
  'Api.errors.zatca.taxDetailsRequiredForCompliance':
    'Dane podatkowe są wymagane do testów zgodności.',
  'Api.errors.zatca.complianceCsidRequired':
    'Compliance CSID musi zostać uzyskane przed uruchomieniem testów zgodności.',
  'Api.errors.zatca.complianceChecksMustPass':
    'Testy zgodności muszą zakończyć się powodzeniem przed wnioskiem o certyfikat produkcyjny.',
  'Api.errors.timesheet.weekStartDateMustBeMonday':
    'Data początku tygodnia musi być poniedziałkiem.',
  'Api.errors.timesheet.notFound': 'Nie znaleziono karty pracy.',
  'Api.errors.timesheet.canOnlyEditDraftOrRejected':
    'Można edytować wyłącznie karty pracy o statusie DRAFT lub REJECTED.',
  'Api.errors.timesheet.entryNotFound': 'Nie znaleziono wpisu czasu pracy.',
  'Api.errors.timesheet.cannotEditImportedEntries': 'Nie można edytować zaimportowanych wpisów.',
  'Api.errors.timesheet.cannotSubmit':
    'Karty pracy nie można wysłać (nieprawidłowy status lub nie znaleziono).',
  'Api.errors.timesheet.cannotApprove':
    'Karty pracy nie można zaakceptować (musi mieć status SUBMITTED).',
  'Api.errors.timesheet.cannotReject':
    'Karty pracy nie można odrzucić (musi mieć status SUBMITTED).',
  'Api.errors.approval.noUserWithRole': 'Nie znaleziono użytkownika z wymaganą rolą.',

  // ─── Layout.footer ──────────────────────────────────────────────────────────
  'Layout.footer.copyright': '© 2026 Contractor Ops', // brand line — keep English

  // ─── organization.kleinunternehmer ──────────────────────────────────────────
  'organization.kleinunternehmer.toggleLabel': 'Kleinunternehmerregelung (§ 19 UStG)', // DE tax regime — keep

  // ─── Classification ─────────────────────────────────────────────────────────
  'Classification._NOTE':
    'Frazy prawne (legal-locked) znajdują się w packages/validators/src/legal/{de,disclaimers}.ts. Nie duplikuj wartości CLASSIFICATION_* ani DISCLAIMER_* w tym pliku.',
  'Classification.rationale.counter': '{current} / {max}',
  'Classification.documents.byteSize': '{kb} KB',
  'Classification.ExpertHelp.gb.hmrc.title': 'HMRC Employment Status Manual', // UK official document title

  // ─── EInvoice.Settings ──────────────────────────────────────────────────────
  'EInvoice.Settings.subline':
    'Zarządzaj rejestracją uczestnika Peppol, identyfikatorami Leitweg-ID dla niemieckich faktur sektora publicznego oraz ustawieniami zgodności e-faktur.',
  'EInvoice.Settings.PeppolCard.ctaNotRegistered': 'Zarejestruj uczestnika Peppol',
  'EInvoice.Settings.PeppolCard.ctaRegistered': 'Zarządzaj uczestnikiem',
  'EInvoice.Settings.PeppolCard.emptyHeading': 'Brak rejestracji w Peppol',
  'EInvoice.Settings.PeppolCard.emptyBody':
    'Zarejestruj organizację jednorazowo, aby wysyłać e-faktury XRechnung do brytyjskich nabywców z sektora publicznego i odbierać potwierdzenia dostarczenia.',
  'EInvoice.Settings.LeitwegIdCard.ctaCreate': 'Utwórz Leitweg-ID',
  'EInvoice.Settings.LeitwegIdCard.emptyHeading': 'Brak zarejestrowanych Leitweg-ID',
  'EInvoice.Settings.LeitwegIdCard.emptyBody':
    'Dodaj Leitweg-ID dla każdego niemieckiego nabywcy z sektora publicznego, któremu wystawiasz faktury. Możesz ustawić wartości domyślne na poziomie kontrahenta oraz nadpisania per umowa.',

  // ─── EInvoice.InvoicesList ──────────────────────────────────────────────────
  'EInvoice.InvoicesList.SummaryTile.heading': 'Zgodność e-fakturowania',
  'EInvoice.InvoicesList.SummaryTile.bodyPattern':
    '{validCount} z {totalCount} faktur jest zgodnych z EN 16931.',
  'EInvoice.InvoicesList.SummaryTile.ctaNeedsAttention':
    'Przejrzyj {needsAttentionCount} faktur(ę)',
  'EInvoice.InvoicesList.Filter.label': 'Filtruj wg zgodności',
  'EInvoice.InvoicesList.Filter.notGenerated': 'Nie wygenerowano',
  'EInvoice.InvoicesList.Cell.notGenerated': 'Nie wygenerowano',
  'EInvoice.InvoicesList.Empty.heading': 'Brak faktur w tym stanie',
  'EInvoice.InvoicesList.Empty.body':
    'Spróbuj innego filtra lub wyczyść filtry, aby zobaczyć wszystkie faktury.',

  // ─── EInvoice.InvoiceTab ────────────────────────────────────────────────────
  'EInvoice.InvoiceTab.generationNotGeneratedBody':
    'Dla tej faktury nie wygenerowano jeszcze XML w formacie XRechnung.',
  'EInvoice.InvoiceTab.generateCta': 'Wygeneruj XML',
  'EInvoice.InvoiceTab.finalizeCta': 'Sfinalizuj i waliduj',
  'EInvoice.InvoiceTab.generationCaptionPattern':
    'Wygenerowano {relativeTime} · Zestaw reguł {ruleSetVersion} · SHA-256 {hashPrefix8}…',
  'EInvoice.InvoiceTab.downloadXmlButton': 'Pobierz XML',
  'EInvoice.InvoiceTab.downloadXmlHelper':
    'Wygasa za 5 minut — wygeneruj nowy link, jeśli potrzeba.',
  'EInvoice.InvoiceTab.validationNotValidatedBody':
    'Walidacja jeszcze nie uruchomiona. Sfinalizuj fakturę, aby zwalidować ją wobec KoSIT.',
  'EInvoice.InvoiceTab.validationCta': 'Waliduj teraz',
  'EInvoice.InvoiceTab.layer1Label': 'Warstwa 1 — schemat XSD',
  'EInvoice.InvoiceTab.layer2Label': 'Warstwa 2 — Schematron EN 16931',
  'EInvoice.InvoiceTab.layer3Label': 'Warstwa 3 — Schematron XRechnung CIUS',
  'EInvoice.InvoiceTab.layerResultWarningsPattern':
    '{count, plural, one {# ostrzeżenie} few {# ostrzeżenia} many {# ostrzeżeń} other {# ostrzeżeń}}',
  'EInvoice.InvoiceTab.layerResultFailPattern':
    '{count, plural, one {# błąd} few {# błędy} many {# błędów} other {# błędów}}',
  'EInvoice.InvoiceTab.svrlIssueRowPattern': '[{severity}] {ruleId} — {message} w {xpath}',
  'EInvoice.InvoiceTab.downloadReportButton': 'Pobierz pełny raport',
  'EInvoice.InvoiceTab.downloadReportHelper':
    'Otwiera pełny raport HTML KoSIT z podświetleniem reguł.',
  'EInvoice.InvoiceTab.transmissionNotSentBody': 'Ta e-faktura nie została jeszcze wysłana.',
  'EInvoice.InvoiceTab.sendCta': 'Wyślij przez Peppol',
  'EInvoice.InvoiceTab.transmittedCaptionPattern':
    'Wysłano {relativeTime} · Wiadomość {transmissionId}',
  'EInvoice.InvoiceTab.deliveryAckPattern': 'Dostarczono {relativeTime}',
  'EInvoice.InvoiceTab.transmissionHistoryHeading': 'Historia transmisji',
  'EInvoice.InvoiceTab.transmissionEventPattern': '{occurredAt} — {eventType} {detailsOneLiner}',
  'EInvoice.InvoiceTab.leitwegResolvedPattern':
    'Rozwiązany Leitweg-ID: {leitwegIdValue} ({source})',
  'EInvoice.InvoiceTab.leitwegSourceContract': 'z nadpisania umowy',
  'EInvoice.InvoiceTab.leitwegSourceContractorDefault': 'z wartości domyślnej kontrahenta',
  'EInvoice.InvoiceTab.leitwegMissingWarningHeading':
    'Brak Leitweg-ID dla niemieckiego nabywcy z sektora publicznego',
  'EInvoice.InvoiceTab.leitwegMissingWarningBody':
    'Ten nabywca jest oznaczony jako sektor publiczny. Przed wysyłką dodaj Leitweg-ID do kontrahenta lub umowy.',

  // ─── EInvoice.LeitwegIdDialog ───────────────────────────────────────────────
  'EInvoice.LeitwegIdDialog.headingCreate': 'Utwórz Leitweg-ID',
  'EInvoice.LeitwegIdDialog.headingEdit': 'Edytuj Leitweg-ID',
  'EInvoice.LeitwegIdDialog.valueHelper':
    'Format: cyfry zgrubne (2–12) + opcjonalne dookreślenie (do 30 znaków alfanumerycznych wielkich liter) + 2-cyfrowa suma kontrolna. Przykład: 1234567890-AGENCY-56.',
  'EInvoice.LeitwegIdDialog.descriptionLabel': 'Opis (opcjonalnie)',
  'EInvoice.LeitwegIdDialog.descriptionHelper':
    'Etykieta wewnętrzna — np. „Bundesministerium für Finanzen, Abt. IV”.',
  'EInvoice.LeitwegIdDialog.contractorLabel': 'Przypisz do kontrahenta',
  'EInvoice.LeitwegIdDialog.contractLabel':
    'Lub przypisz do konkretnej umowy (nadpisuje wartość domyślną kontrahenta)',
  'EInvoice.LeitwegIdDialog.defaultToggle': 'Ustaw jako domyślny dla tego kontrahenta',
  'EInvoice.LeitwegIdDialog.validFromLabel': 'Ważny od (opcjonalnie)',
  'EInvoice.LeitwegIdDialog.validToLabel': 'Ważny do (opcjonalnie)',
  'EInvoice.LeitwegIdDialog.notesLabel': 'Notatki (opcjonalnie)',
  'EInvoice.LeitwegIdDialog.saveButton': 'Zapisz Leitweg-ID',
  'EInvoice.LeitwegIdDialog.errorInvalidCheckDigit':
    'Suma kontrolna tego Leitweg-ID nie zgadza się z częścią zgrubną i dookreśleniem. Zweryfikuj wartość z nabywcą z sektora publicznego.',
  'EInvoice.LeitwegIdDialog.errorInvalidFormat':
    'Leitweg-ID musi składać się z 2–12 cyfr, opcjonalnie z `-<do 30 znaków alfanumerycznych wielkich liter>`, następnie `-<2-cyfrowa suma kontrolna>`.',
  'EInvoice.LeitwegIdDialog.errorDuplicate':
    'Ten Leitweg-ID jest już zarejestrowany w Twojej organizacji.',

  // ─── EInvoice.PeppolDialog ──────────────────────────────────────────────────
  'EInvoice.PeppolDialog.registerHeading': 'Zarejestruj uczestnika Peppol',
  'EInvoice.PeppolDialog.registerBody':
    'Rejestracja umożliwia wysyłanie e-faktur XRechnung do brytyjskich nabywców z sektora publicznego przez Peppol. Twój identyfikator uczestnika zostanie wpisany do Peppol SML.',
  'EInvoice.PeppolDialog.schemeLabel': 'Schemat identyfikatora',
  'EInvoice.PeppolDialog.schemeHelper':
    '`0060` = UK Companies House, `0088` = GLN, `0106` = Dun & Bradstreet.',
  'EInvoice.PeppolDialog.valueLabel': 'Wartość identyfikatora',
  'EInvoice.PeppolDialog.valueHelper':
    'Numer Companies House, GLN lub DUNS — zgodnie z wybranym schematem.',
  'EInvoice.PeppolDialog.registerButton': 'Zarejestruj uczestnika',
  'EInvoice.PeppolDialog.pendingHeading': 'Rejestracja w toku',
  'EInvoice.PeppolDialog.pendingBody':
    'Storecove rejestruje Twojego uczestnika w Peppol SML. Zwykle trwa to kilka minut. Status zaktualizujemy automatycznie.',
  'EInvoice.PeppolDialog.activeHeading': 'Zarejestrowano w Peppol',
  'EInvoice.PeppolDialog.activeBodyPattern':
    'Uczestnik {schemeId}:{value} · Status {status} · Zarejestrowano {relativeTime}',
  'EInvoice.PeppolDialog.deregisterButton': 'Wyrejestruj uczestnika',

  // ─── EInvoice.Errors ────────────────────────────────────────────────────────
  'EInvoice.Errors.LEITWEG_ID_MISSING':
    'Brak Leitweg-ID dla tego niemieckiego nabywcy z sektora publicznego. Dodaj wartość do kontrahenta lub umowy przed wysłaniem przez Peppol.',
  'EInvoice.Errors.PARTICIPANT_NOT_REACHABLE':
    'Odbiorca nie jest zarejestrowany w Peppol lub nie obsługuje XRechnung. Potwierdź ID Peppol nabywcy i spróbuj ponownie.',
  'EInvoice.Errors.KOSIT_VALIDATION_FAILED':
    'Ta e-faktura nie przeszła walidacji KoSIT. Przejrzyj raport walidacji i sfinalizuj ponownie po skorygowaniu danych faktury.',
  'EInvoice.Errors.PEPPOL_PARTICIPANT_NOT_ACTIVE':
    'Zarejestruj organizację w Peppol przed wysyłką e-faktur. Przejdź do Ustawienia → E-fakturowanie, aby rozpocząć.',
  'EInvoice.Errors.STORECOVE_TRANSMISSION_FAILED':
    'Transmisja Peppol nie powiodła się. Spróbujemy ponownie automatycznie — możesz też ponowić ręcznie z zakładki E-faktura.',
  'EInvoice.Errors.Generic':
    'Coś poszło nie tak. Spróbuj odświeżyć stronę lub skontaktuj się z pomocą, jeśli problem się utrzymuje.',

  // ─── EInvoice.intake ────────────────────────────────────────────────────────
  'EInvoice.intake.splitButtonPrimary': '+ Nowa faktura',
  'EInvoice.intake.splitButtonImport': 'Importuj e-fakturę',
  'EInvoice.intake.pageTitle': 'Importy faktur',
  'EInvoice.intake.pageSubtitle': 'Przychodzące faktury XRechnung i ZUGFeRD oczekujące na przegląd',
  'EInvoice.intake.uploadDialogTitle': 'Importuj e-fakturę',
  'EInvoice.intake.dropZonePrimary': 'Upuść tutaj plik XML XRechnung lub PDF ZUGFeRD',
  'EInvoice.intake.dropZoneSecondary': 'lub kliknij, aby wybrać plik (maks. 5 MB, .xml lub .pdf)',
  'EInvoice.intake.uploadTryAnother': 'Wypróbuj inny plik',
  'EInvoice.intake.uploadSuccessToast': 'Zaimportowano — przejrzyj w /invoices/intake/{id}',
  'EInvoice.intake.uploadDedupToast': 'Już zaimportowano — otwieram istniejący import',
  'EInvoice.intake.uploadNetworkError':
    'Przesyłanie nie powiodło się. Sprawdź połączenie i spróbuj ponownie.',
  'EInvoice.intake.uploadWrongType': 'Akceptowane są wyłącznie pliki .xml lub .pdf.',
  'EInvoice.intake.ctaConvert': 'Konwertuj na fakturę',
  'EInvoice.intake.ctaConfirmMatch': 'Potwierdź dopasowanie',
  'EInvoice.intake.ctaAcceptDespiteIssues': 'Zaakceptuj mimo problemów',
  'EInvoice.intake.ctaCreateContractor': 'Utwórz nowego kontrahenta z tych danych',
  'EInvoice.intake.ctaUseThisContractor': 'Użyj tego kontrahenta',
  'EInvoice.intake.ctaDownloadZugferd': 'Pobierz PDF ZUGFeRD',
  'EInvoice.intake.ctaRejectImport': 'Odrzuć import',
  'EInvoice.intake.emptyStateHeading': 'Brak importów',
  'EInvoice.intake.emptyStateBody':
    'Przychodzące pliki XML XRechnung oraz PDF ZUGFeRD pojawiają się tutaj. Aby przesłać plik, użyj opcji „Importuj e-fakturę” ze strony Faktury.',
  'EInvoice.intake.errorXsdReject':
    'XML nie jest zgodny ze schematem CII — poproś nadawcę o ponowne wystawienie. Pierwsze błędy: {errors}',
  'EInvoice.intake.errorNoXmlAttachment':
    'Ten PDF nie zawiera osadzonego załącznika XML XRechnung/ZUGFeRD. Importować można wyłącznie pliki PDF zgodne z ZUGFeRD.',
  'EInvoice.intake.errorLevelTooLow':
    'Ta faktura używa profilu ZUGFeRD {level}, który nie zawiera danych pozycji. Poproś nadawcę o profil COMFORT lub XRECHNUNG.',
  'EInvoice.intake.errorFileTooLarge': 'Plik przekracza 5 MB. Poproś nadawcę o mniejszy plik.',
  'EInvoice.intake.errorGeneric':
    'Nie udało się zaimportować pliku. Spróbuj ponownie lub skontaktuj się z pomocą.',
  'EInvoice.intake.bannerExtendedBestEffort':
    'Ta faktura używa profilu EXTENDED ZUGFeRD. Niektóre pola specyficzne dla nadawcy nie mogły zostać zmapowane. Dokładnie sprawdź dane przed konwersją.',
  'EInvoice.intake.tooltipConvertDisabledNeedsAck': 'Najpierw potwierdź problemy walidacji',
  'EInvoice.intake.tooltipConvertDisabledNeedsMatch': 'Dopasuj kontrahenta przed konwersją',
  'EInvoice.intake.matchReasonVat': 'Zgodny numer VAT',
  'EInvoice.intake.matchReasonLeitweg': 'Zgodny Leitweg-ID',
  'EInvoice.intake.matchReasonExactName': 'Dokładna zgodność nazwy',
  'EInvoice.intake.matchReasonFuzzyName': 'Przybliżona zgodność nazwy (odległość {n})',
  'EInvoice.intake.rejectDialogTitle': 'Odrzucić ten import?',
  'EInvoice.intake.rejectDialogBody':
    'Odrzucone importy pozostają w dzienniku audytu, lecz nie mogą zostać przekonwertowane na fakturę. Tej operacji nie można cofnąć.',
  'EInvoice.intake.rejectDialogConfirm': 'Odrzuć import',
  'EInvoice.intake.rejectReasonPlaceholder':
    'Powód (wymagany) — np. duplikat, błędny odbiorca, pomyłka nadawcy',
  'EInvoice.intake.rejectReasonTooShort': 'Podaj przynajmniej 3 znaki.',
  'EInvoice.intake.genFailureToast':
    'Generowanie ZUGFeRD nie powiodło się. Spróbuj ponownie lub skontaktuj się z pomocą, jeśli problem się powtarza.',
  'EInvoice.intake.genSuccessToast': 'PDF ZUGFeRD gotowy — pobieranie rozpoczęte.',
  'EInvoice.intake.notYetGenerated': 'Jeszcze nie wygenerowano',
  'EInvoice.intake.generatedOnPattern': 'Wygenerowano {date}',
  'EInvoice.intake.zugferdSectionBody':
    'Wygeneruj fakturę PDF/A-3 z osadzonym załącznikiem XML XRechnung CII.',
  'EInvoice.intake.skipPreview': 'Pomiń podgląd',
  'EInvoice.intake.openFullReport': 'Otwórz pełny raport',
  'EInvoice.intake.reportNotAvailable': 'Raport niedostępny',
  'EInvoice.intake.issuesAcceptedPattern': 'Problemy zaakceptowano {date}',
  'EInvoice.intake.advancedSectionHeading': 'Zaawansowane / techniczne',
  'EInvoice.intake.unmappedFieldsHeading': 'Niezmapowane pola specyficzne dla nadawcy',
  'EInvoice.intake.noMatchCandidatesHeading': 'Brak kandydatów',
  'EInvoice.intake.noMatchCandidatesBody':
    'Żaden istniejący kontrahent nie pasuje do tego dostawcy. Utwórz nowego na podstawie sparsowanych danych.',
  'EInvoice.intake.loadMore': 'Załaduj więcej',
  'EInvoice.intake.column.invoiceNumber': 'Nr faktury',
  'EInvoice.intake.field.supplierName': 'Nazwa dostawcy',
  'EInvoice.intake.field.invoiceNumber': 'Numer faktury',
  'EInvoice.intake.field.date': 'Data faktury',
  'EInvoice.intake.field.totalGross': 'Suma (brutto)',
  'EInvoice.intake.field.lineCount': 'Liczba pozycji',
  'EInvoice.intake.field.profileLevel': 'Profil ZUGFeRD',
  'EInvoice.intake.filter.needsReview': 'Wymaga przeglądu',
  'EInvoice.intake.status.NEEDS_REVIEW': 'Wymaga przeglądu',
  'EInvoice.intake.validation.issuesCountPattern':
    '{count, plural, one {# problem} few {# problemy} many {# problemów} other {# problemów}}',

  // ─── Offboarding.Templates ──────────────────────────────────────────────────
  'Offboarding.Templates.ProductManager.displayName': 'Product Manager', // role name commonly kept in EN in PL B2B SaaS
};

function setDeep(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i];
    const next = cur[segment];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cur[segment] = {};
    }
    cur = cur[segment] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

const data = JSON.parse(readFileSync(PL_PATH, 'utf-8')) as Record<string, unknown>;
let applied = 0;
for (const [key, value] of Object.entries(TRANSLATIONS)) {
  setDeep(data, key, value);
  applied++;
}
writeFileSync(PL_PATH, JSON.stringify(data, null, 2) + '\n');
// eslint-disable-next-line no-console -- one-shot CLI script reports completion to operator
console.log(`Applied ${applied} translations to ${PL_PATH}`);
