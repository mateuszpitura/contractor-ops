# Roadmap: Contractor Ops

## Milestones

- v1.0 MVP - Phases 1-11 (shipped 2026-03-23)
- v2.0 Platform Expansion - Phases 12-27 (shipped 2026-04-01)
- v3.0 Enterprise & Monetization - Phases 28-44 (shipped 2026-04-10)
- v4.0 International Foundation & Gulf Expansion - Phases 45-55 (shipped 2026-04-12)
- v5.0 UK & Germany Expansion - Phases 56-69 (shipped 2026-04-26)
- v6.0 Platform Maturity & Operational Hardening - Phases 70-80 (planned)
- v7.0 GTM Expansion — US Cross-Border + Workforce Management + Integration Marketplace - Phases 81+ (backlog, pre-prod gate; see `.planning/milestones/v7.0-BACKLOG.md`)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-11) - SHIPPED 2026-03-23</summary>
See .planning/milestones/v1.0/ for details.
</details>

<details>
<summary>v2.0 Platform Expansion (Phases 12-27) - SHIPPED 2026-04-01</summary>
See .planning/milestones/v2.0/ for details.
</details>

<details>
<summary>v3.0 Enterprise & Monetization (Phases 28-44) - SHIPPED 2026-04-10</summary>
See .planning/milestones/v3.0/ for details.
</details>

<details>
<summary>v4.0 International Foundation & Gulf Expansion (Phases 45-55) - SHIPPED 2026-04-12</summary>
See .planning/milestones/v4.0/ for details.
</details>

<details>
<summary>✅ v5.0 UK & Germany Expansion (Phases 56-69) — SHIPPED 2026-04-26</summary>

- [x] Phase 56: Country Foundations & German i18n (8/8 plans) — completed 2026-04-12
- [x] Phase 57: Government API Clients (4/4 plans) — completed by Phase 66 on 2026-04-26
- [x] Phase 58: Classification Engine & Rule Sets (5/5 plans) — completed 2026-04-13
- [x] Phase 59: Classification Documents & Chain Tracking (4/4 plans) — completed 2026-04-13
- [x] Phase 60: Classification Polish (4/4 plans) — completed 2026-04-14
- [x] Phase 61: XRechnung E-Invoicing (8/8 plans) — completed 2026-04-14
- [x] Phase 62: ZUGFeRD E-Invoicing (7/7 plans) — completed 2026-04-16
- [x] Phase 63: UK Payments & Financial Features (7/7 plans) — completed 2026-04-26
- [x] Phase 64: Legal Compliance Hardening (9/9 plans) — completed 2026-04-25
- [x] Phase 65: Phase 63 Critical Bug Fixes (2/2 plans, gap-closure) — completed 2026-04-26
- [x] Phase 66: Phase 57 Completion & Verification (4/4 plans, gap-closure) — completed 2026-04-26
- [x] Phase 67: Phase 56 & 58 Verification (2/2 plans, gap-closure) — completed 2026-04-26
- [x] Phase 68: Skonto BG-20 XRechnung Emission Fix (5/5 plans, gap-closure — closes audit I-1) — completed 2026-04-26
- [x] Phase 69: DE Message-Key Parity Fix (1/1 plan, gap-closure — closes FOUND-03) — completed 2026-04-26

Full details: `.planning/milestones/v5.0-ROADMAP.md`
Audit: `.planning/milestones/v5.0-MILESTONE-AUDIT.md`
Requirements archive: `.planning/milestones/v5.0-REQUIREMENTS.md`
Phase artifacts: `.planning/milestones/v5.0-phases/`

</details>

### 🚧 v6.0 Platform Maturity & Operational Hardening (In Progress)

**Milestone Goal:** Make the platform production-grade across all supported markets (PL, UK, DE, UAE, SA) by closing four critical operational gaps surfaced (and deferred) across v1.0–v5.0: per-jurisdiction compliance-document expiry blocking payment, IdP deprovisioning across 5 providers, Gulf operational polish (UAE free-zone + Saudization with new 2026-04-15 Qiwa-auth requirement), and offboarding hardening (KT templates, IP-assignment verification, contract clause health check, structured credential-rotation tracking). No new market entry; focus on reliability and security for real users.

**Coverage:** 54 / 54 v6.0 requirements mapped (100%) — see `.planning/REQUIREMENTS.md` Traceability section.
**Granularity:** fine (per `.planning/config.json`)

#### Standing Project Constraints (apply to every v6.0 phase)

- **App is LOCAL-ONLY; legal sign-off DEFERRED.** Phases touching jurisdiction-specific legal copy (COMPL-09, GULF-09, OFFB-05/11) ship working code with `Needs verification by legal entity before production deploy` annotations on the relevant success criteria. No CI hard-block on missing legal sign-off.
- **No `console.*` in source.** All logging via `@contractor-ops/logger` factories (Pino) or raw `pino` in standalone scripts. Strict-by-default body redaction (`LOG_BODY_INCLUDE_PREFIXES` opt-in, FOUND6-02).
- **Self-hosted Unleash OSS feature flags** with PENDING → APPROVED CI gate (FOUND6-04). Every legal-sensitive v6.0 capability gets a flag in `compliance-*` / `idp-deprovisioning` / `gulf-*` / `offboarding-ip-*` namespace, registered PENDING in `signoff-registry.ts`.
- **Stripe tier gating** locked at requirements time: F1 advisory dashboard at Starter, F1 hard-block at Pro+; F2 GWS+Slack at Starter, F2 Entra+Okta+GitHub at Pro+; F3 Saudization dashboard advisory all tiers, F3 UAE permitted-activity hard-block at Enterprise; F4 KT templates all tiers, F4 IP-clause scanner + hard-block at Pro+.
- **Multi-tenant isolation** preserved: every new Prisma model carries `organizationId` OR is registered in the global-lookup-list allowlist (FOUND6-01); ME-region (UAE/KSA) data routes to ME database (GULF-11).

