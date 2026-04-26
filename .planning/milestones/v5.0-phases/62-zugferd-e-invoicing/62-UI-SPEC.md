---
phase: 62
slug: zugferd-e-invoicing
status: approved
shadcn_initialized: true
preset: base-nova
created: 2026-04-14
reviewed_at: 2026-04-14
---

# Phase 62 — UI Design Contract

> Visual and interaction contract for the ZUGFeRD e-invoicing surfaces (outbound "Download ZUGFeRD PDF" CTA on the existing invoice detail page; new `/invoices/intake/` list and `/invoices/intake/[id]/` detail surfaces for inbound XRechnung + ZUGFeRD parsing). Pre-populated from the project's "Precision Craft" design system already encoded in `apps/web/src/app/globals.css` and from `62-CONTEXT.md` D-14 (UI placement) and Phase 60–61 component patterns.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | base-nova (per `apps/web/components.json`) |
| Component library | shadcn/ui (Radix primitives) |
| Icon library | lucide-react |
| Font | Outfit (body/sans), Bricolage Grotesque (display), JetBrains Mono (mono) — already loaded via `--font-sans`, `--font-display`, `--font-mono` |

**No new fonts, no new colors, no new spacing tokens are introduced by Phase 62.** All surfaces consume the existing "Precision Craft" tokens defined in `apps/web/src/app/globals.css` (light + dark mode bridged through `@theme inline`).

---

## Spacing Scale

Phase 62 uses the project-wide 4-point scale (Tailwind defaults bridged in `globals.css`). All multiples of 4.

| Token | Value | Usage in Phase 62 |
|-------|-------|-------------------|
| xs | 4px (`gap-1`, `p-1`) | Icon-to-label gaps inside `<Badge>` chips, status-cell content |
| sm | 8px (`gap-2`, `p-2`) | Drop-zone inner padding around the upload icon, filter-chip row gaps |
| md | 16px (`gap-4`, `p-4`) | Card content padding, form-field stacks, intake-detail field rows |
| lg | 24px (`gap-6`, `p-6`) | Section padding inside the intake detail page (PDF preview pane, parsed-fields pane, validation-report pane) |
| xl | 32px (`gap-8`, `p-8`) | Page header → first content block, drop-zone outer padding inside the upload Dialog |
| 2xl | 48px (`gap-12`, `mt-12`) | Empty state vertical spacing on `/invoices/intake/` when there are no rows |
| 3xl | 64px (`gap-16`) | Reserved for marketing surfaces — not used in Phase 62 (dashboard pages stay denser) |

**Exceptions:** none. The intake split-button trigger reuses the existing button heights (`h-9` = 36px) shipped by shadcn/ui — these are 4-multiples (36 = 9 × 4) and align with the rest of the dashboard.

---

## Typography

Inherits the project's `--text-*` fluid scale (clamp-based responsive sizes) from `globals.css`. Phase 62 declares which roles map to which tokens — no new sizes or weights are introduced.

| Role | Token | Resolved size (clamp range) | Weight | Line height | Used for |
|------|-------|------------------------------|--------|-------------|----------|
| Body | `text-base` | 0.875rem → 0.9375rem (14–15px) | 400 (`font-normal`) | 1.5rem (24px) | All paragraph copy, parsed-field values, validation-report body, drop-zone helper text |
| Label | `text-sm` | 0.8125rem → 0.875rem (13–14px) | 500 (`font-medium`) | 1.25rem (20px) | Field labels, table column headers, filter-chip labels, badge text |
| Heading | `text-xl` | 1.125rem → 1.375rem (18–22px) | 600 (`font-semibold`, `font-display`) | 1.75rem (28px) | Page titles ("Invoice imports", "Import detail"), Card titles ("Parsed fields", "Validation report") |
| Display | `text-2xl` | 1.375rem → 1.875rem (22–30px) | 700 (`font-display`) | 2.25rem (36px) | Empty-state heading on the intake list when there are zero imports |

Mono (`font-mono`) is reserved for: extracted IDs (Leitweg-ID, VAT identifier, invoice number, sha256 prefixes in download filenames, R2-key hints) and KoSIT rule identifiers in the validation-report section. Tabular numerals (`font-variant-numeric: tabular-nums`) are used for the totals column in the intake list and the "Total (gross)" field in the detail panel — already wired via `globals.css` line 1495.

---

## Color

