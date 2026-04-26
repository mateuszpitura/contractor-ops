# Pitfalls Research

**Domain:** v6.0 Platform Maturity & Operational Hardening — adding 4 feature areas (Compliance Document Lifecycle, IdP Deprovisioning, Gulf Operational Polish, Offboarding Hardening) to an existing production-grade multi-tenant contractor-ops SaaS.
**Researched:** 2026-04-26
**Confidence:** HIGH — pitfalls grounded in concrete patterns already validated in v1.0–v5.0 (AsyncLocalStorage tenant scoping, AES-256-GCM per-provider keys, locked-phrases guard, Unleash PENDING→APPROVED CI gate, classification rule-set drift escape hatch, LPCDA mid-batch race learnings, message-key parity contract).
**Scope:** Integration pitfalls — failure modes when these specific features intersect existing engines (classification, workflow, approval, payment, i18n, regional routing, integration framework). Generic SaaS / OWASP advice excluded.

---

## Critical Pitfalls

### Pitfall 1: Mid-Payment-Batch Document Expiry Race (Compliance Lifecycle ↔ Payment Engine)

**What goes wrong:**
Payment runs are batched (v1.0 Phase 7 design — selection → CSV/Elixir/SEPA/BACS/SWIFT export → mark-paid). A required CRITICAL document (UK Right-to-Work, UAE Emirates ID, German Aufenthaltstitel) expires AT 00:00 in the contractor's jurisdiction WHILE the batch is in `READY` state but pre-export. If "is document expired?" is evaluated only at batch-creation time, a contractor with an expired Emirates ID still gets paid; if re-evaluated at export time, half the batch may silently drop with no operator-visible reason.

**Why it happens:**
The expiry-block check is naturally written as a query-time predicate (`WHERE doc.expiresAt > NOW()`). Once the batch is materialized into a `PaymentRun` with frozen rows, NOW() drift between batch creation and export crosses the expiry boundary. The v5.0 LPCDA late-interest design solved a similar staleness problem by snapshotting the BoE rate at invoice issue time — but compliance docs are different: they MUST be re-checked at the latest possible moment because expiring docs is the WHOLE POINT of the engine.

**How to avoid:**
1. Two-phase expiry gate, both backed by the SAME Postgres `current_timestamp` (no clock skew between app server and DB):
   - **Selection time:** Filter out invoices for contractors with expired CRITICAL docs (visible to operator with reason).
   - **Export time (atomic):** `SELECT … FOR UPDATE` the payment run rows JOIN-ed against a `compliance_document` view computing `is_expired = expires_at < NOW() AT TIME ZONE contractor_tz`. If any row newly expires between selection and export, FAIL the entire run with a per-contractor breakdown — never a partial export.
2. Snapshot the expiry decision into an immutable `PaymentRunComplianceCheck` row keyed by `(paymentRunId, contractorId, checkedAt, blockReason)` written in the same transaction as the export. This becomes the audit-trail evidence and is what the operator UI shows ("blocked because doc X expired at HH:MM:SS, see receipt #N").
3. NEVER re-check at "mark paid" time — by then the file has gone to the bank. The bank-file-export step is the point of no return.
4. UI: show "expires in N hours" badge inside the payment-run drawer for any doc expiring within the next 24 h so the operator manually defers the run; this is the same defensive pattern as the v1.0 SLA countdown badges on approval queue.

**Warning signs:**
- A payment run completes export but the Stripe-style "successful payments" KPI doesn't match the bank file row count.
- Contractor receives payment despite an expired-doc compliance dashboard flag.
- Audit-log search for `event=PAYMENT_EXPORT` and `event=DOC_EXPIRED` reveals timestamps within seconds of each other.

**Phase to address:**
Compliance Document Lifecycle Engine phase (likely Phase 70 or 71). Wire the export-time gate THEN the reminder cron — never the other way round; reminders without the gate are theatre.

**Classification:** data-integrity / compliance / cost (a paid-but-non-compliant contractor is a refund + legal-letter chain).

---

### Pitfall 2: Reminder Fatigue Cascade (Compliance Lifecycle ↔ Notification Engine)

**What goes wrong:**
The plan calls for 90/60/30/15/7-day expiry reminders. A contractor with 3 documents expiring in the same week (e.g. Emirates ID, work permit, and free-zone licence on the same renewal cycle, common in UAE) receives 15 emails over 5 days plus 15 in-app notifications plus 3 Slack DMs. Either the operator turns off all compliance notifications (silent failure) or the contractor marks the address as spam (Resend deliverability hit).

**Why it happens:**
Each document type runs its own reminder cron, dispatching independently through the v1.0 notification dispatch service. There is no per-recipient rollup. The notification dedup key (`v1.0` Phase 7 design) is event-instance-based, not recipient-bucket-based.

**How to avoid:**
1. Add a `complianceReminderDigest` cron that runs BEFORE the per-doc reminder cron, scans the next 7 days of expirations per contractor, and emits ONE rolled-up email/in-app/Slack per contractor with a table of items + per-item upload CTAs.
2. Per-contractor notification preferences (existing `NotificationPreference` model from v1.0 Phase 7): add a `COMPLIANCE_REMINDER_DIGEST` channel that, when enabled, suppresses individual `COMPLIANCE_REMINDER_*` events.
3. Throttle: max 1 compliance reminder per contractor per 24 h regardless of how many docs trigger; same-bucket deduplication via Redis SETNX with key `compliance-reminder:{orgId}:{contractorId}:{YYYY-MM-DD}`.
4. Operator-side: dashboard "send reminder now" button must call the digest service, not bypass it — same pattern as the v1.0 manual reminder send.

**Warning signs:**
- Resend bounce/complaint rate climbs after compliance feature ships.
- Slack DM "this user has muted this app" errors in webhook delivery log.
- `notification_preference` table shows contractors mass-disabling all compliance categories within first 30 days.

**Phase to address:**
Compliance Document Lifecycle Engine phase, plan ordering: digest service BEFORE per-doc reminders.

**Classification:** UX / operational.

---

### Pitfall 3: Time-Zone Drift Between Contractor Jurisdiction and Org HQ (Compliance Lifecycle)

**What goes wrong:**
A document marked "expires 2026-12-31" in a Saudi contractor's profile is interpreted as UTC by the org HQ (Berlin). At 22:00 Berlin local time on 2026-12-31 (already 00:00 in Riyadh next day), the org operator sees "expires today, still valid" — but in Riyadh the document already expired 1 hour ago and the contractor's Iqama renewal grace period is now ticking. Conversely, a Polish org with a UK contractor sees "expires today" at 23:00 GMT (already midnight in Warsaw next day) and triggers a payment block prematurely.

**Why it happens:**
Prisma defaults `DateTime` to UTC. v4.0 introduced regional database routing but did not standardize how date-only expiry semantics map to UTC instants. The document is logically a date-only field (Emirates ID expires on a calendar day, not a wall-clock instant) but is stored as a `DateTime`.

**How to avoid:**
1. Store all document expiry as `Date`-only (Prisma `@db.Date`), NOT `DateTime`. The semantic is "valid through end-of-day-in-contractor-jurisdiction".
2. Add `expiry_jurisdiction_tz` column on `Contractor` (or derive deterministically from contractor country + first work location) so the cron knows which midnight to roll on.
3. The expiry-evaluation predicate becomes:
   ```sql
   (expires_at + INTERVAL '1 day') AT TIME ZONE contractor_jurisdiction_tz <= NOW()
   ```
   — this is "the start of the day AFTER expiry, in the contractor's TZ, has passed".
4. UI: dual-display in the operator dashboard — "expires 2026-12-31 (23:59 Asia/Riyadh / 22:59 Europe/Berlin)" so the operator never has to mentally TZ-convert.
5. NEVER rely on `Date.now()` in client code for expiry checks; always use the server-computed `is_expired` boolean.

**Warning signs:**
- Off-by-one-day disputes from contractors ("you blocked my payment but my Iqama is still valid until tomorrow").
- Cron-run audit-log shows expiry transitions happening at midnight UTC instead of midnight in contractor TZ.

**Phase to address:**
Compliance Document Lifecycle Engine phase, in the schema-design plan (first plan of the phase) — fixing this after data is in place is a forward-only migration with manual contractor-by-contractor review.

**Classification:** data-integrity / compliance / UX.

---

### Pitfall 4: Document-Type Conflation (Compliance Lifecycle ↔ Country Profiles)

**What goes wrong:**
A single `Document` model with an `expires_at` and a `type` enum tries to handle UK Right-to-Work (which has a "no expiry — settled status" variant), UAE Emirates ID (calendar expiry, but renewal can backdate), German Aufenthaltstitel (Niederlassung = unlimited, befristet = fixed), and Polish PESEL-as-residency-anchor (no expiry; residency permit has expiry). Engineers add boolean flags (`isUnlimited`, `isPendingRenewal`, `isInGracePeriod`) until the model is unmaintainable.

**Why it happens:**
Each country's regulator defines documents with different expiry semantics. v4.0 country-profile pattern (KSeF / ZATCA / Peppol) solved this for e-invoicing via a country-profile registry. Same pattern is needed here, but engineers naturally start with a single shared model.

**How to avoid:**
1. Mirror the v4.0 / v5.0 pluggable engine pattern: create `packages/compliance-docs` with per-country profile modules:
   ```
   packages/compliance-docs/src/profiles/
     gb/right-to-work.ts        // share-code semantics, no expiry for settled, expiry for pre-settled
     ae/emirates-id.ts          // calendar expiry, 30-day grace
     ae/free-zone-licence.ts    // calendar expiry, blocks billing
     sa/iqama.ts                // calendar expiry, blocks payments
     de/aufenthaltstitel.ts     // unlimited | befristet variant
     pl/residency-permit.ts     // calendar expiry
   ```
   Each profile exports `{ documentType, isExpired(doc, now, tz), isCriticalForPayment, gracePeriodDays, requiredFor: ['BILLING' | 'PAYMENT' | 'CONTRACT_START'] }`.
2. Store `documentTypeProfileKey` (string) on the document row; the profile module owns expiry-evaluation logic. Engine code stays generic.
3. Country compliance requirement-sets (e.g. "UAE contractors need Emirates ID + free-zone licence + medical insurance") live as code, registered like the v4.0 einvoice country profiles. This makes drift-handling possible (see Pitfall 5).

**Warning signs:**
- A second boolean flag is added to `Document` model in week 2 of the phase.
- A `switch (document.country) { case 'AE': ... case 'GB': ... }` block appears in `payment-engine.ts`.

**Phase to address:**
Compliance Document Lifecycle Engine phase, second plan after schema (after Pitfall 3 is fixed).