#### Milestone-Wide Patterns (promoted from research)

- **Drift escape hatch (3x reuse, mirrors v5.0 `recreateDraftAfterDrift`)** — F1 compliance requirement-set drift (COMPL-10), F3 Saudization Nitaqat threshold drift + UAE permitted-activity catalogue drift (GULF-10), F4 offboarding role-taxonomy drift (OFFB-03). Every drift handler emits an opt-in admin mutation + audit log + "Custom — verify with adviser" badge on overrides.
- **Locked-phrases guard extension (78 → 78+N)** — F1 jurisdiction-specific document type names (COMPL-11), F3 UAE/KSA Arabic statutory terms (GULF-09), F4 Werkvertrag Schöpferprinzip + Nutzungsrechte canonical wordings (OFFB-11). CI count grows monotonically.
- **Detect-and-prompt re-OAuth (mirrors v2.0 Jira)** — F2 GWS scope upgrade (IDP-11) + Slack SCIM scope + Entra session-revoke. Per-org `IntegrationConnection.scopeCapabilities` JSONB (FOUND6-05). NEVER force global re-OAuth.
- **Two-step suspend + revoke contract** — F2 adapter interface MUST require both `suspendAccount()` AND `revokeAllSessions()` (IDP-08). Per-provider integration test asserts token-revoked-within-5-min.

#### Phase List

- [x] **Phase 70: v6.0 Foundation — Cross-Cutting CI Guards & Observability Baseline** (10/10 plans) — completed 2026-04-27. Multi-region backfill apply deferred to post-deploy (see STATE.md Deferred Items)
- [x] **Phase 71: F1 Compliance — Policy Package + Schema + Classification Reconcile** — `packages/compliance-policy` with per-jurisdiction profiles, additive `ContractorComplianceItem` extension, drift escape hatch (completed 2026-04-27)
- [x] **Phase 72: F1 Compliance — Reminder Cascade + Payment Block** — band-state-machine cron, daily digest, paymentRouter hard-block, approval-engine condition operator, atomic audit row (completed 2026-05-31)
- [x] **Phase 73: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n** — at-risk dashboard, contractor portal compliance tab, one-click upload-replacement, en/pl/de parity (completed 2026-05-31)
- [x] **Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission** — IP_VERIFICATION + CONTRACT_HEALTH_CHECK enums, OWNER override with reason, 4 role-typed KT seed templates, OOO-aware routing (completed 2026-04-27)
- [ ] **Phase 75: F4 Offboarding — Contract Health Check + IP Verification + Credential Vault** — Claude Vision tool_use with regex-first phrase library, tristate verdict, e-sign-backed IP ratification, `CredentialReference` (no secrets) with content-validation regex — **PARTIAL (75-01..07 complete; 75-08 UI/templates/i18n done, e-sign signing mutation + webhook IP-ratification atomic flow DEFERRED — STATE.md blocker)** (2026-05-31)
- [x] **Phase 76: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration** — `Deprovisionable` interface, `DeprovisioningRun/Step` saga, 14-day cooldown referencing F4 final-invoice-paid, scope-capabilities JSONB, webhook-loop guard (completed 2026-05-31)
- [x] **Phase 77: F2 IdP — GWS + Slack Adapters (the wedge)** — Google Workspace suspend+OAuth-revoke+sign-out, Slack session-invalidate+SCIM-deactivate, per-IdP `describeImpact` preview, partial-failure reconcile queue (completed 2026-05-31)
- [x] **Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator)** — Entra disable+revokeSignInSessions with CA pre-flight, Okta deactivate+session-clear, GitHub member-remove+per-PAT-revoke+outside-collab manual flag (completed 2026-05-31)
- [x] **Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL** — `packages/gulf-regulatory`, 10-zone seed enum, Saudization manual-band entry, pre-offboarding impact banner, Qiwa-auth, ms-/me-/ps-/pe- ESLint guard (completed 2026-06-03)
- [x] **Phase 80: v6.0 Verification + Hardening + Manual UAT** — cross-feature integration tests (F1+F3+F4 composition), manual-UAT checkpoints document, consolidated post-deploy legal sign-off list, v6.0 retrospective (completed 2026-06-05)

## Phase Details

### Phase 70: v6.0 Foundation — Cross-Cutting CI Guards & Observability Baseline

**Goal:** Engineers cannot land code that introduces a multi-tenant leak, regulator-grade PII exposure, message-key drift, unsigned legal copy, or breaks v3.0 read-only OAuth — every class of CRITICAL-recovery-cost bug surfaced by PITFALLS P27–P31 has a CI guard that blocks the PR.
**Depends on:** v5.0 milestone close (Phase 69 shipped 2026-04-26)
**Requirements:** FOUND6-01, FOUND6-02, FOUND6-03, FOUND6-04, FOUND6-05, FOUND6-06
**Success Criteria** (what must be TRUE):
  1. Engineer adding a new Prisma model without `organizationId` and not in the global-lookup-list allowlist sees `pnpm lint:schema` fail in CI with a structured diff naming the offending model and a remediation pointer
  2. Engineer adding a new tRPC router whose request bodies were previously logged in full now sees Pino emitting `[REDACTED]` for that router by default; opt-in body logging requires an explicit `LOG_BODY_INCLUDE_PREFIXES` entry reviewed in code review
  3. Engineer adding a new i18n key in `en.json` without peer entries in `de.json`, `pl.json`, `ar.json` sees `pnpm i18n:parity` fail in CI per-PR with the exact missing-key list (locked-phrase 78-superset guard remains green)
  4. Engineer flipping an Unleash flag in the `compliance-*` / `idp-deprovisioning` / `gulf-*` / `offboarding-ip-*` namespace from PENDING to APPROVED in `signoff-registry.ts` sees the CI gate require a referencing legal-sign-off ticket commit; a flag without a registry entry refuses to load at boot
  5. Engineer re-running an OAuth flow against a v3.0 Google Workspace connection upgrades scopes with `prompt=consent`; the existing read-only directory-import use continues working AND `IntegrationConnection.scopeCapabilities` JSONB persists the new scope set; backfill migration populated all existing connections
  6. Engineer writing IdP audit log lines uses a separate Pino child logger with explicit allow-list — fields the audit needs (e.g. `externalUserId`, `actionResult`) are NOT redacted, while request bodies remain redacted globally
