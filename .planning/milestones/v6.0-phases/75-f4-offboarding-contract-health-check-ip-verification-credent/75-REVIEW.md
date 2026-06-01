---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
status: changes-requested
depth: deep
reviewed: 2026-06-01
findings_critical: 0
findings_warning: 6
findings_info: 7
---

# Phase 75 Code Review — F4 Offboarding: Contract Health Check + IP Verification + Credential Vault

Inline review (gsd-code-reviewer agent unavailable in this background runtime; the
orchestrator performed a deep review directly). Scope: Phase 75 production source files
extracted from the eight `75-NN-SUMMARY.md` frontmatter blocks and cross-checked against
the `feat(75-*)` / `test(75-*)` commit set. Generated Prisma client, `.txt` IP-ratification
templates, `package.json`, `scripts/check-webhook-routes.mjs`, locale JSON, and `.planning`
artifacts are excluded from deep code review (verified separately for parity/registration).

Lint-catchable issues are NOT re-reported (the deterministic gate ran clean per
`75-08-FINAL-STATUS.txt`: typecheck 42/42, schema/logs only pre-existing offences,
i18n:parity PASS, web-vite data-layer/presentational/dialog/table/page-shell guards PASS).
This review targets what those guards cannot catch.

75-08 e-sign loop is a known DEFERRED scope (see `75-08-FINAL-STATUS.txt`); findings about
the deferred mutation/webhook are excluded except where the deferral leaves orphaned
production code.

---

## Summary

**Status: changes-requested.** No Critical findings. Six Warning-level findings — the most
material being (a) the credential-vault secret-shape detector does not catch secrets
*embedded* in the 10 000-char `notes` / free-text `label` fields, weakening the "never
persist secrets" guarantee, and (b) the Phase 75 web-vite surfaces (`HealthCheckPanel`,
`CredentialsTab`) are fully built and tested but never mounted on any page, so the feature
is currently dark. Backend security posture (tenant scoping, audit, QStash HMAC, RLS, no
secret logging) is strong.

---

## Security review (focus areas)

- **No secret logging / persistence (PASS, with one gap — see W-1).** Swept every Phase 75
  service/router/route: `vaultUrl`, `notes`, `label`, and `pdfBase64` are never passed to
  `@contractor-ops/logger`. The credential audit-log payloads
  (`credential-reference.ts:91,142,180,206`) record only `label` / `vaultProvider` /
  `accessType` / status — never `vaultUrl` or `notes`, a deliberate defence-in-depth choice.
  `parse-json-response.ts` (untracked helper) and `contract-health-service.ts` both keep raw
  bodies out of logs. PASS.
- **Tenant scoping (PASS).** Every `credentialReference.*` procedure and every
  `workflow-execution` mutation filters `findFirst`/`count`/`findMany` by
  `organizationId: ctx.organizationId` before mutating, and re-checks ownership on update/
  delete/markRotated. `run-health-check` scopes `fetchContractPdf` and all writes by
  `organizationId`. New tables carry `ENABLE` + `FORCE ROW LEVEL SECURITY` with
  org-match SELECT/ALL policies (`migration.sql:144-173`). PASS.
- **Audit on mutations (PASS).** create / update / markRotated / remove credential mutations,
  `forceCompleteRunWithPendingCredentials`, `overrideBlockingTask`, `rerunHealthCheck`, and
  the health-check run all call `writeAuditLog`, passing `tx` inside transactions. PASS.
- **QStash signature verification (PASS).** `/contract-health/_run` calls `guardQStashRequest`
  first; missing/empty signature → 401, missing signing keys → 500 (fail-closed, never
  silently accept), verify failure → 401. Route is registered inside the raw-body webhook
  plugin scope so the HMAC is computed over the exact bytes (`webhooks/index.ts:53-54,88`).
  Always-200 on handler failure is intentional and documented (prevents QStash retry storms;
  the FAILED run row is the source of truth). PASS.

---

## Warning findings

### WR-1 — Secret-shape detector misses secrets embedded in multi-char fields
`packages/validators/src/secret-shape-detector.ts:30-112` + `credential-reference.ts:36-38`

