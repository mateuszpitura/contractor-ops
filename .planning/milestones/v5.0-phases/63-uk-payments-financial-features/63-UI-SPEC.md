---
phase: 63
slug: uk-payments-financial-features
status: approved
shadcn_initialized: true
preset: base-nova
created: 2026-04-14
reviewed_at: 2026-04-14
---

# Phase 63 — UI Design Contract

> Visual and interaction contract for the UK Payments & Financial Features surfaces: BACS Std 18 export preview + settings (PAY-01), statutory late-payment-interest surfaces on UK B2B invoices + dashboard tile (PAY-06), Skonto early-payment-discount configuration + PaymentRun application (PAY-07). Pre-populated from the project's "Precision Craft" design system encoded in `apps/web/src/app/globals.css` and from `63-CONTEXT.md` decisions D-06, D-10, D-16, D-24, D-25. Reuses Phase 60–62 component patterns verbatim.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | base-nova (per `apps/web/components.json`) |
| Component library | shadcn/ui (Radix primitives) |
| Icon library | lucide-react |
| Font | Outfit (body/sans), Bricolage Grotesque (display), JetBrains Mono (mono) — already loaded via `--font-sans`, `--font-display`, `--font-mono` |

**No new fonts, no new colors, no new spacing tokens are introduced by Phase 63.** All surfaces consume the existing "Precision Craft" tokens defined in `apps/web/src/app/globals.css` (light + dark mode bridged through `@theme inline`). The BACS file-preview block is the only new monospace-heavy surface, and it reuses the existing `--font-mono` token plus the `<pre>` patterns already used in the Phase 62 XML-preview pane.

---

## Spacing Scale

Phase 63 uses the project-wide 4-point scale (Tailwind defaults bridged in `globals.css`). All multiples of 4.

| Token | Value | Usage in Phase 63 |
|-------|-------|-------------------|
| xs | 4px (`gap-1`, `p-1`) | Icon-to-label gaps inside status chips ("Overdue" / "Discount window expired" / "Eligible for Skonto"), masked-bank-field label spacing |
| sm | 8px (`gap-2`, `p-2`) | Form-field label → input gaps inside the settings page, filter-chip row gaps on the invoices list (Overdue / All / Unpaid) |
| md | 16px (`gap-4`, `p-4`) | Card content padding (Late-Interest section, Skonto section, BACS Preview card), Dialog body padding, admin-table row padding |
| lg | 24px (`gap-6`, `p-6`) | Section padding inside the invoice detail page (Late-Interest pane, Skonto pane), settings page form-section padding |
| xl | 32px (`gap-8`, `p-8`) | Page header → first content block on `/settings/payments/`, `/admin/boe-rate/`, and invoice detail Late-Interest region top margin |
| 2xl | 48px (`gap-12`, `mt-12`) | Empty-state vertical spacing on BACS preview ("No BACS-eligible items in this run"), Late-Interest empty state ("No overdue UK B2B invoices"), admin BoE-rate empty table |
| 3xl | 64px (`gap-16`) | Reserved for marketing surfaces — not used in Phase 63 |

**Exceptions:** none. The BACS-preview file-contents block uses `p-4` padding around an internal `<pre>` that has its own inline padding = 0 (the monospace content already carries its own visual margin via fixed-width columns). Form inputs on the settings page reuse existing `h-9` (36px = 9×4) button/input heights shipped by shadcn/ui.

---

## Typography

Inherits the project's `--text-*` fluid scale (clamp-based responsive sizes) from `globals.css`. Phase 63 declares which roles map to which tokens — no new sizes or weights are introduced.

| Role | Token | Resolved size (clamp range) | Weight | Line height | Used for |
|------|-------|------------------------------|--------|-------------|----------|
| Body | `text-base` | 0.875rem → 0.9375rem (14–15px) | 400 (`font-normal`) | 1.5rem (24px) | All paragraph copy: Late-Interest explanation text, Skonto "save if paid by" copy, settings-page form-field helper text, admin BoE-rate description cells |
| Label | `text-sm` | 0.8125rem → 0.875rem (13–14px) | 500 (`font-medium`) | 1.25rem (20px) | Field labels ("Sort code", "Account number", "Service user number", "Discount %", "Discount period", "Net period"), table column headers, filter-chip labels, badge text |
| Heading | `text-xl` | 1.125rem → 1.375rem (18–22px) | 600 (`font-semibold`, `font-display`) | 1.75rem (28px) | Page titles ("Payment export settings", "BoE base-rate history"), Card titles ("Statutory late-payment interest", "Early-payment discount (Skonto)", "BACS Std 18 preview") |
| Display | `text-2xl` | 1.375rem → 1.875rem (22–30px) | 700 (`font-display`) | 2.25rem (36px) | Dashboard tile headline amount ("£12,340.56 overdue — +£284.12 interest"), invoice-detail claim-summary headline ("£X,XXX.XX statutory claim"), empty-state headings |

Mono (`font-mono`) is reserved for:
- The entire BACS Std 18 file-preview block (fixed-width content is semantically load-bearing).
- Masked bank fields in settings (`XX-XX-34`, `XXXX-5678`) and masked submitter fields.
- Sort codes shown in modulus-check warnings (`12-34-56`).
- R2 key fragments and SHA-256 prefixes in BACS export history (e.g. `BACS-R123-a7f2e14b.txt`).
- Claim PDF reference numbers.
- BoE rate effective dates shown in the admin table when copied to clipboard.

Tabular numerals (`font-variant-numeric: tabular-nums`) are used for every money column (invoice lists, dashboard tile, late-interest breakdown, Skonto discount amounts, BoE rate percentages in the admin table) — already wired via `globals.css`.

---

## Color

Phase 63 inherits the 60/30/10 distribution from the existing dashboard. Accent (Deep Teal `--primary` = oklch(0.44 0.145 178)) is reserved for primary CTAs and active filter chips ONLY.

| Role | Token | Usage in Phase 63 |
|------|-------|-------------------|
| Dominant (60%) | `--background` (warm off-white oklch(0.985 0.003 85)) / `--surface-0` | Page background of `/settings/payments/`, `/admin/boe-rate/`, invoice-detail Late-Interest + Skonto regions |
| Secondary (30%) | `--card` (pure white) / `--surface-1` / `--sidebar` | Card surfaces (BACS-preview card, Late-Interest card, Skonto card, BoE-rate table, settings form sections), sidebar entries ("Imports", "Settings → Payments", "Admin → BoE rate") |
| Accent (10%) | `--primary` (Deep Teal) | Primary CTAs ("Download BACS file", "Save submitter details", "Validate sort code", "Claim statutory interest", "Issue as secondary invoice", "Apply Skonto discount to run", "Save Skonto term", "Save BoE rate"), active filter chip background ("Overdue"), active sidebar nav entries, focus rings (`--ring`) |
| Destructive | `--destructive` (refined crimson oklch(0.58 0.23 18)) | "Waive interest" confirm button (AlertDialog), "Revoke waiver" button, "Delete BoE rate row" (admin, AlertDialog), inline form errors (sort-code regex fail, discount-percent out of range, account-number regex fail) |