**Plans:** TBD
**Research flag:** STANDARD (mirrors v5.0 Phase 56 locked-phrases-guard establishment)
**Feature flags:** none — foundation-only phase

### Phase 71: F1 Compliance — Policy Package + Schema + Classification Reconcile

**Goal:** A new contractor whose engagement is classified as IR35 / Scheinselbständigkeit / cross-border immediately has the correct per-jurisdiction document set materialised as `ContractorComplianceItem` rows; existing rows survive policy rotation; admins can manually trigger a drift recompute.
**Depends on:** Phase 70 (foundation guards must pass before schema additions)
**Requirements:** COMPL-02, COMPL-08, COMPL-09, COMPL-10
**Success Criteria** (what must be TRUE):
  1. After classification submit on a new UK B2B engagement, system materialises 4 `ContractorComplianceItem` rows (UK Right-to-Work share code, UTR, business-registration, SDS) with severity, `policyRuleId`, and `expiry_jurisdiction_tz` populated; on a DE engagement classified ABHANGIG the row set switches to A1-Bescheinigung + Aufenthaltstitel + §48b EStG (conditional) without DELETE — superseded rows are marked `WAIVED` with reason `classification_outcome_change`
  2. "Expires today" for a contractor in Riyadh resolves at 00:00 Asia/Riyadh time, not 00:00 of the org HQ timezone — `@db.Date` plus `expiry_jurisdiction_tz` field drives the boundary
  3. Per-jurisdiction policy registry seeds resolve correctly across PL/UK/DE/UAE/SA covering at minimum: UK Right-to-Work (90-day), UK UTR, DE A1 (24-month), DE Aufenthaltstitel, DE §48b EStG (construction-only), PL ZUS A1 (12-month), PL UDT, KSA Iqama (1-year), KSA work permit + Qiwa-auth boolean, UAE Emirates ID, UAE free-zone trade license — *Needs verification by legal entity before production deploy* per Standing Constraints
  4. Admin invokes `recreateComplianceAssessment(reason)` after a `RULE_SET_VERSION` bump and sees regenerated requirements with audit log entry; operation never auto-runs (mirrors v5.0 `recreateDraftAfterDrift`)
**Plans:** 7/7 plans complete
**Research flag:** NEEDS RESEARCH — per-jurisdiction document seed data is dense (Border Security Act 2025, A1 24mo, §48b EStG, Iqama+Qiwa-auth)
**Feature flags:** `compliance-policy-engine` PENDING

### Phase 72: F1 Compliance — Reminder Cascade + Payment Block

**Goal:** Contractors and admins receive timely expiry reminders without notification fatigue; admins cannot accidentally pay a contractor whose CRITICAL document is expired, regardless of whether they came in through the payment-run wizard or the auto-`READY` path from approvals.
**Depends on:** Phase 71 (instances + severity required for both reminder cron and payment gate)
**Requirements:** COMPL-03, COMPL-05, COMPL-06, COMPL-07
**Success Criteria** (what must be TRUE):
  1. Contractor with a doc expiring in 89 days receives exactly one reminder when the 90-day band trips; no further reminder until the 60-day band; per-recipient daily digest throttles cross-doc reminders to max 1/24h via Redis SETNX (avoiding the v1.0 invoice-reminder fatigue pattern)
  2. Admin attempting to create a payment run that includes a contractor with an EXPIRED CRITICAL compliance item sees a `PRECONDITION_FAILED` modal "Compliance EXPIRED — payment blocked" listing structured per-contractor reasons (doc name, expired-on date) with a deep link to the affected document; payment run insert never occurs
  3. Admin force-pushing an approval decision on an invoice for a contractor with an EXPIRED CRITICAL doc sees the approval held in `PENDING_COMPLIANCE` state (not auto-`READY`); approval-engine `complianceCritical(EXPIRED)` condition operator evaluated as secondary defence
  4. After a payment-run bank-file export, the database contains a `PaymentRunComplianceCheck` row written in the SAME transaction as the file emission, with the snapshotted compliance state at the moment of export (mid-batch race protection per Pitfall 1)
**Plans:** 8/8 plans complete
**Research flag:** STANDARD (port of v5.0 `economic-dependency-scan.ts` band-state-machine)
**Feature flags:** `compliance-payment-block` PENDING (legal-sensitive — admin lockout posture)

### Phase 73: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n