Phase 62 inherits the 60/30/10 distribution from the existing dashboard. Accent (Deep Teal `--primary` = oklch(0.44 0.145 178)) is reserved for primary CTAs and active filter chips ONLY.

| Role | Token | Usage in Phase 62 |
|------|-------|-------------------|
| Dominant (60%) | `--background` (warm off-white oklch(0.985 0.003 85)) / `--surface-0` | Page background of `/invoices/intake/` and `/invoices/intake/[id]/` |
| Secondary (30%) | `--card` (pure white) / `--surface-1` / `--sidebar` | Card surfaces (PDF preview pane, parsed-fields pane, validation-report pane, match-candidate panel), sidebar (no change) |
| Accent (10%) | `--primary` (Deep Teal) | Primary CTA buttons ("Convert to Invoice", "Confirm match", "Import e-invoice"), active filter-chip background, `<Sidebar>` "Imports" entry active state, focus rings (`--ring`) |
| Destructive | `--destructive` (refined crimson oklch(0.58 0.23 18)) | "Reject import" button only, inline error text inside the upload Dialog when XSD layer-1 validation hard-rejects |

Accent is reserved for (explicit list — never "all interactive elements"):

- Primary CTAs in the new flows: "Import e-invoice" (split-button secondary item), "Convert to Invoice", "Confirm match", "Use this contractor", "Create new contractor from this data", "Accept despite issues", "Download ZUGFeRD PDF"
- Active state of filter chips on the intake list (`All` / `Needs review` / `Matched` / `Converted` / `Rejected`)
- The active sidebar nav entry ("Imports")
- Focus rings on all interactive elements (inherits from `--ring`)

Status pill colors map to existing semantic tokens (no new colors):

| Intake status | Background | Foreground | Token |
|---------------|------------|------------|-------|
| `PARSED` | muted | muted-foreground | `bg-muted text-muted-foreground` |
| `NEEDS_REVIEW` | warning-tinted (`oklch(0.7 0.16 65 / 12%)`) | warning | `bg-warning/10 text-warning` |
| `MATCHED` | info-tinted (`oklch(0.55 0.18 260 / 12%)`) | info | `bg-info/10 text-info` |
| `CONVERTED` | success-tinted (`oklch(0.55 0.17 150 / 12%)`) | success | `bg-success/10 text-success` |
| `REJECTED` | destructive-tinted (`oklch(0.58 0.23 18 / 10%)`) | destructive | `bg-destructive/10 text-destructive` |

| Validation status | Background | Foreground |
|-------------------|------------|------------|
| `VALID` | success-tinted | success |
| `WARNINGS` | warning-tinted | warning |
| `INVALID` | destructive-tinted | destructive |

| Profile level badge | Background | Foreground |
|---------------------|------------|------------|
| `COMFORT` | `bg-teal-100 text-teal-800` | (default ZUGFeRD level) |
| `XRECHNUNG` | `bg-teal-100 text-teal-800` | (functionally equivalent) |
| `EXTENDED` | `bg-warning/10 text-warning` | (paired with the `LEVEL_EXTENDED_BEST_EFFORT` banner) |

These reuse the same token vocabulary as `apps/web/src/components/invoices/einvoice-status-cell.tsx` (Phase 61) and `band-chip.tsx` (Phase 60).

---

## Copywriting Contract

All strings are added to `apps/web/messages/{en,de,gb}.json` under the existing `EInvoice` namespace (extended). DE strings flow through `packages/validators/src/legal/de.ts` only when they carry statutory meaning (per Phase 56 pattern); all other strings are translation entries.