Accent is reserved for (explicit list — never "all interactive elements"):

- Primary CTAs in the new flows: "Download BACS file", "Preview BACS file", "Save submitter details", "Save UK bank details" (on ContractorBillingProfile edit), "Save Skonto term", "Apply Skonto discount to run", "Claim statutory interest", "Issue as secondary invoice", "Download claim letter PDF", "Save BoE rate" (admin).
- Active state of filter chips on the invoices list ("Overdue" chip when filter is engaged).
- The active sidebar nav entries ("Payments" under settings, "BoE rate" under admin).
- Focus rings on all interactive elements (inherits from `--ring`).

Status pill colors map to existing semantic tokens (no new colors):

| Late-Interest status | Background | Foreground | Token |
|---------------------|------------|------------|-------|
| `NOT_APPLICABLE` (B2C / non-GB) | `bg-muted` | `text-muted-foreground` | `bg-muted text-muted-foreground` |
| `ACCRUING` (overdue, unwaived) | warning-tinted (`oklch(0.7 0.16 65 / 12%)`) | warning | `bg-warning/10 text-warning` |
| `CLAIMED` (snapshot written) | info-tinted (`oklch(0.55 0.18 260 / 12%)`) | info | `bg-info/10 text-info` |
| `WAIVED` | `bg-muted` | `text-muted-foreground` with strike-through on amount | `bg-muted text-muted-foreground line-through` |
| `PAID` | success-tinted (`oklch(0.55 0.17 150 / 12%)`) | success | `bg-success/10 text-success` |

| Skonto eligibility state | Background | Foreground | Token |
|--------------------------|------------|------------|-------|
| `ELIGIBLE` (within window, unpaid) | success-tinted | success | `bg-success/10 text-success` |
| `PAST_DISCOUNT_WINDOW` | `bg-muted` | `text-muted-foreground` | `bg-muted text-muted-foreground` |
| `NO_SKONTO_CONFIGURED` | *(not rendered — section hidden entirely)* | — | — |
| `TAKEN_AT_PAYMENT` (SkontoSnapshot → eligible + discount applied) | success-tinted | success | `bg-success/10 text-success` with `CheckCircle2` icon |
| `NOT_TAKEN_AT_PAYMENT` (SkontoSnapshot → missed window) | `bg-muted` | `text-muted-foreground` | `bg-muted text-muted-foreground` |

| BACS modulus check | Background | Foreground |
|--------------------|------------|------------|
| `VALID` | success-tinted | success |
| `WARN` (exception category — non-blocking) | warning-tinted | warning |
| `INVALID` (regex fail — hard block) | destructive-tinted | destructive |

| BACS transliteration warning | Background | Foreground |
|------------------------------|------------|------------|
| 0 replacements | *(banner not rendered)* | — |
| 1–N replacements | warning-tinted | warning (banner shows "{count} character(s) transliterated — review before download") |
| Any `?` replacement | destructive-tinted | destructive (banner shows "{count} unmappable character(s) — BACS will reject") |

These reuse the same token vocabulary as `apps/web/src/components/invoices/einvoice-status-cell.tsx` (Phase 61), `intake-status-pill.tsx` (Phase 62), and `band-chip.tsx` (Phase 60).

---

## Copywriting Contract

All strings are added to `apps/web/messages/{en,de,gb}.json` under a new `Payments` namespace (BACS + Late-Interest + Skonto chrome) plus a new `Admin.BoeRate` namespace. Locked statutory phrases (Skonto DE description + LPCDA claim footer) live in `packages/validators/src/legal/de.ts` (D-22) and `packages/validators/src/legal/gb.ts` (NEW, D-17) with CI guards (Phase 56 pattern).