**Goal:** Admins see at-a-glance who is at risk and which payments are blocked; contractors can self-serve doc replacement from the portal in one click; every COMPL surface is available in en/pl/de.
**Depends on:** Phase 72 (data + state machine drives every dashboard widget)
**Requirements:** COMPL-01, COMPL-04, COMPL-11
**Success Criteria** (what must be TRUE):
  1. Admin lands on `/compliance/dashboard` and sees three widgets — at-risk contractor count (clickable into filtered list), upcoming-renewal queue (sorted by expiry), and currently-blocked-payments queue (sorted by submit date) — all driven by indexed queries (no N+1)
  2. Contractor receives a portal-side notification "Right-to-Work share code expires in 30 days"; clicking through opens a one-click upload-replacement flow that auto-marks the requirement `SATISFIED` with refreshed `expiresAt` from the template
  3. Admin can manually mark a requirement as overridden with reason text (audit-logged); status flips to `WAIVED` with the override appearing in the requirement history
  4. Every COMPL UI surface ships en/pl/de message-key parity at 100%; jurisdiction-specific document type names ("Right-to-Work share code", "A1-Bescheinigung", "Iqama") added to locked-phrase registry — *Needs verification by legal entity before production deploy* on the locked-phrase additions per Standing Constraints
**Plans:** 8/8 plans complete
**Research flag:** STANDARD
**Feature flags:** `compliance-portal-self-service` PENDING
**UI hint:** yes

### Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission

**Goal:** Admins running an offboarding workflow auto-receive a role-typed knowledge-transfer checklist routed to the correct manager (PTO-aware fallback); OWNER-role admins can override the IP-verification block with a recorded reason, but no other role can; ops can extend role taxonomy without engineering involvement.
**Depends on:** Phase 70 (workflow uses extended permissions; foundation must ship)
**Requirements:** OFFB-01, OFFB-02, OFFB-03, OFFB-07, OFFB-10, OFFB-11
**Success Criteria** (what must be TRUE):
  1. Admin starts an offboarding workflow for a contractor tagged "Software Engineer"; system auto-selects the SE KT template (4 seeds: Software Engineer / Designer / Product Manager / Generic Consultant) and creates 6-9 task rows with role-appropriate handover items; admin can manually override template selection
  2. KT task auto-routes to the contractor's manager; if v2.0 calendar integration shows the manager as on PTO, task delegates to the configured fallback approver — no PTO-spam (Pitfall 26)
  3. Ops user opens Settings > Workflow Roles and creates a 5th role template "Data Engineer" with custom KT items; future offboardings for that role can select the new template — no engineering involvement
  4. OWNER-role admin attempts to complete an offboarding while `IP_VERIFICATION` task is open; system surfaces an override dialog requiring reason text (min 20 chars) + acknowledgement checkbox; override audit-logs to immutable trail and surfaces a permanent badge on the offboarding record
  5. Non-OWNER user (admin, manager, finance) sees no override button on the same screen; `workflow:override_blocking_task` permission is OWNER-only and CI-tested
  6. All OFFB workflow surfaces ship en/pl/de message-key parity; locked-phrase registry extension still pending Werkvertrag wording (lands in Phase 75)
**Plans:** 8/8 plans complete
**Research flag:** STANDARD (extends v1.0 template builder + v1.0 RBAC)
**Feature flags:** `offboarding-hardening-foundation` PENDING
**UI hint:** yes

### Phase 75: F4 Offboarding — Contract Health Check + IP Verification + Credential Vault

**Goal:** Every uploaded contract is automatically scanned for IP-assignment language; admins cannot complete an offboarding workflow until the IP-assignment ratification is e-signed; structured credential-rotation tasks track WHO rotates WHAT WHERE without ever touching the secret itself.
**Depends on:** Phase 74 (workflow foundation + override permission); Phase 71 (health-check findings persist as `ContractorComplianceItem` rows of severity STANDARD)
**Requirements:** OFFB-04, OFFB-05, OFFB-06, OFFB-08, OFFB-09
**Success Criteria** (what must be TRUE):
  1. Admin uploads a UK consultancy agreement; within 60s a fire-and-forget contract health check runs through reused `ClaudeOcrAdapter` with `contract-health-tools.ts` tool_use schema, persists `Contract.complianceFlagsJson` + `complianceFlagsCheckedAt` + `complianceFlagsModelVer` (e.g. `claude-3-5-sonnet-20241022`); admin can trigger manual re-run; audit log shows every run with model version (replay-ready)
  2. Health check returns one of three verdicts (`LIKELY_PRESENT` / `LIKELY_MISSING` / `MANUAL_REVIEW_REQUIRED`); `LIKELY_MISSING` triggers an open `ContractorComplianceItem` of severity STANDARD; per-jurisdiction phrase library covers UK ("hereby assigns"), DE Werkvertrag (Schöpferprinzip + Nutzungsrechte distinction per §7 UrhG — UK boilerplate is INSUFFICIENT under DE law), PL, KSA, UAE, US — *Needs verification by legal entity before production deploy* on Werkvertrag wording per Standing Constraints
  3. Admin attempts to mark `WorkflowRun.completedAt` while `IP_VERIFICATION` task is open; system hard-blocks; admin signs the IP-assignment ratification document via existing v2.0 e-sign integration (DocuSign for UK/PL/US, Autenti for DE); on signing-completion webhook, task auto-completes and offboarding can finalise
  4. Admin records a credential-rotation task with `CredentialReference` row containing label, vault URL, successor user; content-validation regex rejects any string shaped like `AKIA*`, GitHub PAT, JWT structure, or hex≥32 (system stores POINTERS only, NEVER secrets) — paste of an actual AWS access key returns 400 with explanation
  5. After offboarding completes with no IP-block override, `Contract.complianceFlagsJson.ipAssignment` history shows the verdict that drove the gate; admin can drill into the cited clause text from the audit log
**Plans:** 8/8 plans complete
**Research flag:** NEEDS RESEARCH — Werkvertrag wording lawyer-dependent; Anthropic SDK tool_use schema requires Context7 validation at implementation time
**Feature flags:** `offboarding-ip-clause-scanner` PENDING (legal-sensitive — AI verdict on legal-adjacent surface)
**UI hint:** yes

