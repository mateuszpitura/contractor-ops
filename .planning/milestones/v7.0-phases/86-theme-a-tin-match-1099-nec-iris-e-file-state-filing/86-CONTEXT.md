# Phase 86: Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

The **year-end US information-return loop**, end-to-end on the data captured in Phase 85:

1. **IRS TIN-Matching** (US-FORM-03) — validate a recipient's name/TIN against IRS e-Services with a 24h cache, retry, and admin escalation on mismatch (never a hard block).
2. **1099-NEC generation** (US-FORM-04) — per-recipient, tax-year-keyed threshold (`$2,000` TY2026 per OBBBA, stored as a config table NOT a constant), CORRECTED-form support, recipient Copy-B PDF, audit-immutable archive.
3. **IRIS e-file** (US-FORM-05) — build + XSD-validate the IRIS XML, transmit, parse the acknowledgement. IRIS is the primary/mandatory path; FIRE is documented as a legacy fallback only (no FIRE code).
4. **Per-state 1099 filing** (US-FORM-07) — Combined Federal/State Filing (CFSF) auto-forward where eligible, plus a separate-state output for the non-CFSF direct-file states.

**NOT this phase:**
- 1042-S, US worker classification (federal/AB5/§530), Determination Letter, 1099-K tracker → **Phase 87**.
- The actual **24% backup-withholding payout reduction** → **Phase 88** (this phase only records the flag).
- ACH/wire payment rails, USD-as-first-class → **Phase 88**.
- Official **W-9 / W-8BEN / W-8BEN-E** intake-form PDFs (deferred from P85 D-06) → stay deferred to **Phase 87** (1042-S also needs foreign-payee recipient PDFs). This phase renders only the **1099-NEC Copy-B** PDF.
</domain>

<decisions>
## Implementation Decisions

### IRIS E-File Transmission (US-FORM-05)
- **D-01:** **Manual-upload is the DEFAULT, TCC-independent transmit path.** `buildIrisXml()` → `xsdValidate()` (against the IRS XSDs, validated in CI mirroring the XRechnung KoSIT pattern) → admin downloads the validated `.xml` and uploads it to the IRS IRIS portal by hand. This ships and works with **no TCC**, never blocking GA on the ~45-day enrollment clock. Matches the local-only / no-product-theater posture.
- **D-02:** **Live A2A is built but dark.** The SOAP/MTOM A2A transmit + ack-poll is implemented behind a flag (`iris-a2a-transmit`, registered **PENDING**), exercised only once the IRS TCC is approved. FIRE is **documentation-only** (legacy fallback note), no code.
- **D-03:** **Transmitter-adapter seam** mirroring the payment-export factory: a `TaxFilingTransmitter` interface with `ManualDownload` (default), `IrisA2A` (flag-gated), and `Vendor` (stub — Sovos / 1099Pro fallback path if TCC is never approved). One generation pipeline, swappable transmit tail.
- **D-04:** **One ack parser, both paths.** For manual filing, the admin **uploads the acknowledgement file IRS returns**; the SAME ack-parser used by the A2A path consumes it and updates submission status (Accepted / Rejected / Partial) + `writeAuditLog`. Guarantees the parser is exercised in production even while A2A is dark, and rejection details stay structured.