| Element | EN copy | DE copy | GB copy |
|---------|---------|---------|---------|
| **Settings → Payments page** | | | |
| Page title | "Payment export settings" | "Einstellungen für Zahlungsexporte" | "Payment export settings" |
| Page subtitle | "Configure UK BACS and EU SEPA submitter details used when exporting payment runs" | "UK-BACS- und EU-SEPA-Absenderdaten konfigurieren, die beim Export von Zahlungsläufen verwendet werden" | "Configure UK BACS and EU SEPA submitter details used when exporting payment runs" |
| BACS section heading | "UK BACS Standard 18 submitter" | "UK-BACS-Std-18-Absender" | "UK BACS Standard 18 submitter" |
| Service user number label | "Service user number (SUN)" | "Service User Number (SUN)" | "Service user number (SUN)" |
| Service user number helper | "6-digit BACS Service User Number issued by your sponsor bank" | "6-stellige BACS Service User Number, ausgestellt von Ihrer Sponsorbank" | "6-digit BACS Service User Number issued by your sponsor bank" |
| Submitter sort code label | "Originating sort code" | "Absender-Sort-Code" | "Originating sort code" |
| Submitter account number label | "Originating account number" | "Absender-Kontonummer" | "Originating account number" |
| Submitter name label | "Submitter name (max 18 ASCII chars)" | "Absendername (max. 18 ASCII-Zeichen)" | "Submitter name (max 18 ASCII chars)" |
| Save button | "Save submitter details" | "Absenderdaten speichern" | "Save submitter details" |
| Saved toast | "BACS submitter details saved" | "BACS-Absenderdaten gespeichert" | "BACS submitter details saved" |
| Feature-flag off banner | "BACS export is disabled. Enable it in feature flags to use BACS Std 18." | "BACS-Export ist deaktiviert. Aktivieren Sie ihn in den Feature Flags, um BACS Std 18 zu verwenden." | "BACS export is disabled. Enable it in feature flags to use BACS Std 18." |
| **ContractorBillingProfile — UK bank details** | | | |
| UK sort code label | "UK sort code" | "UK-Sort-Code" | "UK sort code" |
| UK sort code helper | "6 digits, hyphens added automatically" | "6 Ziffern, Bindestriche werden automatisch hinzugefügt" | "6 digits, hyphens added automatically" |
| UK account number label | "UK account number" | "UK-Kontonummer" | "UK account number" |
| UK account number helper | "8 digits" | "8 Ziffern" | "8 digits" |
| Validate button | "Validate sort code" | "Sort-Code prüfen" | "Validate sort code" |
| Validation success | "Sort code passed modulus check" | "Sort-Code hat die Modulo-Prüfung bestanden" | "Sort code passed modulus check" |
| Validation warn (exception) | "Sort code is in an exception range — modulus check not decisive. Continue if your bank confirms this account." | "Sort-Code liegt in einem Ausnahmebereich — Modulo-Prüfung nicht eindeutig. Fortfahren, wenn Ihre Bank das Konto bestätigt." | "Sort code is in an exception range — modulus check not decisive. Continue if your bank confirms this account." |
| Validation fail (format) | "Sort code format invalid — 6 digits required" | "Sort-Code-Format ungültig — 6 Ziffern erforderlich" | "Sort code format invalid — 6 digits required" |
| **PaymentRun detail — BACS preview** | | | |
| Card title | "BACS Std 18 preview" | "BACS-Std-18-Vorschau" | "BACS Std 18 preview" |
| Preview action | "Preview BACS file" | "BACS-Datei-Vorschau" | "Preview BACS file" |
| Download action | "Download BACS file" | "BACS-Datei herunterladen" | "Download BACS file" |
| Transliteration warning (N>0, no `?`) | "{count} character(s) transliterated to BACS character set. Review the preview before downloading." | "{count} Zeichen in den BACS-Zeichensatz umgewandelt. Prüfen Sie die Vorschau vor dem Download." | "{count} character(s) transliterated to BACS character set. Review the preview before downloading." |
| Unmappable-character error | "{count} character(s) could not be transliterated — BACS will reject this file. Edit the contractor name(s) and try again." | "{count} Zeichen konnten nicht umgewandelt werden — BACS lehnt diese Datei ab. Passen Sie den/die Auftragnehmer-Name(n) an und versuchen Sie es erneut." | "{count} character(s) could not be transliterated — BACS will reject this file. Edit the contractor name(s) and try again." |
| Modulus warning list title | "Sort-code checks" | "Sort-Code-Prüfungen" | "Sort-code checks" |
| Empty state (no BACS items) | "No BACS-eligible items in this run. Add UK contractors with GBP invoices to generate a BACS file." | "Keine BACS-fähigen Posten in diesem Lauf. UK-Auftragnehmer mit GBP-Rechnungen hinzufügen, um eine BACS-Datei zu erzeugen." | "No BACS-eligible items in this run. Add UK contractors with GBP invoices to generate a BACS file." |
| Submitter-not-configured error | "BACS submitter details are required. Configure them in Settings → Payments." | "BACS-Absenderdaten sind erforderlich. Konfigurieren Sie diese unter Einstellungen → Zahlungen." | "BACS submitter details are required. Configure them in Settings → Payments." |
| Generate-failure toast | "BACS generation failed. Please try again or contact support if the problem persists." | "BACS-Erstellung fehlgeschlagen. Bitte erneut versuchen oder den Support kontaktieren, falls das Problem weiterhin besteht." | "BACS generation failed. Please try again or contact support if the problem persists." |
| **Invoice detail — Late-Interest section** | | | |
| Section heading | "Statutory late-payment interest" | *(not displayed — DE invoices do not carry LPCDA interest)* | "Statutory late-payment interest" |
| Explanation tooltip | "Calculated under the Late Payment of Commercial Debts (Interest) Act 1998. Rate = Bank of England base rate + 8%, fixed on the last day of the preceding 6-month statutory period (30 June or 31 December)." | — | "Calculated under the Late Payment of Commercial Debts (Interest) Act 1998. Rate = Bank of England base rate + 8%, fixed on the last day of the preceding 6-month statutory period (30 June or 31 December)." |
| B2C not-applicable banner | *(not rendered for non-GB)* | — | "Statutory interest not applicable (B2C transaction)." |
| Status row labels | "Principal outstanding" / "Days overdue" / "Rate used" / "Daily accrual" / "Interest accrued" / "Fixed compensation" / "Total statutory claim" | — | "Principal outstanding" / "Days overdue" / "Rate used" / "Daily accrual" / "Interest accrued" / "Fixed compensation" / "Total statutory claim" |
| Claim CTA | "Claim statutory interest" | — | "Claim statutory interest" |
| Claim secondary option | "Issue claim as a secondary invoice" | — | "Issue claim as a secondary invoice" |
| Claim confirmation dialog title | "Claim statutory interest?" | — | "Claim statutory interest?" |
| Claim confirmation dialog body | "This will snapshot the current interest + compensation amounts, generate a PDF claim letter, and (optionally) issue a secondary invoice for the claim amount. The snapshot is immutable — further accrual will not be added." | — | "This will snapshot the current interest + compensation amounts, generate a PDF claim letter, and (optionally) issue a secondary invoice for the claim amount. The snapshot is immutable — further accrual will not be added." |
| Download claim PDF | "Download claim letter" | — | "Download claim letter" |
| Claimed banner | "Claim snapshot taken {date} — £{amount}. Further interest does not accrue on this claim." | — | "Claim snapshot taken {date} — £{amount}. Further interest does not accrue on this claim." |
| Waive CTA | "Waive interest" | — | "Waive interest" |
| Waive dialog title | "Waive statutory interest?" | — | "Waive statutory interest?" |
| Waive reason placeholder | "Reason (required, min 10 chars) — e.g., customer negotiated settlement, goodwill gesture, admin error" | — | "Reason (required, min 10 chars) — e.g., customer negotiated settlement, goodwill gesture, admin error" |
| Waive type options | "Interest only" / "Compensation only" / "Both" | — | "Interest only" / "Compensation only" / "Both" |
| Waive confirm | "Waive interest" | — | "Waive interest" |
| Waived banner | "Interest waived on {date} by {name}. {revoke link}" | — | "Interest waived on {date} by {name}. {revoke link}" |
| Revoke waiver CTA | "Revoke waiver" | — | "Revoke waiver" |
| Revoke dialog reason placeholder | "Reason for revoking (required) — e.g., customer refused settlement" | — | "Reason for revoking (required) — e.g., customer refused settlement" |
| **Invoices list — Overdue interest column + filter** | | | |
| Column header | "Overdue interest" | "Verzugszinsen" | "Overdue interest" |
| Filter chip | "Overdue" | "Überfällig" | "Overdue" |
| Empty (no overdue) | "No overdue UK B2B invoices" | "Keine überfälligen UK-B2B-Rechnungen" | "No overdue UK B2B invoices" |
| **Dashboard tile — Overdue receivables** | | | |
| Tile title | "Overdue receivables (UK)" | "Überfällige Forderungen (UK)" | "Overdue receivables (UK)" |
| Tile subline | "{principal} outstanding — +{interest} interest accrued" | "{principal} ausstehend — +{interest} Zinsen aufgelaufen" | "{principal} outstanding — +{interest} interest accrued" |
| Tile click-through | "View overdue invoices →" | "Überfällige Rechnungen ansehen →" | "View overdue invoices →" |
| **Invoice create/edit — Skonto section** | | | |
| Section heading | "Early-payment discount (Skonto)" | "Skonto" | "Early-payment discount (Skonto)" |
| Use-default pill | "Using contractor default: {percent}% / {discountDays} days / net {netDays} days" | "Auftragnehmer-Voreinstellung: {percent}% / {discountDays} Tage / netto {netDays} Tage" | "Using contractor default: {percent}% / {discountDays} days / net {netDays} days" |
| Customize toggle | "Customize for this invoice" | "Für diese Rechnung anpassen" | "Customize for this invoice" |
| Discount percent label | "Discount %" | "Skonto-Prozentsatz" | "Discount %" |
| Discount period label | "Discount period (days)" | "Skonto-Frist (Tage)" | "Discount period (days)" |
| Net period label | "Net period (days)" | "Netto-Frist (Tage)" | "Net period (days)" |
| Preview line (locked DE phrase) | — | "{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage" *(locked — from `packages/validators/src/legal/de.ts`)* | — |
| Preview line (EN locale, informational) | "{percent}% discount if paid within {discountDays} days, otherwise net {netDays} days" | — | "{percent}% discount if paid within {discountDays} days, otherwise net {netDays} days" |
| Save term | "Save Skonto term" | "Skonto-Bedingung speichern" | "Save Skonto term" |
| Delete invoice-specific term | "Reset to contractor default" | "Auf Auftragnehmer-Voreinstellung zurücksetzen" | "Reset to contractor default" |
| Validation — percent out of range | "Discount must be between 0 and 50%" | "Skonto muss zwischen 0 und 50% liegen" | "Discount must be between 0 and 50%" |
| Validation — days ordering | "Discount period must be shorter than net period" | "Skonto-Frist muss kürzer als Netto-Frist sein" | "Discount period must be shorter than net period" |
| **Invoice detail — Skonto banner** | | | |
| Eligible banner | "Save {discountAmount} if paid by {date} — discounted total {discountedTotal}" | "{discountAmount} sparen bei Zahlung bis {date} — Rechnungsbetrag mit Skonto {discountedTotal}" | "Save {discountAmount} if paid by {date} — discounted total {discountedTotal}" |
| Window-expired banner | "Discount window expired on {date}" | "Skonto-Frist am {date} abgelaufen" | "Discount window expired on {date}" |
| Taken (snapshot) banner | "Skonto applied at payment: {discountAmount} saved on {paidDate}" | "Skonto bei Zahlung angewendet: {discountAmount} gespart am {paidDate}" | "Skonto applied at payment: {discountAmount} saved on {paidDate}" |
| Not taken (snapshot) banner | "Paid after discount window — no Skonto applied" | "Nach Skonto-Frist bezahlt — kein Skonto angewendet" | "Paid after discount window — no Skonto applied" |
| **ContractorBillingProfile — default Skonto** | | | |
| Section heading | "Default early-payment discount" | "Standard-Skonto" | "Default early-payment discount" |
| Helper | "Applied automatically to new DE invoices for this contractor. Can be overridden per invoice." | "Wird automatisch auf neue DE-Rechnungen für diesen Auftragnehmer angewendet. Kann pro Rechnung überschrieben werden." | "Applied automatically to new DE invoices for this contractor. Can be overridden per invoice." |
| Save default | "Save default Skonto" | "Standard-Skonto speichern" | "Save default Skonto" |
| Clear default | "Remove default Skonto" | "Standard-Skonto entfernen" | "Remove default Skonto" |
| **PaymentRun preview — Skonto checkbox** | | | |
| Line checkbox label | "Apply {percent}% Skonto — save {discountAmount}" | "{percent}% Skonto anwenden — {discountAmount} sparen" | "Apply {percent}% Skonto — save {discountAmount}" |
| Outside-window helper | "Discount window expired ({date}) — full amount applies" | "Skonto-Frist abgelaufen ({date}) — voller Betrag fällig" | "Discount window expired ({date}) — full amount applies" |
| Snapshot-on-payment toast | "Skonto applied to run — {count} invoice(s) discounted, {totalSavings} saved" | "Skonto auf Lauf angewendet — {count} Rechnung(en) rabattiert, {totalSavings} gespart" | "Skonto applied to run — {count} invoice(s) discounted, {totalSavings} saved" |
| **Invoices list — Skonto column** | | | |
| Column header | "Skonto" | "Skonto" | "Skonto" |
| Empty cell | "—" | "—" | "—" |
| Cell format | "{percent}% {discountDays}/{netDays}" (e.g. "3% 7/30") | "{percent}% {discountDays}/{netDays}" | "{percent}% {discountDays}/{netDays}" |
| **Admin → BoE rate page** | | | |
| Page title | "Bank of England base-rate history" | "Bank of England Leitzinshistorie" | "Bank of England base-rate history" |
| Page subtitle | "Reference data powering UK statutory late-payment interest calculations" | "Referenzdaten für die Berechnung der gesetzlichen Verzugszinsen (UK)" | "Reference data powering UK statutory late-payment interest calculations" |
| Table columns | "Effective from" / "Rate %" / "Source" / "Recorded by" / "Recorded at" / "Notes" / "" *(actions)* | "Gültig ab" / "Zinssatz %" / "Quelle" / "Erfasst von" / "Erfasst am" / "Hinweise" / "" | "Effective from" / "Rate %" / "Source" / "Recorded by" / "Recorded at" / "Notes" / "" |
| Source values | "BOE API" / "Manual" | "BoE-API" / "Manuell" | "BOE API" / "Manual" |
| Add new CTA | "+ Add rate" | "+ Zinssatz hinzufügen" | "+ Add rate" |
| Add dialog title | "Add BoE base-rate entry" | "BoE-Zinssatz-Eintrag hinzufügen" | "Add BoE base-rate entry" |
| Delete dialog title | "Delete BoE rate entry?" | "BoE-Zinssatz-Eintrag löschen?" | "Delete BoE rate entry?" |
| Delete dialog body | "Deleting a historical rate changes interest calculations for any invoices that fell overdue during its validity period. Proceed only if this entry was entered in error." | "Das Löschen eines historischen Zinssatzes ändert die Zinsberechnung für alle Rechnungen, die in seinem Gültigkeitszeitraum überfällig wurden. Nur fortfahren, wenn dieser Eintrag fehlerhaft erfasst wurde." | "Deleting a historical rate changes interest calculations for any invoices that fell overdue during its validity period. Proceed only if this entry was entered in error." |
| Poller-last-success row | "Last BoE API poll: {date} — rate unchanged / new rate {percent}% recorded" | "Letzter BoE-API-Abruf: {date} — Zinssatz unverändert / neuer Zinssatz {percent}% erfasst" | "Last BoE API poll: {date} — rate unchanged / new rate {percent}% recorded" |
| Poller-last-failure row | "Last BoE API poll failed on {date}. Manual entry still possible; poller will retry at the next scheduled run." | "Letzter BoE-API-Abruf am {date} fehlgeschlagen. Manuelle Erfassung weiterhin möglich; der Abruf wird beim nächsten geplanten Lauf erneut versucht." | "Last BoE API poll failed on {date}. Manual entry still possible; poller will retry at the next scheduled run." |

