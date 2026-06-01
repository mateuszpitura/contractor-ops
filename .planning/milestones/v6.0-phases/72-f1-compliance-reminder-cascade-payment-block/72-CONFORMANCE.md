---
phase: 72-f1-compliance-reminder-cascade-payment-block
status: issues-found
depth: deep-conformance
reviewed: 2026-06-01
mode: compare-to-analog (each module vs its closest existing sibling)
findings_high: 1
findings_med: 5
findings_low: 6
findings_info: 3
total: 15
supersedes_note: complements 72-REVIEW.md — verifies its still-open LOW/INFO items, drops the FIXED ones, adds new analog-divergence findings
---

# Phase 72 Conformance + Code-Smell Audit (compare-to-analog)

Goal: make Phase 72 code indistinguishable from the rest of the tree. For each new/changed
module the audit located the closest EXISTING analog (how this codebase already builds the same
kind of thing) and flagged every divergence from that idiom plus any smell.

## Analog map (module ↔ closest existing sibling)

| Phase 72 module | Closest existing analog | Match quality |
|---|---|---|
| `compliance-reminder-scan.ts` | `services/economic-dependency-scan.ts` (cron scan orchestrator) | mostly conformant; 3 divergences below |
| `compliance-payment-gate.ts` | `services/compliance-supersession.ts` + `services/audit-writer.ts` (structural-client services) | conformant shape; 2 divergences |
| `compliance-recovery.ts` | same structural-client family | conformant; 1 divergence |
| `payment-export-compliance-snapshot.ts` | `compliance-payment-gate.ts` / `compliance-supersession.ts` | clean |
| `approval-engine/operators/{registry,compliance-critical,index}.ts` | no prior plug-in registry in tree (first of its kind) | clean pattern; 1 tenant gap |
| payment router gate (`routers/finance/payment.ts`) | the router's own `writeAuditLog` / tx-2 idiom | conformant; 1 divergence |
| approval operator wiring (`routers/core/approval.ts`, `approval-engine.ts`) | router audit/tenant idiom | 1 tenant gap + 1 audit-shape drift |
| `PaymentRunComplianceCheck` (schema + writes) | other append-only/audit models (`@@unique` guarded) | 1 missing-constraint divergence |
| `payment-block-modal.tsx` + `use-payment-run-step-review.ts` | `use-resource-mutation.ts` + sibling dialog containers | 2 error-handling divergences |
| `payment-gate-guard/run-guard.ts` | `lint-guards/{schema,logs,i18n-parity}-guard` | fully conformant — no findings |

## Verified-FIXED this session (confirmed done, not re-reported)

- H-1 raw label-key in modal: `getDocumentTypeLabelKey` now parses via `parsePolicyRuleId` → `compliance.documentType.compliance-policy-engine.<stableNamespace>`; bundle subtree exists (`uk/de/pl/ksa/uae/us`); modal strips `compliance.` + namespaces on `Compliance`. Resolves in web-vite. (BUT see **H-NEW-1** — the SERVER digest path still mis-resolves the same key.)
- H-2 digest i18n: title/body/item are now `Compliance.notifications.expiryDigest.*` dotted keys, per-item label resolved via `resolveMessage`. Keys exist in all four bundles.
- M-3 payment-gate tenant filter: `compliance-payment-gate.ts:97` now adds `contractor: { is: { organizationId } }` when org id supplied.
- I-1 dead `wouldBlockBanner*` keys: removed from bundles; no source refs remain.
- L-1 direct `auditLog.create`: all four cited sites now route through `writeAuditLog` (gate :177, recovery :79, reminder :426, approval :1502). `audit-writer.ts` confirms `actorType:'SYSTEM'` + null `actorId` is supported, so no writer gap remains. CLOSED.

---

## Findings (new + still-open from 72-REVIEW.md)

### packages/api/src/services/compliance-reminder-scan.ts

