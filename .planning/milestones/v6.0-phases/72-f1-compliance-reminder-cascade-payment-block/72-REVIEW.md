---
phase: 72-f1-compliance-reminder-cascade-payment-block
status: issues-found
depth: deep
reviewed: 2026-06-01
findings_critical: 0
findings_high: 2
findings_medium: 4
findings_low: 5
findings_info: 3
total: 14
focus: standards + quality (beyond lint) — SOLID/DRY, i18n, tenant-scoping, transaction integrity, audit
---

# Phase 72 Code Review — F1 Compliance: Reminder Cascade + Payment Block

Deep review of Phase 72 production source. Lint-catchable issues are NOT re-reported
(a deterministic guard pass already ran). This focuses on logic/i18n/tenant/audit
problems that static guards cannot see. The previously committed `status: clean`
REVIEW.md was an inline-orchestrator stub (the gsd-code-reviewer agent was unavailable
in that runtime); it missed the i18n contract breaks below. This supersedes it.

## Scope reviewed

Core production files (tests / generated client / locale JSON / .planning excluded):
- `packages/api/src/services/compliance-reminder-scan.ts`
- `packages/api/src/services/compliance-payment-gate.ts`
- `packages/api/src/services/compliance-recovery.ts`
- `packages/api/src/services/payment-export-compliance-snapshot.ts`
- `packages/api/src/services/approval-engine.ts` (+ `operators/{registry,compliance-critical,index}.ts`)
- `packages/api/src/routers/finance/payment.ts`
- `packages/api/src/routers/core/approval.ts` (resumeFromCompliance)
- `packages/api/src/routers/compliance/classification.ts` (recovery + upload-outcome wiring)
- `packages/api/src/services/cron-dedup.ts`
- `apps/cron-worker/src/jobs/handlers/reminders/index.ts`
- `apps/web-vite/src/components/payments/{payment-block-modal.tsx, new-payment-run-dialog/step-review-container.tsx, hooks/use-payment-run-step-review.ts}`
- `packages/feature-flags/src/registry.ts` (isPaymentBlockEnforced)
- `packages/lint-guards/src/payment-gate-guard/run-guard.ts`
- 3 additive migrations under `packages/db/prisma/schema/migrations/`

---

## Findings

### HIGH

#### H-1 — Payment-block modal renders RAW i18n key paths as document labels (label-key contract is broken end-to-end)
- **Files:** `packages/api/src/services/compliance-payment-gate.ts:194-197` (`getDocumentTypeLabelKey`) ↔ `apps/web-vite/src/components/payments/payment-block-modal.tsx:58-60,121` (`labelKeyTail` + `t(...)`) ↔ `apps/web-vite/messages/{en,de,pl,ar}.json` (`Compliance.documentType.*`).
- **Problem:** The server emits the label key as
  - `compliance.documentType.${policyRuleId}` when a rule id exists, or
  - `compliance.documentType.${documentType.toLowerCase()}` otherwise.
  `policyRuleId` values are `<jurisdiction>.<doc>@v<N>` (e.g. `uk.utr@v1`, verified in `packages/compliance-policy/src/policies/*.ts`). So the emitted key is `compliance.documentType.uk.utr@v1`. The modal strips the leading `compliance.` and looks up `documentType.uk.utr@v1` under the `Compliance` namespace.
  But the actual message tree is `Compliance.documentType.compliance-policy-engine.<jurisdiction>.<rule>` (extra `compliance-policy-engine` segment, and **no** `@v1` suffix). The lookup path can never match. i18next then echoes the raw key, so every contractor-reason line displays literal text like `documentType.uk.utr@v1` instead of "HMRC UTR".