All patterns except `private-key-block` use `^…$` whole-input anchors and the detector docs
itself "for short pointer-like inputs … NOT for arbitrary multi-line text" (lines 26-28).
But `SAFE_NOTES = z.string().max(10000)` and `SAFE_TEXT` (label, 2000) run the same
refinement. A token pasted *inside* a longer value bypasses detection — verified:

```
BLOCKED "AKIAIOSFODNN7EXAMPLE"                              (bare)
PASSES  "Rotate the AKIAIOSFODNN7EXAMPLE key in vault"      (embedded in notes/label)
PASSES  "old token was ghp_1234567890abcdefghijklmnopqrst…" (embedded PAT)
```

This is the credential vault's core invariant ("Stores POINTERS only — never secrets").
**Fix:** for `notes`/`label` (non-URL free text), additionally run the patterns in a
non-anchored `.search()`/global mode (mirror the PEM substring approach) so an embedded
secret in a longer string is also rejected; or split the regex set into an "anchored, short
field" set and a "substring, free-text" set and apply the latter to `notes`/`label`. Keep the
URL field anchored.

### WR-2 — Phase 75 web-vite surfaces are built + tested but never mounted (feature is dark)
`apps/web-vite/src/components/contracts/health-check-panel-container.tsx`,
`apps/web-vite/src/components/workflow/credentials-tab-container.tsx`

`HealthCheckPanelContainer`, `CredentialsTabContainer`, `PendingCredentialsWarningDialog`,
and `IpVerificationEsignButton` have **zero** non-test importers (grep across
`apps/web-vite/src` returns only the `__tests__` files). They are not wired into
`pages/dashboard/contract-detail.tsx` or `pages/dashboard/workflows/detail.tsx`. The e-sign
button is expected to be dark (75-08 deferred), but the health-check panel and credentials
tab were the user-facing deliverable of 75-06/75-07 and are unreachable in the running app.
**Fix:** mount `HealthCheckPanelContainer` on the contract detail page (using
`contract.complianceFlagsJson`) and `CredentialsTabContainer` on the offboarding workflow run
detail, or explicitly record the wiring as deferred alongside 75-08 if that was the intent.

### WR-3 — CredentialsTab has no error state
`apps/web-vite/src/components/workflow/credentials-tab.tsx:48-54`,
`credentials-tab-container.tsx:13-44`, `hooks/use-credentials-tab.ts:55-56`

The hook exposes `isError` and `refetch`, but the container does not pass them and the
component renders only loading / empty / data — no error branch. CLAUDE.md mandates loading,
empty, AND error states for every user-facing flow. The list `useQuery` failing (e.g. 403/500)
shows a permanent empty/loading state with no retry. **Fix:** thread `isError`/`refetch` into
`CredentialsTab` and render an error block with a retry action. (Same hook also swallows
mutation errors — see WR-4.)

### WR-4 — Credential + health-check mutations surface no error feedback
`hooks/use-credentials-tab.ts:33-48`, `contracts/hooks/use-health-check-panel.ts:14-22`

`create` / `markRotated` / `remove` and `rerunHealthCheck` define only `onSuccess`. A
server-side rejection — notably the `looksLikeSecretRefinement` BAD_REQUEST, which is the
*primary* secret-paste defence — produces no toast/inline error; the dialog closes on success
only and otherwise appears inert to the user. **Fix:** add `onError` handlers that surface a
translated error (toast or inline), especially for the secret-paste rejection so the user
learns why the create failed.

### WR-5 — Destructive credential removal has no confirmation
`apps/web-vite/src/components/workflow/credentials-tab.tsx:82-88`

`onRemove(row.id)` fires immediately on a single ghost-button click and the mutation hard-
deletes the row (`credential-reference.ts:197-214`, `tx.credentialReference.delete`). No
AlertDialog / confirm step for an irreversible action on offboarding compliance evidence.
**Fix:** gate `onRemove` behind an AlertDialog confirm (matches the destructive-action
pattern used elsewhere in web-vite).