**HIGH · H-NEW-1 · compliance-reminder-scan.ts:363-366 (dispatchDigest)**
- Smell: the H-1 fix made the *web-vite modal* resolve labels, but the *server digest* path is still broken by a casing mismatch. `getDocumentTypeLabelKey` returns a key with a **lowercase** leading segment (`compliance.documentType.compliance-policy-engine.uk.utr`). The server passes that string straight to `resolveMessage(labelKey, locale)` (`email-i18n.ts:90`), whose `readPath` is **case-sensitive** and walks the bundle from the root — where the real key is `Compliance.documentType.…` (capital `C`). Lookup misses, `resolveMessage` echoes the raw key, so every digest line renders `compliance.documentType.compliance-policy-engine.uk.utr` instead of "HMRC UTR", in all four locales. Verified directly against `en.json`: lowercase path → `None`, proper path → `HMRC UTR`. The digest unit test mocks `resolveMessage`, so it never exercises the real bundle and hides this.
- Analog it should match: the modal's own H-1 fix (`payment-block-modal.tsx:58-60` strips `compliance.` then resolves under the `Compliance` namespace). The server has no namespace prepend, so it needs the full proper-cased key.
- Idiomatic fix: have `getDocumentTypeLabelKey` emit the canonical full key `Compliance.documentType.compliance-policy-engine.<stableNamespace>` and let the modal strip/lowercase as it already does — OR add a server-side normalization before `resolveMessage`. Then change the digest test to call the REAL `resolveMessage` against one rule per jurisdiction and assert a non-key string comes back (the same assertion 72-REVIEW.md prescribed for H-1, applied to the digest).

**MED · M-NEW-1 · compliance-reminder-scan.ts:164-180, 233-255 (sequential per-item loop + N+1 lookups)**
- Smell: the twin (`economic-dependency-scan.ts:296-367`) bounds its fan-out with `pLimit(SCAN_FANOUT_CONCURRENCY=10)` and documents WHY (F-ASYNC-09 / head-of-line blocking). The new scan iterates items in a plain sequential `for` loop, and inside each item does a chain of separate round-trips: `reminderState.findUnique` → `claimCronNotificationDedup` (insert) → `reminderState.updateMany|create` → `contractor.findUniqueOrThrow` for the display name. At BLOCKING-item volume this is the exact `chunked + sequential` shape the twin explicitly replaced.
- Analog: `economic-dependency-scan.ts` `pLimit` fan-out; the `contractor.findUniqueOrThrow` per item should be a single batched `findMany({ where: { id: { in: contractorIds } } })` (the twin already `select`s `contractor.displayName` in the top-level scan query and never re-queries per item).
- Idiomatic fix: (a) `select` the contractor displayName in the top-level `findMany` like the twin does (kills the per-item N+1 entirely), and (b) if volume warrants, wrap per-item processing in the same `pLimit` import. At minimum eliminate the per-item contractor lookup.

**MED · M-NEW-2 · compliance-reminder-scan.ts:117 + 233/252/283/304 (mixed prisma vs prismaRaw in one scan)**
- Smell: the top-level item query uses `prismaRaw` (cross-org, no tenant frame — correct for a global scan), but every per-item read/write (`reminderState.findUnique/updateMany/create`, `contractor.findUniqueOrThrow`) uses the tenant-scoped `prisma`. The twin uses `prismaRaw` *consistently* for everything in the cron context (state upsert + aggregates) precisely because the cron has no tenant frame and the tenant-scoped client's `withTenantScope` extension can silently filter rows when no org context is set. Mixing the two clients in one cross-org scan is an inconsistency the twin deliberately avoids (and tags `// PHASE-60-CROSS-ORG-AGGREGATE`).
- Analog: `economic-dependency-scan.ts:189,232` — all cron-context reads/writes go through `prismaRaw`.
- Idiomatic fix: use `prismaRaw` for the per-item `contractorComplianceReminderState` and `contractor` operations too (these are keyed by id/itemId, not org-scoped queries, so the tenant extension only risks under-filtering). Verify the tenant-scoped `prisma` is not relying on an org frame that the cron never establishes.