- **Impact:** The entire payment-block modal — the user-facing surface of the COMPL-05 feature — shows unintelligible key strings for every blocked document, in all four locales. Lint cannot catch this (cross-package string contract). The broken `i18n:code-coverage` guard would also miss it.
- **Fix:** Make the producer key match the bundle. Either (a) change `getDocumentTypeLabelKey` to emit `compliance.documentType.compliance-policy-engine.<jurisdiction>.<docNamespace>` by parsing the rule id via `parsePolicyRuleId` (strip `@vN`, split jurisdiction/doc), or (b) flatten the message tree to the keys the server already emits and drop the `compliance-policy-engine`/version segments. Add a unit test asserting `t(labelKeyTail(getDocumentTypeLabelKey('UTR','uk.utr@v1')))` resolves to a real string for at least one rule per jurisdiction. Confirm the `documentType.toLowerCase()` fallback (null policyRuleId) also maps to a real bundle key.

#### H-2 — Compliance-expiry digest notification is hardcoded English; no i18n, no localized document label
- **File:** `packages/api/src/services/compliance-reminder-scan.ts:347-372` (`dispatchDigest`).
- **Problem:** `title`, `body`, and each line are built as literal English strings:
  - `` `${group.fires.length} compliance document(s) expiring soon` ``
  - `` `The following compliance documents need attention:\n\n${lines.join('\n')}` ``
  - `` `• ${f.contractorDisplayName} — ${f.documentType} (${f.band}, expires ${dateStr})` ``
  The notification dispatcher (`notification-service.ts:317-326` `resolveCopy`) only localizes `title`/`body` when they match the dotted-i18n-key regex `^[A-Za-z][\w$]*(\.[A-Za-z][\w$]*)+$`. These strings contain spaces/punctuation, so they are stored and delivered verbatim. German, Polish, and Arabic (RTL) orgs all receive an English-only digest. `f.documentType` is also the raw enum (e.g. `UTR`), not a localized label.
- **Impact:** Direct violation of the i18n standard (en/de/pl/ar) for a user-facing notification. This is the only correct in-Phase-72 path that emits user copy, and it bypasses i18n entirely. Compare the established pattern in `packages/api/src/routers/equipment/equipment-shared.ts` (`NOTIFICATION_KEYS` = dotted i18n keys resolved per org locale) and Phase 73's own `dispatchComplianceUploadOutcome` (passes `Compliance.notifications.*` keys).
- **Fix:** Define `Compliance.notifications.expiryDigest.{title,body}` (and a per-item label) i18n keys in all four locale files, pass them as dotted keys with ICU params (`{count}`, item list via metadata), and use the localized document label rather than the raw enum. Follow the `NOTIFICATION_KEYS` convention.

---

### MEDIUM

#### M-1 — Payment-block error double-surfaces: block modal AND a generic error toast fire together
- **Files:** `apps/web-vite/src/components/payments/hooks/use-payment-run-step-review.ts:78-98,100-152` ↔ `apps/web-vite/src/hooks/use-resource-mutation.ts:101-107`.
- **Problem:** `createMutation`/`lockAndExportMutation` are built via `useResourceMutation`, whose `onError` callback **unconditionally** calls `toast.error(translateError(error))` for every rejection. When `payment.create`/`lockAndExport` rejects with the structured `PRECONDITION_FAILED` compliance block, `onError` fires the toast first, then `mutateAsync` rejects into `handleLockAndExport`'s `catch`, which opens the block modal. The user sees both an error toast (the translated `compliancePaymentBlocked` errorKey, if present) and the modal — redundant and confusing.
- **Impact:** UX/standards issue: the block is meant to be a rich modal, not a toast; surfacing both is contradictory. Not lint-catchable.
- **Fix:** Either suppress the toast for the compliance-block code (pass an `onError` in the mutation options that swallows `PRECONDITION_FAILED` with `contractorReasons`, or add an `errorMessage`/skip flag to `useResourceMutation`), or stop using `useResourceMutation` for these two mutations and handle errors entirely in the hook's catch.

#### M-2 — Non-compliance errors are silently swallowed in handleLockAndExport
- **File:** `apps/web-vite/src/components/payments/hooks/use-payment-run-step-review.ts:133-140`.
- **Problem:** The `catch` only acts when `isPaymentBlock(err)` is true (opens modal). For any other failure it just calls `setIsLocking(false)` and returns — no rethrow, no explicit handling. It works today only because `useResourceMutation.onError` happens to toast for the generic path (see M-1), but that coupling is implicit and fragile: if the toast path is fixed for M-1, genuine create/export failures (network, validation, server 500) become invisible to the user with no error state.
- **Impact:** Violates the "no silent failures / every flow needs an error state" standard. Coupled to M-1: the two interact, so fix them together.
- **Fix:** In the catch, branch explicitly — open the modal for the compliance block, and surface a toast/error UI for all other errors (or rethrow to a boundary). Do not rely on the mutation hook's incidental toast.

