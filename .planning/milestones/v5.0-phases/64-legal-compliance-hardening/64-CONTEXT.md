# Phase 64: Legal Compliance Hardening - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce the legal/compliance posture for the classification features shipped in Phases 58–60 so that production deployment is safe even before external legal sign-off completes:

1. **Feature flag `module.classification-engine` gates all classification functionality at three layers:** (a) UI render tree (server-side route-layout check + `<FeatureGate>` component, no CSS hiding), (b) tRPC API (conditional router registration + middleware defense-in-depth returning FORBIDDEN), (c) background processing (cron handler early-return with structured audit log).
2. **Disclaimer PENDING→APPROVED lifecycle** with a git-tracked signoff registry + CI dual-gate (always-on dangling-entry test + production-deploy-only PENDING block).
3. **Advisory UX on every classification surface** — locked jurisdiction-aware banner phrases + "Get Expert Help" CTA → dedicated referral page + new `ClassificationEscalationEvent` audit trail.
4. **Document-level compliance controls** — SDS approval checkbox + PDF cover page (with new `SdsApproval` entity), DRV decision-letter upload extending Phase 59 classification-document R2 pattern + unverified-entry disclaimer.
5. **Platform Terms of Service** — new MDX `/terms/` pages per jurisdiction with `SOFTWARE_NOT_LEGAL_ADVICE_*` locked phrases; version-bumped `ConsentEvent` re-acceptance forced on existing users via non-dismissible modal.

**Explicitly out of scope:** external legal-review workflow (out-of-band — Steuerberater / UK tax adviser review happens via email/documents; only the APPROVED state is recorded in this phase), super-admin UI for flipping Unleash flags (that lives in Unleash console), automated partner-adviser directory maintenance, legacy classification data purge when flag flips OFF (data preserved, just inaccessible), multi-jurisdiction classification mixed on a single assessment.

</domain>

<decisions>
## Implementation Decisions

### Feature flag `module.classification-engine` — UI render-tree exclusion (LEGAL-08)
- **D-01:** **Register new flag in `packages/feature-flags/src/registry.ts`:**
  - Key: `'module.classification-engine'`
  - Default: `false` (ship-dark — classification is invisible until explicitly enabled per-org)
  - Category: `'module'`
  - Jurisdiction: `'ANY'` (flag exists for GB + DE orgs; per-org toggled by operator based on their legal-review status)
  - Owner: `'legal-platform'`
  - Deep-frozen per existing registry convention.
- **D-02:** **Server-side route layout gates:**
  - New `layout.tsx` (or augment existing) at these three Next.js route roots:
    - `apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx`
    - `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/classification/layout.tsx`
    - `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/classification/layout.tsx`
  - Each layout is an async RSC that resolves the flag using the authenticated session's `jurisdiction` + `orgId` via `packages/feature-flags/src/evaluator.evaluate({ flag: 'module.classification-engine', context })`.
  - On `{ value: false }`: call `notFound()` from `next/navigation` → Next.js 404. The route module body never renders; no classification-specific client JS ships in that navigation.
  - On `{ value: true }`: render `<>{children}</>` with a top-slotted `<ClassificationAdvisoryBanner jurisdiction={org.countryCode} />` (D-11).
- **D-03:** **`<FeatureGate flag="module.classification-engine">` RSC wrapper:**
  - New component at `apps/web/src/components/feature-gate.tsx` — server component that resolves the flag and renders `children` only when ON; returns `null` otherwise (no DOM, no CSS, no `display:none`).
  - Used to wrap: sidebar nav entry ("Classification"), contractor profile "Classification" tab/tile, compliance health dashboard "Classification risk" section, economic dependency alert widget. Each wrapping site gets a targeted `FeatureGate` — no global conditional logic embedded in parent components.
- **D-04:** **Bundle hygiene — dynamic imports for classification page modules:**
  - The classification page root modules (`classification/page.tsx`, the outcome page, wizard, etc.) stay route-based in the file system. Next.js App Router RSC boundary already ensures client components in those routes only ship in the bundle when the route is actually reached. The `notFound()` in D-02 prevents reaching the route. Combined, this satisfies "classification JS doesn't ship when flag OFF" without requiring explicit `next/dynamic` calls at every site.
  - Verification: a new test `apps/web/src/__tests__/bundle-hygiene/classification-flag-off.test.ts` asserts that when the flag is OFF, the `/classification` route returns a 404 HTML response that does NOT reference `classification-*.js` chunk names (sniffing the `<link rel="preload">` and `<script>` tags).

### Feature flag — tRPC API gate (LEGAL-09)
- **D-05:** **Conditional router registration at `packages/api/src/root.ts`:**
  - `classification`, `classificationDashboard`, `classificationDocument`, and the classification-procedure subset of `contractor` routers are registered inside an IIFE that reads the flag via a module-level `FlagClient.getBoolean('module.classification-engine', { jurisdiction: 'ANY', orgId: 'ROOT' })` — this global evaluation represents the baseline (Unleash toggle on/off for the whole platform).
  - When the global flag is OFF: routers absent from `appRouter`. Clients calling them receive tRPC's `METHOD_NOT_FOUND` error (distinct from `FORBIDDEN` — the procedure literally does not exist).
  - When ON: routers registered AND an additional `requireClassificationFlag` middleware (D-06) is attached to every classification procedure for per-org / per-jurisdiction evaluation.