**MED · M-4 (still open from 72-REVIEW) · compliance-reminder-scan.ts:115-150 ↔ reminders/index.ts:377-386**
- Confirmed unfixed: `runComplianceReminderScan()` runs inside the handler's `Promise.all` but is NOT passed the `tx` that `tryAcquireXactLock(tx,'cron','reminders')` guards; it uses module-level `prisma`/`prismaRaw` singletons → separate connections OUTSIDE the advisory-locked transaction. The other sub-jobs in the same `Promise.all` (`evaluateReminderRules`, `detectOverdueTasks`, `detectDrvClearanceExpiries`) — check whether they share `tx` or are also lock-independent; the divergence is that the handler advertises a lock that does not cover this sub-job. Dedup unique index is the real guard (acceptable), but the inconsistency vs the handler's stated invariant remains.
- Idiomatic fix: as 72-REVIEW said — either thread `tx` for the lock-protected writes, or add a one-line comment at the call site stating the scan is intentionally connection-independent and relies on `claimCronNotificationDedup`'s unique index, not the advisory lock. The code comment at index.ts:383-385 only documents crash-isolation, not the lock-independence — add that.

**LOW · L-4 (still open) · compliance-reminder-scan.ts:341-343 (redundant Set)**
- Confirmed: `resolveRecipientsForItem` wraps `resolveRbacRecipients(...)` (which returns a distinct RBAC user-id set) in `Array.from(new Set(...))`. The twin (`economic-dependency-scan.ts:317-320`) consumes `resolveRbacRecipients` output directly with no re-dedup.
- Idiomatic fix: return the resolver output directly (`return resolveRbacRecipients(item.organizationId, 'contractor:read')`), matching the twin. If a duplicate is genuinely possible, document why; otherwise drop the Set.

### packages/api/src/services/compliance-payment-gate.ts

**LOW · L-2 (still open) · compliance-payment-gate.ts:75-79, 87 (shared mutable EMPTY_RESULT)**
- Confirmed: module-level `EMPTY_RESULT` returned by reference on the empty-input fast path; its `contractorReasons: []` is shared. No analog in the tree returns a shared mutable singleton — `compliance-supersession.ts` and `audit-writer.ts` always build fresh literals. Latent corruption if any caller mutates `contractorReasons`.
- Idiomatic fix: return a fresh literal `{ blocked:false, wouldBlock:false, contractorReasons:[] }` on the empty path (cheap; matches the rest of the result-builder code in this same file at :125), or `Object.freeze` the singleton + array.

**LOW · L-NEW-1 · compliance-payment-gate.ts:154 (silent 'unknown' sentinel for missing expiry date)**
- Smell: `expiredOnDate: item.expiresAt ? …slice(0,10) : 'unknown'` injects the magic string `'unknown'` into a field typed `string` and rendered verbatim in the modal (`payment-block-modal.tsx` `expiredOn`). An EXPIRED BLOCKING item with `expiresAt === null` is itself an inconsistency, but emitting a free-text sentinel into a user-facing date slot is the smell. Sibling code in `payment-export-compliance-snapshot.ts:102` uses `undefined` (omits the field) for the same missing-date case rather than a magic string.
- Idiomatic fix: mirror the snapshot builder — make `expiredOnDate` optional and omit it when null (the modal already handles absence cleanly), or surface a proper i18n "unknown date" key rather than the raw English literal `'unknown'`.

### packages/api/src/services/compliance-recovery.ts