#### M-3 — Payment-gate eligibility query has no organizationId guard; tenant safety relies entirely on caller-supplied IDs
- **File:** `packages/api/src/services/compliance-payment-gate.ts:81-98` (`assertContractorPaymentEligibility`).
- **Problem:** The `findMany` filters `contractorId IN (contractorIds)` + `severity:'BLOCKING'` + `status:'EXPIRED'`, but never `organizationId` — even though `AssertOptions.organizationId` is accepted and used elsewhere (would-block audit). When called without a `tx` (the `payment.create` path, `payment.ts:539`, passes only `{ organizationId }`), `db` falls back to the **non-tenant-scoped** base `prisma` client (`packages/db/src/client.ts:176` — no `withTenantScope` extension). Tenant isolation holds today only because `contractorIds` are pre-derived from an org-scoped `invoice.findMany`. There is no defense-in-depth in the helper itself.
- **Impact:** Latent IDOR/cross-tenant read risk. A future call site that passes contractor ids from a weaker source (or a bug that widens the id set) would read other orgs' compliance items with no second guard. Standards require DB-level/tenant guards, not caller discipline alone.
- **Fix:** When `organizationId` is provided, add `contractor: { is: { organizationId } }` (or `organizationId` directly if the item carries it) to the WHERE. Cheap, removes the implicit-trust coupling, and matches the multi-tenant guideline.

#### M-4 — Compliance reminder scan runs on pooled clients OUTSIDE the cron advisory-lock transaction
- **Files:** `apps/cron-worker/src/jobs/handlers/reminders/index.ts:350-400` ↔ `packages/api/src/services/compliance-reminder-scan.ts:112-147` (module-level `prisma`/`prismaRaw`).
- **Problem:** `remindersHandler` wraps its sub-jobs in `prismaRaw.$transaction` guarded by `tryAcquireXactLock(tx, 'cron', 'reminders')`. But `runComplianceReminderScan()` is invoked inside the `Promise.all` without receiving `tx`; it uses the module-level `prisma`/`prismaRaw` singletons, i.e. separate connections outside the locked transaction. Consequences: (1) the advisory lock does NOT serialize the compliance scan across overlapping ticks — only the `claimCronNotificationDedup` unique-index guard prevents double-fires (acceptable, but the lock the handler advertises is decorative for this sub-job); (2) the scan performs many sequential round-trips (findMany + per-item findUnique/dedup-create/update/contractor-findUnique) concurrently while the outer 60s tx holds a connection + advisory lock — extra connection pressure under load.
- **Impact:** Not a correctness defect (dedup table is the real guard) but a transaction-integrity / design inconsistency versus the other sub-jobs and the handler's stated invariant. Worth an explicit note in the handler or threading `tx` through where writes should be lock-protected.
- **Fix:** Either (a) document that the compliance scan is intentionally connection-independent and relies on the dedup unique index (not the advisory lock), or (b) thread `tx` into `runComplianceReminderScan` for the reads/writes that should share the lock. Confirm the per-item sequential round-trips are acceptable at expected BLOCKING-item volume; batch the contractor display-name lookups if not.

---

### LOW