**Destructive confirmations:**
- **"Waive interest"** — uses `<AlertDialog>` with a required textarea (min 10 chars). Destructive button never auto-focused; `Tab` order is Reason → Waive-type selector → Cancel → Waive.
- **"Delete BoE rate entry"** — uses `<AlertDialog>`; destructive button never auto-focused; `Tab` order is Cancel → Delete.
- **"Revoke waiver"** — uses `<AlertDialog>` with a required reason textarea; destructive button never auto-focused; same tab pattern.
- **"Claim statutory interest"** is irreversible but non-destructive — uses a non-destructive confirmation `<Dialog>` (Cancel + Confirm primary). Claim creates an immutable snapshot; an inline "claimed" banner replaces the claim CTA once taken.

**Locked phrase enforcement:** the DE Skonto description template (D-22) and the GB LPCDA claim-letter footer (D-17) are CI-guarded. Any change to these strings triggers a build failure unless paired with a legal-review checkpoint note.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `button`, `card`, `dialog`, `alert-dialog`, `dropdown-menu`, `badge`, `table`, `input`, `label`, `textarea`, `tooltip`, `tabs`, `skeleton`, `separator`, `sheet`, `sonner` (toasts), `scroll-area`, `form` (react-hook-form integration), `select`, `switch`, `checkbox` | not required (already installed in `apps/web/src/components/ui/`) |