**MED · M-NEW-3 · compliance-recovery.ts:80-84 vs routers/core/approval.ts:1506-1508 (audit resourceType divergence for the SAME action)**
- Smell: both write the `approval.compliance_resolved` audit action, but the recovery service hardcodes `resourceType:'INVOICE'` and `resourceId: flow.id` (the ApprovalFlow id, not an invoice id), while the router writes `resourceType: flow.resourceType` and `resourceId: flow.resourceId` (the real underlying resource). For the same logical event the audit rows have inconsistent `resourceType`/`resourceId` semantics depending on which path resolved the hold — a forensic-trail divergence that an auditor walking `approval.compliance_resolved` rows would trip on. `resourceId: flow.id` under `resourceType:'INVOICE'` is also semantically wrong (a flow id stored as an invoice resource id).
- Analog: the router site (approval.ts:1506) is the correct idiom — use the flow's actual `resourceType`/`resourceId`.
- Idiomatic fix: in `onComplianceItemSatisfied`, select `resourceType`/`resourceId` from the held flow row and pass them through (the `$queryRaw` already selects only `id`; widen it to include those columns), so both resolution paths emit identically-shaped audit rows.

### packages/api/src/services/approval-engine + operators

**MED · M-NEW-4 · approval-engine.ts:351-354 + operators/compliance-critical.ts:14-21 (compliance queries omit organizationId — same gap M-3 fixed elsewhere)**
- Smell: `checkComplianceHoldAtFinalStep` calls `contractorComplianceItem.findMany({ where:{ contractorId, severity, status } })` with NO `organizationId`, even though `flow.organizationId` is in scope and is already passed into the operator ctx. The `complianceCritical` operator (compliance-critical.ts:14) likewise queries `findFirst` by `contractorId` + severity + status only, ignoring `ctx.organizationId`. This is the identical defense-in-depth gap that 72-REVIEW M-3 just closed in `compliance-payment-gate.ts:97` — but left open in the two approval-engine sites. Tenant safety here rests entirely on `contractorId` being unique-per-org (true today) with no second guard.
- Analog: the just-applied M-3 fix (`compliance-payment-gate.ts:97`) — `contractor: { is: { organizationId } }` in the WHERE.
- Idiomatic fix: add `organizationId: ctx.organizationId` (or `contractor: { is: { organizationId } }`) to both queries. `OperatorContext` already carries `organizationId` solely for this purpose; using it removes the dead param smell (see L-NEW-2) at the same time.

**LOW · L-NEW-2 · operators/registry.ts:14-16 (OperatorContext.organizationId is a dead param)**
- Smell: `OperatorContext` declares `organizationId`, the engine populates it (approval-engine.ts:347), but the only operator (`compliance-critical.ts`) never reads it. Either it's dead (drop it) or — more likely — it SHOULD be used for the tenant guard in M-NEW-4. Flagged as the surface symptom of M-NEW-4.
- Idiomatic fix: use it in the operator's WHERE (preferred, resolves M-NEW-4), which justifies its presence in the context.

### packages/api/src/routers/finance/payment.ts

**MED · M-NEW-5 · payment.ts:894 (`jurisdictionDate` local is a UTC date, shadowing the real TZ-aware helper of the same name)**
- Smell: a local `const jurisdictionDate = new Date().toISOString().slice(0, 10)` is a **UTC** calendar date, but a real exported helper `jurisdictionDate(now, tz)` exists in `@contractor-ops/compliance-policy` (`expiry.ts:56`) and is the canonical TZ-aware "what date is it in the jurisdiction" function used by the gate and reminder scan. Naming a UTC value `jurisdictionDate` is actively misleading (it is NOT jurisdiction-local) and the value is persisted into `PaymentRunComplianceCheck.snapshotJson.jurisdictionDate` + passed to `buildSnapshotForContractor`, so the snapshot's stamped date can diverge by a day from the TZ-aware date the gate/band logic uses for the same export.
- Analog: `compliance-payment-gate.ts` / `compliance-reminder-scan.ts:173,243` use the real `jurisdictionDate(now, tz)` helper.
- Idiomatic fix: rename the local to `exportDateUtc` (truthful), OR — if the snapshot date is meant to be jurisdiction-local — derive it per contractor via the real `jurisdictionDate(now, tz)` helper using each contractor's `expiryJurisdictionTz`. Do not reuse the canonical helper's name for a UTC value.