### 1099-NEC Generation (US-FORM-04)
- **D-05:** **Trigger = on-demand admin batch + notify-only year-end cron.** An admin runs "Generate 1099 batch" for a tax year, reviews, then files. A January cron (`createCronLogger`, registered in `apps/cron-worker` registry) **only notifies** that the batch is due — it never auto-generates or auto-transmits. Human stays in the loop before any immutable archive + IRS file.
- **D-06:** **Threshold aggregation basis = payments settled in the tax year, USD at payment date.** Sum box-1 nonemployee comp by **payment (settlement) date** within the calendar tax year, converting any non-USD payout at the **payment-date FX rate**, aggregated **per recipient per payer-org**. IRS cash-basis furnishing. Threshold comes from a **tax-year-keyed config table** (`$2,000` TY2026), not a constant.
- **D-07:** **Box 4 (federal backup withholding)** is populated when the recipient's W-9 backup-withholding flag is set or a TIN C-notice/mismatch exists (see D-12). The amount **withheld** is a Phase 88 concern; Phase 86 reports what is recorded.
- **D-08:** **CORRECTED form = supersede, not mutate.** A correction inserts a new immutable `Form1099Nec` row that supersedes the prior one (reuses the P85 `TaxFormSubmission` immutable+supersede idiom). The original filed record is never edited.
- **D-09:** **Recipient Copy-B PDF rendered with the existing `@react-pdf/renderer` infra** (the deferred filing-PDF stack from P85 D-06 now exists). **Delivery is portal-download gated on affirmative IRS electronic-delivery consent** — the contractor must consent to e-furnishing before downloading; **no consent → flagged for paper/manual**. The immutable PDF is archived either way.

### IRS TIN-Matching (US-FORM-03)
- **D-10:** **Run at W-9 intake AND revalidate the whole batch at year-end** before 1099 generation. Earliest mismatch signal (feeds the backup-withholding decision) + a pre-filing re-check to catch new/changed TINs. The 24h cache keeps re-checks cheap.
- **D-11:** **Mock `TinMatchClient` behind an adapter seam; logic shipped; live client flag-gated.** The 24h-cache + retry + admin-escalation logic is built fully against a `TinMatchClient` interface with a deterministic mock; the real IRS e-Services client sits behind a flag (PENDING), dark until the **PAF (Principal/Responsible Official) enrollment** clears — a separate operational prerequisite from the IRIS TCC. Consistent with D-01/D-02.
- **D-12:** **Mismatch → auto-set backup-withholding flag + escalate; 1099 still generates.** A TIN mismatch creates an admin escalation AND sets the recipient's backup-withholding flag (recorded now per IRS B-notice logic; the 24% payout reduction is enforced in Phase 88). It is **never a hard block** — the return still generates with the TIN as captured, and the mismatch is surfaced.

### Per-State Filing / CFSF (US-FORM-07)
- **D-13:** **CFSF auto-forward indicator + per-state config table + downloadable file for non-CFSF states.** Set the Combined Federal/State Filing state code in the IRIS B-records so the IRS auto-forwards to CFSF-participating states (no separate transmission). Maintain a **per-state config table** (CFSF participation + filing threshold + state-withholding-box rules). For the ~7 non-CFSF / direct-file states, produce a downloadable state output.
- **D-14:** **Non-CFSF output = per-state data file (CSV/summary) + documented manual-portal guidance.** A state-scoped file (recipients, amounts, state income/withholding boxes) plus per-state manual-filing steps — **no bespoke per-state e-file integrations or credentials**. Consistent with the IRIS manual-upload + local-only posture; a per-state e-file format can land later if a customer requires it.

### Cross-Cutting (carried forward — not re-asked)
- **D-15:** **Whole surface gated on `module.us-expansion`** via `require-us-expansion-flag.ts` + conditional `root.ts` spread (mirrors P85). New `iris-a2a-transmit` (and any TIN-match-live) flags register **PENDING** in the signoff registry per FOUND7-02.
- **D-16:** **Immutable + supersede archive** for `Form1099Nec` (and IRIS submission records) — append-only, mirrors P85 `TaxFormSubmission` + `WhtCertificate`.
- **D-17:** **Retention registration:** register `Form1099Nec` → `'1099-NEC'` (4yr) in `MODEL_RETENTION_TYPE` (`packages/db/src/retention-policy.ts`) so the data-purge chokepoint enforces IRS 4-year retention (7yr for backup-withholding records). Closes the P83 wiring point.
- **D-18:** **Adviser-verify posture** — 1099-NEC, IRIS output, threshold config, and treaty/withholding figures ship with "needs jurisdiction-specific legal/tax-adviser verification before production deploy" annotations (local-only / legal-deferred). No artifact is presented as final legal advice.
- **D-19:** **Audit + idempotency** — sign/transmit/correct/reveal/escalate actions go through `writeAuditLog`; the batch-generation + transmit operations use `packages/api/src/lib/idempotency.ts` (reserve/complete/clear) so a retried batch never double-files.
- **D-20:** **i18n** — admin/portal-facing strings (1099 batch UI, recipient PDF e-delivery consent, escalation surface) at parity across en / en-US / de / pl / ar (RTL) per the standing rule.