#### L-1 — Direct `auditLog.create(...)` bypasses `writeAuditLog` in four Phase 72 sites (KNOWN)
- **Files:** `packages/api/src/routers/core/approval.ts:1502`; `packages/api/src/services/compliance-payment-gate.ts:175`; `packages/api/src/services/compliance-recovery.ts:77`; `packages/api/src/services/compliance-reminder-scan.ts:405`.
- **Problem:** Each writes the AuditLog row directly via the Prisma client instead of `writeAuditLog`/`writeAuditLogMany` (`packages/api/src/services/audit-writer.ts`). The payment router itself uses `writeAuditLog` everywhere, so these four are inconsistent with the in-file/in-repo convention and skip whatever normalization/enrichment the writer applies (consistent field shaping, tamper-hash/chain, redaction).
- **Severity rationale:** Low — the rows ARE written (audit is not missing), tenant/actor fields are present, and the writes participate in the caller tx. The risk is convention drift + missing any centralized audit-writer guarantees, not a missing audit trail.
- **Correct fix:** Route all four through `writeAuditLog({ tx, organizationId, actorType, actorId?, action, resourceType, resourceId, metadata/newValues })`. For SYSTEM-actor rows (gate/recovery/reminder), confirm `writeAuditLog` supports `actorType:'SYSTEM'` with no `actorId` (it is used that way elsewhere); if not, that gap is the real reason these went direct and should be fixed in the writer rather than worked around per-call.

#### L-2 — `EMPTY_RESULT` shared mutable singleton returned to callers
- **File:** `packages/api/src/services/compliance-payment-gate.ts:75-79,87`.
- **Problem:** `EMPTY_RESULT` is a module-level object returned by reference when `contractorIds.length === 0`. Its `contractorReasons: []` array is shared; any caller that mutates the returned `contractorReasons` (push/sort) would corrupt the singleton for all future empty-input calls.
- **Impact:** No current caller mutates it, so latent only. Still a leaky-abstraction smell.
- **Fix:** Return a fresh literal `{ blocked:false, wouldBlock:false, contractorReasons:[] }` each time, or `Object.freeze` the singleton + its array.

#### L-3 — `PaymentRunComplianceCheck` has no uniqueness guard against duplicate PASS rows
- **Files:** `packages/db/prisma/schema/migrations/20260531170002_phase72_payment_run_compliance_check/migration.sql`; `packages/api/src/routers/finance/payment.ts:954-967`.
- **Problem:** No unique constraint on `(paymentRunId, contractorId, paymentExportId)` (or similar). The PASS rows are written one-per-contractor inside the export tx; idempotency rests on the EXPORTED/LOCKED status re-check earlier in tx-2. If two concurrent finalizers ever both passed the status guard (narrow window), duplicate PASS audit rows could be created.
- **Impact:** Low — the status guard makes this very unlikely, and duplicate audit rows are not corrupting. Noted for audit-table hygiene.
- **Fix:** Consider a partial unique index for the PASS case (`paymentExportId IS NOT NULL`), or rely on the documented status-guard invariant and note it.

#### L-4 — `resolveRecipientsForItem` wraps an already-deduped list in another Set (dead DRY)
- **File:** `packages/api/src/services/compliance-reminder-scan.ts:338-341`.
- **Problem:** `resolveRbacRecipients` returns recipient user ids; the function wraps them in `Array.from(new Set(...))`. If `resolveRbacRecipients` already returns distinct ids (it does for the RBAC set), the extra Set is redundant. Minor.
- **Fix:** Drop the redundant Set or document why duplicates are expected from the resolver.