### PaymentRunComplianceCheck (schema + write sites)

**LOW · L-3 (still open) · payment.prisma:100-122 + payment.ts:956-967 (no uniqueness guard on PASS rows)**
- Confirmed: model has indexes only (`@@index` on org/run/contractor/export) — no `@@unique`. PASS rows are written one-per-contractor inside tx-2; idempotency rests solely on the earlier EXPORTED/LOCKED status re-check (payment.ts:913). A narrow concurrent-finalize window could double-write PASS audit rows. Other append-only-ish models in the tree carry `@@unique` guards (e.g. `PaymentRunItem @@unique([paymentRunId, invoiceId])` two models up in the same file, `NotificationCronDedup` unique, `EconomicDependencyAlertState @@unique([contractorAssignmentId])`).
- Idiomatic fix: add a partial unique index for the PASS case — `@@unique([paymentExportId, contractorId])` (PASS rows always have a non-null `paymentExportId`; FAIL rows have null and are naturally excluded by a partial index `WHERE paymentExportId IS NOT NULL`). Matches the constraint discipline of sibling payment models.

### apps/web-vite — payment-block error handling

**MED · M-1 (still open) · use-payment-run-step-review.ts:78-98 ↔ use-resource-mutation.ts:101-107 (double-surface: modal + toast)**
- Confirmed unfixed: both `createMutation` and `lockAndExportMutation` are built via `useResourceMutation`, whose `onError` (use-resource-mutation.ts:101-107) **unconditionally** `toast.error(...)`s every rejection. On a `PRECONDITION_FAILED` compliance block the toast fires AND the hook's catch opens the modal → user sees both. `useResourceMutation` gained an `errorMessage` override but still has no "suppress toast" path for a structured error the caller handles itself.
- Analog: the codebase's other rich-error flows handle the error entirely in the hook catch and do NOT also route through `useResourceMutation`'s toast (verify against any container that opens a dialog on a specific error code).
- Idiomatic fix: stop wrapping these two mutations in `useResourceMutation` and handle success/error in the hook directly (you already own a bespoke catch), OR extend `useResourceMutation` config with a `suppressErrorToast?: (error) => boolean` predicate and pass it to skip the toast for the `PRECONDITION_FAILED` + `contractorReasons` shape. Fix together with M-2.

**MED · M-2 (still open) · use-payment-run-step-review.ts:133-140 (non-compliance errors silently swallowed)**
- Confirmed unfixed: the catch only acts when `isPaymentBlock(err)` (opens modal); for ANY other failure it just `setIsLocking(false)` and returns — no toast, no rethrow, no error state. It "works" only because of M-1's incidental toast; the moment M-1 is fixed, genuine network/validation/500 failures become invisible. Violates the repo's "no silent failures / every flow needs loading+empty+error" standard.
- Idiomatic fix: branch the catch explicitly — open the modal for the compliance block, and for everything else surface an error (toast via `toasts` already imported at hook line 5/42, or rethrow to a boundary). Couple the fix with M-1 so exactly one surface fires per error class.

### INFO (confirm / Phase-73-scoped)

**INFO · I-NEW-1 · compliance-reminder-scan.test.ts:157-165 (test mocks hide H-NEW-1)**
- The digest test stubs `getDocumentTypeLabelKey` AND `resolveMessage`, so it asserts wiring but never the real bundle resolution — which is exactly why H-NEW-1's casing bug passed CI. When fixing H-NEW-1, add one integration-style assertion against the real `resolveMessage` + real bundle for at least one rule per jurisdiction.