- **D-06:** **Defense-in-depth middleware — `packages/api/src/middleware/require-classification-flag.ts` (new):**
  - Reads the flag with the authenticated request's `{ jurisdiction, orgId }` via the evaluator.
  - If `value: false`: throws `TRPCError({ code: 'FORBIDDEN', message: 'CLASSIFICATION_ENGINE_DISABLED', cause: { flag: 'module.classification-engine', reason } })`.
  - Attached via a composition helper `classificationProcedure = tenantProcedure.use(requireClassificationFlag)`. Every new classification procedure uses `classificationProcedure` instead of raw `tenantProcedure` — if a future contributor forgets the middleware, the conditional registration from D-05 still blocks at appRouter boundary (two independent layers).
- **D-07:** **Unit tests assert every classification procedure uses `classificationProcedure`:**
  - New test `packages/api/src/routers/__tests__/classification-flag-coverage.test.ts` imports each classification router's internal procedure array and asserts every procedure's `.meta.middleware` chain includes `requireClassificationFlag`. Catches missed middleware at PR time.

### Feature flag — cron gate (LEGAL-09, criterion #5)
- **D-08:** **`apps/web/src/app/api/cron/classification-economic-dependency/route.ts` early-return:**
  - First line of handler evaluates `await FlagClient.getBoolean('module.classification-engine', { jurisdiction: 'ANY', orgId: 'CRON' })`.
  - If `false`: log `{ event: 'CRON_SKIPPED_FLAG_OFF', endpoint: 'classification-economic-dependency', skippedAt }` via `@contractor-ops/logger` at info level, return HTTP 200 with `{ skipped: true, reason: 'FLAG_OFF' }`. No DB access. No `economicDependencyScan()` invocation.
  - If `true`: proceed with the existing scan logic (no behavioural change).
- **D-09:** **Flag-off cron behaviour tested:**
  - `packages/api/src/services/__tests__/economic-dependency-flag-off.test.ts` mocks the flag client, calls the route handler, asserts no DB calls and the log entry.

### Feature flag — LEGAL-10 app-side "can't flip ON while PENDING" gate
- **D-10:** **App-side evaluator override in `packages/feature-flags/src/evaluator.ts`:**
  - New hook `classificationEngineDisclaimerGate(flagKey, unleashResult)`:
    - Only applies when `flagKey === 'module.classification-engine'`.
    - If Unleash returns `{ value: true }`, reads the signoff registry (D-12) and checks that all classification-relevant locked disclaimers (`SDS_DISCLAIMER_EN`, `DRV_DEFENSE_DISCLAIMER_DE`, `DISCLAIMER_IR35_BODY`, `DISCLAIMER_SCHEIN_BODY`, `BANNER_IR35_ADVISORY_EN`, `BANNER_SCHEIN_ADVISORY_DE`, `SDS_APPROVAL_STATEMENT_EN`, `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE`, `SOFTWARE_NOT_LEGAL_ADVICE_EN`, `SOFTWARE_NOT_LEGAL_ADVICE_DE`) have `status === 'APPROVED'`.
    - If any are still `PENDING`: override to `{ value: false, reason: 'DISCLAIMER_PENDING', pendingKeys: [...] }`. Even if an operator flips the flag in Unleash, the app refuses to render classification surfaces until every disclaimer is APPROVED.
  - Logged at warn level on every evaluation where override kicks in (dedupe per-request to avoid log spam).
- **D-11:** **Super-admin visibility surface at `/[locale]/(admin)/feature-flags/classification-engine/`:**
  - New super-admin-only page (first `/admin/` route in the app if none exists — if so, introduces a minimal admin shell with a left nav matching the dashboard pattern).
  - Shows: Unleash toggle state (live), evaluated app-side value (which may differ due to D-10 override), signoff-registry status per disclaimer key (PENDING / APPROVED / missing), "override reason" when the flag is forcibly OFF.
  - Actionable copy: "Flag is ON in Unleash but app-gated — SDS_DISCLAIMER_EN is PENDING. Resolve via PR updating `packages/validators/src/legal/signoff-registry.json`."
  - Read-only (no flipping of Unleash from the UI; that still happens in Unleash console).