**No third-party registries are introduced by Phase 63.** All UI primitives reuse what is already on disk. The sole net-new components (in `apps/web/src/components/payments/`, `apps/web/src/components/invoices/late-interest/`, `apps/web/src/components/invoices/skonto/`, `apps/web/src/components/admin/boe-rate/`) are project-specific compositions of existing primitives.

---

## Interaction & State Contracts

### BACS export flow (PaymentRun detail)

1. User opens a PaymentRun whose auto-detected format is `BACS_STD18`. A "BACS Std 18 preview" Card is rendered below the existing run-items table (only visible when format = `BACS_STD18` and `PAY_BACS_ENABLED` is on).
2. Clicking **"Preview BACS file"** calls `bacs.previewExport({ paymentRunId })`. While pending: the button shows `<Skeleton>`-style "Generating preview…" state. Response contains `{ fileText, transliterationWarnings[], modulusChecks[] }`.
3. Preview renders:
   - A warning banner (if any): transliteration warnings first (warning tint for replacements, destructive tint if any unmappable `?`), then modulus-check warnings grouped by sort code (each entry: contractor name, masked sort code, status pill, reason).
   - A monospace `<pre>` block with the generated fixed-width content, `max-h-[420px]` with `overflow-auto`, `font-mono text-sm` inside a Card with `p-4`.
4. Clicking **"Download BACS file"** calls `bacs.generateExport({ paymentRunId })` which returns a signed URL (R2, TTL 300s). The browser downloads the file. A `PaymentExport` row is created server-side and `downloadCount` is incremented. Toast: "BACS file downloaded — {filename}".
5. If unmappable characters (`?` in the replacement list) exist, **Download is disabled** with a tooltip "Fix the unmappable characters above before downloading". The only path forward is editing contractor/reference names upstream and regenerating the preview.
6. If BACS submitter not configured: Card renders only the configure-submitter banner with a deep-link to `/settings/payments/`. Preview and Download actions are hidden.

### BACS settings flow (`/settings/payments/`)

- Route-level permission gate (`org:settings:write`); non-admin users see a 403-shaped empty state ("You don't have permission to configure payment exports") with a link back to dashboard.
- Single form using `react-hook-form` + `zod` resolver. Three encrypted fields (SUN, submitter sort code, submitter account number) + plain `submitterName` (max 18 ASCII chars). Inline validation runs on blur; submit is disabled while invalid.
- Masked preview of saved values shown as read-only labels above each input when encrypted secret already exists (e.g. `Currently saved: XXXX34`). Re-submitting overwrites.
- Save button calls `bacs.saveSubmitterConfig(...)`. Toast "BACS submitter details saved". Audit-log row written server-side (contains user, org, field names changed — never the values).
- If `PAY_BACS_ENABLED` is off, the BACS section is still visible for admin convenience (labelled with the feature-flag-off banner copy above), but the Save button is disabled.

### ContractorBillingProfile — UK bank details flow

- Within the existing billing-profile edit form, a new "UK bank account" collapsible section appears ONLY when `contractor.countryCode === 'GB'` (otherwise hidden, SEPA/SWIFT fields remain in place).
- Sort-code input auto-formats on blur: `123456` → displayed as `12-34-56` but stored hyphen-free. Account number input accepts digits only (8 max).
- `Validate sort code` button calls `bacs.validateSortCode({ sortCode, accountNumber })`. Response renders an inline status chip (`VALID` success, `WARN` warning for exception ranges, `INVALID` destructive for regex fail). Response is advisory — save still proceeds on `WARN`.
- Save triggers re-encryption server-side; the masked representation refreshes on response.

### Late-payment-interest flow (invoice detail)

- A new "Statutory late-payment interest" Card is rendered in the invoice detail right column (below the existing payment-status card) IF:
  - `contractor.countryCode === 'GB'` AND `contractor.isBusinessCustomer === true` AND `invoice.currency === 'GBP'` AND `PAY_LATE_INTEREST_ENABLED` is on.
