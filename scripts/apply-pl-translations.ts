#!/usr/bin/env tsx
/**
 * One-shot script: merges the curated Polish translation map below into
 * apps/web-vite/messages/pl.json at the correct nested paths, creating
 * intermediate objects as needed and preserving existing entries.
 *
 * Source of truth for the keys: .planning/translations/apps_web-pl-missing.json
 * (193 keys missing from pl vs the canonical en.json).
 *
 * Style guidelines applied while translating:
 *   - Professional B2B SaaS Polish, concise, mirrors existing pl.json tone.
 *   - ICU placeholders ({count}, {date}, {percent}, plural slots) preserved verbatim.
 *   - Domain vocabulary anchored in existing pl.json terms
 *     (Kontrahent, Faktura, Umowa, Zgodność, Akceptacja, Płatność, Próg, Rabat).
 *   - Proper nouns kept (BACS, SEPA, KSeF, ZATCA, Peppol, DRV, IR35, HMRC, BOE, SDS,
 *     Steuerberater, Skonto).
 *   - UK statute names kept in English (Late Payment of Commercial Debts (Interest) Act 1998).
 *
 * Run once (after which the script may be deleted or kept for future similar passes):
 *   pnpm tsx scripts/apply-pl-translations.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PL_PATH = resolve(process.cwd(), 'apps/web-vite/messages/pl.json');

/**
 * Curated Polish translations for the 193 missing keys.
 * Key format = dotted path into apps/web-vite/messages/en.json.
 */