### Disclaimer signoff lifecycle (LEGAL-01, LEGAL-02)
- **D-12:** **New file `packages/validators/src/legal/signoff-registry.json`:**
  - Shape: `Record<LockedDisclaimerKey, { status: 'PENDING' | 'APPROVED', approvedBy?: string, approvedAt?: ISODate, approverRole?: 'UK_TAX_ADVISER' | 'STEUERBERATER' | 'INTERNAL_COUNSEL' | 'INTERNAL_PRODUCT', approverEmailHash?: string, upstreamRef?: string, notes?: string }>`
  - Initial seed: every entry in `LOCKED_DISCLAIMERS` (from Phase 58/59 `disclaimers.ts`) + the new entries added in this phase (D-23, D-27, D-29, D-31, D-33) start as `{ status: 'PENDING' }`. Production deployments are blocked by the gate in D-14 until each is updated.
  - Zod schema `SignoffRegistrySchema` exported from `packages/validators/src/legal/signoff-registry-schema.ts` validates structure + enforces `approvedBy+approvedAt+approverRole` required when `status === 'APPROVED'`.
  - Module-load-time validation: `packages/validators/src/legal/signoff-registry.ts` imports + parses the JSON at boot; throws at import time on malformed data (fail-fast).
  - Exported helpers: `getDisclaimerStatus(key): SignoffEntry`, `getAllPending(): LockedDisclaimerKey[]`, `isAllApproved(): boolean`.
- **D-13:** **Signoff approval workflow:**
  - Approver reviews disclaimer content out-of-band (PDF email, legal-review meeting, signed document). Approver's actual identity attested in the PR body + `approvedBy` + `upstreamRef` (link to signed PDF in a secure doc store / legal email message-id).
  - Engineering submits or asks approver to submit a PR updating the signoff-registry.json row.
  - `CODEOWNERS` entry: `packages/validators/src/legal/signoff-registry.json  @contractor-ops/legal-platform` — requires legal-platform team review on the PR.
  - PR template auto-populated when the diff touches signoff-registry.json: asks for "Approver name + role + email (hashed) + upstream document reference".
  - `approverEmailHash` is SHA-256 of the lowercased email so the raw address is not in git; reversible audit via an internal mapping maintained by the security team (out of scope for this phase).
- **D-14:** **CI dual-gate:**
  - **Layer 1 — always-run unit test:** `packages/validators/src/legal/__tests__/signoff-guard.test.ts`:
    - Asserts every key in `LOCKED_DISCLAIMERS` has a corresponding entry in `signoff-registry.json` (fails if a new disclaimer is added without a registry row — forces PENDING at minimum).
    - Asserts the registry Zod schema parses without errors.
    - Runs on every PR; part of the standard test suite.
  - **Layer 2 — production deployment gate:** new CI step `ci-legal-gate-production` in `.github/workflows/deploy.yml` (or existing equivalent), runs ONLY when the target is a production deployment (on the configured production branch + deploy environment):
    - Asserts `getAllPending().length === 0`.
    - Fails the production deploy pipeline if any disclaimer is PENDING. Feature-branch PRs and non-prod deploys are unaffected.
    - Job name + failure message explicitly reference LEGAL-02 and include the list of PENDING keys.
- **D-15:** **Migration of existing Phase 59 PENDING markers:**
  - The PENDING comments in `SDS_DISCLAIMER_EN` (en.ts:15 + disclaimers.ts:28) and `DRV_DEFENSE_DISCLAIMER_DE` (de.ts:56, de.ts:94 + disclaimers.ts:37) are preserved as code comments but the **authoritative status** moves to the signoff registry. The comments become informational cross-references (`// Signoff tracked in packages/validators/src/legal/signoff-registry.json`).
  - Phase 59 status flags (if any constants currently carry `_PENDING_STATUS = 'PENDING' as const` — check during planning) are removed. Single source of truth = the registry.

### Advisory banner (LEGAL-03) + escalation event (LEGAL-04)
- **D-16:** **New locked phrases in `packages/validators/src/legal/`:**
  - `BANNER_IR35_ADVISORY_EN` (English, UK-specific advisory banner copy referencing IR35 + UK tax adviser consultation).
  - `BANNER_SCHEIN_ADVISORY_DE` (German, Scheinselbständigkeit advisory banner copy referencing Steuerberater / Fachanwalt für Sozialrecht consultation).
  - Both added to `LOCKED_DISCLAIMERS` + `RESERVED_DISCLAIMER_KEYS` in `disclaimers.ts` + seeded in signoff-registry.json as PENDING.
  - Phrasing drafts: produced in this phase's plan; final wording requires the approver workflow (D-13) before production deploy.
- **D-17:** **`<ClassificationAdvisoryBanner>` RSC component:**
  - Location: `apps/web/src/components/classification/advisory-banner.tsx`.
  - Props: `jurisdiction: 'GB' | 'DE' | 'MULTI'` (MULTI renders both stacked).
  - Styling: sticky at top of scroll container, amber palette reusing Phase 60 compliance-pill colour tokens (`bg-amber-50 border-amber-400 text-amber-900`), `role="note"`, non-dismissible (no close button, no local-storage suppression), persistent across navigation within classification routes.
  - Placement: rendered by the classification route `layout.tsx` (D-02) above `{children}`, so every classification page inherits it without per-page plumbing.