**Classification:** data-integrity / maintainability / compliance.

---

### Pitfall 5: Per-Country Requirement-Set Drift Without Backfill Escape Hatch (Compliance Lifecycle)

**What goes wrong:**
Saudization Nitaqat thresholds change per sector annually. UAE adds a new mandatory Wage Protection System (WPS) registration requirement mid-year. A new Polish residency-permit category is introduced. Existing engagements were assessed under the OLD requirement set — the new cron now flags them ALL as non-compliant overnight, blocking payments en masse. The v5.0 classification engine hit exactly this — the chosen escape hatch was `recreateDraftAfterDrift` tRPC mutation.

**Why it happens:**
Requirement sets are versioned implicitly (in code), but engagement compliance state is computed against "current rules" rather than "rules as-of engagement start". When rules change, history rewrites itself silently.

**How to avoid:**
1. Mirror v5.0 classification pattern: every requirement-set has a `RULE_SET_VERSION` constant. Snapshot `complianceRequirementSetVersion` on every contractor/engagement at compliance-record creation time (just like classification snapshots questions).
2. Daily cron: detect `currentVersion !== snapshotVersion` and emit a `COMPLIANCE_RULESET_DRIFT` notification to org admins WITHOUT auto-flagging the contractor as non-compliant. Admin chooses: (a) reassess under new rules (creates new compliance record + audit trail entry), or (b) grandfather under old rules (with explicit until-date and audit reason).
3. Provide a `recreateComplianceAssessment(contractorId, reason)` admin tRPC mutation that mirrors `recreateDraftAfterDrift` from v5.0 — explicitly opt-in, audit-logged, never silent.
4. Document the "rules-as-of date" in every PDF / compliance artefact — same as v5.0 SDS PDFs include `assessedAgainstRulesetVersion: 2026.04`.

**Warning signs:**
- Mass-flag event in audit log within 24 h of a requirement-set deployment.
- Operator support tickets: "everyone is suddenly non-compliant, is this a bug?"
- No `recreateComplianceAssessment` audit events but compliance state changing across multiple contractors simultaneously.

**Phase to address:**
Compliance Document Lifecycle Engine phase, drift-handling plan (last or second-to-last plan of the phase). Roadmap should explicitly call out "drift escape hatch" as a deliverable, not buried as a sub-task.

**Classification:** data-integrity / compliance / operational.

---

### Pitfall 6: i18n Leakage of Legal Terms (Compliance ↔ Locked-Phrases Guard)

**What goes wrong:**
Engineers add German document-type labels ("Aufenthaltstitel", "Niederlassungserlaubnis") and UAE labels ("Emirates ID", "Iqama", "Tasdeeq") to the regular `de.ts` / `ar.ts` translation files. A future translator (or an LLM-based auto-translation step) "improves" them — `Aufenthaltstitel` becomes `Aufenthaltsgenehmigung` (a real word, but a different legal concept). PDF artefacts now contain wrong statutory terminology; a Steuerberater audit flags them.

**Why it happens:**
Translation files feel like the natural home for any user-visible string. The v5.0 locked-phrases guard exists precisely because this happened with DSGVO/tax phrases — but it's a CI guard, not an engineering reflex.

**How to avoid:**
1. Extend the existing `packages/validators/src/legal/` locked-phrases registry. Add `compliance.ts` with `COMPLIANCE_DOC_TYPE_*` and `COMPLIANCE_GULF_*` constants for every legally-defined document name.
2. Extend `locked-phrases-guard.test.ts` (currently 32 tests, will be 32 + N after this phase) to assert each locked phrase appears VERBATIM in the rendered PDF + UI label. Same pattern as v5.0 78/78 DSGVO/tax phrases.
3. Translation files (`de.ts`, `ar.ts`) reference the locked constants for any term that has statutory meaning, like:
   ```ts
   docType_emiratesId: COMPLIANCE_DOC_TYPE_EMIRATES_ID,  // never a free string
   ```
4. CI: extend the `pnpm message-key-parity` check (already at 4,281-key contract) to include the new compliance namespace.

**Warning signs:**
- A PR adds a German legal term as a free string in `de.ts`.
- A translator-PR diff renames a locked-phrase-equivalent term.
- Locked-phrases-guard test count drops without an explicit constant-removal commit.

**Phase to address:**
Compliance Document Lifecycle Engine phase AND Gulf Operational Polish phase. Both phases must extend the locked-phrases registry.

**Classification:** compliance / data-integrity.

---

### Pitfall 7: IdP Deprovisioning vs. Final-Month Invoice Race (IdP Deprovisioning ↔ Invoice / Approval Engines)

**What goes wrong:**
Offboarding workflow completes Friday 17:00. IdP deprovisioning fires immediately — Google Workspace suspended, Slack deactivated, Okta SSO revoked. Monday morning, the contractor needs to clarify their final invoice (approval queue sent CLARIFY action). They cannot log into the magic-link portal because the magic-link email was sent to their Google Workspace address, and the link verification calls Slack to notify the requester (now also broken). The final invoice ages out of the SLA, late-payment-interest accrues (LPCDA Phase 63), and the contractor escalates to small-claims court.

**Why it happens:**
The natural workflow is "offboarding done → revoke access → done". But v1.0 portal magic-link auth already decoupled contractor authentication from internal IdP — yet ops engineers naturally conflate "deprovisioned from internal SSO" with "no longer needs to access portal". The portal magic-link email destination is the contractor's PERSONAL email (set during onboarding), not their org-IdP email — except when it isn't, because some orgs onboarded contractors with their corporate Gmail.

**How to avoid:**
1. Offboarding workflow gains a NEW gate task BEFORE IdP deprovisioning: "Confirm final invoice approved AND paid AND no open clarification requests AND contractor portal email is non-IdP". This task is owned by the offboarding chain's last approver (typically Finance Manager).
2. Hard rule: IdP deprovisioning runs AT EARLIEST 14 days after final-invoice-paid event (configurable per org, default 14d). This is the "cooldown window".
3. During cooldown, the contractor's portal session continues to work but their internal-side access (Google, Slack, etc.) is already revoked — the portal session model (PortalSession from v2.0 Phase 12) is independent of any IdP. Verify this in code: portal magic-link must NEVER hit Google OAuth.
4. Add a `contractor.portalEmailIsIdpDependent` boolean: if true, force a "rotate portal email" workflow step BEFORE deprovisioning.
5. Audit: emit `IDP_DEPROVISION_DEFERRED` event with reason whenever the cooldown blocks a deprovisioning request.

**Warning signs:**
- Support ticket: "ex-contractor cannot log into portal to clarify their final invoice".
- LPCDA late-interest event for an invoice whose contractor was offboarded.
- IdP deprovisioning audit event timestamp earlier than final-invoice-paid event timestamp.

**Phase to address:**
IdP Deprovisioning phase — make the cooldown gate the FIRST plan, not an afterthought. Roadmap order matters: Offboarding Hardening should ship before or in same phase as IdP Deprovisioning so the gate task exists.

**Classification:** UX / operational / cost (LPCDA interest + reputation).

---

### Pitfall 8: Refresh-Token / Session-Lifetime Semantic Drift Across IdPs

**What goes wrong:**
Engineers assume "deprovision = user can't log in anywhere" uniformly. Reality:
- **Google Workspace:** `users.update({ suspended: true })` immediately invalidates web sessions but OAuth refresh tokens already issued continue to work for up to 24 h. To fully revoke: explicitly call `users.signOut` AND revoke OAuth tokens via `tokens.delete`.
- **Okta:** `POST /users/{id}/lifecycle/deactivate` does NOT terminate active sessions — they live until the access token's exp claim. To kill sessions: separately `POST /users/{id}/sessions` DELETE.
- **Slack SCIM `active=false`:** deactivates account but does NOT revoke xoxp/xoxb tokens issued to that user. Token remains valid until explicitly revoked via `auth.revoke`.
- **GitHub org member removal:** PAT tokens with `org:read` scopes continue working. Need to specifically revoke the SSO link.
- **Azure AD/Entra ID:** `account-disabled` does NOT invalidate active access tokens; need conditional access policy "block access" + explicit `revokeSignInSessions`.

**Why it happens:**
"Deprovision" is a marketing word, not an API. Each provider's docs use different verbs. Engineers wire up the easy/visible API and miss the second step.

**How to avoid:**
1. The `IdpDeprovisioningAdapter` interface (mirrors v2.0 `IntegrationProviderAdapter` pattern) MUST require BOTH methods:
   ```ts
   interface IdpDeprovisioningAdapter {
     suspendAccount(externalUserId): Promise<{ ok: boolean }>
     revokeAllSessions(externalUserId): Promise<{ ok: boolean, revokedTokenCount: number }>
   }
   ```
   Calling code MUST invoke both, in that order, in a Saga (see Pitfall 10).
2. Per-provider integration test: simulate "user suspended but token still valid" by calling the suspended user's stored OAuth token after `suspendAccount`; assert it FAILS within ≤5 minutes after `revokeAllSessions`. Use Context7 for current Google Admin SDK / Okta / Slack docs at implementation time, NOT training data.
3. Document per-provider semantics in `packages/integrations/src/idp-deprovisioning/README.md` (table form: provider × suspend × revoke × time-to-effect).
4. Audit event payload includes `revokedTokenCount` from each provider response.

**Warning signs:**
- An ex-contractor's commit appears in GitHub org repo days after offboarding.
- Slack message sent from ex-contractor's account post-deactivation.
- Audit log only has `IDP_SUSPEND` events, never `IDP_REVOKE_SESSIONS`.

**Phase to address:**
IdP Deprovisioning phase, the per-provider adapter plan. Build adapter interface FIRST with both methods required, THEN implement each provider.

**Classification:** security / compliance.

---

### Pitfall 9: Re-OAuth Required for Deprovisioning Scopes (IdP Deprovisioning ↔ Existing v3.0 GWS Read-Only Connections)

**What goes wrong:**
v3.0 Phase added Google Workspace Admin SDK with READ-ONLY directory.user scopes (`admin.directory.user.readonly`). To suspend a user, we need WRITE scope `admin.directory.user`. Existing customers with v3.0 connections will hit OAuth-scope errors silently when the new "suspend" code path runs. Worse: if we eagerly bump scopes in the OAuth URL of an existing OAuth client, Google may invalidate existing refresh tokens and break the v3.0 directory-import cron at the same time.

**Why it happens:**
OAuth scope expansion is not transparent — Google issues a new refresh token tied to the new scope set, and the old one stops working. Engineers building the new feature don't realize the existing read-only flow stops the moment they add a write scope.