### Claude's Discretion
- Exact new Prisma models/columns: `Form1099Nec` (+ CORRECTED supersede chain), the IRIS submission/ack record, the tax-year threshold config table, and the per-state CFSF config table — planner decides shapes, preserving tenant-owning model conventions (never add to `globalModels`; cross-org leak test per new model).
- The `TaxFilingTransmitter` / `TinMatchClient` interface signatures and where the seams live (`packages/integrations` base-adapter vs a finance-local factory like `peppol-adapter-factory`).
- IRIS XML builder mechanics (fast-xml-parser `XMLBuilder` vs hand-roll) and which IRS XSDs to bundle + how the CI XSD-validation job is wired (mirror `packages/einvoice` validator-bundle).
- FX-rate source for non-USD → USD payment-date conversion (reuse an existing rate source if present).
- 1099-NEC Copy-B PDF template layout (react-pdf), and the e-delivery-consent storage shape.
- Which specific states populate the non-CFSF direct-file set + the CFSF participation seed data.
- Whether TIN-match interactive (≤25) vs bulk (≤100k) mode is modeled now or left to the live-client phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — US-FORM-03, US-FORM-04, US-FORM-05, US-FORM-07 verbatim; line 19 OBBBA `$2,000` threshold correction (backlog "$600" is stale); US-INFRA-03 retention.
- `.planning/ROADMAP.md` (Phase 86 entry) — goal + 4 success criteria + research flag (IRIS A2A hand-build XML / XSD-validate / transmitter seam / PAF + TCC as plan-phase ops checklist items). Phase 87/88 entries for downstream scope this feeds.
- `.planning/milestones/v7.0-BACKLOG.md` — A1 tax-form intake block (US-FORM-03/04/05/07), IRIS-vs-FIRE cutover (open item #5, research-gated before US-FORM-05 plan-phase), local-only/legal-deferred annotation rule (line 227), AI-integration candidates (line 306).
- `.planning/phases/85-theme-a-w-form-intake-tax-treaty-engine/85-CONTEXT.md` — W-form intake, `TaxFormSubmission` immutable+supersede, treaty-rate engine, `module.us-expansion` gating, ESIGN attestation, D-06 PDF deferral this phase now picks up (1099-NEC only).
- `.planning/phases/82-...` & `83-...` CONTEXT.md — add-on/flag registry + US region routing + R2 tax-archive bucket + IRS retention resolver that this phase registers into.

### TIN-Match + filing engine (services to mirror)
- `packages/api/src/services/tax-form.service.ts` — immutable snapshot + ESIGN attestation idiom to mirror for `Form1099Nec`.
- `packages/api/src/services/treaty-rate.service.ts`, `tax-form-routing.ts` — P85 resolution/routing services this composes with.
- `packages/db/prisma/schema/tax.prisma:86-113` — `TaxFormSubmission` (DRAFT/ACTIVE/SUPERSEDED) supersede model; `WhtCertificate:45-68` immutable-snapshot analog.
- `packages/api/src/lib/idempotency.ts:90-145` — reserve/complete/clear for batch-generation + transmit (D-19).
- `packages/api/src/services/audit-writer.ts:61-137` — `writeAuditLog` for sign/transmit/correct/escalate (D-19).

### IRIS XML build + XSD validation (the closest in-tree analog)
- `packages/einvoice/src/profiles/xrechnung-de/generator.ts` — `fast-xml-parser` `XMLBuilder` hand-built XML pattern for the IRIS XML.
- `packages/einvoice/src/profiles/xrechnung-de/validator.ts` + `validator-bundle/*.xsd` — XSD validation (libxmljs2, SSRF/XXE-safe) + how a validator bundle is shipped and run in CI.

### Transmitter + external-client seam
- `packages/api/src/services/payment-export.ts` + `routers/finance/payment-export-router.ts` — export-format factory + lock/compliance-snapshot writer; the `TaxFilingTransmitter` factory mirror.
- `packages/integrations/src/adapters/base-adapter.ts:42-100` — abstract adapter (OAuth/credential/retry defaults) for the IRS TIN-Match e-Services client.
- `packages/api/src/services/peppol-adapter-factory.ts:35-64` — credential-decrypt + pinned-URL (SSRF-safe) pattern for a new IRS client.

### PDF, cron, retention, flag-gating
- `packages/api/src/services/classification-document-render.ts`, `late-payment-claim-pdf.ts`, `pdf-templates/*.tsx` — `@react-pdf/renderer` `renderToBuffer` pattern for the 1099-NEC Copy-B PDF (D-09).
- `apps/cron-worker/src/jobs/registry.ts:29-108` + `runner.ts` + `index.ts` — register the notify-only year-end reminder job (D-05).
- `packages/db/src/retention-policy.ts:13-58` + `apps/cron-worker/src/jobs/handlers/data-purge.ts:43-45` — register `Form1099Nec` in `MODEL_RETENTION_TYPE` (D-17).
- `packages/api/src/middleware/require-us-expansion-flag.ts:29-47` + `packages/api/src/root.ts` — flag gating + conditional router spread (D-15).
- `packages/feature-flags/src/registry.ts` — register `iris-a2a-transmit` (+ live-TIN-match) flags PENDING.

### Documentation-follows-code (update in the same change set)
- `.planning/brain/wiki/domains/` (US-tax / year-end filing domain page — extend the P85 us-tax-forms page or add a sibling), `wiki/structure/api-routers-catalog.md` (new 1099/IRIS/TIN-match procedures), `wiki/structure/prisma-schema-areas.md` (`Form1099Nec` + IRIS submission + config tables), `wiki/structure/cron-jobs.md` (year-end reminder job), `wiki/integrations/` (IRS IRIS + e-Services TIN-Matching), `wiki/patterns/feature-flags.md` (`iris-a2a-transmit`), `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for any new invariant.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **P85 tax services + `TaxFormSubmission`** — immutable snapshot + supersede chain is the exact shape for `Form1099Nec` (CORRECTED = supersede, D-08).
- **`@react-pdf/renderer@3.4.5`** (`classification-document-render`, `late-payment-claim-pdf`, `pdf-templates/*.tsx`) — the deferred filing-PDF stack already exists; renders the 1099-NEC Copy-B (D-09).
- **XRechnung CII builder + KoSIT validator** (`packages/einvoice`) — `fast-xml-parser` build + libxmljs2 XSD validation + CI-bundled schemas = the template for the IRIS XML + XSD-validate-in-CI requirement.
- **Payment-export factory** (`payment-export.ts`, `payment-export-router.ts`) — format-factory + export-lock idiom for the `TaxFilingTransmitter` seam.
- **Integration adapter base + peppol-adapter-factory** — SSRF-safe credential-decrypt + pinned-URL pattern for the IRS TIN-Match e-Services client.
- **Cron registry** (`apps/cron-worker`) — register the notify-only year-end reminder (`createCronLogger`).
- **`idempotency.ts`, `audit-writer.ts`** — batch dedupe + sensitive-action audit.
- **Retention resolver** (`retention-policy.ts` + `data-purge` chokepoint) — `MODEL_RETENTION_TYPE` shipped EMPTY; register `Form1099Nec` to enforce IRS 4yr (P83 wiring point).
- **`require-us-expansion-flag.ts`** — per-request + conditional-spread US gating.

### Established Patterns
- **Adapter-seam + mock + flag-gated live client** (mirrors how external integrations stay opt-in) — both IRIS A2A transmit (D-02/03) and TIN-Match live client (D-11) use it.
- **Immutable, supersede-able compliance records** — `Form1099Nec` + IRIS submission follow `TaxFormSubmission`/`WhtCertificate`.
- **Hand-built XML → XSD validation in CI** — established by `packages/einvoice`; reused for IRIS.
- **Auto-detect/record + admin escalation, never hard-block** (reverse-charge / P85 D-10) — TIN-mismatch escalation (D-12) follows the same shape.
- **Tax-year-keyed config tables, not constants** (threshold $2,000 TY2026; per-state CFSF table) — avoids the stale-`$600` constant trap.
- **No hardcoded user-facing strings; i18n parity en/en-US/de/pl/ar(RTL)** (D-20).

### Integration Points
- TIN-Match runs at W-9 intake (extends the P85 portal/staff tax-form surface) and at year-end batch.
- 1099-NEC aggregation reads settled payments (P88 payment domain feeds amounts; this phase consumes payment-date + currency).
- Backup-withholding flag set here is **read** by Phase 88 to actually reduce payout 24%.
- IRIS B-records carry the CFSF state code → IRS auto-forward; non-CFSF states get a separate downloadable file.
- Recipient PDF + IRIS XML archived to the US R2 tax-archive bucket (P83) under IRS retention (D-17).

</code_context>

<specifics>
## Specific Ideas

- **Build the deterministic core, defer the credentialed tail.** The XML generator, XSD validation, ack parser, TIN-match logic, batch aggregation, and PDF all ship and are testable with no live IRS credentials. Only the live A2A transmit and live TIN-match e-Services calls are flag-gated dark until TCC/PAF enrollment clears — so GA never blocks on IRS enrollment timelines.
- **One ack parser exercised in both paths** — the manual-upload flow feeds the same parser the A2A path uses, so the parser isn't dead code while A2A is dark.
- **Mechanical filing ≠ verdict** — 1099-NEC generation is a deterministic published-threshold computation (like reverse-charge / treaty lookup), not the classification-as-verdict liability the product deliberately avoids. Figures are adviser-verify-annotated.
- **CFSF does the heavy lifting** — relying on IRS auto-forward for participating states keeps state filing proportionate; only the ~7 non-CFSF states need a separate (manual) output.
- **Notify-only cron** — a tax artifact that hits an immutable archive + the IRS must never be generated/filed without a human reviewing first.

</specifics>

<deferred>
## Deferred Ideas

- **Live IRIS A2A transmit (SOAP/MTOM)** — built but dark behind `iris-a2a-transmit`; activated when the IRS TCC is approved.
- **Live IRS e-Services TIN-Matching client** — mock now; live behind a flag once PAF enrollment clears.
- **Vendor transmitter (Sovos / 1099Pro)** — stub seam only; a real fallback path if the TCC is never approved.
- **Actual 24% backup-withholding payout reduction** — flag is recorded here; enforcement is **Phase 88**.
- **Official W-9 / W-8BEN / W-8BEN-E intake-form PDFs** — stay deferred to **Phase 87** (1042-S also needs foreign-payee PDFs); P86 renders only the 1099-NEC Copy-B.
- **Bespoke per-state direct e-file integrations** — per-state CSV/summary + manual guidance now; per-state e-file format/credentials only when a customer requires it.
- **FIRE system code** — documentation-only legacy fallback; no implementation.
- **1042-S, US classification (federal/AB5/§530), Determination Letter, 1099-K tracker** — **Phase 87**.

None of these expand the phase scope — discussion stayed within the TIN-match → 1099-NEC → IRIS → state-filing boundary.

</deferred>

---

*Phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing*
*Context gathered: 2026-06-16*