const PL_TRANSLATIONS: Record<string, string> = {
  // ─── Payments.bacs ──────────────────────────────────────────────────────────
  'Payments.bacs.settingsPageTitle': 'Ustawienia eksportu płatności',
  'Payments.bacs.settingsPageSubtitle':
    'Skonfiguruj dane nadawcy dla brytyjskiego BACS i unijnego SEPA wykorzystywane podczas eksportu przebiegów płatności',
  'Payments.bacs.sectionHeading': 'Nadawca BACS Standard 18 (UK)',
  'Payments.bacs.sunLabel': 'Numer użytkownika usługi (SUN)',
  'Payments.bacs.sunHelper':
    '6-cyfrowy numer Service User Number wydany przez bank sponsorujący BACS',
  'Payments.bacs.sortCodeLabel': 'Sort code nadawcy',
  'Payments.bacs.accountNumberLabel': 'Numer rachunku nadawcy',
  'Payments.bacs.submitterNameLabel': 'Nazwa nadawcy (maks. 18 znaków ASCII)',
  'Payments.bacs.saveSubmitter': 'Zapisz dane nadawcy',
  'Payments.bacs.savedToast': 'Dane nadawcy BACS zapisane',
  'Payments.bacs.featureFlagOffBanner':
    'Eksport BACS jest wyłączony. Włącz go we flagach funkcjonalności, aby korzystać z BACS Std 18.',
  'Payments.bacs.previewCardTitle': 'Podgląd BACS Std 18',
  'Payments.bacs.previewAction': 'Podejrzyj plik BACS',
  'Payments.bacs.downloadAction': 'Pobierz plik BACS',
  'Payments.bacs.transliterationWarning':
    'Przekonwertowano {count} znak(ów) do zestawu znaków BACS. Sprawdź podgląd przed pobraniem.',
  'Payments.bacs.unmappableError':
    'Nie udało się przekonwertować {count} znak(ów) — BACS odrzuci ten plik. Popraw nazwę kontrahenta i spróbuj ponownie.',
  'Payments.bacs.modulusWarningTitle': 'Weryfikacja sort code',
  'Payments.bacs.emptyState':
    'Brak pozycji kwalifikujących się do BACS w tym przebiegu. Dodaj brytyjskich kontrahentów z fakturami w GBP, aby wygenerować plik BACS.',
  'Payments.bacs.submitterNotConfigured':
    'Dane nadawcy BACS są wymagane. Skonfiguruj je w Ustawienia → Płatności.',
  'Payments.bacs.generateFailure':
    'Nie udało się wygenerować pliku BACS. Spróbuj ponownie lub skontaktuj się z pomocą, jeśli problem się powtórzy.',

  // ─── Payments.ukBank ────────────────────────────────────────────────────────
  'Payments.ukBank.sortCodeLabel': 'Brytyjski sort code',
  'Payments.ukBank.sortCodeHelper': '6 cyfr, myślniki dodawane automatycznie',
  'Payments.ukBank.accountNumberLabel': 'Brytyjski numer rachunku',
  'Payments.ukBank.accountNumberHelper': '8 cyfr',
  'Payments.ukBank.validateButton': 'Zweryfikuj sort code',
  'Payments.ukBank.validationSuccess': 'Sort code przeszedł kontrolę modulo',
  'Payments.ukBank.validationWarn':
    'Sort code znajduje się w zakresie wyjątków — kontrola modulo nie jest rozstrzygająca. Kontynuuj, jeśli bank potwierdzi ten rachunek.',
  'Payments.ukBank.validationFail': 'Nieprawidłowy format sort code — wymagane 6 cyfr',

  // ─── Payments.lateInterest ──────────────────────────────────────────────────
  'Payments.lateInterest.sectionHeading': 'Ustawowe odsetki za opóźnienie w płatności',
  'Payments.lateInterest.explanationTooltip':
    'Naliczane zgodnie z Late Payment of Commercial Debts (Interest) Act 1998. Stopa = stopa bazowa Bank of England + 8%, ustalana ostatniego dnia poprzedzającego 6-miesięcznego okresu ustawowego (30 czerwca lub 31 grudnia).',
  'Payments.lateInterest.b2cBanner': 'Odsetki ustawowe nie mają zastosowania (transakcja B2C).',
  'Payments.lateInterest.principalOutstanding': 'Należność główna',
  'Payments.lateInterest.daysOverdue': 'Dni opóźnienia',
  'Payments.lateInterest.rateUsed': 'Zastosowana stopa',
  'Payments.lateInterest.dailyAccrual': 'Naliczanie dzienne',
  'Payments.lateInterest.interestAccrued': 'Naliczone odsetki',
  'Payments.lateInterest.fixedCompensation': 'Rekompensata stała',
  'Payments.lateInterest.totalStatutoryClaim': 'Łączne roszczenie ustawowe',
  'Payments.lateInterest.claimCta': 'Żądaj odsetek ustawowych',
  'Payments.lateInterest.claimSecondaryOption': 'Wystaw roszczenie jako fakturę dodatkową',
  'Payments.lateInterest.claimDialogTitle': 'Zgłosić roszczenie o odsetki ustawowe?',
  'Payments.lateInterest.claimDialogBody':
    'Spowoduje to utrwalenie bieżących kwot odsetek i rekompensaty, wygenerowanie pisma roszczenia w PDF oraz (opcjonalnie) wystawienie faktury dodatkowej na kwotę roszczenia. Migawka jest niezmienna — dalsze naliczanie nie zostanie dodane.',
  'Payments.lateInterest.downloadClaimPdf': 'Pobierz pismo roszczenia',
  'Payments.lateInterest.claimedBanner':
    'Migawka roszczenia z dnia {date} — £{amount}. Dalsze odsetki nie są naliczane od tego roszczenia.',
  'Payments.lateInterest.waiveCta': 'Zrzeknij się odsetek',
  'Payments.lateInterest.waiveDialogTitle': 'Zrzec się odsetek ustawowych?',
  'Payments.lateInterest.waiveReasonPlaceholder':
    'Powód (wymagany, min. 10 znaków) — np. klient wynegocjował ugodę, gest dobrej woli, błąd administracyjny',
  'Payments.lateInterest.waiveTypeInterestOnly': 'Tylko odsetki',
  'Payments.lateInterest.waiveTypeCompensationOnly': 'Tylko rekompensata',
  'Payments.lateInterest.waiveTypeBoth': 'Oba',
  'Payments.lateInterest.waiveConfirm': 'Zrzeknij się odsetek',
  'Payments.lateInterest.waivedBanner': 'Odsetki zrzeczone {date} przez {name}. {revokeLink}',
  'Payments.lateInterest.revokeWaiverCta': 'Cofnij zrzeczenie',
  'Payments.lateInterest.revokeReasonPlaceholder':
    'Powód cofnięcia (wymagany) — np. klient odmówił ugody',

  // ─── Payments.overdueInterest ───────────────────────────────────────────────
  'Payments.overdueInterest.columnHeader': 'Odsetki za opóźnienie',
  'Payments.overdueInterest.filterChip': 'Przeterminowane',
  'Payments.overdueInterest.emptyState': 'Brak przeterminowanych faktur B2B w Wielkiej Brytanii',

  // ─── Payments.dashboardTile ─────────────────────────────────────────────────
  'Payments.dashboardTile.title': 'Przeterminowane należności (UK)',
  'Payments.dashboardTile.subline':
    '{principal} pozostaje do zapłaty — +{interest} naliczonych odsetek',
  'Payments.dashboardTile.clickThrough': 'Zobacz przeterminowane faktury →',

  // ─── Payments.skonto ────────────────────────────────────────────────────────
  'Payments.skonto.sectionHeading': 'Rabat za wcześniejszą płatność (Skonto)',
  'Payments.skonto.useDefaultPill':
    'Domyślne dla kontrahenta: {percent}% / {discountDays} dni / netto {netDays} dni',
  'Payments.skonto.customizeToggle': 'Dostosuj dla tej faktury',
  'Payments.skonto.discountPercentLabel': 'Rabat %',
  'Payments.skonto.discountPeriodLabel': 'Okres rabatu (dni)',
  'Payments.skonto.netPeriodLabel': 'Okres netto (dni)',
  'Payments.skonto.previewLineEn':
    'Rabat {percent}% przy płatności w ciągu {discountDays} dni, w przeciwnym razie netto {netDays} dni',
  'Payments.skonto.saveTerm': 'Zapisz warunek Skonto',
  'Payments.skonto.deleteInvoiceSpecific': 'Przywróć domyślne dla kontrahenta',
  'Payments.skonto.validationPercentRange': 'Rabat musi mieścić się w zakresie od 0 do 50%',
  'Payments.skonto.validationDaysOrdering': 'Okres rabatu musi być krótszy niż okres netto',
  'Payments.skonto.eligibleBanner':
    'Zaoszczędź {discountAmount} przy zapłacie do {date} — kwota po rabacie {discountedTotal}',
  'Payments.skonto.windowExpiredBanner': 'Okno rabatowe wygasło {date}',
  'Payments.skonto.takenBanner':
    'Skonto zastosowane przy płatności: zaoszczędzono {discountAmount} dnia {paidDate}',
  'Payments.skonto.notTakenBanner':
    'Zapłacono po upływie okna rabatowego — Skonto nie zostało zastosowane',
  'Payments.skonto.defaultSectionHeading': 'Domyślny rabat za wcześniejszą płatność',
  'Payments.skonto.defaultHelper':
    'Stosowany automatycznie do nowych niemieckich faktur dla tego kontrahenta. Można nadpisać dla pojedynczej faktury.',
  'Payments.skonto.saveDefault': 'Zapisz domyślne Skonto',
  'Payments.skonto.clearDefault': 'Usuń domyślne Skonto',
  'Payments.skonto.lineCheckboxLabel': 'Zastosuj Skonto {percent}% — oszczędność {discountAmount}',
  'Payments.skonto.outsideWindowHelper': 'Okno rabatowe wygasło ({date}) — obowiązuje pełna kwota',
  'Payments.skonto.snapshotToast':
    'Skonto zastosowane do przebiegu — {count} faktur(a) z rabatem, zaoszczędzono {totalSavings}',
  'Payments.skonto.columnHeader': 'Skonto',
  'Payments.skonto.emptyCell': '—',
  'Payments.skonto.cellFormat': '{percent}% {discountDays}/{netDays}',

  // ─── Legal.terms.sections.softwareNotLegalAdvice ────────────────────────────
  'Legal.terms.sections.softwareNotLegalAdvice.heading':
    'Oprogramowanie — nie stanowi porady prawnej ani profesjonalnej',
  'Legal.terms.sections.softwareNotLegalAdvice.subheading':
    'Istotne ograniczenia dotyczące charakteru wyników platformy',

  // ─── Legal.SdsApproval ──────────────────────────────────────────────────────
  'Legal.SdsApproval.gateTitle': 'Zatwierdzenie klienta wymagane przed wygenerowaniem SDS',
  'Legal.SdsApproval.clientNameLabel': 'Nazwa klienta',
  'Legal.SdsApproval.clientNamePlaceholder': 'Wprowadź nazwę firmy końcowego zleceniodawcy',
  'Legal.SdsApproval.confirmApproval': 'Potwierdź zatwierdzenie i kontynuuj',
  'Legal.SdsApproval.confirmingApproval': 'Potwierdzanie...',
  'Legal.SdsApproval.approved': 'Zatwierdzone — możesz teraz wygenerować SDS',

  // ─── Legal.DrvUpload ────────────────────────────────────────────────────────
  'Legal.DrvUpload.uploadDecisionLetter': 'Prześlij pismo decyzyjne DRV',
  'Legal.DrvUpload.uploading': 'Przesyłanie...',
  'Legal.DrvUpload.uploadedAt': 'Przesłano {date} przez {user}',
  'Legal.DrvUpload.downloadLetter': 'Pobierz pismo decyzyjne',
  'Legal.DrvUpload.fileTooLarge': 'Plik za duży (maks. 10 MB)',

  // ─── Ir35Chain ──────────────────────────────────────────────────────────────
  'Ir35Chain.title': 'Łańcuch IR35',
  'Ir35Chain.subtitle':
    'Śledź łańcuch klient → agencja → PSC → wykonawca oraz dostarczenie/potwierdzenie SDS dla każdego ogniwa.',
  'Ir35Chain.emptyState': 'Brak uczestników łańcucha.',
  'Ir35Chain.addParticipant': 'Dodaj uczestnika',
  'Ir35Chain.addParticipantTitle': 'Dodaj uczestnika łańcucha',
  'Ir35Chain.addParticipantHint':
    'Dodaj agencję lub spółkę osobistą (PSC) do łańcucha tego zlecenia.',
  'Ir35Chain.displayName': 'Nazwa wyświetlana',
  'Ir35Chain.roleLabel': 'Rola',
  'Ir35Chain.contactEmail': 'E-mail kontaktowy',
  'Ir35Chain.cancel': 'Anuluj',
  'Ir35Chain.save': 'Zapisz',
  'Ir35Chain.saving': 'Zapisywanie…',
  'Ir35Chain.confirm': 'Potwierdź',
  'Ir35Chain.noteLabel': 'Notatka (opcjonalna)',
  'Ir35Chain.markDelivered': 'Oznacz jako dostarczone',
  'Ir35Chain.markAcknowledged': 'Oznacz jako potwierdzone',
  'Ir35Chain.markDeliveredTitle': 'Oznacz SDS jako dostarczone',
  'Ir35Chain.markAcknowledgedTitle': 'Oznacz SDS jako potwierdzone',
  'Ir35Chain.remove': 'Usuń',
  'Ir35Chain.notDelivered': 'Nie dostarczone',
  'Ir35Chain.notAcknowledged': 'Nie potwierdzone',
  'Ir35Chain.columnRole': 'Rola',
  'Ir35Chain.columnDisplayName': 'Nazwa',
  'Ir35Chain.columnDelivered': 'Dostarczone',
  'Ir35Chain.columnAcknowledged': 'Potwierdzone',
  'Ir35Chain.columnActions': 'Akcje',
  'Ir35Chain.role.CLIENT': 'Klient',
  'Ir35Chain.role.AGENCY': 'Agencja',
  'Ir35Chain.role.PSC': 'PSC',
  'Ir35Chain.role.WORKER': 'Wykonawca',

  // ─── OtherClientAttestation ─────────────────────────────────────────────────
  'OtherClientAttestation.title': 'Oświadczenie o innych klientach',
  'OtherClientAttestation.subtitle':
    'Potwierdź, czy ten kontrahent współpracuje z innymi klientami — wykorzystywane do wsparcia pakietu obrony audytowej DRV.',
  'OtherClientAttestation.statementLabel': 'Oświadczenie',
  'OtherClientAttestation.statementHint':
    'Opisz swoich pozostałych aktywnych klientów. Maksymalnie {max} znaków.',
  'OtherClientAttestation.signedNameLabel': 'Imię i nazwisko podpisującego',
  'OtherClientAttestation.submit': 'Złóż oświadczenie',
  'OtherClientAttestation.update': 'Zaktualizuj oświadczenie',
  'OtherClientAttestation.saving': 'Zapisywanie…',

  // ─── Classification.documents ───────────────────────────────────────────────
  'Classification.documents.title': 'Dokumenty klasyfikacji',
  'Classification.documents.subtitle':
    'Wygeneruj wymagane prawem oświadczenie o statusie (SDS) oraz pakiet obrony audytowej.',
  'Classification.documents.generateSds': 'Wygeneruj SDS',
  'Classification.documents.generateDisabled':
    'Ukończ ocenę klasyfikacji IR35, aby wygenerować SDS.',
  'Classification.documents.generateDrvBundle': 'Wygeneruj pakiet obrony DRV',
  'Classification.documents.drvDisabledNeedAssessment':
    'Ukończ ocenę klasyfikacji Scheinselbständigkeit, aby wygenerować pakiet obrony DRV.',
  'Classification.documents.drvDisabledNeedAttestation':
    'Zarejestruj poniżej oświadczenie o innych klientach przed wygenerowaniem pakietu obrony DRV.',
  'Classification.documents.generating': 'Generowanie…',
  'Classification.documents.documentHistory': 'Historia dokumentów',
  'Classification.documents.emptyState': 'Nie wygenerowano jeszcze żadnych dokumentów.',
  'Classification.documents.download': 'Pobierz',
  'Classification.documents.generatedOn': 'Wygenerowano {date}',
  'Classification.documents.byteSize': '{kb} KB',
  'Classification.documents.toastSdsGenerated': 'SDS wygenerowane — otwieram pobieranie…',
  'Classification.documents.errorGenericTitle': 'Nie udało się wygenerować dokumentu',
  'Classification.documents.kindSds': 'Oświadczenie o statusie (SDS)',
  'Classification.documents.kindDrvDefenseBundle': 'Pakiet obrony audytowej DRV',

  // ─── Classification.AdvisoryBanner ──────────────────────────────────────────
  'Classification.AdvisoryBanner.label': 'Informacja prawna',

  // ─── Classification.ExpertHelp ──────────────────────────────────────────────
  'Classification.ExpertHelp.title': 'Uzyskaj pomoc eksperta',
  'Classification.ExpertHelp.subtitle':
    'Skontaktuj się z wykwalifikowanymi doradcami w sprawach klasyfikacji.',
  'Classification.ExpertHelp.orgAdviser.title': 'Doradca Twojej organizacji',
  'Classification.ExpertHelp.orgAdviser.description':
    'Twoja organizacja wyznaczyła doradcę do spraw klasyfikacji.',
  'Classification.ExpertHelp.orgAdviser.contact': 'Skontaktuj się z doradcą',
  'Classification.ExpertHelp.gb.title': 'Doradcy IR35 (Wielka Brytania)',
  'Classification.ExpertHelp.gb.description':
    'Skontaktuj się z doradcami podatkowymi akredytowanymi przez CIOT lub ATT, specjalizującymi się w IR35.',
  'Classification.ExpertHelp.gb.ciot.title': 'CIOT — wyszukiwarka doradców podatkowych',
  'Classification.ExpertHelp.gb.ciot.description':
    'Katalog członków Chartered Institute of Taxation',
  'Classification.ExpertHelp.gb.hmrc.title': 'HMRC Employment Status Manual',
  'Classification.ExpertHelp.gb.hmrc.description':
    'Oficjalne wytyczne HMRC dotyczące IR35 i statusu zatrudnienia',
  'Classification.ExpertHelp.de.title': 'Steuerberater für Scheinselbständigkeit',
  'Classification.ExpertHelp.de.description':
    'Spezialisierte Beratung zur Scheinselbständigkeit und DRV-Statusfeststellung.',
  'Classification.ExpertHelp.de.steuerberater.title': 'Steuerberaterkammer — Mitgliedssuche',
  'Classification.ExpertHelp.de.steuerberater.description':
    'Regionale Steuerberaterkammern der Bundessteuerberaterkammer',
  'Classification.ExpertHelp.de.drv.title': 'DRV Statusfeststellungsverfahren',
  'Classification.ExpertHelp.de.drv.description':
    'Offizielle DRV-Informationen zum Statusfeststellungsverfahren nach § 7a SGB IV',

  // ─── Admin.BoeRate ──────────────────────────────────────────────────────────
  'Admin.BoeRate.pageTitle': 'Historia stopy bazowej Bank of England',
  'Admin.BoeRate.pageSubtitle':
    'Dane referencyjne zasilające obliczenia ustawowych odsetek za opóźnienie w UK',
  'Admin.BoeRate.colEffectiveFrom': 'Obowiązuje od',
  'Admin.BoeRate.colRatePercent': 'Stopa %',
  'Admin.BoeRate.colSource': 'Źródło',
  'Admin.BoeRate.colRecordedBy': 'Zapisane przez',
  'Admin.BoeRate.colRecordedAt': 'Zapisane',
  'Admin.BoeRate.colNotes': 'Uwagi',
  'Admin.BoeRate.sourceBoeApi': 'API BOE',
  'Admin.BoeRate.sourceManual': 'Ręcznie',
  'Admin.BoeRate.addCta': '+ Dodaj stopę',
  'Admin.BoeRate.addDialogTitle': 'Dodaj wpis stopy bazowej BoE',
  'Admin.BoeRate.deleteDialogTitle': 'Usunąć wpis stopy BoE?',
  'Admin.BoeRate.deleteDialogBody':
    'Usunięcie historycznej stopy zmienia obliczenia odsetek dla wszystkich faktur, które stały się przeterminowane w okresie jej obowiązywania. Kontynuuj wyłącznie wtedy, gdy wpis został wprowadzony błędnie.',
  'Admin.BoeRate.pollerSuccess':
    'Ostatnie odpytanie API BOE: {date} — stopa bez zmian / zapisano nową stopę {percent}%',
  'Admin.BoeRate.pollerFailure':
    'Ostatnie odpytanie API BOE nie powiodło się dnia {date}. Wpis ręczny nadal możliwy; mechanizm ponowi próbę przy kolejnym zaplanowanym uruchomieniu.',

  // ─── Admin.ClassificationEngineFlag ─────────────────────────────────────────
  'Admin.ClassificationEngineFlag.title': 'Status flagi Classification Engine',
  'Admin.ClassificationEngineFlag.subtitle':
    'Status wyłącznika module.classification-engine oraz rejestr zatwierdzeń klauzul.',
  'Admin.ClassificationEngineFlag.appSideValue':
    'Wartość po stronie aplikacji (co widzą użytkownicy)',
  'Admin.ClassificationEngineFlag.signoffRegistry': 'Rejestr zatwierdzeń',
  'Admin.ClassificationEngineFlag.pendingGate':
    'Flaga włączona w Unleash, ale zablokowana w aplikacji — {count} klauzul(a) OCZEKUJĄCYCH.',
  'Admin.ClassificationEngineFlag.pendingGateResolution':
    'Rozwiąż, przesyłając PR aktualizujący packages/validators/src/legal/signoff-registry.json',
};