**How to avoid:**
1. Detect-and-prompt pattern (already used in v2.0 Phase 16 Jira scope-expansion):
   - On first attempt to call deprovisioning API, detect 403 `insufficient_scope`.
   - Show in UI: "Identity Provider Deprovisioning needs additional access. Click here to re-authorize Google Workspace with deprovisioning scopes."
   - Re-OAuth flow uses `prompt=consent` to force user to re-grant; existing scope+credential record updated in place.
   - Until re-authorized: the deprovisioning feature is gated OFF for that org via a per-org capability flag (NOT the global Unleash flag).
2. NEVER force a global re-OAuth event on feature deploy. Existing read-only directory-import must keep working until each org explicitly re-authorizes.
3. Add a per-org `IntegrationConnection.scopeCapabilities` JSONB field listing what the current credential can do (`['directory.read', 'user.suspend', 'user.revoke']`). Code paths assert the required capability before making the call.
4. Migration plan: at deploy time, audit all existing GWS connections, mark `scopeCapabilities = ['directory.read']` for everyone, surface a UI banner prompting re-auth for customers in the deprovisioning early-access cohort.

**Warning signs:**
- After deploy, v3.0 directory-import cron failure rate spikes.
- Sentry "OAuth refresh_token expired or revoked" errors.
- Customers report they can no longer see "new hires" detection.

**Phase to address:**
IdP Deprovisioning phase, scope-migration plan FIRST (before any deprovisioning code). Plan must include: (a) capability flag schema, (b) re-OAuth UI flow, (c) backfill migration setting all existing connections to `['directory.read']`.

**Classification:** operational / security / cost (broken existing feature).

---

### Pitfall 10: Partial-Failure Saga Without Compensation (IdP Deprovisioning ↔ Workflow Engine)

**What goes wrong:**
Offboarding workflow triggers parallel deprovisioning across 5 IdPs. Google succeeds. Okta times out. GitHub returns 422 ("user already removed by org admin manually"). Slack returns 429 (rate limited). Without compensation logic: workflow shows "complete", contractor is in inconsistent state across providers, audit log is incomplete, and the operator has no actionable signal.

**Why it happens:**
Naive `Promise.allSettled([...])` returns settled promises but the workflow engine doesn't know what to DO with partial failures. Engineers write happy-path code first; partial-failure handling is "next sprint".

**How to avoid:**
1. Each provider deprovisioning is its own QStash job (isolation = blast radius), NOT a Promise inside a single tRPC mutation. Mirrors v2.0 webhook-pipeline async pattern.
2. State machine on `IdpDeprovisioningRequest`:
   - `REQUESTED` → per-provider task fans out
   - per-provider: `PENDING` → `SUCCESS` | `FAILED_RETRYABLE` | `FAILED_PERMANENT` | `ALREADY_GONE` (idempotent semantics: 422 "user not in org" is success-equivalent)
   - aggregate: `COMPLETE` (all SUCCESS or ALREADY_GONE) | `PARTIAL_COMPLETE` (some SUCCESS, some FAILED_PERMANENT) | `RETRYING` (any FAILED_RETRYABLE)
3. Manual reconciliation queue: `PARTIAL_COMPLETE` requests appear in an admin UI with per-provider state and "retry this one" / "mark manually reconciled with reason" actions. Same pattern as v2.0 Phase 12 sync-error queue.
4. The offboarding workflow does NOT auto-complete until aggregate state reaches `COMPLETE` OR the operator explicitly closes a `PARTIAL_COMPLETE` with override reason.
5. Audit-log entry per provider per attempt — never a single rolled-up "deprovisioning ran" event.

**Warning signs:**
- Audit log shows a single `IDP_DEPROVISION_REQUESTED` event with no per-provider follow-up.
- Operator says "I clicked offboard, did it actually do the GitHub thing?"
- An ex-contractor's PR in the org repo is reviewed by another contractor weeks later.

**Phase to address:**
IdP Deprovisioning phase — the saga + manual reconciliation queue is a foundational plan, not a polish item.

**Classification:** security / operational / data-integrity.

---

### Pitfall 11: Reactivation Path Resurrects Stale Access (IdP Deprovisioning ↔ Onboarding)

**What goes wrong:**
A contractor offboarded 6 months ago is rehired for a new engagement. Operator clicks "reactivate". Code path: revert `deprovisioned: true`. Result: their ancient GitHub org membership (with stale repo access list), Google Workspace account (with stale group memberships), and Slack channel access (with stale DM history) all come back. Possibly with elevated permissions from the previous engagement that are inappropriate for the new role.

**Why it happens:**
"Reactivate" feels like the inverse of "deprovision". But in practice, deprovisioning was destructive (memberships removed, group assignments cleared). Reverting the boolean flag doesn't reverse the side effects — and even if it did, those side effects shouldn't be reversed because the new engagement may have different access requirements.

**How to avoid:**
1. There is no "reactivate" — only "create new engagement for this contractor". Reuse the contractor record (PII, tax IDs, bank account, document history) but the new engagement runs the full onboarding workflow including fresh IdP provisioning with role-appropriate access.
2. UI: the "Rehire" button leads into the v3.0 onboarding wizard pre-filled from the historical contractor record. Never a one-click "undo".
3. Stale credential vault entries (see Pitfall 21) from the previous engagement are NEVER auto-recovered — they belong to the closed engagement and remain audit-locked.
4. Engagement history view shows "Engagement 1: Jan-Jun 2025 (offboarded), Engagement 2: Apr-… 2026 (active)" — same contractor, two engagements, two onboarding records, two offboarding records (one closed).

**Warning signs:**
- A "Reactivate" button exists in the UI mockups.
- Code path that flips `deprovisioned: false` without re-running provisioning.
- Audit log shows `CONTRACTOR_REACTIVATED` events without corresponding `ONBOARDING_WORKFLOW_STARTED`.

**Phase to address:**
IdP Deprovisioning phase, with cross-cutting Offboarding Hardening phase. Roadmap-level callout: "Rehire = new engagement, never reactivation".

**Classification:** security / data-integrity.

---

### Pitfall 12: Pino Redaction Dropping Audit-Critical IdP Fields

**What goes wrong:**
Pino factory is configured with global redact paths for PII (`req.body.bankAccount`, `req.body.taxId`, etc., per Standing Project Constraints). The new IdP audit log emits `{ provider: 'GOOGLE_WORKSPACE', externalUserId: 'jane@org.com', revokedTokenCount: 3 }`. If `externalUserId` resolves to an email and a redact path matches `*.email`, the audit-trail loses the user identifier — making it useless for compliance investigations.

**Why it happens:**
Pino redact paths are written defensively (over-redact) early in the project. The IdP feature emits data that LOOKS like PII (an email is a personal identifier) but FUNCTIONS as an audit identifier. The redaction is correct globally but wrong for this specific log path.