| Element | EN copy | DE copy | GB copy |
|---------|---------|---------|---------|
| Split-button primary | "+ New invoice" *(unchanged from existing)* | "+ Neue Rechnung" | "+ New invoice" |
| Split-button secondary item | "Import e-invoice" | "E-Rechnung importieren" | "Import e-invoice" |
| Sidebar nav entry | "Imports" | "Importe" | "Imports" |
| Page title (`/invoices/intake/`) | "Invoice imports" | "Rechnungsimporte" | "Invoice imports" |
| Page subtitle | "Inbound XRechnung and ZUGFeRD invoices awaiting review" | "Eingehende XRechnung- und ZUGFeRD-Rechnungen, die geprüft werden müssen" | "Inbound XRechnung and ZUGFeRD invoices awaiting review" |
| Filter chips | All / Needs review / Matched / Converted / Rejected | Alle / Prüfen / Zugeordnet / Übernommen / Abgelehnt | All / Needs review / Matched / Converted / Rejected |
| Upload dialog title | "Import an e-invoice" | "E-Rechnung importieren" | "Import an e-invoice" |
| Drop-zone primary copy | "Drop an XRechnung XML or ZUGFeRD PDF here" | "XRechnung-XML oder ZUGFeRD-PDF hier ablegen" | "Drop an XRechnung XML or ZUGFeRD PDF here" |
| Drop-zone secondary copy | "or click to choose a file (max 5 MB, .xml or .pdf)" | "oder Datei auswählen (max. 5 MB, .xml oder .pdf)" | "or click to choose a file (max 5 MB, .xml or .pdf)" |
| Primary CTA — convert | "Convert to invoice" | "In Rechnung übernehmen" | "Convert to invoice" |
| Primary CTA — match | "Confirm match" | "Zuordnung bestätigen" | "Confirm match" |
| Secondary CTA — accept warnings | "Accept despite issues" | "Trotz Hinweisen akzeptieren" | "Accept despite issues" |
| Secondary CTA — create contractor | "Create new contractor from this data" | "Neuen Auftragnehmer aus diesen Daten anlegen" | "Create new contractor from this data" |
| Outbound CTA on invoice detail | "Download ZUGFeRD PDF" | "ZUGFeRD-PDF herunterladen" | "Download ZUGFeRD PDF" |
| Empty state heading (intake list) | "No imports yet" | "Noch keine Importe" | "No imports yet" |
| Empty state body | "Inbound XRechnung XML and ZUGFeRD PDF files appear here. Use 'Import e-invoice' from the invoices page to upload one." | "Eingehende XRechnung-XML- und ZUGFeRD-PDF-Dateien erscheinen hier. Verwenden Sie 'E-Rechnung importieren' auf der Rechnungsseite, um eine hochzuladen." | "Inbound XRechnung XML and ZUGFeRD PDF files appear here. Use 'Import e-invoice' from the invoices page to upload one." |
| Error — XSD reject (D-12) | "The XML does not conform to the CII schema — ask the sender to re-issue. First errors: {errors}" | "Die XML entspricht nicht dem CII-Schema — bitten Sie den Absender, erneut auszustellen. Erste Fehler: {errors}" | "The XML does not conform to the CII schema — ask the sender to re-issue. First errors: {errors}" |
| Error — no XML attachment | "This PDF does not contain an embedded XRechnung/ZUGFeRD XML attachment. Only ZUGFeRD-conformant PDFs can be imported." | "Diese PDF enthält keinen eingebetteten XRechnung-/ZUGFeRD-XML-Anhang. Nur ZUGFeRD-konforme PDFs können importiert werden." | "This PDF does not contain an embedded XRechnung/ZUGFeRD XML attachment. Only ZUGFeRD-conformant PDFs can be imported." |
| Error — level too low | "This invoice uses the {level} ZUGFeRD profile, which lacks line-item data. Ask the sender to provide a COMFORT or XRECHNUNG profile." | "Diese Rechnung verwendet das ZUGFeRD-Profil {level}, dem die Positionsdaten fehlen. Bitten Sie den Absender um ein COMFORT- oder XRECHNUNG-Profil." | "This invoice uses the {level} ZUGFeRD profile, which lacks line-item data. Ask the sender to provide a COMFORT or XRECHNUNG profile." |
| Error — file too large | "File exceeds 5 MB. Ask the sender for a smaller file." | "Datei überschreitet 5 MB. Bitten Sie den Absender um eine kleinere Datei." | "File exceeds 5 MB. Ask the sender for a smaller file." |
| Banner — EXTENDED best-effort | "This invoice uses the EXTENDED ZUGFeRD profile. Some sender-specific fields could not be mapped. Review the data carefully before converting." | "Diese Rechnung verwendet das EXTENDED-ZUGFeRD-Profil. Einige absenderspezifische Felder konnten nicht zugeordnet werden. Prüfen Sie die Daten sorgfältig vor der Übernahme." | "This invoice uses the EXTENDED ZUGFeRD profile. Some sender-specific fields could not be mapped. Review the data carefully before converting." |
| Tooltip — disabled convert | "Acknowledge validation issues first" | "Validierungshinweise zuerst akzeptieren" | "Acknowledge validation issues first" |
| Tooltip — disabled convert (no match) | "Match a contractor before converting" | "Auftragnehmer vor der Übernahme zuordnen" | "Match a contractor before converting" |
| Match reason — VAT | "VAT ID match" | "USt-IdNr.-Übereinstimmung" | "VAT ID match" |
| Match reason — Leitweg | "Leitweg-ID match" | "Leitweg-ID-Übereinstimmung" | "Leitweg-ID match" |
| Match reason — exact name | "Exact name match" | "Exakte Namensübereinstimmung" | "Exact name match" |
| Match reason — fuzzy | "Fuzzy name match (distance {n})" | "Ungefähre Namensübereinstimmung (Abstand {n})" | "Fuzzy name match (distance {n})" |
| Reject dialog title | "Reject this import?" | "Diesen Import ablehnen?" | "Reject this import?" |
| Reject dialog body | "Rejected imports remain in the audit log but cannot be converted to an invoice. This action cannot be undone." | "Abgelehnte Importe bleiben im Audit-Log erhalten, können aber nicht in eine Rechnung übernommen werden. Diese Aktion kann nicht rückgängig gemacht werden." | "Rejected imports remain in the audit log but cannot be converted to an invoice. This action cannot be undone." |
| Reject dialog confirm | "Reject import" | "Import ablehnen" | "Reject import" |
| Reject dialog reason placeholder | "Reason (required) — e.g., duplicate, wrong recipient, sender mistake" | "Grund (erforderlich) — z. B. Duplikat, falscher Empfänger, Absenderfehler" | "Reason (required) — e.g., duplicate, wrong recipient, sender mistake" |
| Generation failure toast (outbound) | "ZUGFeRD generation failed. Please try again or contact support if the problem persists." | "ZUGFeRD-Erstellung fehlgeschlagen. Bitte erneut versuchen oder den Support kontaktieren, falls das Problem weiterhin besteht." | "ZUGFeRD generation failed. Please try again or contact support if the problem persists." |