#### L-5 — `no_expiry` modeled as a `+100y` magic sentinel
- **File:** `packages/compliance-policy/src/expiry.ts:62-64` (`defaultExpiryFromUploadDate`, Phase 73 code in the diff window).
- **Problem:** `no_expiry` rules return `addYears(uploadDate, 100)` as a sentinel expiry. Magic-value modeling; downstream band/expiry math will treat these as expiring in ~2126. The comment notes the UI "may display no expiry", but nothing enforces that the reminder scan excludes them.
- **Impact:** Low and Phase 73-scoped, but worth confirming the COMPL-03 scan never bands a `no_expiry` document (it shouldn't, since +100y → `NONE`). Verify there is no path where a `no_expiry` item gets a real `expiresAt` near-term.
- **Fix:** Prefer a nullable `expiresAt` + explicit `noExpiry` flag over a sentinel date, or assert the scan filters these out.

---

### INFO

#### I-1 — Dead/unused i18n keys for the would-block banner
- `Compliance.paymentBlockModal.wouldBlockBannerTitle` / `wouldBlockBannerDescription` exist in all four locale files but are not referenced by `payment-block-modal.tsx`. Either the soft-warn "would-block" banner UI was dropped or lives elsewhere; confirm and remove if dead (the i18n unused-keys audit would flag these).

#### I-2 — Pre-existing cognitive-complexity / barrel-file advisories (NOT introduced here)
- `recreateComplianceAssessment` and `submit` in `classification.ts` exceed biome's cognitive-complexity-15 (warn-level); Phase 72 only added the recovery-hook call inside them. `compliance-recovery.ts:17` re-exports `onComplianceItemExpiresAtChanged` (noBarrelFile advisory) for a single import surface — intentional and minimal. Left untouched; not Phase-72-introduced.

#### I-3 — Phase 73 upload-outcome notification i18n keys must exist or users see raw keys
- `packages/api/src/routers/compliance/classification.ts` `dispatchComplianceUploadOutcome` passes `Compliance.notifications.uploadApproved.title` / `uploadRejected.*` as dotted keys (correct convention per `resolveCopy`). These resolve to readable copy ONLY if the keys exist in `messages/{en,de,pl,ar}.json`; otherwise `resolveCopy` echoes the raw key. Phase 73 scope — verify the keys are added before that feature ships. (Flagged because the code landed in the Phase 72 diff window.)

---

## Verified-good (no action)

- **TOCTOU re-assertion** (`payment.ts:917-929`): eligibility re-checked inside the export tx-2 before flipping to EXPORTED; PRECONDITION_FAILED aborts and rolls back. FAIL-verdict rows written in a separate best-effort tx (`payment.ts:989-1029`) that never masks the original throw. Sound.
- **SQL injection** (`compliance-recovery.ts:48-53`): JSONB containment uses Prisma tagged-template bound params for both `organizationId` and the `::jsonb` payload — no interpolation, org filter present.
- **Optimistic concurrency** (`compliance-reminder-scan.ts:272-323`): version-guarded `updateMany` + P2002-tolerant `create` correctly handle the cron-vs-listener renewal-reset race; both lose gracefully and retry next tick.
- **Crash safety** (`runComplianceReminderScan`): top-level try/catch returns zero counts; per-item try/catch isolates failures. Cannot abort the shared reminders tx (also see M-4 re: it runs outside that tx anyway).
- **Operator registry** (`operators/registry.ts`): clean plug-in pattern; duplicate-name + unknown-name throw; `__testOnly.reset` gated. Open/closed for future operators.
- **Feature-flag gate** (`registry.ts:96-101` `isPaymentBlockEnforced`): hard-block stays OFF (returns false) until the registry entry is APPROVED; `FLAG_SIGNOFF_BYPASS=local` forces ON for dev only. Standing legal-deferral constraint honored.
- **Migrations:** all three additive (no destructive DDL); GIN `jsonb_path_ops` index backs the recovery containment query; FKs sensible (`paymentExportId` ON DELETE SET NULL preserves the audit row; others RESTRICT). Enum `ADD VALUE` not referenced in the same migration (PG12+ safe).
- **Modal a11y / layering** (`payment-block-modal.tsx`): DialogBody (scroll) + DialogFooter (actions) convention followed; `useId` + `aria-labelledby`; `aria-hidden` on decorative icons; empty state handled; presentational (props in / JSX out). Container/Hook/Component split is correct (StepReviewContainer → usePaymentRunStepReview → PaymentBlockModal). The label TEXT it renders is broken — see H-1.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 2 |
| Medium   | 4 |
| Low      | 5 |
| Info     | 3 |
| **Total**| **14** |

**Must-fix before this feature is user-facing:** H-1 (modal shows raw key strings for every document) and H-2 (digest is English-only across all locales). Both are i18n contract breaks invisible to lint and to the (broken) i18n:code-coverage guard. M-1/M-2 are a coupled frontend error-handling pair. M-3 is a latent tenant-scoping gap worth closing cheaply. The four direct `auditLog.create` sites (L-1) are convention drift, not missing audit.