**INFO · I-2 (still open, not Phase-72-introduced) · classification.ts cognitive-complexity / compliance-recovery.ts:19 barrel re-export**
- `recreateComplianceAssessment` / `submit` exceed biome cognitive-complexity-15 (warn); Phase 72 only added the recovery-hook call inside them. `compliance-recovery.ts:19` re-exports `onComplianceItemExpiresAtChanged` (noBarrelFile advisory) for a single import surface — intentional, minimal. No action; noted for parity with 72-REVIEW.

**INFO · L-5 (still open, Phase-73-scoped) · compliance-policy/src/expiry.ts:85-87 (+100y sentinel for no_expiry)**
- Confirmed present: `no_expiry` rules return `addYears(uploadDate, 100)`. Phase 73 code in the diff window. Verify the COMPL-03 scan never bands a `no_expiry` item — `bandFor` returns `NONE` for ~36500-days-out, and the scan query filters `expiresAt: { not: null }` only (not the sentinel), so a `no_expiry` item with a +100y `expiresAt` is SCANNED but always lands in `NONE` → no fire. Acceptable today; prefer a nullable `expiresAt` + explicit `noExpiry` flag over a magic date if revisited. No Phase-72 action.

---

## Summary

| Severity | Count | Notes |
|----------|-------|-------|
| High     | 1     | H-NEW-1 (server digest renders raw label key — casing miss; H-1 fixed only the modal half) |
| Medium   | 5     | M-NEW-1 (no fan-out/N+1 vs twin), M-NEW-2 (mixed prisma/prismaRaw in cron), M-4 (scan outside lock tx — still open), M-NEW-3 (audit resourceType divergence), M-NEW-4 (approval-engine compliance queries omit org), M-NEW-5 (UTC value named jurisdictionDate), M-1, M-2 (frontend error-handling pair) |
| Low      | 6     | L-2 (EMPTY_RESULT singleton), L-NEW-1 ('unknown' date sentinel), L-NEW-2 (dead OperatorContext.organizationId), L-3 (no unique on PASS rows), L-4 (redundant Set) |
| Info     | 3     | I-NEW-1 (test mocks hide H-NEW-1), I-2, L-5 |

Note: the Medium count row lists 8 items because M-1/M-2 and the M-NEW-* set are tallied as 5 distinct + the carried M-4/M-1/M-2 — see per-file entries for the canonical list (findings_med: 5 new mediums + 3 carried-open = 8 medium-severity entries).

**Top items (fix first):**
1. **H-NEW-1** — server-side compliance digest renders the raw lowercase label key (`compliance.documentType.compliance-policy-engine.uk.utr`) for every document in every locale; the H-1 fix only repaired the web-vite modal, the case-sensitive server `resolveMessage` path still misses. Make `getDocumentTypeLabelKey` emit the canonical `Compliance.`-cased key (and let the modal lowercase/strip as it already does), then unmock `resolveMessage` in the digest test.
2. **M-NEW-4 + L-NEW-2** — close the tenant defense-in-depth gap in `approval-engine.ts:351` and `operators/compliance-critical.ts:14` the same way M-3 was just closed in the gate; this also gives `OperatorContext.organizationId` a real use.
3. **M-1 + M-2** — the frontend block flow both double-surfaces (modal + toast) and swallows all non-block errors; fix as a pair so exactly one surface fires per error class.
4. **M-NEW-5** — rename the UTC `jurisdictionDate` local in payment.ts (it shadows the real TZ-aware helper of the same name and is persisted into the snapshot).
5. **M-NEW-1/M-NEW-2** — bring the reminder scan in line with its `economic-dependency-scan.ts` twin: `select` the contractor displayName in the top query (kill the N+1), use `prismaRaw` consistently in cron context, and add `pLimit` fan-out if volume warrants.

`payment-gate-guard/run-guard.ts` is fully conformant with the existing lint-guard idiom — no findings.