**Destructive confirmations:** "Reject import" requires an explicit reason in a textarea (min 3 chars), uses the project's existing `<AlertDialog>` pattern, and never auto-focuses the destructive button (Tab once to reach it — matches Phase 60 pattern). The convert action is non-destructive but irreversible (`InvoiceIntakeRequest.status='CONVERTED'` is terminal); show an inline confirmation badge instead of a modal.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `button`, `card`, `dialog`, `alert-dialog`, `dropdown-menu`, `badge`, `table`, `input`, `label`, `textarea`, `tooltip`, `tabs`, `skeleton`, `separator`, `sheet`, `sonner` (toasts), `scroll-area` | not required (already installed in `apps/web/src/components/ui/`) |

**No third-party registries are introduced by Phase 62.** All UI primitives reuse what is already on disk. The sole net-new components (in `apps/web/src/components/invoices/intake/`) are project-specific compositions of existing primitives:

- `intake-upload-dialog.tsx` — Dialog + drag-drop area + file input
- `intake-status-pill.tsx` — Badge variant for the 5 intake statuses
- `intake-validation-status-pill.tsx` — Badge variant for VALID/WARNINGS/INVALID
- `intake-profile-level-badge.tsx` — Badge variant for COMFORT/XRECHNUNG/EXTENDED
- `intake-list.tsx` — Card + Table composition with filter chips
- `intake-filter-chips.tsx` — Button-group composition (selected uses `--primary`, others use `--muted`)
- `intake-detail-pdf-pane.tsx` — Card wrapping `react-pdf` viewer (already a project dep)
- `intake-detail-fields-pane.tsx` — Card with definition-list of parsed fields
- `intake-detail-validation-pane.tsx` — Card with KoSIT report link / inline summary
- `intake-detail-match-pane.tsx` — Card listing match candidates with reasons
- `intake-detail-actions-bar.tsx` — Action bar wrapping primary + destructive CTAs
- `import-split-button.tsx` — `DropdownMenu` + Button composition for the invoices-page header
- `download-zugferd-pdf-button.tsx` — Button + tRPC `generateZugferdPdf` mutation, lives inside the existing `einvoice-tab/`

---

## Interaction & State Contracts

### Upload flow