**How to avoid:**
1. The IdP audit logger uses a separate Pino child logger with EXPLICIT redact paths (not inherited from the root). Allowed fields: `externalUserId`, `provider`, `revokedTokenCount`, `outcome`, `requestedBy`, `engagementId`. Redacted: `accessToken`, `refreshToken`, `secret*`, `password*`.
2. Audit-trail records that go into the database (immutable AuditLog from v1.0) bypass the Pino logger entirely — they are persisted via Prisma directly. Pino is only for ops/observability logs.
3. Add this router to `LOG_BODY_EXCLUDE_PREFIXES` (so request bodies of `idpDeprovisioning.*` aren't logged at all). The audit details belong in the AuditLog model, not in HTTP request logs.
4. Test: snapshot an audit-log entry post-deprovision and assert the externalUserId is present and the token is absent. Same pattern as v5.0 Phase 67 sentinel verification.

**Warning signs:**
- Investigating a deprovision incident, you find audit entries with `externalUserId: '[REDACTED]'`.
- `LOG_BODY_EXCLUDE_PREFIXES` is missing the new router prefix.
- Pino root config uses a wildcard like `*.email`.

**Phase to address:**
IdP Deprovisioning phase, observability plan (typically last plan of the phase or first plan as a hard prerequisite).

**Classification:** compliance / observability / security.

---

### Pitfall 13: Webhook-Loop Self-Triggering Departure Events (IdP Deprovisioning ↔ v3.0 GWS Directory Import)

**What goes wrong:**
v3.0 Phase 38 GWS Admin SDK runs a daily directory-import cron that diffs current state vs. last snapshot to detect departures. New v6.0 deprovisioning code calls Google's `users.update({ suspended: true })`. Next day, GWS directory-import sees the suspended user as a "departure", emits a `GOOG_SYNC_DEPARTURE_DETECTED` notification — but the contractor was already offboarded yesterday by US. Now operator gets a duplicate departure alert AND an email from us-to-us about it.

**Why it happens:**
The two systems were built independently. Read-side does not know about write-side actions. Same root cause as the v2.0 Jira inbound-webhook-loop-prevention guard (which handles the inverse: "we changed the status, don't react to our own webhook").

**How to avoid:**
1. Mirror v2.0 Jira webhook-loop-prevention pattern: when v6.0 code calls a deprovisioning API, write `IdpChangeProvenance { provider, externalUserId, changeType: 'SUSPEND' | 'DELETE', sourceEventId, ts }` to a short-TTL table (e.g. 7 days).
2. v3.0 directory-import cron, when it detects a "departure", looks up `IdpChangeProvenance` for the matching `(provider, externalUserId)` within last 7 days. If found, the diff is OUR own write — emit `GOOG_SYNC_DEPARTURE_OWN` (audit-trail only, no notification) instead of `GOOG_SYNC_DEPARTURE_DETECTED`.
3. Same pattern applies to Slack SCIM webhook (v2.0 webhook pipeline) when we deactivate users via SCIM.
4. Test: integration test that runs deprovision-then-directory-sync sequence and asserts no duplicate departure notification.

**Warning signs:**
- Operator complaints: "I'm getting duplicate offboarding alerts".
- Notification dispatch service log shows two notifications for the same offboarding event.
- v3.0 directory-import "new hires/departures detected" alert count spikes after v6.0 deploy.

**Phase to address:**
IdP Deprovisioning phase, the plan that touches per-provider adapters. The provenance write must be in the same transaction as the deprovision call.

**Classification:** UX / operational.

---

### Pitfall 14: Conditional-Access-Policy Override (IdP Deprovisioning ↔ Azure AD)

**What goes wrong:**
We call Azure AD `revokeSignInSessions` API. API returns 200 OK. Tenant admin has set a Conditional Access policy "Persist sessions for trusted devices: 90 days" — and our revoke gets silently overridden because the policy takes precedence. Contractor's existing Outlook desktop session continues to work for 90 days post-deprovisioning.

**Why it happens:**
Microsoft Graph API success codes don't surface tenant-policy conflicts. Our adapter trusts the 200 OK as "session ended". Tenant admins are unaware their policy interacts with our API.

**How to avoid:**
1. Azure AD adapter MUST verify post-revoke by calling `signInActivity` API (or audit log query) and asserting last sign-in event has changed status to revoked. If not, mark deprovisioning as `VERIFICATION_REQUIRED` and surface an admin-action banner.
2. UI: "verify deprovisioning" button on offboarding completion page that surfaces per-provider verification status. For Azure AD, show a "policy override detected — contact your tenant admin to revoke the persistent-sessions policy for this user" link.
3. Document in customer onboarding: "If you use Conditional Access policies, configure an exception for accounts in the 'offboarded' security group". Provide the security group name our adapter creates.
4. Health-monitoring dashboard (v2.0 Phase 11) shows per-org Azure AD "deprovisioning verification success rate" — drift below 95% raises an alert.

**Warning signs:**
- Customer escalation: "the contractor I offboarded last week is still in our team Outlook calendar".
- Azure AD adapter telemetry: revoke calls succeed but `signInActivity` shows continued sign-ins.

**Phase to address:**
IdP Deprovisioning phase, Azure AD adapter implementation plan.

**Classification:** security / compliance.

---

### Pitfall 15: UAE Permitted-Activity-Scope Mismatch (Gulf Polish ↔ Invoicing)

**What goes wrong:**
UAE free-zone licences specify "permitted activities" (e.g. "consulting services in IT", "trade in electronic components"). A contractor billed for "graphic design" while their licence permits only "software development" creates a customer compliance violation — the customer may face fines from the free-zone authority. Our system either: (a) doesn't check (silent failure → customer fined), or (b) hard-blocks invoice creation (false-positive friction when the activity description is non-canonical).

**Why it happens:**
Activity descriptions are free text. Free-zone permitted-activity lists use canonical codes (DED-aligned ISIC). Mapping is fuzzy.

**How to avoid:**
1. Schema: UAE free-zone contractor profile gets a `permittedActivityCodes` (string array of ISIC-aligned codes) field. NOT a free-text "what they do" string.
2. Contracts and invoices in UAE jurisdiction get an `activityCode` field selected from the contractor's permitted list. Default = primary permitted activity. UI: dropdown with explanatory text per code, populated from the free-zone licence document.
3. Soft-warn (not hard-block) on mismatch — block on payment-batch-creation if mismatch unresolved AND tier is ENTERPRISE (cost-of-fines tier). For STARTER/PRO, warn at invoice-create time and warn again at payment-batch-creation; Finance Manager can override with reason.
4. Locked-phrase: the activity code rendered on invoices/Peppol PINT-AE XML must come from the v6.0 locked-phrases registry — wrong rendering = downstream Peppol rejection.

**Warning signs:**
- Customer reports a free-zone fine traceable to a billed activity.
- Hard-block messages dominate operator support tickets in UAE region.

**Phase to address:**
Gulf Operational Polish phase, UAE plan.

**Classification:** compliance / cost / UX.

---

### Pitfall 16: Three-Clock Conflation — Licence vs Visa vs Emirates ID (Gulf Polish ↔ Compliance Lifecycle)

**What goes wrong:**
A UAE contractor has: free-zone licence (expires 2027-03), residency visa (expires 2026-09), Emirates ID (expires 2026-09). All three are independent. Conflating them — say, treating "visa expiry = work eligibility expiry" — means a contractor whose Emirates ID expired (but visa is still valid via grace period) gets blocked from payment, OR a contractor whose visa expired (but Emirates ID was renewed under a new visa) gets paid despite being non-compliant.

**Why it happens:**
Engineers naturally model "expiry" as a single field. UAE has three clocks; KSA also has three (Iqama / work permit / Saudization registration). Each has different consequences (no Emirates ID = no banking; no visa = illegal residency; no licence = can't bill).

**How to avoid:**
1. Schema treats each as a separate `Document` row keyed by `documentTypeProfileKey` (Pitfall 4 fix). Each profile defines `requiredFor: ['BILLING' | 'PAYMENT' | 'CONTRACT_RENEWAL']`.
2. Compliance dashboard groups expiries by impact (NOT by document type): "Will block payment if expired", "Will block billing if expired", "Operational warning only".
3. Per-document-type expiry reminders use the document profile's lead-time (some require 90/60/30/15/7; others only 30/15/7 because renewal is fast).
4. Test: scenario fixtures for each expiry combination (Emirates ID expired + visa valid; visa expired + Emirates ID valid; both expired; etc.) verifying correct system behaviour per scenario.

**Warning signs:**
- A `contractor.workEligibilityExpiresAt` column appears in the schema.
- A single boolean `gulf_documents_valid` is computed somewhere.

**Phase to address:**
Gulf Operational Polish phase + Compliance Document Lifecycle Engine phase (shared schema).

**Classification:** data-integrity / compliance.

---

### Pitfall 17: Saudization Nitaqat Threshold Rule-Set Drift (Gulf Polish)

**What goes wrong:**
Nitaqat band thresholds (Platinum / Green / Yellow / Red) depend on sector + company size + Saudization percentage. Thresholds are revised by the Ministry of Human Resources annually (sometimes more often). Hard-coded threshold table goes stale → customers see wrong band → make wrong hiring decisions → real-world consequences (loss of Iqama issuance privileges).

**Why it happens:**
Thresholds feel static when first researched. The drift problem is identical to v5.0 IR35 case-law drift (Atholl House → PGMOL).

**How to avoid:**
1. Mirror v5.0 classification rule-set pattern: `packages/gulf/src/saudization/thresholds.ts` with `RULE_SET_VERSION` constant, threshold tables keyed by sector+size+year.
2. Snapshot `saudizationThresholdsVersion` on every workforce-composition record so historical reports show what band the org was in under the rules-of-record at the time, not the rules-of-today.
3. Quarterly cron: scrape MOL Saudization-rate publication URL (or schedule manual review checkpoint with explicit "Needs verification by legal entity before production deploy" tag per Standing Project Constraints).
4. Same `recreateSaudizationAssessment` admin tRPC mutation as Pitfall 5 — drift escape hatch.
5. PDF artefacts (band confirmation letters) include `assessedAgainstRulesetVersion` watermark.

**Warning signs:**
- A PR labelled "update Nitaqat thresholds" lacks a corresponding `RULE_SET_VERSION` bump.
- Customer reports "your band shows Green but MOL portal shows Yellow".

**Phase to address:**
Gulf Operational Polish phase, Saudization plan.

**Classification:** compliance / data-integrity / cost.

---

### Pitfall 18: GCC-Nationality Partial-Credit Miscalculation (Gulf Polish)

**What goes wrong:**
In some KSA sectors, Saudi nationals count 1.0 toward the Saudization ratio; GCC nationals (Bahraini, Emirati, Kuwaiti, Omani, Qatari) count 0.5. Engineers naively compute `count(saudiNationals) / count(allEmployees)` — wrong number, customer makes wrong hiring decisions.

**Why it happens:**
The half-credit rule is sector-specific and easy to miss. Source-of-truth document is the KSA labour ministry's circular, not in mainstream APIs.

**How to avoid:**
1. The Saudization profile (Pitfall 17) explicitly encodes the per-sector multiplier matrix: `{ sector: 'IT', saudiMultiplier: 1.0, gccMultiplier: 0.5, otherMultiplier: 0.0 }`.
2. Computation goes through a pure function `computeSaudizationPercentage(workforce: Workforce, sectorProfile: SectorProfile)` with property-based tests covering edge cases (all-Saudi, all-GCC, mixed, empty workforce).
3. Dashboard shows raw counts AND weighted percentage AND the multiplier currently applied — operator can spot-check the math.
4. PDF artefact includes the calculation breakdown.

**Warning signs:**
- A PR computes Saudization percentage with no multiplier reference.
- Test file lacks GCC-mixed-workforce scenarios.

**Phase to address:**
Gulf Operational Polish phase, Saudization plan.

**Classification:** compliance / data-integrity.

---

### Pitfall 19: Regional-Routing Default Drift on New Gulf Models (Gulf Polish ↔ v4.0 Multi-Region)

**What goes wrong:**
v4.0 introduced per-org regional database routing (EU + ME). New v6.0 Gulf models (free-zone tracking, Saudization workforce composition, Iqama/Emirates ID document profiles) are added to the Prisma schema. Default migration applies to BOTH region databases — but if a new model is created via the Prisma `Organization`-aware extension and the org is in EU, the row goes to the EU database. Result: ME-region data stored in EU = data residency violation = PDPL breach + Saudi Personal Data Protection Law breach.

**Why it happens:**
v4.0 multi-region routing is configured on the AsyncLocalStorage tenantStore — it's transparent. New models inherit it correctly IF they have a tenant-scoping relationship; new models that don't (e.g. a new "global Saudization sector profile" lookup table) end up in whichever region the migration ran first.

**How to avoid:**
1. Schema-review checklist for v6.0: every new model is classified as `tenant-scoped` (must have `organizationId`) or `global` (lookup data, replicates everywhere). No third category.
2. New tenant-scoped models added to `packages/db/src/multi-region-models.ts` registry that the regional-router uses to assert "this model must be queried with regional routing".
3. CI guard: integration test that creates an ME-region org, creates one row of every new tenant-scoped model, then queries the EU database directly and asserts ZERO rows for that org. Same defensive pattern as v1.0 Phase 1 multi-tenant guard.
4. Data-residency audit checklist appears in the phase VALIDATION.md as a manual checkpoint per Standing Project Constraints (legal sign-off deferred but evidence captured pre-deploy).

**Warning signs:**
- A new Prisma model lacks an `organizationId` field but isn't in the `global` lookup list.
- Schema migration applies to default region only without explicit cross-region apply.

**Phase to address:**
Gulf Operational Polish phase, the schema-design plan. Integrate with the v4.0 multi-region routing infrastructure explicitly.

**Classification:** compliance / data-integrity / regulatory.

---

### Pitfall 20: Arabic RTL Drift on New UI Components (Gulf Polish ↔ v4.0 RTL Foundation)

**What goes wrong:**
v4.0 Phase shipped Arabic localization with CSS logical properties (`margin-inline-start` instead of `margin-left`). New v6.0 components (free-zone licence editor, Saudization dashboard, Emirates ID renewal banner) are written using Tailwind's `ml-`/`mr-` utilities or `flex-row` without RTL consideration. Arabic layout breaks: cards flip wrong way, icons end up on wrong side, percentage progress bars fill from wrong direction.

**Why it happens:**
Tailwind defaults are physical properties (`ml-`, `mr-`). Tailwind's RTL plugin or logical-property utilities (`ms-`, `me-`) require explicit opt-in. Engineers building English-first naturally use the physical defaults.

**How to avoid:**
1. ESLint rule banning `ml-`/`mr-`/`pl-`/`pr-`/`text-left`/`text-right` in `apps/web/src/components/**/*.{tsx,jsx}`. Allow only `ms-`/`me-`/`ps-`/`pe-`/`text-start`/`text-end`. Same enforcement as v4.0 introduced.
2. Storybook (or visual-regression test) for every new Gulf-feature component renders BOTH `dir="ltr"` and `dir="rtl"` viewports. Snapshot diff fails CI on drift.
3. Locale-aware progress bar: percentage fill direction follows `dir`. Same for stepper components.
4. New components added to the `rtlSafeComponents` registry/test harness — same pattern as the locked-phrases-guard for legal terms.

**Warning signs:**
- ESLint passes locally but visual-regression snapshot fails on RTL render.
- Arabic-locale customer screenshot shows misaligned cards.

**Phase to address:**
Gulf Operational Polish phase, every UI plan. Roadmap should call out an RTL-verification checkpoint.

**Classification:** UX / accessibility / compliance.

---

### Pitfall 21: Credential-Vault Storing Actual Credentials (Offboarding Hardening)

**What goes wrong:**
"Documentation handover task with credential links" — the offboarding checklist asks the contractor to upload credentials they used during the engagement. Engineers naturally create a free-text "credentials" field. Contractor pastes actual API tokens, AWS access keys, database passwords. Now Contractor Ops is storing the customer's most sensitive secrets — blast radius, key-rotation nightmare, and a regulatory minefield (PCI, SOC2, HIPAA).

**Why it happens:**
The product-language ("credential links") is ambiguous. Engineers focus on the UI workflow, not the data classification.

**How to avoid:**
1. The schema is `CredentialReference`, not `Credential`. Fields: `name` (e.g. "AWS production access"), `vaultLocation` (e.g. "1Password vault: Engineering / item: aws-prod"), `accessProtocol` (e.g. "request via #ops Slack"). NEVER a `secret` or `value` field.
2. Free-text input is content-validated client-side AND server-side: refuse submission if input matches regex for AWS keys (`AKIA[0-9A-Z]{16}`), GitHub PATs, JWT-shape, hex-shape ≥32 chars. Show error: "We don't store actual credentials — paste a link to your password manager instead."
3. UI copy is explicit: "Where to find this credential" not "the credential". Mockups must demonstrate the distinction.
4. Audit: any string column on this model has a CI scan against credential-shape patterns; new patterns added to scan as found-in-the-wild.
5. Documentation: locked-phrase `OFFBOARDING_CREDENTIAL_REFERENCE_DEFINITION` constant defining the data classification, rendered on the page.

**Warning signs:**
- A field literally named `secret`, `password`, `token`, or `key` in the offboarding schema.
- User-uploaded "credentials" are rendered in plaintext on the offboarding view.

**Phase to address:**
Offboarding Hardening phase, schema-design plan (first plan).

**Classification:** security / compliance / cost (security-incident-grade exposure).

---

### Pitfall 22: IP-Assignment Heuristic False-Negative (Offboarding Hardening ↔ Claude Vision OCR)

**What goes wrong:**
v6.0 plan: "contract clause health check flagging missing IP-assignment language". Claude Vision OCR (v2.0 Phase 13) scans contract PDFs for IP-assignment clauses. The contract uses unusual wording ("the Vendor irrevocably grants the Customer a worldwide perpetual licence to all work product") — semantically equivalent to assignment but phrased as a licence. Heuristic flags as MISSING. Operator sees green-check, contractor offboards without explicit IP signature, customer later disputes IP ownership in litigation.

**Why it happens:**
Heuristic relies on keyword matching ("hereby assigns", "assignment", "all rights, title, and interest"). Real-world contracts use synonyms, hybrid licence-assignment hybrids, and varying jurisdictions (UK "assignation", DE "Übertragung der Verwertungsrechte", AE "تنازل عن حقوق الملكية الفكرية").

**How to avoid:**
1. Heuristic NEVER flags as definitively "missing" — only as `LIKELY_PRESENT` / `LIKELY_MISSING` / `MANUAL_REVIEW_REQUIRED`. Confidence threshold high for "likely missing"; everything else routes to manual review.
2. Manual-review queue with side-by-side PDF + extracted clause UI. Operator confirms presence/absence. Decision is audit-logged with operator identity and timestamp.
3. Per-jurisdiction phrase library (locked-phrases registry pattern from v5.0). For each jurisdiction, encode several canonical IP-assignment phrasings; heuristic checks against the library, not free-form pattern matching.
4. Hard-block at offboarding-completion: contract cannot have status "verified IP" without an operator-signed verification record. Heuristic `LIKELY_PRESENT` is only an ASSIST, never a substitute.
5. Audit trail: `IP_ASSIGNMENT_HEURISTIC_RESULT` event records both heuristic verdict and operator override.

**Warning signs:**
- Offboarding workflow has an automated path that completes without human verification.
- Heuristic confidence threshold is `>50%` (too low).

**Phase to address:**
Offboarding Hardening phase, IP-clause-check plan.

**Classification:** legal / data-integrity / cost (litigation).

---

### Pitfall 23: IP-Assignment Heuristic False-Positive at Upload (Offboarding Hardening ↔ Onboarding)

**What goes wrong:**
The same heuristic runs at contract UPLOAD time (during onboarding, v1.0 contract repository). It flags 30% of existing healthy contracts as `LIKELY_MISSING` because they use the licence-style wording. Customers flood support: "you're saying our contracts are broken but they've been reviewed by our lawyer".

**Why it happens:**
Running an imperfect heuristic eagerly at upload creates noise for the 95% of healthy contracts. The signal is only valuable at offboarding (the moment the question matters).

**How to avoid:**
1. Heuristic runs at offboarding-time ONLY, NOT at upload. Upload-time emits no IP-clause signal.
2. If a customer wants pre-emptive contract health check, it's an explicit "Run health check now" admin action with clear UI labelling that this is a heuristic and may produce false-positives.
3. Heuristic results that disagree with operator manual override are audit-logged for offline calibration; tune the heuristic against this data, not against synthetic data.
4. UI copy NEVER uses words like "missing IP clause" — uses "needs review" with explanation that the checker is a guide.

**Warning signs:**
- Bulk customer support tickets shortly after IP-clause-check feature ships.
- Contract upload page shows IP-clause warnings on previously-uploaded contracts.

**Phase to address:**
Offboarding Hardening phase, IP-clause-check plan.

**Classification:** UX / cost (support load).

---

### Pitfall 24: Knowledge-Transfer Role Taxonomy Ossification (Offboarding Hardening)

**What goes wrong:**
Plan: "knowledge transfer checklist templates per role type". Engineers create an enum: `BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `DESIGNER`, `PM`, `QA`, `DEVOPS`. Customer has "Staff Engineer", "Engineering Manager", "Tech Lead", "Solutions Architect", "Customer Success Engineer" — none fit. Customer either picks "closest" (wrong checklist) or asks support to add a role (slow).

**Why it happens:**
Enums feel safer than free strings. Real-world job titles have a long tail.

**How to avoid:**
1. Role taxonomy is a per-org `WorkflowRole` model (not a global enum). Org admin can create / edit / delete role templates. Each role owns a set of `KnowledgeTransferTaskTemplate`s (similar to v1.0 workflow template builder).
2. Built-in starter templates for common roles ship as seed data on org creation, but mutable.
3. Migration path: `ContractorEngagement.role` is a string (free), with a `roleTemplateId` foreign key (nullable). If the engagement was created with a template, the template ID is stored. If template is later edited, engagement records `templateVersion` snapshot (drift escape hatch — same pattern as Pitfalls 5, 17).
4. Locked-phrase rule applies only to legally-significant role labels (e.g. UK IR35 "Inside" / "Outside" labels, German "Festangestellt" / "Selbständig"). Free-text role titles are NOT locked.

**Warning signs:**
- A `Role` enum in Prisma schema with a fixed list.
- Customer feature requests starting with "can you add role X to the dropdown".

**Phase to address:**
Offboarding Hardening phase, knowledge-transfer-checklist plan.

**Classification:** UX / data-integrity / extensibility.

---

### Pitfall 25: Hard-Block on Missing IP Signature With Unresponsive Contractor (Offboarding Hardening)

**What goes wrong:**
Offboarding cannot complete until the contractor signs the IP assignment form. Contractor has stopped responding (illness, dispute, end-of-engagement burnout). Offboarding workflow is stuck. Operator cannot complete offboarding → cannot deprovision → cannot finalize the contractor's status. Indefinite limbo.

**Why it happens:**
"Hard block until signed" feels safer than "skip with reason". Actually both are needed — the default is hard-block, the escape is admin-override-with-audit.

**How to avoid:**
1. Two-tier completion model: `IP_SIGNATURE_VERIFIED` (contractor signed) | `IP_SIGNATURE_OVERRIDE` (admin attested with reason, audit-logged, signed by an OWNER role per the v1.0 8-role RBAC).
2. Override flow: required reason text, required acknowledgement text ("I understand this engagement is closed without contractor IP confirmation; legal exposure remains until clause review"), required RBAC role OWNER.
3. Override emits `IP_SIGNATURE_OVERRIDE_APPLIED` audit event. Reports include override count per period — surfaces operational pattern (high override rate = process broken).
4. Override does NOT close the IP-clause-check verdict; it records "completed with override" so legal team can later reach out to the contractor.

**Warning signs:**
- Offboarding workflow with no admin-override path.
- Stuck offboarding tickets in operator backlog.
- Override flow exists but lacks audit reason or RBAC enforcement.

**Phase to address:**
Offboarding Hardening phase, IP-verification-workflow plan.

**Classification:** operational / legal / data-integrity.

---

### Pitfall 26: Knowledge-Transfer Task Assignment to PTO Manager (Offboarding Hardening ↔ Notification Engine)

**What goes wrong:**
Knowledge-transfer task assigned to manager as part of offboarding workflow. Manager is on 3-week PTO. Overdue cron (v1.0 workflow engine) fires daily reminders. Manager receives 21+ notifications. Returns from PTO, drowns in alerts, silences entire app, misses the legitimate critical reminders.

**Why it happens:**
Workflow engine has no concept of out-of-office. Tasks go to people regardless of availability.

**How to avoid:**
1. User-level OOO/PTO calendar (could integrate with v2.0 Google/Outlook calendar feature). When the assignee has OOO covering the task due date, the workflow engine routes to the assignee's delegate (settings: `defaultDelegate` per user).
2. If no delegate configured, the task falls back to the org's offboarding chain default approver. NEVER stays unassigned.
3. Reminder-cron checks OOO before sending: if assignee is OOO, suppress and emit one rolled-up "tasks waiting on your return" notification at the OOO end date.
4. Same notification-throttle pattern as Pitfall 2: per-recipient cap of 1/24h.

**Warning signs:**
- An assignee with the same task overdue for >7 days but no notification activity.
- Reminder-cron sends 5+ identical notifications to the same recipient in a week.

**Phase to address:**
Offboarding Hardening phase, knowledge-transfer-workflow plan, with cross-cutting notification-delivery polish.

**Classification:** UX / operational.

---

## Cross-Cutting Pitfalls (Critical)

### Pitfall 27: New Models Missing tenantId (Multi-Tenant Data Leak)

**What goes wrong:**
v6.0 introduces ~10–15 new Prisma models (compliance docs, deprovisioning requests, free-zone licences, Saudization workforce composition, knowledge-transfer templates, IP-clause-check results, credential references, etc.). One new model is added without `organizationId` field — the AsyncLocalStorage Prisma extension cannot scope it. Org A's data is queryable from Org B's session.

**Why it happens:**
The Prisma extension scopes models that HAVE `organizationId`. Models without it are silently NOT scoped — no compile-time error.

**How to avoid:**
1. CI guard: schema-lint script enumerates all models; for each, asserts EITHER `organizationId String` field OR explicit `globalLookupModel: true` annotation in a registry. Fail CI if a model is missing both. Same pattern as v1.0 Phase 1 multi-tenant scoping.
2. Pre-commit hook: any `*.prisma` change triggers the schema-lint.
3. Integration test that creates two orgs, populates one row in every new model for each, and asserts cross-org query returns zero rows from the other org.
4. Code-review checklist: "every new model has tenantId or is on global lookup list".

**Warning signs:**
- A new Prisma model PR has no `organizationId` field and is not on the global-lookup list.
- Test coverage for a new model lacks cross-org isolation test.

**Phase to address:**
Every v6.0 phase. The schema-lint guard should be added in the FIRST v6.0 phase as a hard prerequisite.

**Classification:** security / data-integrity / compliance / regulatory.

---

### Pitfall 28: PII Leakage Into Pino Logs (LOG_BODY_EXCLUDE_PREFIXES)

**What goes wrong:**
New tRPC routers (`compliance.*`, `idpDeprovisioning.*`, `gulf.*`, `offboarding.*`) handle bodies containing visa numbers, Iqama numbers, Emirates ID numbers, IBANs, bank account details. If the router is not registered in `LOG_BODY_EXCLUDE_PREFIXES`, Pino logs the request body. Production logs (or even local logs in a screenshot) leak regulated PII = PDPL/GDPR breach.

**Why it happens:**
The sentinel exists but adding new routers to it is manual.

**How to avoid:**
1. CI guard: enumerate all tRPC routers; for each whose name matches a sensitive-pattern (compliance, idp, gulf, offboarding, billing, payment, contractor, document), assert the prefix appears in `LOG_BODY_EXCLUDE_PREFIXES`. Fail CI on miss.
2. Test: snapshot a request to one of these routers and assert the captured Pino log does NOT contain the request body.
3. New routers default to OPT-IN logging: routers not in an `ALLOW_BODY_LOG_PREFIXES` list have their bodies excluded. Inversion of the current pattern. Stricter default = safer default.

**Warning signs:**
- New router PR with no `LOG_BODY_EXCLUDE_PREFIXES` change.
- Pino log capture in dev shows visa numbers / IBANs.

**Phase to address:**
First v6.0 phase, the observability/logging-baseline plan.

**Classification:** security / compliance / regulatory.

---

### Pitfall 29: i18n Message-Key Parity Drift (4,281-Key Contract)

**What goes wrong:**
v5.0 closed Phase 69 by aligning DE message keys to the 4,281-key parity contract. v6.0 ships ~500 new strings. Engineers add them to `en.ts` only — `pl.ts`, `de.ts`, `ar.ts` lag behind. CI fails at end of phase, blocking merge until translation is filled in.

**Why it happens:**
English-first development. Translation feels like a polish step.

**How to avoid:**
1. Keep the existing CI guard (`pnpm message-key-parity`) — it already exists. Ensure it runs PER-PR, not per-merge.
2. Workflow: each plan that adds new copy creates a `i18n-pending-{plan}.txt` checklist enumerating new keys, sized in ETA. Translation work is part of the plan, not deferred.
3. For ar.ts (RTL), translation includes RTL-pair (visual review). Mark plans whose Arabic translation requires native-speaker review per Standing Project Constraints.
4. Locked-phrase additions (Pitfall 6) extend the 78-phrase guard tally — track phrase count per phase summary.

**Warning signs:**
- PR adds keys to `en.ts` without corresponding additions to `pl.ts`/`de.ts`/`ar.ts`.
- CI message-key-parity runs only on main branch, not on PR.

**Phase to address:**
Every v6.0 phase has an i18n closure plan. First v6.0 phase ensures the CI guard runs PER-PR.

**Classification:** operational / UX.

---

### Pitfall 30: Feature Flag Without PENDING → APPROVED CI Gate Registration

**What goes wrong:**
v5.0 Phase 56-69 introduced an Unleash feature-flag wrapper with a deployment-time signoff registry — flags marked `legalSensitive: true` cannot be toggled to ON without a recorded sign-off. v6.0 features (especially compliance, gulf, IP-clause) are all legal-sensitive but engineers forget to register the new flags. Someone toggles the flag to ON in Unleash UI; signoff registry is missing; CI passes (because the flag isn't in the registry, the gate doesn't fire); legal-unsigned feature ships.

**Why it happens:**
Adding a flag to Unleash UI is a separate action from registering it in the code-side signoff registry. The asymmetry is the bug.

**How to avoid:**
1. CI guard: at deploy time, enumerate all flags in Unleash that match `legalSensitive: true` rules (defined in the registry by name pattern: `compliance-*`, `idp-deprovisioning`, `gulf-*`, `offboarding-ip-*`); for each, assert PENDING or APPROVED record exists. Fail CI on miss. Same pattern as v5.0 PENDING → APPROVED gate.
2. New-flag PR template requires both: (a) flag definition in code wrapper, (b) signoff registry entry with status PENDING and required-approver list.
3. Unleash flag creation should fail (via webhook + custom validator) if not preceded by a code-side registry entry. Operationally enforced.
4. Document in v6.0 onboarding for engineers: "every legal-sensitive flag requires code AND registry AND sign-off".

**Warning signs:**
- A flag exists in Unleash but not in the code wrapper's flag list.
- The signoff registry has no entry for a flag listed in the wrapper.
- A flag with legal-sensitive name pattern is in state ENABLED but no sign-off record exists.

**Phase to address:**
First v6.0 phase, deployment-baseline plan. New flags introduced per-feature phase but the gate enforcement is foundational.

**Classification:** compliance / legal / regulatory.

---

### Pitfall 31: Existing Read-Only OAuth Scope Cohabitation (Cross-Cutting)

**What goes wrong:**
Already covered in Pitfall 9 specifically for GWS, but generalizes. v3.0 Phase 38 GWS, v2.0 Slack, v2.0 Teams, v2.0 Jira all have OAuth integrations with current scope sets. v6.0 may need additional scopes for: Slack deactivation (`admin.users:write`), Teams calendar event delete (`Calendars.ReadWrite`), Jira final-status sync. Same scope-expansion-breaks-existing-token problem applies.

**How to avoid:** Same as Pitfall 9 — generalized scope-capability tracking on `IntegrationConnection`, detect-and-prompt re-auth pattern, NEVER force a global re-OAuth.

**Phase to address:** Any phase that touches an existing integration. Cross-cutting infrastructure plan in first v6.0 phase.

**Classification:** operational / security.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single `Document.expiresAt` field for all expiry types | 1 day saved on schema | Pitfall 4 + 16 + Pitfall 3 TZ bugs in production; forward-only migration | Never |
| Hard-coded threshold tables (Saudization, IR35) | 2 days saved | Annual silent drift, customer disputes | Never — version-stamp from day one |
| Promise.allSettled for parallel deprovisioning | 1 day saved | Pitfall 10 partial-failure data loss | Never — start with QStash saga |
| "Reactivate contractor" button | 1 day saved on rehire UX | Pitfall 11 stale credential resurrection | Never |
| Free-text "credentials" field | 0.5 days saved | Pitfall 21 storing real secrets, regulated-data exposure | Never — refuse the schema review |
| Heuristic IP-clause flag at contract upload | UX feels proactive | Pitfall 23 customer-support flood | Only at offboarding, never at upload |
| Skip cooldown window for IdP deprovisioning | 1 day saved | Pitfall 7 LPCDA interest accrual + court cases | Never — cooldown is mandatory |
| Reuse existing Pino redact paths verbatim | 0.5 days saved | Pitfall 12 audit-trail fields silently redacted | Only after audit-trail review |
| Add new translations only to en.ts | 2 days saved per phase | Pitfall 29 CI failure at phase close, blocking merge | Never — plan i18n in-phase |
| Skip RTL test snapshots for new components | 1 day saved per component | Pitfall 20 Arabic layout bugs surface in customer screenshots | Never — RTL is a v4.0 commitment |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Workspace Admin SDK | Assume `users.update({suspended:true})` revokes tokens | Two-step: suspend + `tokens.delete`; verify via re-call after 5min |
| Okta deactivate | Assume sessions die immediately | Separately call `DELETE /users/{id}/sessions`; sessions live until exp otherwise |
| Slack SCIM `active=false` | Assume tokens revoked | Tokens persist; explicitly call `auth.revoke` for each issued token |
| GitHub org member removal | Assume PATs revoked | PATs with `org:read` scope continue; revoke SSO link explicitly |
| Azure AD `revokeSignInSessions` | Trust the 200 OK | Verify post-revoke via `signInActivity`; tenant CAP may override |
| QStash for deprovisioning saga | Use `Promise.allSettled` | Per-provider QStash job; aggregate state machine; manual reconcile queue |
| v3.0 GWS directory-import | Assume new "departure" events are real | Cross-check with `IdpChangeProvenance` table to filter own writes |
| v2.0 Jira/Slack/Teams existing OAuth | Bump scopes globally on deploy | Per-org capability flag; detect-and-prompt re-auth; existing scopes keep working |
| Resend email reminders | Send per-doc reminder | Daily digest cron BEFORE per-doc cron; one rolled-up email per recipient |
| Pino logger for audit | Inherit root redact paths | Separate child logger with explicit allow-list; AuditLog model is the source-of-truth, not Pino |
| Unleash legal-sensitive flag | Toggle in UI, ship | Code-side wrapper + signoff registry + CI PENDING→APPROVED gate before deploy |
| Prisma extension regional routing | Add new model without `organizationId` | Schema-lint enforces tenantId or global-lookup-list classification |
| Claude Vision (v2.0) for IP-clause check | Treat heuristic verdict as definitive | Return tristate (`LIKELY_PRESENT`/`LIKELY_MISSING`/`MANUAL_REVIEW`); operator confirmation required for offboarding completion |
| LPCDA interest engine (v5.0) | Allow offboarding before final invoice paid | Cooldown gate before IdP deprovisioning; LPCDA accrues if portal access lost |
| Storecove Peppol PINT-AE | Use English activity description | Use ISIC code from contractor's free-zone permitted list — Peppol field is structured |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Compliance-doc cron N+1 query (per contractor, query each document type) | Cron run-time grows linearly with contractor count | Single batched query: all documents JOIN contractor + profile registry, in-memory expiry evaluation per profile | ≥1k contractors per org |
| Reminder-dispatch fan-out from cron | Resend rate-limit (50 req/sec) breaches; QStash queue backed up | Daily-digest pattern (Pitfall 2) collapses N reminders to 1 per recipient | ≥500 reminders per cron run |
| Per-provider deprovisioning sync in single tRPC mutation | tRPC timeout 60s; partial deprovisioning | Per-provider QStash jobs; mutation returns immediately with request ID; UI polls aggregate state | ≥3 providers + 1 slow provider |
| Saudization workforce diff query | Real-time computation on dashboard load | Materialize daily snapshot table; recompute on workforce change events | ≥50 employees per org |
| IP-clause heuristic on every contract upload | Upload-time latency 5-10s | Run only at offboarding (Pitfall 23) | All scales — wrong place to run |
| Compliance dashboard real-time aggregation | Slow dashboard load on >1000 contractors | Compliance health KPIs precomputed by daily cron; dashboard reads cached row | ≥500 contractors per org |
| GWS directory-import hourly polling | API rate limit + cost | Stay daily; rely on detect-and-prompt re-auth + saga for live deprovisioning | All scales — over-polling waste |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing actual credentials in vault (Pitfall 21) | Regulated-data exposure, blast-radius incident | Schema is `CredentialReference`; content-validation rejects credential-shape strings |
| OAuth scope expansion breaks existing scopes (Pitfall 9, 31) | Existing read-only feature stops working; partial credential rotation | Per-org capability flag + detect-and-prompt re-auth |
| Reactivation resurrects ancient access (Pitfall 11) | Privilege escalation; compliance violation | No reactivation — only "new engagement" with fresh provisioning |
| Pino over-redacts audit fields (Pitfall 12) | Compliance investigation has insufficient evidence | Separate child logger; AuditLog model bypasses Pino |
| Pino under-redacts request bodies (Pitfall 28) | Visa/Iqama/IBAN PII leaked to logs | `LOG_BODY_EXCLUDE_PREFIXES` CI guard; opt-in body logging |
| Multi-tenant model missing tenantId (Pitfall 27) | Cross-tenant data leak | Schema-lint CI guard; cross-org integration test |
| ME-region data stored in EU DB (Pitfall 19) | PDPL / Saudi PDPL breach | Regional-routing registry; cross-region isolation test |
| Conditional Access overrides revoke (Pitfall 14) | Ex-contractor retains active session | Verify post-revoke via signInActivity; UI banner for tenant-policy customers |
| HMAC verification skipped for new webhooks | Deprovisioning request forged by attacker | Reuse v2.0 webhook pipeline (Slack HMAC-SHA256, Resend Svix) — never custom |
| Per-provider key reuse for IdP deprovisioning | One key compromised = all providers compromised | AES-256-GCM per-provider keys (already convention from v2.0); each new IdP gets its own key |
| Magic-link portal email tied to corporate IdP (Pitfall 7) | Ex-contractor locked out of portal post-deprovisioning | Enforce non-IdP email for portal; force-rotate before deprovisioning |
| Legal-sensitive flag without signoff (Pitfall 30) | Unsigned legal copy ships to customers | Unleash PENDING→APPROVED CI gate |
| Free-text role / activity description (Pitfalls 15, 24) | Wrong invoice/permit mapping | Structured fields backed by registries (ISIC codes, role templates) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 5 reminder emails for 5 docs same week | Notification fatigue, mass-disable | Daily digest collapses to 1 per recipient (Pitfall 2) |
| "Expires today" off-by-day disputes | Customer support load; trust erosion | Date-only field + contractor-jurisdiction TZ display dual (Pitfall 3) |
| Hard-block payment on expired-doc with no override | Stuck payment runs; ops tickets | Operator override with reason; OWNER role + audit log (Pitfall 25 generalized) |
| "Reactivate" button with no follow-up steps | Stale access surface; security incidents | "Rehire" → onboarding wizard with prefilled history (Pitfall 11) |
| Heuristic flags 30% of contracts at upload | Mass support tickets; trust loss | Heuristic only at offboarding (Pitfall 23) |
| RTL layout breaks for new Gulf components | Arabic users see broken UI; perceived low quality | ESLint + visual regression for `dir=rtl` (Pitfall 20) |
| Free-text role taxonomy doesn't match customer | Wrong checklist; support friction | Per-org `WorkflowRole` model with starter seeds (Pitfall 24) |
| Manager on PTO drowns in reminders | Critical alerts missed post-PTO | OOO-aware routing + delegate fallback (Pitfall 26) |
| Operator can't tell why payment was blocked | "Why is this payment frozen?" tickets | `PaymentRunComplianceCheck` audit row with per-contractor reason (Pitfall 1) |
| "Documentation handover" UI implies storing credentials | Customer pastes real secrets | UI copy: "where to find the credential", schema rejects credential-shape strings (Pitfall 21) |
| Contractor portal unusable post-offboarding for clarification | LPCDA interest accrual; small-claims escalation | 14-day cooldown window pre-deprovisioning (Pitfall 7) |
| Compliance dashboard mixes "blocks billing" with "blocks payment" | Operator can't prioritize action | Group expiries by IMPACT, not by document type (Pitfall 16) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Compliance Document Lifecycle Engine:** Often missing payment-batch export-time recheck — verify `PaymentRunComplianceCheck` audit row written in same transaction as bank-file export.
- [ ] **Compliance Document Lifecycle Engine:** Often missing TZ-aware expiry — verify off-by-day test with contractor in non-UTC TZ.
- [ ] **Compliance Document Lifecycle Engine:** Often missing requirement-set drift escape hatch — verify `recreateComplianceAssessment` admin mutation exists with audit logging.
- [ ] **Compliance Document Lifecycle Engine:** Often missing reminder digest — verify single rolled-up email when 3+ docs expire in same 7-day window.
- [ ] **Compliance Document Lifecycle Engine:** Often missing locked-phrase registry extension — verify legal terms in `packages/validators/src/legal/compliance.ts` not in `de.ts`/`ar.ts`.
- [ ] **IdP Deprovisioning:** Often missing two-step suspend+revoke per provider — verify integration tests confirm token-actually-revoked-within-5-min.
- [ ] **IdP Deprovisioning:** Often missing partial-failure manual-reconcile queue — verify `PARTIAL_COMPLETE` state with operator action UI.
- [ ] **IdP Deprovisioning:** Often missing GWS scope-capability migration — verify existing v3.0 read-only connections continue working post-deploy.
- [ ] **IdP Deprovisioning:** Often missing 14-day cooldown window — verify deprovisioning blocked while open invoices exist.
- [ ] **IdP Deprovisioning:** Often missing webhook-loop guard — verify `IdpChangeProvenance` filters own-write events from v3.0 directory-import.
- [ ] **IdP Deprovisioning:** Often missing Azure AD CAP verification — verify post-revoke check using `signInActivity` API.
- [ ] **IdP Deprovisioning:** Often missing audit-trail Pino exemption — verify `LOG_BODY_EXCLUDE_PREFIXES` covers `idpDeprovisioning.*` AND child logger preserves identifiers.
- [ ] **Gulf Operational Polish:** Often missing UAE permitted-activity field on contracts/invoices — verify Peppol PINT-AE XML uses ISIC code, not free text.
- [ ] **Gulf Operational Polish:** Often missing Saudization rule-set version snapshot — verify historical band reports show "as-of-version" watermark.
- [ ] **Gulf Operational Polish:** Often missing GCC partial-credit multiplier — verify property-based test with mixed-nationality workforce.
- [ ] **Gulf Operational Polish:** Often missing regional-routing classification for new models — verify cross-region isolation integration test.
- [ ] **Gulf Operational Polish:** Often missing RTL snapshots for new components — verify visual-regression coverage for `dir=rtl`.
- [ ] **Offboarding Hardening:** Often missing IP-clause manual-review path — verify heuristic returns tristate and offboarding requires explicit operator verification.
- [ ] **Offboarding Hardening:** Often missing OWNER-role override for unsigned IP — verify override flow with reason text + audit event.
- [ ] **Offboarding Hardening:** Often missing OOO-aware routing — verify task delegate fallback when assignee on PTO.
- [ ] **Offboarding Hardening:** Often missing CredentialReference schema (no actual-credential storage) — verify content-validation regex rejects AKIA*, GitHub PATs, JWT-shape strings.
- [ ] **Cross-cutting:** Schema-lint CI guard for tenantId on every new model — verify CI fails on a PR that adds a model without tenantId.
- [ ] **Cross-cutting:** `LOG_BODY_EXCLUDE_PREFIXES` covers all new sensitive routers — verify CI test snapshots Pino capture.
- [ ] **Cross-cutting:** Message-key parity guard runs PER-PR — verify CI fails on PR that adds keys to en.ts only.
- [ ] **Cross-cutting:** Unleash flag PENDING→APPROVED gate enforced — verify CI fails on legal-sensitive flag without signoff entry.
- [ ] **Cross-cutting:** Re-OAuth detect-and-prompt for existing integrations — verify v3.0 GWS read-only flow continues post-deploy until customer explicitly re-authorizes.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Mid-batch expiry race resulted in non-compliant payment | HIGH | (1) Halt all payment runs; (2) audit-trail query for compliance-blocked invoices that paid; (3) per-org notification + recovery; (4) deploy export-time gate hotfix; (5) post-mortem with regulator-ready timeline. |
| Reminder fatigue — customers mass-mute | MEDIUM | (1) Deploy digest cron immediately; (2) one-time apology email with re-enable CTA; (3) reset `notification_preference` rows to defaults for affected users with explicit consent prompt. |
| TZ drift — contractor disputes payment-block date | LOW | (1) Audit trail shows per-doc expiry-evaluation timestamp + TZ; (2) acknowledge off-by-day if pre-fix; (3) refund LPCDA interest if accrued; (4) deploy date-only-field fix in next phase. |
| Requirement-set drift mass-flagged contractors | MEDIUM | (1) Disable cron; (2) audit who was flagged; (3) operator-by-operator review; (4) ship `recreateComplianceAssessment` mutation; (5) re-enable cron with version-snapshot logic. |
| GWS scope expansion broke v3.0 directory-import | HIGH | (1) Roll back deploy or feature-flag-OFF v6.0 deprovisioning; (2) per-customer comms; (3) ship per-org capability flag; (4) re-deploy. |
| Partial-failure deprovisioning, ex-contractor still active | MEDIUM-HIGH | (1) Manual reconciliation per provider (already in queue); (2) audit which sessions were in active-state during gap; (3) credential-rotation if compromise suspected; (4) verify token-revoke step in adapter. |
| Audit log fields redacted by Pino | LOW (if AuditLog model preserved) HIGH (if only Pino) | (1) Query AuditLog model directly (the proper source of truth); (2) if only Pino logs exist — partial reconstruction from related events; (3) split logger configurations going forward. |
| Multi-tenant data leak (model without tenantId) | CRITICAL | (1) Audit Postgres logs for cross-org queries; (2) per-customer disclosure if PII crossed; (3) regulator notification per PDPL/GDPR; (4) backfill tenantId; (5) deploy schema-lint guard. |
| ME data stored in EU DB | CRITICAL | (1) Stop writes; (2) per-org migration to correct region; (3) regulator-ready disclosure with timeline; (4) deploy regional-routing registry guard. |
| RTL layout broke for new Gulf component | LOW | (1) Hotfix CSS logical properties; (2) visual-regression test added; (3) audit other recent components for same issue. |
| Pasted real credential in vault | HIGH | (1) Rotate the credential immediately (notify owner); (2) purge from DB + storage; (3) audit who accessed; (4) ship content-validation regex; (5) train customer ops on UI copy. |
| IP-clause heuristic false-negative caught in litigation | CRITICAL | (1) Operator-confirmation gate already present (Pitfall 22 prevention) — IF NOT, manual contract review; (2) communicate per-customer; (3) tighten heuristic with the litigated wording added to phrase library. |
| Stuck offboarding with unresponsive contractor | LOW | (1) Use OWNER override flow (Pitfall 25); (2) record reason + audit; (3) legal team follow-up off-platform. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (suggested ordering for ROADMAP.md) | Verification |
|---------|------------------|--------------|
| 1: Mid-batch expiry race | Compliance Doc Lifecycle phase, payment-integration plan | Integration test: race scenario with NOW() advancing across batch boundary |
| 2: Reminder fatigue | Compliance Doc Lifecycle phase, digest-cron plan | Test: 3+ docs expiring in 7-day window emit 1 notification |
| 3: TZ drift | Compliance Doc Lifecycle phase, schema plan (FIRST) | Test: contractor in non-UTC TZ, off-by-day boundary |
| 4: Document-type conflation | Compliance Doc Lifecycle phase, profile-registry plan | Test: per-country profile module owns expiry semantics |
| 5: Rule-set drift escape hatch | Compliance Doc Lifecycle phase, drift-handler plan | Test: `recreateComplianceAssessment` mutation exists + audit-logged |
| 6: i18n locked-phrase leakage | Compliance + Gulf phases, locked-phrases extension | Test: locked-phrases-guard count grows from 78 → 78+N |
| 7: IdP deprov vs final-invoice race | IdP Deprovisioning phase, cooldown-gate plan (FIRST) | Test: open-invoice blocks deprovisioning request |
| 8: Refresh-token semantic drift | IdP Deprovisioning phase, per-provider adapter plan | Per-provider integration test: token-invalidated-within-5-min |
| 9: GWS scope-expansion breaks read-only | IdP Deprovisioning phase, scope-migration plan (FIRST) | Test: existing v3.0 read-only connection unaffected |
| 10: Partial-failure saga | IdP Deprovisioning phase, saga + manual-reconcile plan | Test: simulate per-provider failure mix; queue surfaces correctly |
| 11: Reactivation resurrects access | IdP Deprovisioning + Offboarding phases | Test: no `reactivate` mutation exists; rehire creates new engagement |
| 12: Pino redaction over-redacts audit | IdP Deprovisioning phase, observability plan | Test: snapshot audit-log entry preserves externalUserId |
| 13: Webhook self-trigger loop | IdP Deprovisioning phase, per-provider adapter plan | Test: deprovision-then-directory-sync emits no duplicate |
| 14: Azure AD CAP override | IdP Deprovisioning phase, Azure adapter plan | Test: post-revoke verification via `signInActivity` |
| 15: UAE activity-scope mismatch | Gulf Operational Polish phase, UAE plan | Test: Peppol PINT-AE XML emits ISIC code |
| 16: Three-clock conflation | Gulf + Compliance phases (shared schema) | Test: per-document-type expiry independence |
| 17: Saudization rule-set drift | Gulf Operational Polish phase, Saudization plan | Test: version-snapshot on every assessment record |
| 18: GCC partial-credit | Gulf Operational Polish phase, Saudization plan | Property test: mixed-workforce computation |
| 19: Regional-routing default drift | Gulf Operational Polish phase, schema plan | Test: cross-region isolation integration test |
| 20: RTL drift for new components | Gulf Operational Polish phase, every UI plan | Visual regression: `dir=rtl` snapshots |
| 21: Credential vault stores secrets | Offboarding Hardening phase, schema plan (FIRST) | Test: content-validation rejects credential-shape strings |
| 22: IP-clause false-negative | Offboarding Hardening phase, IP-check plan | Test: tristate verdict + operator-confirmation gate |
| 23: IP-clause false-positive at upload | Offboarding Hardening phase, IP-check plan | Test: heuristic does NOT run at upload |
| 24: Role taxonomy ossification | Offboarding Hardening phase, knowledge-transfer plan | Test: per-org WorkflowRole model with editable templates |
| 25: Hard-block on unresponsive contractor | Offboarding Hardening phase, IP-verification plan | Test: OWNER override flow exists with audit |
| 26: PTO manager reminder spam | Offboarding Hardening phase, knowledge-transfer plan | Test: OOO-aware routing + delegate fallback |
| 27: Missing tenantId on new models | First v6.0 phase (CI guard) | CI: schema-lint fails on missing tenantId |
| 28: PII in Pino logs | First v6.0 phase (LOG_BODY_EXCLUDE_PREFIXES guard) | CI: enumerate routers, assert prefix coverage |
| 29: Message-key parity drift | Every v6.0 phase, i18n closure | CI: parity check runs PER-PR |
| 30: Feature flag without signoff | First v6.0 phase (Unleash signoff CI gate) | CI: flag-list + signoff-registry cross-check |
| 31: Existing OAuth scope cohabitation | First v6.0 phase + each integration phase | Test: existing connection continues working post-deploy |

---

## Recommended Phase Ordering (for Roadmap)

Based on pitfall dependencies and the FIRST/foundational nature of certain prevention strategies:

1. **v6.0 Foundation** (cross-cutting CI guards + observability): Pitfalls 27, 28, 29, 30, 31 — schema-lint, log-redaction guard, i18n parity per-PR, Unleash signoff gate, OAuth scope-capability framework.
2. **Compliance Document Lifecycle Engine**: Pitfalls 1–6 + 16 — schema FIRST (TZ-aware date-only + profile-registry), then payment-integration export-time gate, then digest cron, then drift escape hatch, then locked-phrases extension. Schedule before IdP Deprov so cooldown-gate semantics exist.
3. **Offboarding Hardening**: Pitfalls 21–26 — schema FIRST (CredentialReference, no secrets), per-org role taxonomy, knowledge-transfer with OOO routing, IP-clause heuristic with operator gate. Must land before/with IdP Deprov so cooldown can reference final-invoice state.
4. **IdP Deprovisioning**: Pitfalls 7–14 — scope-migration FIRST, then per-provider adapter saga (two-step suspend+revoke), then cooldown gate (depends on Offboarding final-invoice state), then webhook-loop guard, then Azure CAP verify, then audit-trail child logger.
5. **Gulf Operational Polish**: Pitfalls 15–20 — regional-routing classification FIRST, then UAE activity-scope, then Saudization with version snapshot + GCC multiplier, then RTL snapshots for every new component.

This order maximizes shared foundation reuse and avoids the IdP-Deprov-without-Cooldown trap.

---

## Sources

- `.planning/PROJECT.md` (v6.0 milestone definition, Standing Project Constraints, Key Decisions)
- `.planning/MILESTONES.md` (v1.0–v5.0 patterns: AsyncLocalStorage tenant scoping, AES-256-GCM per-provider keys, locked-phrases-guard 78/78, classification rule-set drift escape hatch via `recreateDraftAfterDrift`, LPCDA mid-batch race learnings, message-key parity 4,281-key contract, v3.0 GWS read-only scopes, v2.0 webhook pipeline, v2.0 Jira loop-prevention, v4.0 multi-region routing + RTL CSS logical properties)
- `.planning/STATE.md` (Standing Project Constraints, deferred items, blocker patterns from v5.0 nested-agent execution)
- `CLAUDE.md` (no-console.log Pino, schema validation, multi-tenant scoping, security defaults, RLS preference, accessibility WCAG, locked-legal-phrases convention)
- User memory: `feedback_logging.md` (Pino, no console.*, LOG_BODY_EXCLUDE_PREFIXES sentinel)
- User memory: `project_stack.md` (pnpm+turbo, Next.js 15 SSR, tRPC v11, Prisma 7 + Neon multi-region, Better Auth, Render deployment)
- User memory: `project_local_only_legal_deferred.md` (LOCAL-ONLY deploy, legal sign-off DEFERRED but evidence captured)
- User memory: `project_feature_flags_strategy.md` (self-hosted Unleash OSS + thin code wrapper, jurisdiction short-circuit, PENDING→APPROVED CI gate)

Note on confidence: HIGH because every pitfall pattern derives from a concrete v1.0–v5.0 precedent already in the codebase. Where docs needed verification (Google Admin SDK token revocation behaviour, Okta session-vs-deactivate semantics, Azure AD Conditional Access override interaction), the recommendation is to verify via Context7 / official docs at implementation time, not training data — this is consistent with the "training data = hypothesis" discipline.

---
*Pitfalls research for: v6.0 Platform Maturity & Operational Hardening — feature-integration pitfalls*
*Researched: 2026-04-26*