### WR-6 — Unvalidated Anthropic tool output cast at the external boundary
`packages/integrations/src/services/contract-health-service.ts:65` +
`run-health-check.ts:92-116`

`return toolUseBlock.input as ContractHealthToolInput` — no Zod validation of the model's
tool_use payload, the exact `(await ...) as <shape>` anti-pattern the repo's own
`parse-json-response.ts` (untracked, "Audit finding #10") was written to eliminate, and which
the codebase mandates at all external boundaries. Downstream, `IP_CLAUSES_BY_JURISDICTION[
cited.jurisdiction]` (run-health-check.ts:103) yields `undefined` for any out-of-enum
jurisdiction, and `Object.entries(undefined)` (line 107) throws. The throw is caught by the
outer try/catch and persisted as a FAILED run, so it degrades safely rather than crashing —
but a malformed/partial model response is silently downgraded to FAILED instead of the
intended MANUAL_REVIEW_REQUIRED, and `confidence`/`citedText` are trusted unchecked into
`resultsJson`. **Fix:** validate `toolUseBlock.input` with a Zod schema (a `citedClauses`/
`verdict` schema already exists conceptually in `ip-clauses-results-schema.ts`) before
returning; on parse failure throw a typed error so the run records a deterministic outcome.

---

## Info findings

### INFO-1 — CredentialsTab renders raw enum values instead of i18n labels
`credentials-tab.tsx:63,71`

`row.vaultProvider · row.accessType` and `{row.status}` render the raw DB enum
(`AWS_SECRETS_MANAGER`, `PENDING`, …). `Workflow.credentials.columns.*` keys exist in all
four locales but are unused, and there are no value-label keys for the enums. Users see
SCREAMING_SNAKE_CASE. Add status/provider/accessType label maps under `Workflow.credentials`.

### INFO-2 — CredentialAddDialog dropdowns show raw enum option labels
`credential-add-dialog.tsx:108-112,122-126`

Native `<select>` options render the bare enum (`p`, `a`) as visible labels — hardcoded,
untranslated user-facing strings. Same i18n gap as INFO-1; also the only Phase 75 strings
not driven through `useTranslations`. (The i18n:code-coverage guard is reported broken, so
flagged manually.)

### INFO-3 — `notes` field declared in dialog props but never collected
`credential-add-dialog.tsx:21-28,137`

`onSubmit`'s type includes `notes?`, and the `Workflow.credentials.dialog.fields.notes` i18n
key exists, but no Notes input is rendered and the `onSubmit({...})` call omits `notes`. Either
add the textarea or drop `notes` from the prop type to avoid a dead contract.

### INFO-4 — Native `<select>` instead of the design-system Select primitive
`credential-add-dialog.tsx:103-113,117-127`

Raw `<select className="w-full rounded border p-2 text-sm">` diverges from the shadcn Select
used elsewhere in web-vite (styling, focus ring, RTL handling for the `ar` locale). Prefer the
shared primitive for consistency and a11y parity.

### INFO-5 — Footnote superscript marker lacks an accessible association
`health-check-panel.tsx:108-112,121-125`

The `<sup>¹</sup>` pending-phrase marker is purely visual; a screen reader announces "1" with
no link to the `pendingPhraseFooter` explanation. Add an `aria-label` (or visually-hidden text)
tying the marker to the footnote, or use a `<Tooltip>`/`title` for the pending rationale.

### INFO-6 — CredentialsTab loading state is a bare ellipsis
`credentials-tab.tsx:48-49`

Loading renders `<p>…</p>` rather than a skeleton/spinner consistent with the rest of
web-vite. Minor UX/consistency; the `…` literal is also not translated (acceptable, but a
skeleton would avoid it entirely).

### INFO-7 — `rerunHealthCheck` enqueues for caller-supplied IDs without org pre-check
`packages/api/src/routers/core/contract.ts:781-832`