1. User clicks split-button → "Import e-invoice" → `<Dialog>` opens centered, `max-w-lg`, with the drop-zone.
2. Drop-zone accepts `.xml` or `.pdf` only (HTML `accept` + JS double-check). Wrong type → inline error inside the dialog (no toast).
3. On valid drop/select, the file is base64-encoded and sent via `invoiceIntake.upload`. The dialog stays open, button shows `<Skeleton>` + "Validating…" copy.
4. On success: dialog closes, toast "Imported — review at /invoices/intake/{id}", router pushes to the detail page.
5. On hard-reject (XSD failure / no-XML / level-too-low): dialog stays open, inline error message replaces the drop-zone, "Try another file" button resets state.
6. Network or unknown error: dialog stays open, generic error toast appears, drop-zone is re-enabled.

### Intake list

- Default sort: `createdAt DESC`.
- Filter chips drive the URL query (`?status=NEEDS_REVIEW`) for shareable/back-button-safe state.
- Empty state: large `display`-sized heading + body copy + a single `secondary` button "Import e-invoice" that opens the upload dialog from this page too.
- Each row links to `/invoices/intake/[id]/`. Hover state uses `--accent` background (warm hover surface, already a token).
- Pagination: cursor-based, "Load more" button (matches existing invoices-list pattern). 25 rows per page.

### Intake detail

Layout: 2-column on `md+` (PDF/XML preview left, parsed fields + validation + match panels right, stacked), 1-column on `<md`.

- PDF preview pane shows the rendered ZUGFeRD PDF via `react-pdf` viewer (page-by-page scroll); for XML uploads, shows a syntax-highlighted CII XML preview using a lightweight pre/code block (no new lib — server-side highlight via `shiki` is already a project dep; otherwise plain `<pre>` with mono font).
- Parsed-fields pane: definition-list with: Supplier name, VAT ID, Leitweg-ID, Invoice #, Date, Currency, Total (gross, in `font-mono` `tabular-nums`), Line count.
- Validation-report pane: status pill (VALID / WARNINGS / INVALID) + summary count + "Open full report" link (signed R2 URL, 300s TTL) + inline list of first 5 issues.
- Match-candidate panel: list of ranked candidates with match-reason chips. Single unambiguous match is pre-selected (selected ring on the candidate card) but `Confirm match` button is still required. "Create new contractor from this data" is always available as a fallback.
- Actions bar (sticky bottom on mobile, inline footer on desktop): `Convert to invoice` (primary, disabled with tooltip if not MATCHED + not validation-acknowledged), `Accept despite issues` (warm-accent secondary, only shown when `validationStatus IN ('WARNINGS', 'INVALID')` and not yet acknowledged), `Reject import` (destructive ghost, opens AlertDialog with reason textarea).

### Outbound — invoice detail page

- Inside the existing `einvoice-tab/`, append a new section "ZUGFeRD" below the Phase 61 XRechnung section.
- The section shows: status (none generated yet / generated at {date} / generation failed) + a primary "Download ZUGFeRD PDF" button.
- Clicking the button calls `einvoice.generateZugferdPdf({ invoiceId })`. While pending: button shows `<Skeleton>`-style "Generating…" state. On success: triggers a browser download via the returned signed URL and shows a success toast.
- On `ZUGFERD_WRAPPING_FAILED`: error toast with the failure copy above; button remains enabled for retry.

### Loading & skeleton states

- Intake list: 5 skeleton rows (`<Skeleton>` from shadcn) while `listByOrg` is in-flight.
- Intake detail: skeleton blocks for each pane (PDF pane wide block, fields pane stack of label+value blocks, validation pane single block, match pane two skeleton candidate cards).
- Outbound generate button: `<Skeleton>`-tinted button label ("Generating…") + disabled state.

### Accessibility

- All status pills include `aria-label` with the full status name (the visual badge text is already the full word, but the surrounding context uses `aria-describedby` to link the pill to its row description).
- Drop-zone is keyboard-operable: `<input type="file">` is the source of truth, the visual drop-zone is `<label>`-wrapped to forward focus + click. `aria-describedby` points to the helper-text element listing accepted formats and size limit.
- Focus-visible rings everywhere use the existing `--ring` (Deep Teal) at 2px outline + 2px offset.
- AlertDialog reject confirmation: `Tab` order is Reason textarea → Cancel → Reject (destructive). Destructive button never auto-focused.
- Color is never the sole signal: every status pill pairs the color with explicit text + a leading lucide icon (`Clock` for PARSED, `AlertTriangle` for NEEDS_REVIEW/WARNINGS/INVALID, `Link2` for MATCHED, `Check` for CONVERTED/VALID, `X` for REJECTED).
- The intake list table has visible column headers and uses `<caption>` (visually hidden) describing the table contents.
- Intake detail PDF preview pane includes a "Skip preview" link (visually hidden, focusable) jumping to the parsed-fields heading for keyboard users who don't need the visual.