### Phase 76: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration

**Goal:** Every IdP adapter declares a uniform `Deprovisionable` contract with both `suspendAccount()` and `revokeAllSessions()`; deprovisioning runs are observable as saga state with idempotent retry; no deprovisioning starts within 14 days of `ContractorAssignment.status = ENDED` (final-invoice race protection); v3.0 GWS read-only directory-import never breaks during scope upgrade; webhook self-trigger loops are impossible.
**Depends on:** Phase 70 (scope-capabilities JSONB infrastructure); Phase 74 (workflow `ACCESS_REVOKE` task hook); Phase 75 ends F4 — cooldown gate references final-invoice-paid state (Pitfall 7)
**Requirements:** IDP-02, IDP-08, IDP-09, IDP-10, IDP-11, IDP-13, IDP-14, IDP-15
**Success Criteria** (what must be TRUE):
  1. Admin attempts to start IdP deprovisioning on a contractor whose `ContractorAssignment.status = ENDED` was set 10 days ago; system blocks with "14-day cooldown active — earliest deprovisioning date: <date>"; portal magic-link auth (non-IdP-dependent email) continues working so the contractor can still upload final invoice
  2. Admin opens a `DeprovisioningRun` audit trail and sees per-step status, retry attempts, request/response SHA-256 hashes (SOC2 evidence-grade with no PII in hash), last-error message, and aggregate run status (`COMPLETED` / `PARTIAL_FAILURE` / `FAILED`); `PARTIAL_FAILURE` runs surface in the admin reconcile queue with a manual-retry button per provider
  3. Engineer connecting a GWS integration with v3.0 read-only scope sees a "Re-OAuth required for write access" detect-and-prompt banner with `prompt=consent`; existing read-only directory-import continues working AND `IntegrationConnection.scopeCapabilities` JSONB upgrades to `['directory.read', 'directory.user.write']`; force global re-OAuth never occurs
  4. Webhook event from a GWS user-suspended event whose `IdpChangeProvenance` record matches our own deprovision call is filtered out; v3.0 directory-import does not loop-fire a "user departed" notification on our own suspend
  5. Each provider adapter (GWS / Slack / Entra / Okta / GitHub) compiles only when both `suspendAccount()` AND `revokeAllSessions()` methods are implemented (TS interface enforcement); per-provider integration-test stub in place asserting revocation verifiable within 5 minutes
  6. System enforces minimum-privilege OAuth scopes per provider: GWS `admin.directory.user`, Entra `User.EnableDisableAccount.All` + `User.RevokeSessions.All`, GitHub `admin:org`, Slack `admin.users.session:write` + `scim:write` (org-token), Okta "User Admin" role; CI lint asserts no scope expansion beyond the registry without code-review approval
  7. UI exposes no "reactivate contractor" button anywhere; returning contractors flow through the new-engagement path with fresh provisioning by design (Pitfall 11)
  8. Each deprovisioning step runs as an independent QStash job (no `Promise.allSettled` aggregation per Pitfall 10); aggregate `DeprovisioningRun.status` is computed from per-step states
**Plans:** 10/10 plans complete
**Research flag:** STANDARD (mirrors v2.0 Jira scope-expansion + v2.0 webhook pipeline + v5.0 saga model)
**Feature flags:** `idp-deprovisioning` PENDING

### Phase 77: F2 IdP — GWS + Slack Adapters (the wedge)

**Goal:** Admins running offboarding can deprovision Google Workspace (suspend + OAuth-grant revoke + sign-out-all-sessions) and Slack (session-invalidate + SCIM-deactivate) for ~95% of SMB customers — the wedge sub-phase per FEATURES analysis.
**Depends on:** Phase 76 (saga + capability + cooldown infrastructure)
**Requirements:** IDP-01, IDP-03, IDP-04, IDP-12
**Success Criteria** (what must be TRUE):
  1. Admin clicks the offboarding workflow's `ACCESS_REVOKE` task; system enumerates connected IdPs (GWS, Slack at this phase) and shows a per-IdP impact preview via `describeImpact` — "GWS: suspend account `ana@acme.com`, revoke 4 OAuth grants (Notion, Linear, Asana, Bitwarden), sign out all 3 active sessions" — admin sees this BEFORE clicking "Deprovision"
  2. Admin executes deprovision on a GWS contractor; system suspends the user (`users.update({ suspended: true })`), revokes all OAuth grants (`directory.tokens.list` → `tokens.delete` per token), and signs the user out of all sessions (`users.signOut`); audit log captures three step rows with response hashes
  3. Admin executes deprovision on a Slack contractor; system invalidates active sessions (`admin.users.session.invalidate`) and SCIM-deactivates the user (`SCIM PATCH active=false` via raw `fetch` with org-token); both steps succeed independently — Slack deactivation success is NOT blocked by GWS partial failure
  4. Admin sees one provider step in `MANUAL_ESCALATION` after final retry exhaustion; admin clicks "Mark complete" with a written reason ("verified-via-vendor-console: GWS user already suspended manually"); failure record preserved, override audit-logged, offboarding workflow unblocks
  5. After deprovisioning, second click of the same `ACCESS_REVOKE` task returns `LIKELY_GONE` per provider (idempotent semantic) without errors; calling deprovision twice is safe
**Plans:** 5/5 plans complete
**Research flag:** NEEDS RESEARCH — GWS `tokens.delete` behaviour, Slack SCIM `scim:write` org-token requirement, current rate-limits via Context7
**Feature flags:** `idp-deprovisioning-gws` PENDING, `idp-deprovisioning-slack` PENDING
**UI hint:** yes

### Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator)

**Goal:** Admins in Microsoft / Okta-IdP / GitHub-org-managed shops can deprovision via the same `ACCESS_REVOKE` task; pre-flight Conditional Access detection prevents silent-failure mode (Entra); per-PAT explicit revocation prevents the GitHub "outside-collab back-door" path.
**Depends on:** Phase 77 (GWS + Slack proven through wedge sub-phase before differentiator scope expansion)
**Requirements:** IDP-05, IDP-06, IDP-07
**Success Criteria** (what must be TRUE):
  1. Admin executes deprovision on an Entra ID contractor; system disables the account (`accountEnabled: false` via Microsoft Graph) and revokes all sign-in sessions (`revokeSignInSessions`); pre-flight Conditional Access policy enumeration warns the admin if org policies may override the revoke (Pitfall 14) BEFORE execution; post-revoke `signInActivity` polled to verify revocation took effect
  2. Admin executes deprovision on an Okta contractor; system deactivates the user (`@okta/okta-sdk-nodejs@8.0.0` namespaced `userApi.deactivateUser`) and clears active sessions (`revokeUserSessions`); audit row captures the request/response hashes
  3. Admin executes deprovision on a GitHub org member; system removes the org member (`octokit.rest.orgs.removeMember`), explicitly revokes per-PAT credentials, and flags any outside-collaborator repos as a manual-task with link (per Pitfall 7 + GitHub authorization model)
  4. Admin sees a hybrid-AD detection hard-warning when attempting to deprovision an Entra-only identity that's actually backed by on-prem AD; system refuses the action with "On-prem AD authoritative — revoke at source" and a link to the v3.0 GWS directory-import-style status panel
**Plans:** 7/7 plans complete
**Research flag:** NEEDS RESEARCH — Entra `revokeSignInSessions` Conditional Access interaction, Okta 8.x namespaced API surface, GitHub SAML credential-authorization endpoint via Context7
**Feature flags:** `idp-deprovisioning-entra` PENDING, `idp-deprovisioning-okta` PENDING, `idp-deprovisioning-github` PENDING
**UI hint:** yes

### Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL

**Goal:** Admins of UAE/KSA orgs can record and monitor every contractor's free-zone trade license, see Saudization band status with offboarding impact preview, comply with the 2026-04-15 Qiwa-auth requirement, and operate every Gulf surface fully in Arabic with RTL layout.
**Depends on:** Phase 71 (free-zone trade license participates in F1 reminder cron + payment-block as `ContractorComplianceItem` of severity CRITICAL)
**Requirements:** GULF-01, GULF-02, GULF-03, GULF-04, GULF-05, GULF-06, GULF-07, GULF-08, GULF-09, GULF-10, GULF-11
**Success Criteria** (what must be TRUE):
  1. Admin records a contractor's UAE free-zone assignment by selecting from a 10-zone seed enum (DIFC, DMCC, IFZA, Dubai Internet City, Dubai Media City, Meydan FZ, JAFZA, SHAMS, RAKEZ, ADGM) plus Mainland; license number, license category, license expiry, and permitted-activities text persist in `FreeZoneAssignment` with `licenseExpiresAt` participating in F1 reminder cascade (90/60/30/15/7-day) and hard-blocking payment when EXPIRED
  2. Admin creating a contract whose activity descriptor falls outside the contractor's free-zone permitted-activities list sees a scope-mismatch advisory with auto-add of an NOC required-document for the affected engagement; advisory uses ISIC-style codes (Pitfall 15) — *Needs verification by legal entity before production deploy* on UAE permitted-activity catalogues per Standing Constraints
  3. Admin opens the Saudization dashboard and sees current band, nationalisation rate (%), Qiwa-auth coverage gap (count of contracts WHERE `qiwaContractAuthenticated = false`), Iqama expiry roll-up (reusing F1 expiry data), and total/Saudi-national headcount; admin can manually update the band (PLATINUM / HIGH_GREEN / MID_GREEN / LOW_GREEN / YELLOW / RED) with industry-segment field — system displays last-updated timestamp and prompts quarterly re-entry; system NEVER auto-computes the band (legal liability anti-feature locked at requirements)
  4. Admin offboarding a Saudi-national contractor sees a pre-offboarding impact banner showing the projected Saudization band trajectory ("Current: MID_GREEN at 31% Saudization → After offboarding: LOW_GREEN at 28%"); banner is advisory-only, not gating
  5. Every Gulf surface (compliance dashboard, free-zone forms, Saudization dashboard, NOC flow) renders fully in Arabic with RTL layout via CSS logical properties (`ms-` / `me-` / `ps-` / `pe-` only); ESLint guard bans `ml-`/`mr-` in v6.0 surfaces — *Needs verification by legal entity before production deploy* on UAE/KSA Arabic statutory locked phrases per Standing Constraints
  6. Admin overrides a seed Saudization Nitaqat threshold or UAE permitted-activity entry per-org; system audit-logs the write and displays a "Custom — verify with adviser" badge on overrides (drift escape hatch pattern, mirrors v5.0 / F1 Phase 71)
  7. New gulf-domain Prisma models (`FreeZoneAssignment`, `SaudizationConfig`, `SaudiHeadcount`, `UaeFreeZone` global lookup) all carry explicit regional-routing annotations; ME-region data stays in ME database per v4.0 multi-region strategy; schema-lint test asserts no cross-region leakage (Pitfall 19)