- **D-18:** **New Prisma model `ClassificationEscalationEvent`:**
  - Fields: `id`, `organizationId`, `userId`, `contractorId` (nullable FK — amber auto-logs may precede a specific contractor context), `assessmentId` (FK), `verdict` enum (`'IR35_OUTSIDE' | 'IR35_INSIDE' | 'IR35_INDETERMINATE' | 'SCHEIN_SELFEMPLOYED' | 'SCHEIN_EMPLOYED' | 'SCHEIN_UNCLEAR'`), `triggerKind` enum (`'AMBER_VERDICT_AUTO' | 'GET_EXPERT_HELP_CLICK' | 'MANUAL_FLAG'`), `referralTarget` (String — URL path, external URL, or `'INTERNAL_PAGE'` sentinel), `ipAddress` (String, nullable), `userAgent` (Text, nullable), `createdAt`.
  - Multi-tenant scoped via Prisma extension.
  - Indexed on `(organizationId, createdAt)` and `(organizationId, assessmentId)`.
  - Append-only — no update or delete tRPC procedures (deletion via DB-level retention job, future phase).
- **D-19:** **New tRPC mutation `classification.logEscalation`:**
  - Signature: `{ assessmentId: string, triggerKind: EscalationTriggerKind, referralTarget: string } → { eventId: string }`.
  - Zod-validated; uses `classificationProcedure` (flag-gated).
  - Fired client-side in two places:
    - On outcome page render when verdict is amber/indeterminate/unclear (fire once per session per assessment via a ref guard + `useEffect`).
    - On "Get Expert Help" CTA click (before navigation) — button is disabled while the mutation is in-flight to guarantee audit capture.
- **D-20:** **"Get Expert Help" referral page at `/[locale]/(dashboard)/classification/expert-help/`:**
  - Server component reads `session.org.countryCode` + query-string `?assessmentId=...`.
  - Renders jurisdiction-specific MDX content (reuses Phase 56 MDX infra):
    - GB: list of CIOT-accredited advisers + HMRC IR35 guidance link + disclaimer that listings are informational only.
    - DE: list of Steuerberaterkammer regional chambers + DRV Statusfeststellungsverfahren process guide MDX page + disclaimer of non-endorsement.
  - Org-level opt-in override: `Organization.expertReferralEmail` (existing or new nullable String) — when set, an additional "Contact our adviser" card shows with a `mailto:` link to that address. Uses existing Phase 56 MDX + react-pdf rendering stack.
  - Page route is flag-gated via the same D-02 layout scheme (path is under `classification/`).