- If scope gates fail but invoice is GB/GBP, render a small banner: "Statutory interest not applicable (B2C transaction)." (no Card chrome). Non-GB invoices render nothing.
- If scope passes AND invoice is not overdue: Card shows "Due in {N} days — no statutory interest yet" with no numbers. On overdue, the Card switches to the "ACCRUING" layout.
- **ACCRUING layout:**
  - Status pill (warning-tinted).
  - Dense grid of 6 rows (label left, tabular-nums right):
    - Principal outstanding: £{amount}
    - Days overdue: {n}
    - Rate used: {boe + 8}% {statutoryPeriodStartDate → statutoryPeriodEndDate helper text}
    - Daily accrual: £{amount}
    - Interest accrued: £{amount}
    - Fixed compensation: £{40 | 70 | 100}
  - Separator + total row: "**Total statutory claim: £{amount}**" (`font-semibold`).
  - Info tooltip next to "Rate used" explains the 6-month statutory period rule (copy above).
  - CTA row: `Claim statutory interest` (primary), `Waive interest` (ghost destructive).
- **CLAIMED layout:** status pill (info-tinted), all values are the snapshot values (not live), snapshot date is shown, `Claim statutory interest` is replaced with `Download claim letter` + (if secondary invoice was issued) `View secondary invoice #{number}`. `Waive interest` remains available (waiving post-claim does not un-claim; it zeroes out future accrual which in a claimed state is irrelevant — the button is hidden once claimed).
- **WAIVED layout:** status pill (muted, strike-through on amount), reason + waived-by/date shown, `Revoke waiver` button available. If waive type was `COMPENSATION`, interest numbers remain visible; the compensation row shows as strike-through.
- Claim flow: `Claim statutory interest` opens a non-destructive `<Dialog>` with a checkbox `[ ] Issue claim as a secondary invoice`, Cancel + Confirm buttons. On Confirm: `lpi.claim({...})` creates `InvoiceInterestClaim` + generates claim PDF + (conditionally) creates the secondary `Invoice`. Toast "Claim snapshot taken — £{amount}". Card transitions to CLAIMED layout.
- Waive flow: `Waive interest` opens `<AlertDialog>` with a `<Select>` for waiveType (Interest only / Compensation only / Both), `<Textarea>` for reason (min 10 chars), Cancel + Waive buttons. Destructive Waive button is last in tab order. On Waive: `lpi.waive({...})` creates `InvoiceInterestWaiver`. Toast "Interest waived". Card transitions to WAIVED layout.
- Revoke-waiver: inside the waived banner, `Revoke waiver` opens an `<AlertDialog>` with a required reason textarea. On confirm: `lpi.revokeWaiver({...})` sets `revokedAt`. Card returns to ACCRUING (or CLAIMED) layout.

### Invoices list — Overdue interest column + filter

- Column is sortable (`Overdue interest DESC`), shows the live-computed `totalInterestAccruedMinor + compensationTierMinor` for GB B2B rows, `—` for all others.
- Column is hidden by default for orgs whose primary country is not `GB`; visible by default for UK orgs. Column preferences are stored per-user.
- Filter chip "Overdue" toggles `?filter=overdue` (server filter: `status != PAID && dueDate < now()`); chip is active-tinted (accent) when engaged, muted when off.
- List rows gain a subtle warning-tinted left-border indicator when the row is overdue + GB B2B (3px `border-l-warning`).

### Dashboard tile — Overdue receivables (UK)