**Plans:** 8/8 plans complete
- [x] 79-01-PLAN.md — Wave 0: RED test scaffolds (C1-C10) + ME-region fixture factory + verify/build the `ml-`/`mr-` RTL guard (GULF-08)
- [x] 79-02-PLAN.md — Wave 1: gulf.prisma (4 ME-region models + NitaqatBand/UaeFreeZoneCode enums) + ContractorAssignment/Contract columns + LOCKED_AE/SA_PHRASES + feature-flags PENDING + [BLOCKING] multi-region migrate/generate/enum-casing
- [x] 79-03-PLAN.md — Wave 2: free-zone-compliance service + uae policy BLOCKING @v2 + reminder-cron region fan-out + region-leakage lint (GULF-02/11, landmines 1/2/4)
- [x] 79-04-PLAN.md — Wave 2: permitted-activity ISIC check + auto-NOC + Saudization dashboard derivation + offboarding trajectory (GULF-03/05/06/07)
- [x] 79-05-PLAN.md — Wave 3: gulf tRPC routers (free-zone/saudization/overrides) + root mount + contract-create wiring + D-02 backfill + AE-field hide (GULF-01/04/10)
- [x] 79-06-PLAN.md — Wave 4: web-vite free-zone form + scope-mismatch banner + D-02 hide of UAE freeform inputs (GULF-01/03)
- [x] 79-07-PLAN.md — Wave 4: web-vite Saudization dashboard + manual band entry + drift-override dialog + offboarding trajectory banner (GULF-05/06/07/10)
- [x] 79-08-PLAN.md — Wave 5: 4-locale Gulf i18n (real de/pl/ar) + RTL/locked-phrase/parity sweep + Arabic-RTL human-verify (GULF-08/09)
**Research flag:** NEEDS RESEARCH — Saudization Nitaqat 2026–2028 rates verified against Qiwa portal at seed time; UAE free-zone permitted-activity lists cross-referenced against each authority's portal; Dubai Law No. 7/2025 contracting framework; Qiwa-auth 2026-04-15 requirement
**Feature flags:** `gulf-free-zone-tracking` PENDING, `gulf-saudization-dashboard` PENDING
**UI hint:** yes

### Phase 80: v6.0 Verification + Hardening + Manual UAT

**Goal:** Cross-feature integration tests prove F1 + F3 + F4 compose correctly; manual-UAT checkpoints document captures all human-verify items; consolidated post-deploy legal sign-off list is ready for the Steuerberater / UK-tax-adviser / Saudi-MOL / UAE-legal / KSA-legal advisers when LOCAL-ONLY status flips.
**Depends on:** Phases 70–79 (all v6.0 features must ship before milestone hardening)
**Requirements:** none — verification phase covers all v6.0 surfaces
**Success Criteria** (what must be TRUE):
  1. Cross-feature integration test exercises full composition: contractor in UAE free zone with expiring license + IP-clause `LIKELY_MISSING` + Saudi-national assignment with Qiwa-auth gap → payment hard-blocked AND offboarding hard-blocked AND Saudization band trajectory preview shown; every gate fires; every audit row written; locked-phrase guard green
  2. `80-HUMAN-UAT.md` document lists every manual UI UAT scenario across F1/F2/F3/F4 with reproduction steps, expected behaviour, and "post-deploy" disposition (mirrors v5.0 `63-HUMAN-UAT.md` pattern)
  3. Consolidated post-deploy legal sign-off list catalogues every "Needs verification by legal entity" annotation across the milestone — Steuerberater for §48b EStG / A1 / Aufenthaltstitel / Werkvertrag IP wording; Saudi MOL/HRSD for Saudization rates; UAE legal for free-zone permitted-activity; UK legal for Border Security Act; KSA legal for Iqama+Qiwa-auth flow
  4. v6.0 retrospective documents (a) hard dependencies that played out as planned vs differed, (b) all PENDING Unleash flags by namespace with their post-deploy approval ticket pointers, (c) plan-completion velocity vs v5.0 baseline