/**
 * Walks the dotted path inside `obj`, creating intermediate plain objects
 * as needed, and sets the leaf to `value`. Throws if an intermediate
 * segment exists and is NOT a plain object (would silently clobber data).
 */
function setDeep(obj: Record<string, unknown>, dotted: string, value: string): void {
  const segments = dotted.split('.');
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const existing = cursor[seg];
    if (existing === undefined) {
      const next: Record<string, unknown> = {};
      cursor[seg] = next;
      cursor = next;
    } else if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) {
      cursor = existing as Record<string, unknown>;
    } else {
      throw new Error(
        `Cannot set ${dotted}: intermediate segment "${seg}" is not an object (got ${typeof existing}).`,
      );
    }
  }
  const leaf = segments[segments.length - 1]!;
  cursor[leaf] = value;
}

function main(): void {
  const raw = readFileSync(PL_PATH, 'utf-8');
  const pl = JSON.parse(raw) as Record<string, unknown>;

  let applied = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(PL_TRANSLATIONS)) {
    // Defensive: if the leaf already exists, leave it alone (idempotent rerun).
    const segs = key.split('.');
    let cursor: unknown = pl;
    let found = true;
    for (const seg of segs) {
      if (
        cursor !== null &&
        typeof cursor === 'object' &&
        !Array.isArray(cursor) &&
        seg in (cursor as Record<string, unknown>)
      ) {
        cursor = (cursor as Record<string, unknown>)[seg];
      } else {
        found = false;
        break;
      }
    }
    if (found) {
      skipped++;
      continue;
    }
    setDeep(pl, key, value);
    applied++;
  }

  const serialized = JSON.stringify(pl, null, 2) + '\n';
  writeFileSync(PL_PATH, serialized, 'utf-8');

  // Use process.stdout to avoid console.* lint rule (this is a one-shot script,
  // not application source).
  process.stdout.write(
    `Applied ${applied} translation(s), skipped ${skipped} pre-existing key(s).\n`,
  );
  process.stdout.write(`Total in map: ${Object.keys(PL_TRANSLATIONS).length}\n`);
}

main();