### Responsive

- Mobile (`<md`, ≤768px): single column, actions bar becomes a sticky bottom bar. Drop-zone Dialog uses `<Sheet>` from the bottom for >sm screen real estate.
- Tablet (`md`, 768–1024px): 2-column intake detail with a collapsible PDF preview.
- Desktop (`lg+`, ≥1024px): full 2-column with both panes always visible.

### Internationalization

- DE is the primary launch locale (matches Phase 56 default). All strings ship in EN + DE + GB at the same time; no English-only releases.
- Numbers use `Intl.NumberFormat(locale, { style: 'currency', currency: extractedCurrency })` — already a `formatMoney` helper in `packages/utils/`.
- Dates use `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })` — already wired through `next-intl`.

### Feature flag

- The "Imports" sidebar entry, the split-button "Import e-invoice" item, and the `/invoices/intake/*` routes are all gated behind the `EINVOICE_IMPORT_ENABLED` flag via the existing Unleash wrapper (project memory: `feature_flags_strategy`). When disabled: the sidebar entry is hidden, the split-button shows only "+ New invoice" (no dropdown), and the routes return a 404. The outbound "Download ZUGFeRD PDF" button is NOT flagged — outbound generation is unconditionally available wherever Phase 61 e-invoicing already is.

---

## Component Reuse Summary

| Existing component | Reused in Phase 62 for |
|--------------------|------------------------|
| `apps/web/src/components/ui/button.tsx` | All buttons (no custom variants) |
| `apps/web/src/components/ui/dialog.tsx` | Upload dialog |
| `apps/web/src/components/ui/sheet.tsx` | Mobile upload affordance |
| `apps/web/src/components/ui/dropdown-menu.tsx` | Split-button secondary menu |
| `apps/web/src/components/ui/alert-dialog.tsx` | Reject confirmation |
| `apps/web/src/components/ui/badge.tsx` | All status / level pills (composed via Tailwind class variants — no shadcn fork) |
| `apps/web/src/components/ui/card.tsx` | All intake-detail panes |
| `apps/web/src/components/ui/table.tsx` | Intake list |
| `apps/web/src/components/ui/skeleton.tsx` | Loading states |
| `apps/web/src/components/ui/sonner.tsx` | Toast notifications |
| `apps/web/src/components/ui/tooltip.tsx` | Disabled-button explanations |
| `apps/web/src/components/invoices/einvoice-tab/einvoice-tab.tsx` (Phase 61) | Host for the outbound ZUGFeRD section + "Download ZUGFeRD PDF" button |
| `apps/web/src/components/invoices/einvoice-status-cell.tsx` (Phase 61) | Pattern reference for `intake-status-pill.tsx` |
| `apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx` (Phase 60) | Pattern reference for `intake-validation-status-pill.tsx` (warning-tinted chip vocabulary) |
| `apps/web/src/components/contractors/vat-validation-status-pill.tsx` | Pattern reference for the VAT-ID display in match-candidate cards |

**No new design primitives are introduced.** Every Phase 62 component is a composition of shadcn primitives + project tokens.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — every surface has explicit EN + DE + GB strings, error states are problem + solution, destructive confirmations are explicit
- [x] Dimension 2 Visuals: PASS — composed only from existing `apps/web/src/components/ui/*`, no new primitives, no inline custom SVG, all icons via lucide-react
- [x] Dimension 3 Color: PASS — strict 60/30/10 (background / cards+sidebar / primary teal accent), accent reserved-for list is enumerated, semantic statuses use existing `--success/--warning/--info/--destructive` tokens with `/10`–`/12%` tints
- [x] Dimension 4 Typography: PASS — uses 4 declared roles (body / label / heading / display) mapped to existing `--text-base/--text-sm/--text-xl/--text-2xl`, two weights (400 + 600/700), mono reserved for IDs
- [x] Dimension 5 Spacing: PASS — 4-point scale only (4/8/16/24/32/48), no exceptions
- [x] Dimension 6 Registry Safety: PASS — only shadcn official blocks, all already on disk; zero third-party registries

**Approval:** approved 2026-04-14