**Plans:** 4/4 plans complete
  - [x] 80-01-PLAN.md — Wave 1: cross-feature F1+F3+F4 composition integration test (SC#1)
  - [x] 80-02-PLAN.md — Wave 1: 80-HUMAN-UAT.md manual UI UAT scenarios across F1/F2/F3/F4 (SC#2, F2 included)
  - [x] 80-03-PLAN.md — Wave 1: 80-LEGAL-SIGNOFF.md consolidated post-deploy legal sign-off list, one section per adviser (SC#3)
  - [x] 80-04-PLAN.md — Wave 2: D-04 milestone-wide gate re-run + 80-RETROSPECTIVE.md dependency play-out / PENDING-flag inventory / velocity (SC#4)
**Research flag:** STANDARD (mirrors v5.0 Phase 69 retrospective)
**Feature flags:** none — verification phase

## Dependency Graph (v6.0)

```
                    ┌──────────────────────────────┐
                    │ Phase 70: Foundation         │
                    │ (CI guards — must ship 1st)  │
                    └───────────────┬──────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
        ┌─────────────┐    ┌──────────────────┐    [F2 deferred]
        │ Phase 71    │    │ Phase 74         │
        │ F1 Schema + │    │ F4 Workflow      │
        │ Policy Pkg  │    │ Foundation + KT  │
        └──────┬──────┘    └────────┬─────────┘
               │                    │
               ▼                    ▼
        ┌─────────────┐    ┌──────────────────┐
        │ Phase 72    │    │ Phase 75         │
        │ F1 Reminder │    │ F4 IP Verify +   │
        │ + Pay Block │    │ Health Check +   │
        └──────┬──────┘    │ Credential Vault │
               │           └────────┬─────────┘
               ▼                    │
        ┌─────────────┐             │
        │ Phase 73    │             │
        │ F1 Dashboard│             │
        │ + Portal    │             │
        └──────┬──────┘             │
               │                    │
               │   ┌────────────────┘
               │   │ (F4 must precede F2 — cooldown gate
               │   │  references final-invoice-paid state)
               │   ▼
               │ ┌──────────────────┐
               │ │ Phase 76         │
               │ │ F2 Capability +  │
               │ │ Saga + Cooldown  │
               │ └────────┬─────────┘
               │          │
               │          ▼
               │ ┌──────────────────┐
               │ │ Phase 77         │
               │ │ F2 GWS + Slack   │
               │ │ (the wedge)      │
               │ └────────┬─────────┘
               │          │
               │          ▼
               │ ┌──────────────────┐
               │ │ Phase 78         │
               │ │ F2 Entra + Okta  │
               │ │ + GitHub         │
               │ └──────────────────┘
               │
               ▼
        ┌─────────────────────┐
        │ Phase 79            │
        │ F3 UAE Free-Zone +  │
        │ Saudization + AR    │
        │ (composes F1 expiry │
        │  cron + payment     │
        │  block for licenses)│
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │ Phase 80            │
        │ Verification + UAT  │
        │ + Legal Sign-off    │
        │ List + Retro        │
        └─────────────────────┘
```

**Hard dependencies:**
- 70 → all (foundation guards must catch CRITICAL-recovery-cost bug classes before any feature work)
- 71 → 79 (UAE free-zone trade license expiry is a `ContractorComplianceItem` of severity CRITICAL participating in F1 reminder cascade)
- 71 → 75 (F4 IP-clause `LIKELY_MISSING` finding is a `ContractorComplianceItem` of severity STANDARD)
- 74 → 75 (F4 IP_VERIFICATION block needs the override permission and workflow foundation)
- 75 → 76 (F2 14-day cooldown gate references F4's final-invoice-paid state — Pitfall 7)
- 76 → 77 → 78 (saga + cooldown infrastructure → wedge → differentiator)

**Research flags:**
- NEEDS RESEARCH (5 phases): 71, 75, 77, 78, 79
- STANDARD pattern (6 phases): 70, 72, 73, 74, 76, 80

## Coverage Summary (v6.0)

✓ All 54 v6.0 requirements mapped to exactly one phase (no orphans, no duplicates)
- 6 FOUND6 → Phase 70
- 4 + 4 + 3 = 11 COMPL → Phases 71, 72, 73
- 8 + 4 + 3 = 15 IDP → Phases 76, 77, 78
- 11 GULF → Phase 79
- 6 + 5 = 11 OFFB → Phases 74, 75

## Progress

| Phase                                          | Milestone | Plans Complete | Status      | Completed  |
| ---------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 56. Country Foundations & German i18n          | v5.0      | 8/8            | Complete    | 2026-04-12 |
| 57. Government API Clients                     | v5.0      | 4/4            | Complete    | 2026-04-26 |
| 58. Classification Engine & Rule Sets          | v5.0      | 5/5            | Complete    | 2026-04-13 |
| 59. Classification Documents & Chain Tracking  | v5.0      | 4/4            | Complete    | 2026-04-13 |
| 60. Classification Polish                      | v5.0      | 4/4            | Complete    | 2026-04-14 |
| 61. XRechnung E-Invoicing                      | v5.0      | 8/8            | Complete    | 2026-04-14 |
| 62. ZUGFeRD E-Invoicing                        | v5.0      | 7/7            | Complete    | 2026-04-16 |
| 63. UK Payments & Financial Features           | v5.0      | 7/7            | Complete    | 2026-04-26 |
| 64. Legal Compliance Hardening                 | v5.0      | 9/9            | Complete    | 2026-04-25 |
| 65. Phase 63 Critical Bug Fixes                | v5.0      | 2/2            | Complete    | 2026-04-26 |
| 66. Phase 57 Completion & Verification         | v5.0      | 4/4            | Complete    | 2026-04-26 |
| 67. Phase 56 & 58 Verification                 | v5.0      | 2/2            | Complete    | 2026-04-26 |
| 68. Skonto BG-20 XRechnung Emission Fix        | v5.0      | 5/5            | Complete    | 2026-04-26 |
| 69. DE Message-Key Parity Fix                  | v5.0      | 1/1            | Complete    | 2026-04-26 |
| 70. v6.0 Foundation — CI Guards                | v6.0      | 0/?            | Not started | -          |
| 71. F1 Compliance — Policy Package + Schema   | v6.0      | 7/7 | Complete   | 2026-04-27 |
| 72. F1 Compliance — Reminder + Payment Block  | v6.0      | 8/8 | Complete    | 2026-05-31 |
| 73. F1 Compliance — Dashboard + Portal + i18n | v6.0      | 8/8 | Complete    | 2026-05-31 |
| 74. F4 Offboarding — Workflow + KT            | v6.0      | 8/8 | Complete    | 2026-04-27 |
| 75. F4 Offboarding — IP Verify + Credentials  | v6.0      | 7.x/8 | Partial (esign deferred) | 2026-05-31 |
| 76. F2 IdP — Capability + Saga + Cooldown     | v6.0      | 10/10 | Complete    | 2026-05-31 |
| 77. F2 IdP — GWS + Slack (the wedge)          | v6.0      | 5/5 | Complete    | 2026-05-31 |
| 78. F2 IdP — Entra + Okta + GitHub            | v6.0      | 7/7 | Complete    | 2026-05-31 |
| 79. F3 Gulf — UAE Free-Zone + Saudization     | v6.0      | 8/8 | Complete    | 2026-06-03 |
| 80. v6.0 Verification + Hardening + UAT       | v6.0      | 4/4 | Complete   | 2026-06-05 |