`contractIds` (≤1000) are not verified to belong to `ctx.organizationId` before enqueuing; the
QStash body uses `ctx.organizationId`, so the downstream run is tenant-scoped and a foreign
`contractId` simply fails `fetchContractPdf` (no cross-tenant leak). The residual is that a
caller can queue up to 1000 wasted Anthropic-bound jobs for arbitrary IDs (cost/abuse, not data
exposure). Optionally pre-filter `contract.findMany({ where: { id: { in }, organizationId } })`
and enqueue only matches; mirrors `bulkTransition`'s own found-ID discipline.

---

## What was reviewed and found clean

- **QStash guard** (`apps/api/src/lib/qstash-verify.ts`): fail-closed, signature-mandatory,
  key-presence-mandatory, ALS context reseeded from upstream headers. Solid.
- **Idempotency** (`dedup.ts` + partial unique index `ContractHealthCheckRun_dedup_succeeded`
  WHERE status='SUCCEEDED'): PENDING row inserted before the LLM call closes the dedup window
  against concurrent triggers; FAILED/PENDING rows intentionally unconstrained so re-runs work.
- **Run-completion gate** (`workflow-shared.ts:234-368`): IP_VERIFICATION hard-block +
  PENDING-credential soft-warning correctly enforced server-side via `assertRunCompletable`,
  invoked from BOTH `completeTask` and `skipTask` with the `gate` arg (verified the gate is not
  bypassed on the normal completion path). `forceCompleteRunWithPendingCredentials` re-asserts
  the IP block and refuses to bypass it without the Phase 74 OWNER override. Structured `cause`
  payloads route the UI correctly.
- **materialise.ts**: idempotent on (contractorId, policyRuleId), single-item creation,
  deliberately does NOT reuse Phase 71's whole-set `materialiseFromPolicy`. Clean abstraction.
- **cross-jurisdiction.ts**: pure functions, alpha-2/alpha-3 ISO map, sensible
  no-jurisdiction → MANUAL_REVIEW fallback.
- **compliance-policy IP rules** (de/uk/pl/us/ksa/uae): consistent reuse of the Phase 71
  `registerPolicyRule` pattern; no duplication; jurisdiction-correct legal framing (DE
  Nutzungsrechte vs UK assignment). All carry PENDING legal-review markers per project policy.
- **IP-clause phrase libraries** (`ip-clauses-*.ts` + `ip-clauses-index.ts`): per-jurisdiction
  modules aggregated via `IP_CLAUSES_BY_JURISDICTION` / `ALL_IP_CLAUSES`; uniform entry shape;
  versioned library constant. Good DRY/SOLID.
- **Migration** (`migration.sql`): additive, RLS enabled+forced, proper FKs/ON DELETE,
  correct indexes; `ALTER TYPE … ADD VALUE 'IP_RATIFICATION'` is safe on PG17.
- **i18n parity**: all Phase 75 keys actually used by components are present in en/de/pl/ar
  (manually verified — the i18n:code-coverage guard is broken). The gaps are *unused* keys
  (INFO-1) and *raw enum* rendering (INFO-1/INFO-2), not missing translations.
- **Dialog convention**: both new dialogs correctly use DialogBody (scroll) + DialogFooter
  (actions).

---

## Out-of-scope note

`packages/integrations/src/services/parse-json-response.ts` is present as an **untracked**
file referencing "Audit finding #10" — it belongs to the post-migration-parity audit, not
Phase 75. It is well-written (fail-closed `parseJsonResponse`, never logs raw bodies). Its
existence underscores WR-6: the contract-health service should adopt exactly this helper/pattern
at its Anthropic boundary.

---

## By-severity summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 0     | —   |
| Warning  | 6     | WR-1 secret detector misses embedded secrets in notes/label · WR-2 Phase 75 UI unmounted (feature dark) · WR-3 CredentialsTab missing error state · WR-4 mutations have no error feedback · WR-5 destructive remove lacks confirm · WR-6 unvalidated Anthropic tool-output cast |
| Info     | 7     | INFO-1 raw-enum labels · INFO-2 untranslated select options · INFO-3 dead `notes` prop · INFO-4 native select · INFO-5 footnote a11y · INFO-6 ellipsis loading state · INFO-7 rerun enqueues unfiltered IDs |

Highest-priority fixes: **WR-1** (security invariant) and **WR-2** (feature reachability).