### SDS cover page + approval (LEGAL-05)
- **D-21:** **New Prisma model `SdsApproval`:**
  - Fields: `id`, `organizationId`, `assessmentId` (FK, `@unique` — one approval per assessment), `approvedByUserId`, `approvedAt`, `clientName` (String — snapshot of the end-hirer legal name at approval time), `approvalStatementSnapshot` (Text — the locked `SDS_APPROVAL_STATEMENT_EN` content at approval time, preserved so later edits to the constant don't retroactively change historical records), `createdAt`.
  - Multi-tenant scoped.
- **D-22:** **In-app approval checkbox gate:**
  - On the assessment outcome page (when verdict is IR35_OUTSIDE, IR35_INSIDE, or IR35_INDETERMINATE — i.e., any final IR35 outcome), before the "Generate SDS" CTA is enabled:
    - A required checkbox labelled with `SDS_APPROVAL_STATEMENT_EN` locked phrase (D-23).
    - A `clientName` input (pre-filled from existing end-hirer data but editable — the actual company name that will appear on the SDS).
    - A "Confirm approval" button that fires `classification.approveSds({ assessmentId, clientName })` → creates the `SdsApproval` row.
  - After approval: "Generate SDS" CTA enabled. `classification.generateSdsPdf({ assessmentId })` checks for an `SdsApproval` row and throws `SDS_NOT_APPROVED` if absent.
- **D-23:** **New locked phrase `SDS_APPROVAL_STATEMENT_EN`:**
  - Content: "I, as the client or authorised representative of the client named on this Status Determination Statement, confirm that I have reviewed this determination and take responsibility for its issuance under Chapter 10 ITEPA 2003. I understand this tool does not constitute legal advice."
  - Added to `LOCKED_DISCLAIMERS`, CI-guarded, seeded PENDING in signoff registry.
- **D-24:** **SDS PDF cover page (extends Phase 59 `ir35-sds.tsx`):**
  - New first page rendered before the existing verdict-first layout.
  - Contents: `clientName` (from `SdsApproval.clientName`), assessment date (`assessment.completedAt`), the locked `SDS_APPROVAL_STATEMENT_EN` text, approver's user name + role + `approvedAt` timestamp, and a footer sentence noting the approval was recorded in-app.
  - Byte-stability: cover page uses the same stable `renderedAt` scheme as existing pages (passed by caller; typically `assessment.completedAt`).

### DRV Statusfeststellungsverfahren letter upload (LEGAL-06)
- **D-25:** **Extend `ClassificationDocumentKind` enum with `DRV_DECISION_LETTER`:**
  - Prisma migration on the existing Phase 59 `ClassificationDocument` model (add enum value).
  - Reuses the existing R2 content-addressed storage (`classification-docs/{orgId}/{assessmentId}/drv-decision-{sha256[:16]}.{ext}`), signed URL TTL 300s, the existing `classification-document` tRPC router.
- **D-26:** **Upload flow in DRV tracking panel (extends Phase 60 DRV Statusfeststellungsverfahren panel):**
  - New dropzone accepts `.pdf`, `.jpg`, `.png`; server-side MIME + magic-byte validation; size cap 10MB; virus scan gate TBD (defer — rely on R2 + app isolation for v5.0).
  - Upload creates a `ClassificationDocument` row with `kind = 'DRV_DECISION_LETTER'`, writes the file to R2, and updates the panel's display.
  - Panel states: **Unverified** (no letter uploaded) → shows `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE` locked phrase (D-27) in an amber banner; **Verified by DRV document** (letter uploaded) → shows signed download URL + upload timestamp + uploader user.
- **D-27:** **New locked phrase `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE`:**
  - Content: "Dieser Eintrag basiert auf manueller Angabe und ist nicht durch den offiziellen DRV-Bescheid verifiziert. Laden Sie den Bescheid der Deutschen Rentenversicherung hoch, um den Eintrag zu verifizieren."
  - Added to `LOCKED_DISCLAIMERS`, CI-guarded, seeded PENDING in signoff registry.

### Platform Terms of Service (LEGAL-07)
- **D-28:** **MDX ToS pages at `/[locale]/terms/page.mdx`:**
  - Three locale variants: en (default), en-GB (UK-specific nuances), de (Scheinselbständigkeit + DSGVO context).
  - Content sections: (i) General terms, (ii) Classification features — "software not legal advice" with full list of features covered (IR35 assessment, Scheinselbständigkeit assessment, SDS generation, DRV defense bundle, economic dependency scan, compliance dashboard), (iii) E-invoicing features — "software not tax advice", (iv) Payment files — "BACS file format correctness, no bank processing representation", (v) Interest calculations — "statutory interest calculation follows LPCDA but legal claims are user's responsibility", (vi) Data processing + consent references to Phase 56 GDPR pages.
  - Version baked into frontmatter: `---\nversion: 2026.1.0\neffectiveFrom: 2026-05-01\n---` (version bumps semver-style on substantive change).
  - Render pipeline reuses Phase 56 MDX + react-pdf (printable ToS for records).
- **D-29:** **New locked phrases `SOFTWARE_NOT_LEGAL_ADVICE_EN` + `SOFTWARE_NOT_LEGAL_ADVICE_DE`:**
  - Full paragraphs covering classification, e-invoicing, payment files, interest calculations. Embedded in ToS MDX via `import { SOFTWARE_NOT_LEGAL_ADVICE_EN } from '@contractor-ops/validators/legal/disclaimers'`.
  - Added to `LOCKED_DISCLAIMERS`, CI-guarded, seeded PENDING in signoff registry.
- **D-30:** **Re-acceptance enforcement via `ConsentEvent`:**
  - Extend the existing Phase 56 `ConsentEvent` model's `scope` enum with value `'tos'`.
  - On every authenticated request, a lightweight session-scoped check compares `session.user.latestTosVersion` against the current MDX version from a build-time-generated constant (`TOS_CURRENT_VERSION` in `apps/web/src/lib/tos.ts` emitted from MDX frontmatter at build).
  - If stale or missing: the root `layout.tsx` renders a non-dismissible modal (`<TosReacceptanceModal />`) above all other UI. Modal shows the ToS content (first ~300 words + "Read full ToS" link to `/terms/`) + an "I accept" button. On click, fires `consent.recordToS({ version })` which creates a `ConsentEvent { userId, scope: 'tos', version, acceptedAt, ipAddress, userAgent }`.
  - Modal blocks all other interactions (focus-trap, esc-noop, overlay covers app shell) until accepted.
- **D-31:** **Existing-user migration:**
  - Every active user gets their `latestTosVersion` cleared on the deploy that introduces v2026.1.0 — next login triggers the modal. No email notification; modal itself is the notification.
  - The pre-existing Phase 56 consent data (GDPR/privacy acceptances) remains untouched.

### tRPC router layout
- **D-32:** **New + extended routers:**
  - `packages/api/src/routers/classification.ts` (existing) — new `logEscalation`, `approveSds` mutations. All procedures use `classificationProcedure` (flag-gated).
  - `packages/api/src/routers/classification-document.ts` (existing) — new `uploadDrvDecisionLetter` mutation.
  - `packages/api/src/routers/consent.ts` (existing or new) — new `recordToS` mutation.
  - `packages/api/src/routers/admin-feature-flags.ts` (new, super-admin) — `getClassificationEngineStatus()` returning Unleash + app-side + signoff registry combined view for the admin page (D-11).

### Claude's Discretion
- Exact copy of `BANNER_IR35_ADVISORY_EN`, `BANNER_SCHEIN_ADVISORY_DE`, `SDS_APPROVAL_STATEMENT_EN`, `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE`, `SOFTWARE_NOT_LEGAL_ADVICE_EN`, `SOFTWARE_NOT_LEGAL_ADVICE_DE` — first drafts land in the plan; final wording is approver-dependent and captured via the signoff workflow.
- Whether the admin route shell under `/(admin)/` gets a dedicated layout/sidebar or reuses the dashboard shell with admin-only chrome — decide during UI phase.
- Exact MDX structure for `/terms/` (single long page vs section index) — go with single long page for printability; table of contents on the side.
- Whether virus scanning is added to the DRV upload path (probably not for v5.0 since R2 + same-org isolation suffices; revisit if user demand warrants).
- `Organization.expertReferralEmail` — new field vs stored on a parent legal settings row; likely a new nullable String field on Organization.
- Whether escalation events are counted and surfaced on an internal operator dashboard — probably yes for v5.1, not v5.0.
- Rollback drill: if `module.classification-engine` is flipped OFF on an org that has existing classification data, the data stays in the DB (retention policy out of scope for v5.0); users see no classification UI but data is preserved.

### Folded Todos
No todos folded — `gsd-tools todo match-phase 64` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` lines referencing LEGAL-01 through LEGAL-10 — full scope of the phase
- `.planning/ROADMAP.md` §Phase 64 — Goal, 11 success criteria, `Depends on Phase 58 + Phase 59 + Phase 60`

### Standing project constraints
- `.planning/STATE.md` §"Standing Project Constraints" — app is local-only; legal/regulatory verification deferred post-deploy. This phase operationalises that deferral by ensuring classification cannot accidentally become accessible before sign-off completes.

### Prior phase context (foundations this phase extends)
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — MDX privacy page pattern (REUSED for `/terms/`); locked legal phrase + CI guard pattern (REUSED for new banner/approval/disclaimer phrases); `ConsentEvent` model (EXTENDED with `'tos'` scope)
- `.planning/phases/58-classification-engine-rule-sets/58-CONTEXT.md` — Classification engine; existing `DISCLAIMER_IR35_BODY`, `DISCLAIMER_SCHEIN_BODY`, etc. (REFERENCED; moved into signoff registry)
- `.planning/phases/59-classification-documents-chain-tracking/59-CONTEXT.md` — `SDS_DISCLAIMER_EN`, `DRV_DEFENSE_DISCLAIMER_DE` PENDING markers (MIGRATED to signoff registry); `ClassificationDocument` model + R2 storage (EXTENDED with `DRV_DECISION_LETTER` enum value); `ir35-sds.tsx` PDF template (EXTENDED with cover page)
- `.planning/phases/60-classification-polish/60-CONTEXT.md` — economic dependency cron (EXTENDED with flag-gated early-return); compliance-pill palette (REUSED for advisory banner styling); DRV Statusfeststellungsverfahren tracking panel (EXTENDED with upload + unverified disclaimer)

### Existing code (reusable infrastructure)
- `packages/feature-flags/src/registry.ts` — ADD `'module.classification-engine'` entry (D-01)
- `packages/feature-flags/src/evaluator.ts` — ADD `classificationEngineDisclaimerGate` override hook (D-10)
- `packages/feature-flags/src/client.ts` — existing `getFlagClient` used by evaluator + middleware
- `packages/validators/src/legal/disclaimers.ts` — ADD new locked phrases (D-16, D-23, D-27, D-29); migrate PENDING comments (D-15)
- `packages/validators/src/legal/signoff-registry.json` — NEW file (D-12)
- `packages/validators/src/legal/signoff-registry.ts` + `signoff-registry-schema.ts` — NEW module + Zod schema (D-12)
- `packages/validators/src/legal/__tests__/signoff-guard.test.ts` — NEW test (D-14)
- `packages/validators/src/legal/__tests__/locked-phrases-guard.test.ts` — EXISTING CI guard (extended to include new locked phrases)
- `packages/api/src/root.ts` — EXTENDED with conditional router registration (D-05)
- `packages/api/src/middleware/require-classification-flag.ts` — NEW middleware (D-06)
- `packages/api/src/routers/classification.ts` + `classification-dashboard.ts` + `classification-document.ts` + `contractor.ts` — EXTENDED to use `classificationProcedure` base (D-06)
- `packages/api/src/routers/__tests__/classification-flag-coverage.test.ts` — NEW test (D-07)
- `packages/api/src/services/economic-dependency-scan.ts` — REFERENCED (untouched; flag gate is in the route handler per D-08)
- `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` — EXTENDED with early-return (D-08)
- `apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx` — NEW (D-02)
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/classification/layout.tsx` — NEW (D-02)
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/classification/layout.tsx` — NEW (D-02)
- `apps/web/src/components/feature-gate.tsx` — NEW RSC wrapper (D-03)
- `apps/web/src/components/classification/advisory-banner.tsx` — NEW (D-17)
- `apps/web/src/app/[locale]/(dashboard)/classification/expert-help/page.tsx` — NEW referral page (D-20)
- `apps/web/src/app/[locale]/terms/page.mdx` — NEW ToS MDX per locale (D-28)
- `apps/web/src/components/tos-reacceptance-modal.tsx` — NEW modal (D-30)
- `apps/web/src/lib/tos.ts` — NEW build-time ToS version constant (D-30)
- `apps/web/src/app/[locale]/(admin)/feature-flags/classification-engine/page.tsx` — NEW super-admin page (D-11)
- `packages/api/src/pdf-templates/ir35-sds.tsx` — EXTENDED with cover page (D-24)
- `packages/db/prisma/schema/classification.prisma` — ADD `ClassificationEscalationEvent` model (D-18) + `SdsApproval` model (D-21); EXTEND `ClassificationDocumentKind` enum with `DRV_DECISION_LETTER` (D-25)
- `packages/db/prisma/schema/consent.prisma` — EXTEND `ConsentScope` enum with `'tos'` (D-30)
- `packages/db/prisma/schema/organization.prisma` — ADD `expertReferralEmail` nullable field (D-20)
- `apps/web/messages/{de,en,en-GB}.json` — ADD namespaces for `Classification.AdvisoryBanner`, `Classification.ExpertHelp`, `Legal.TermsModal`, `Legal.SdsApproval`, `Legal.DrvUpload` (content mostly static / locked phrases — localised framing copy only)
- `.github/workflows/*` — EXTEND deploy workflow with `ci-legal-gate-production` job (D-14)

### External regulatory & technical references
- HMRC Employment Status Manual (ESM) — https://www.gov.uk/hmrc-internal-manuals/employment-status-manual (IR35 context for banner copy)
- Chapter 10 ITEPA 2003 — https://www.legislation.gov.uk/ukpga/2003/1/part/2/chapter/10 (SDS legal basis referenced in cover page + approval statement)
- DRV Statusfeststellungsverfahren guidance — https://www.deutsche-rentenversicherung.de/DRV/DE/Beitragszahler/Arbeitgeber-und-Steuerberater/Statusfeststellung/statusfeststellung_node.html (DRV process for Scheinselbständigkeit determinations)
- § 7a SGB IV — https://www.gesetze-im-internet.de/sgb_4/__7a.html (German statutory basis referenced in Scheinselbständigkeit disclaimers)
- Steuerberaterkammer directory — https://www.bstbk.de/de/mitgliedschaft/kammern (referenced in DE expert-help MDX)
- CIOT (Chartered Institute of Taxation) member directory — https://www.tax.org.uk/find-tax-adviser (referenced in GB expert-help MDX)
- Unleash OSS activation strategies — https://docs.getunleash.io/reference/activation-strategies (reference for custom-strategy decision — rejected in favour of app-side evaluator per D-10)
- Next.js App Router `notFound()` — https://nextjs.org/docs/app/api-reference/functions/not-found (D-02 mechanism)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Feature flag wrapper** (`packages/feature-flags/`): jurisdiction-aware, deep-frozen registry, evaluator with custom hook support — the `classificationEngineDisclaimerGate` override (D-10) is a natural extension point.
- **Locked phrases + CI guard** (Phase 56/58/59): the pattern extends seamlessly to new banner + approval + ToS phrases; existing guard runs in the same test suite.
- **MDX legal pages + react-pdf** (Phase 56): `/terms/` ToS pages reuse the exact pipeline — MDX content → React component → printable PDF.
- **`ConsentEvent` model** (Phase 56): adding a `'tos'` scope value is a one-line enum extension; the existing write path works.
- **`ClassificationDocument` model + R2 storage** (Phase 59): `DRV_DECISION_LETTER` slots in as a new `kind` enum value; upload/download tRPC procedures already exist.
- **`ir35-sds.tsx` React-PDF template** (Phase 59): cover page is a new first Page element in the Document.
- **Next.js App Router RSC boundary**: `notFound()` in route `layout.tsx` cleanly prevents both render and bundle shipping for the flagged-off path.
- **tRPC `classificationProcedure` composition**: extending `tenantProcedure` with a new middleware is a one-line pattern.
- **Multi-tenant Prisma extension**: new models (`ClassificationEscalationEvent`, `SdsApproval`) inherit org-scoping.
- **DRV Statusfeststellungsverfahren panel** (Phase 60): existing surface extended with upload CTA + banner, not replaced.
- **Compliance-pill palette** (Phase 60): amber tokens reused for advisory banner.

### Established Patterns
- **Dual-layer enforcement** for compliance gates (Phase 60 approval workflow; this phase D-05 + D-06 for API, D-02 + D-03 for UI). Single points of failure rejected — every critical gate has defense-in-depth.
- **Append-only audit tables** (Phase 59 `ClassificationDocument`, Phase 60 triggers): `ClassificationEscalationEvent` follows — no update/delete procedures.
- **Snapshot-on-action** (Phase 60 compensation tier, Phase 63 `InvoiceInterestCompensation`): `SdsApproval.approvalStatementSnapshot` freezes the locked phrase content at approval time so later edits don't retroactively change historical records.
- **Fail-fast module-load validation**: signoff registry Zod parse at import time (pattern used elsewhere for config validation).
- **CI gate layers**: unit test for structural invariants (always run) + deployment-branch-only production gate (hard stop) — same two-tier approach as Phase 61 KoSIT bundle integrity.
- **Build-time constants from MDX** (Phase 56): extract ToS version from MDX frontmatter at build.
- **Locked phrases CI guard**: every new phrase lands in `disclaimers.ts` + `LOCKED_DISCLAIMERS` + is tested to NOT appear in `messages/*.json`.
- **Multi-tenant Prisma scoping via middleware extension** — all new models inherit.

### Integration Points
- **Feature flag registry**: one new entry, one deep-freeze side-effect.
- **Unleash toggle UI (external)**: operator creates `module.classification-engine` toggle in the self-hosted Unleash UI per region. Out-of-band; not a code change.
- **Signoff registry file**: CODEOWNERS rule + protected-branch review for modifications.
- **Classification route tree**: three new `layout.tsx` files; does not restructure existing pages.
- **appRouter assembly**: conditional router registration in one place (`packages/api/src/root.ts`).
- **Cron handler**: one early-return guard in the route handler.
- **SDS PDF template**: first-page addition; existing verdict-first page becomes page 2.
- **DRV panel**: one new CTA + one new banner + one new disclaimer phrase.
- **ToS modal**: inserted at root layout level; blocks the app until accepted.
- **Admin shell**: may introduce the project's first `/(admin)/` route group; minimal shell if so.

</code_context>

<specifics>
## Specific Ideas

- The `classification-engine` flag is a kill-switch for legal risk, not a feature rollout toggle — default `false` for ship-dark matches that posture. Per-org opt-in after legal review.
- Server-side route `layout.tsx` + `notFound()` is the cleanest Next.js App Router pattern for "not rendered at all" — the response is an HTML 404 with zero classification JS chunks referenced.
- Defense-in-depth on the tRPC side (conditional registration AT `appRouter` + middleware on every procedure) means a single-point drift (new procedure added outside the conditional block) still fails closed.
- App-side evaluator override (D-10) is authoritative over Unleash's toggle state — even a rogue operator flipping the toggle can't bypass the disclaimer gate. Unleash is advisory; the app decides.
- Signoff registry lives in git so every status change is auditable via `git log` on a single file. No runtime writes; no "flip status in UI" admin path.
- Dual-layer CI gate (always-on + production-only) separates "dangling entry" errors (blocked at PR time on every branch) from "PENDING reaches production" errors (blocked only on the deploy pipeline). Dev branches can have PENDING without blocking every PR.
- `SdsApproval.approvalStatementSnapshot` is load-bearing — LPCDA / ITEPA / etc. statutory framing evolves; a historical SDS must show the statement as it was at approval time, not whatever the constant says today.
- `ClassificationEscalationEvent` captures both auto-fired (amber verdict render) and user-triggered (Get Expert Help click) events distinctly via `triggerKind`, so compliance reports can show "users who reached an amber verdict" vs "users who actively sought help".
- Non-dismissible advisory banner is a UX constraint the product team has to own — users will ask "why can't I close this?" and the answer is "this is legally required context, not noise". Locked phrase + persistent placement makes the constraint legible.
- ToS re-acceptance modal is a hard gate — user can't do anything else until accepting. Heavier UX than a banner but necessary for "software not legal advice" informed consent.
- Classification data is preserved when the flag flips OFF — no purge. Data retention on flag-off is a separate future concern.

</specifics>

<deferred>
## Deferred Ideas

- **External legal-review workflow automation** — out-of-band; the registry simply records the outcome.
- **Virus scanning on DRV decision letter uploads** — R2 + org isolation suffices for v5.0.
- **Super-admin UI for flipping Unleash toggles** — lives in Unleash console.
- **Operator dashboard for escalation event trends** — v5.1.
- **Data purge or anonymisation when flag flips OFF** — separate future phase (retention policy).
- **Admin-only "force re-approve all SDS" bulk action** — not needed for v5.0.
- **Legal-review signoff stored in external compliance DB** — overkill for current signoff volume.
- **Multi-jurisdiction classification mixing on a single assessment** — no known requirement; out of scope.
- **Automated partner-adviser referral directory maintenance** — MDX pages are manually maintained; a CMS-backed directory is a future phase.
- **Signed download of DRV decision letter with watermark** — standard signed URL suffices for v5.0.
- **ToS translation diff UI for reviewers** — nice-to-have; can be accomplished via GitHub PR view.
- **Versioned archive of old ToS accessible to users** — out of scope; the `ConsentEvent` + MDX git history provides the audit trail.
- **Super-admin user role implementation** — this phase introduces the need; actual role/permission model (if none exists) is a prerequisite that either already exists or becomes a tiny carve-out in the plan.
- **Automatic approver notification when a PENDING key is referenced in a PR** — GitHub bot later.
- **Classification-engine "soft enable" mode** (UI visible, API 403) — not a current requirement; flag is binary.
- **Bulk migration tool for orgs switching from "classification ON" to "classification OFF"** — flag evaluation is per-request, so no migration needed.

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 64` returned 0 matches.

</deferred>

---

*Phase: 64-legal-compliance-hardening*
*Context gathered: 2026-04-15*