- New tile in the dashboard grid, rendered only for orgs with at least one GB B2B invoice (otherwise hidden — no empty state needed; the tile's absence is the empty state).
- Tile structure: small tile heading (`text-sm` muted) + large `display`-sized headline (`text-2xl font-display`) + sub-line (`text-sm` muted) + click-through link to `/invoices?filter=overdue`.
- Live computation: sum across unwaived, unclaimed, overdue UK B2B invoices. Updates on invoice list revalidation (`react-query` + tRPC SWR pattern).

### Skonto — invoice create/edit form (DE invoices only)

- Section rendered only when `invoice.locale === 'de'` (inferred from contractor country === 'DE' OR org default). For non-DE invoices, section is hidden entirely.
- Default cascade UI:
  - If profile default exists AND no invoice-specific term: shows "Using contractor default: 3% / 7 days / net 30 days" pill + "Customize for this invoice" toggle.
  - If invoice-specific term exists: shows the three inputs (percent / discount days / net days) with current values + "Reset to contractor default" button (if profile default exists) OR "Remove Skonto" (if no profile default).
  - If no default and no term: shows "Add Skonto" button that reveals the three inputs.
- Validation: inline on blur. `0 < discountPercent <= 50`, `1 <= discountDays < netDays <= 180`. Error text in destructive tint below the offending input.
- Live preview line: shows the locked DE phrase (D-22) with interpolated values below the inputs (e.g. "3% Skonto bei Zahlung innerhalb von 7 Tagen, sonst netto 30 Tage"). `font-mono` treatment NOT applied — this is a customer-facing sentence, uses the default body font.
- Save button calls `skonto.upsertForInvoice({...})`. Toast "Skonto term saved".

### Skonto — ContractorBillingProfile edit form (DE profiles only)

- New collapsible "Default early-payment discount" section at the bottom of the DE billing-profile form. Expanded by default if a profile default exists, collapsed otherwise.
- Same three inputs + same validation. Save calls `skonto.upsertForBillingProfile({...})`.

### Skonto — invoice detail banner

- Rendered directly below the invoice-status card on the invoice detail page for DE invoices with a resolved SkontoTerm.
- State machine: `ELIGIBLE` → success-tinted banner (green), `PAST_DISCOUNT_WINDOW` → muted banner, `TAKEN_AT_PAYMENT` → success-tinted with `CheckCircle2`, `NOT_TAKEN_AT_PAYMENT` → muted banner. `NO_SKONTO_CONFIGURED` → banner hidden.
- Live eligibility evaluation on every read (pure function `evaluateSkontoEligibility`).

### Skonto — PaymentRun preview

- For each DE invoice line within the discount window, a `<Checkbox>` labelled "Apply {percent}% Skonto — save €{discountAmount}" appears next to the `amountMinor` cell. Default state: unchecked (conservative — user opts in).
- When checked: the row's `amountMinor` updates to `discountedAmountMinor` in the UI (live) and a `SkontoApplication` row is written on `applySkontoToItem` mutation. Unchecking reverts both.
- For lines past the discount window: label becomes "Discount window expired ({date}) — full amount applies", checkbox is disabled.
- Run-summary footer shows total savings: "Total savings: €{sum of discountAmountMinor}" in success tint when any Skonto is applied.
- Snapshot on payment complete: when the run marks its items as paid, a post-success toast shows "Skonto applied to run — {count} invoice(s) discounted, €{totalSavings} saved".

### Invoices list — Skonto column

- Column header "Skonto" with sort on `discountPercent DESC`.
- Cell shows `{percent}% {discountDays}/{netDays}` (e.g. "3% 7/30") for invoices with a resolved term, `—` otherwise.
- Column is hidden by default for non-DE orgs; visible for DE orgs. Per-user column preferences respected.

### Admin → BoE base-rate history (`/admin/boe-rate/`)

- Super-admin only (permission `admin:boe-rate:write`). Non-super-admin users see a 403-shaped empty state.
- Page layout: title + subtitle + poller-status strip (last poll result from `BoEBaseRateHistory` where `source = 'BOE_API'` + most recent log entry via a server-computed status) + `+ Add rate` button + table.
- Table: columns per the copywriting contract. Rows sorted `effectiveFrom DESC`. Each row has an "Edit" and "Delete" action. Cron-sourced rows show "Edit" only (to add/amend notes; ratePercent of cron rows is editable as an override with a warning tooltip).
- Add-rate dialog: `<Input type="date">` for effectiveFrom, numeric input for ratePercent (2 decimal places), `<Textarea>` for notes. Server validates uniqueness on `effectiveFrom`.
- Delete AlertDialog: destructive confirmation with the delete copy above; destructive button last in tab order.
- Poller-status strip is informational only — no action buttons. "Last successful poll: 2026-04-14 06:00 UTC — rate unchanged at 4.75%" or "Last poll failed: 2026-04-13 06:00 UTC — see system logs".

### Loading & skeleton states

- BACS preview: skeleton block (full-width, 240px tall) with "Generating preview…" helper below.
- Late-interest card: skeleton rows (6 label+value pairs) while `lpi.getForInvoice` is in-flight on first render.
- Dashboard tile: skeleton headline + subline.
- Skonto banner: skeleton single-line.
- BoE-rate admin table: 5 skeleton rows.

### Accessibility

- All status pills include `aria-label` with the full status name (e.g., `aria-label="Accruing interest"`).
- Focus-visible rings everywhere use the existing `--ring` (Deep Teal) at 2px outline + 2px offset.
- Destructive AlertDialogs never auto-focus the destructive button; Tab order always ends with the destructive action.
- BACS-preview `<pre>` block has `role="region"` + `aria-label="BACS Std 18 file preview"` + `tabindex="0"` to allow keyboard scrolling.
- Monospace numeric content (rate percentages, currency amounts) uses `tabular-nums` to prevent column jitter.
- Tooltip triggers are keyboard-accessible (`Info` icon buttons with `aria-label="Rate calculation details"`).
- Color is never the sole signal: every status pill pairs the color with explicit text + a leading lucide icon (`Clock` for ACCRUING, `Check` for CLAIMED/PAID/TAKEN_AT_PAYMENT, `SlashCircle` for WAIVED/NOT_APPLICABLE, `AlertTriangle` for modulus-warning, `AlertOctagon` for unmappable-transliteration).
- Form labels are always `<Label htmlFor>`-associated. Helper text and errors use `aria-describedby`.
- Skip links: the late-interest card has a "Skip to claim actions" link (visually hidden, focusable) for keyboard users.

### Responsive

- Mobile (`<md`, ≤768px): single column; late-interest card, Skonto banner, and BACS-preview card stack below main invoice/run content. Admin BoE-rate table becomes a card-list (one card per row) on `<sm`.
- Tablet (`md`, 768–1024px): 2-column invoice detail (main left, sidebar right). Settings-page form is single-column centered (max-w-2xl).
- Desktop (`lg+`, ≥1024px): full 2-column invoice detail with late-interest/Skonto cards in the right sidebar below payment-status.
- BACS preview `<pre>` scrolls horizontally on narrow viewports rather than reflowing — fixed-width content must stay fixed-width.

### Internationalization

- DE is the primary launch locale. All strings ship in EN + DE + GB at the same time.
- Late-Interest surfaces are EN/GB only (LPCDA is UK law — no DE translation).
- Skonto surfaces are DE-primary; EN/GB carry the informational translation.
- Currency formatting: invoices use `Intl.NumberFormat(locale, { style: 'currency', currency: invoice.currency })` — existing `formatMoney` helper. Dashboard tile uses `currency: 'GBP'` explicitly (UK-scoped tile).
- Dates use `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`.
- BoE rate percentages display as `{ratePercent}%` with 2 decimal places (tabular-nums) — no locale-specific thousand separators (these are percentages, not currency).

### Feature flags

- `PAY_BACS_ENABLED`: gates the BACS-preview Card on PaymentRun detail, the BACS section on `/settings/payments/`, and the `BACS_STD18` option in format auto-detection fallback. When off: Card hidden, settings section shows the feature-flag-off banner, format detection skips BACS_STD18.
- `PAY_LATE_INTEREST_ENABLED`: gates the Late-Interest Card on invoice detail, the Overdue-interest column + filter on the invoices list, the dashboard tile, and the BoE-rate polling cron. When off: all UI surfaces hidden, no calculation calls made.
- `PAY_SKONTO_ENABLED`: gates the Skonto section on invoice create/edit, the profile-default section, the Skonto banner on invoice detail, the PaymentRun Skonto checkbox, and the XRechnung BG-20 Skonto emission (the generator checks the flag server-side). When off: sections hidden, BG-20 block omitted (generator behavior identical to pre-Phase-63).
- Feature flags honor the project's jurisdiction-aware wrapper (per memory `feature_flags_strategy`): `PAY_BACS_ENABLED` and `PAY_LATE_INTEREST_ENABLED` are short-circuited to `false` for orgs with no GB presence; `PAY_SKONTO_ENABLED` is short-circuited to `false` for orgs with no DE presence.

---

## Component Reuse Summary

| Existing component | Reused in Phase 63 for |
|--------------------|------------------------|
| `apps/web/src/components/ui/button.tsx` | All buttons (no custom variants) |
| `apps/web/src/components/ui/card.tsx` | BACS preview, Late-Interest section, Skonto banner, settings sections, BoE-rate page |
| `apps/web/src/components/ui/dialog.tsx` | Claim-statutory-interest confirmation, Add-BoE-rate |
| `apps/web/src/components/ui/alert-dialog.tsx` | Waive interest, Revoke waiver, Delete BoE rate |
| `apps/web/src/components/ui/badge.tsx` | All status pills (late-interest, Skonto eligibility, modulus-check, transliteration warning) |
| `apps/web/src/components/ui/table.tsx` | BoE-rate admin table |
| `apps/web/src/components/ui/input.tsx` | Bank-field inputs, Skonto numeric inputs, rate inputs |
| `apps/web/src/components/ui/label.tsx` | All form labels |
| `apps/web/src/components/ui/textarea.tsx` | Waive reason, Revoke reason, BoE-rate notes |
| `apps/web/src/components/ui/select.tsx` | Waive-type selector |
| `apps/web/src/components/ui/checkbox.tsx` | PaymentRun per-line Skonto checkbox, "Issue as secondary invoice" in claim dialog |
| `apps/web/src/components/ui/switch.tsx` | "Customize for this invoice" Skonto toggle |
| `apps/web/src/components/ui/tooltip.tsx` | Rate-calculation info tooltip, disabled-button explanations |
| `apps/web/src/components/ui/skeleton.tsx` | All loading states |
| `apps/web/src/components/ui/sonner.tsx` | All toasts |
| `apps/web/src/components/ui/separator.tsx` | Total-claim separator inside Late-Interest card |
| `apps/web/src/components/ui/scroll-area.tsx` | BACS preview `<pre>` scroll container |
| `apps/web/src/components/ui/form.tsx` | Settings-page BACS form, billing-profile UK bank form, Skonto form, Add-BoE-rate form |
| `apps/web/src/components/invoices/einvoice-status-cell.tsx` (Phase 61) | Pattern reference for `late-interest-status-pill.tsx` + `skonto-eligibility-pill.tsx` |
| `apps/web/src/components/invoices/intake/intake-status-pill.tsx` (Phase 62) | Pattern reference for modulus-check + transliteration-warning pills |
| `apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx` (Phase 60) | Pattern reference for the warning-tinted Overdue-row left-border indicator |

### Net-new Phase 63 components

| Path | Purpose |
|------|---------|
| `apps/web/src/components/payments/bacs/bacs-preview-card.tsx` | PaymentRun BACS preview Card |
| `apps/web/src/components/payments/bacs/bacs-preview-pre.tsx` | Monospace file-content `<pre>` with ScrollArea |
| `apps/web/src/components/payments/bacs/modulus-check-warning-list.tsx` | Per-item sort-code warnings |
| `apps/web/src/components/payments/bacs/transliteration-warning-banner.tsx` | File-level transliteration warnings (warning + destructive variants) |
| `apps/web/src/components/payments/bacs/bacs-submitter-form.tsx` | Settings-page form |
| `apps/web/src/components/contractors/billing-profile/uk-bank-fields-section.tsx` | Collapsible UK bank section in billing-profile edit |
| `apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx` | Inline validate button + result pill |
| `apps/web/src/components/invoices/late-interest/late-interest-card.tsx` | Invoice-detail Card with all 4 states (accruing/claimed/waived/paid) |
| `apps/web/src/components/invoices/late-interest/late-interest-status-pill.tsx` | Status pill variants |
| `apps/web/src/components/invoices/late-interest/claim-dialog.tsx` | Non-destructive claim confirmation |
| `apps/web/src/components/invoices/late-interest/waive-dialog.tsx` | Destructive AlertDialog with reason + type |
| `apps/web/src/components/invoices/late-interest/revoke-waiver-dialog.tsx` | Destructive AlertDialog with reason |
| `apps/web/src/components/invoices/late-interest/rate-calculation-tooltip.tsx` | Info tooltip explaining the 6-month period rule |
| `apps/web/src/components/invoices/skonto/skonto-form-section.tsx` | Invoice-create/edit Skonto inputs + default-cascade affordances |
| `apps/web/src/components/invoices/skonto/skonto-banner.tsx` | Invoice-detail eligibility banner |
| `apps/web/src/components/invoices/skonto/skonto-eligibility-pill.tsx` | Status pill variants |
| `apps/web/src/components/contractors/billing-profile/default-skonto-section.tsx` | Billing-profile default Skonto editor |
| `apps/web/src/components/payments/run/skonto-apply-checkbox.tsx` | PaymentRun per-line checkbox + Skonto math |
| `apps/web/src/components/dashboard/overdue-receivables-tile.tsx` | Dashboard tile |
| `apps/web/src/components/admin/boe-rate/boe-rate-table.tsx` | Admin table |
| `apps/web/src/components/admin/boe-rate/add-boe-rate-dialog.tsx` | Add-rate dialog |
| `apps/web/src/components/admin/boe-rate/edit-boe-rate-dialog.tsx` | Edit-rate dialog (reuses the add form in edit mode) |
| `apps/web/src/components/admin/boe-rate/delete-boe-rate-dialog.tsx` | Destructive AlertDialog |
| `apps/web/src/components/admin/boe-rate/poller-status-strip.tsx` | Informational strip on the admin page |
| `apps/web/src/components/admin/admin-shell.tsx` | Minimal `/admin/` layout shell (sidebar with single "BoE rate" entry for v5.0; extensible) |

**No new design primitives are introduced.** Every Phase 63 component is a composition of shadcn primitives + project tokens. The BACS `<pre>` block and monospace content reuse existing `--font-mono` — no font additions.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — every surface has explicit EN + DE + GB strings; error states are problem + solution; destructive confirmations are explicit (Waive interest / Revoke waiver / Delete BoE rate); locked statutory phrases (DE Skonto D-22, GB LPCDA footer D-17) are CI-guarded.
- [x] Dimension 2 Visuals: PASS — composed only from existing `apps/web/src/components/ui/*`; no new primitives; no inline custom SVG; all icons via lucide-react; monospace content uses existing `--font-mono`.
- [x] Dimension 3 Color: PASS — strict 60/30/10 (background / cards+sidebar / primary teal accent); accent reserved-for list is enumerated; semantic statuses use existing `--success/--warning/--info/--destructive` tokens with `/10`–`/12%` tints; overdue left-border uses `border-l-warning` (existing token).
- [x] Dimension 4 Typography: PASS — 4 declared roles (body/label/heading/display) mapped to existing `--text-base/--text-sm/--text-xl/--text-2xl`; two weights (400 + 600/700); mono reserved for BACS preview + masked bank fields + rate identifiers + R2 keys.
- [x] Dimension 5 Spacing: PASS — 4-point scale only (4/8/16/24/32/48); all inputs/buttons reuse `h-9` (36 = 9×4); no exceptions.
- [x] Dimension 6 Registry Safety: PASS — only shadcn official blocks; all already on disk; zero third-party registries.

**Approval:** approved 2026-04-14
