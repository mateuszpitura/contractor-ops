# Requirements: Contractor Ops — Milestone v6.0

**Defined:** 2026-04-26
**Milestone:** v6.0 Platform Maturity & Operational Hardening
**Core Value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.

## v6.0 Scope Decisions (locked at requirements time)

| Decision | Outcome | Source |
|---|---|---|
| Phase ordering | Foundation (Phase 70) BEFORE any feature work | PITFALLS P27–P31 (cross-tenant leak, PII redaction, message-key parity, Unleash signoff, OAuth scope cohabitation) |
| F2 IdP split | GWS+Slack as wedge (sub-phase 1) → Entra+Okta+GitHub as differentiator (sub-phase 2) | FEATURES (~95% SMB market hits GWS+Slack) + ARCHITECTURE (sub-phase containment) |
| F2 ordering | F4 ships before F2 (cooldown gate references F4 final-invoice state) | PITFALLS P7 |
| F3 ordering | F1 ships before F3 (free-zone license expiry composes on F1 reminder cron) | ARCHITECTURE schema dependency |
| Stripe tier gating | Compliance dashboard advisory at Starter; Compliance hard-block at Pro+; GWS+Slack deprovisioning at Starter; Entra+Okta+GitHub at Pro+; F4 IP-clause scanner at Pro+; UAE permitted-activity hard-block at Enterprise | FEATURES tier-gating recommendation |
| Arabic localization | F3 Gulf surfaces ship FULL AR + RTL; other v6.0 surfaces en/pl/de + AR-deferred-to-v6.x | FEATURES customer-facing-only AR scope |
| Contract clause scanner | Regex-first per-jurisdiction phrase library; Claude Vision tool_use only as MANUAL_REVIEW_REQUIRED tristate fallback | FEATURES + PITFALLS P22 (avoid AI hallucination in legal-adjacent surface) |
| Saudization band entry | Manual self-reported band; we do NOT auto-compute band (legal liability + quarterly matrix changes); we surface inputs (nationality breakdown, Qiwa-auth coverage, Iqama expiry) | FEATURES anti-features list |
| Drift escape hatch | Reused 3x (compliance requirement-set, Saudization Nitaqat thresholds, role taxonomy) — milestone-wide pattern mirrors v5.0 `recreateDraftAfterDrift` | SUMMARY milestone-wide patterns |
| Legal sign-off posture | LOCAL-ONLY deploy; legal sign-off DEFERRED. Every locked phrase guarded; every legal-sensitive flag PENDING in code-side signoff registry | Standing Project Constraints (memory + STATE.md) |

## v6.0 Requirements

Requirements for the v6.0 milestone. Each maps to exactly one phase (filled by roadmapper).

### Foundation (cross-cutting CI guards)

- [ ] **FOUND6-01**: Engineer can run `pnpm lint:schema` to fail CI when any new Prisma model lacks `organizationId` and is not registered in the global-lookup-list allowlist
- [ ] **FOUND6-02**: API receives strict-by-default body redaction — `LOG_BODY_EXCLUDE_PREFIXES` becomes opt-in body logging via explicit `LOG_BODY_INCLUDE_PREFIXES`, with all v6.0 routers added to the include list only after manual review
- [ ] **FOUND6-03**: Engineer can run `pnpm i18n:parity` per-PR; CI fails if any new i18n key in en.json is missing a peer in de/pl/ar (locked-phrase guard remains the existing 78-phrase superset)
- [ ] **FOUND6-04**: Admin cannot ship a legal-sensitive Unleash flag to staging unless the corresponding entry in `signoff-registry.ts` is PENDING (CI gate); flipping to APPROVED requires a code commit referencing the legal-sign-off ticket
- [ ] **FOUND6-05**: Engineer can re-OAuth a v3.0 Google Workspace connection to upgrade scopes without breaking existing read-only directory-import use; `IntegrationConnection.scopeCapabilities` JSONB persists per-connection scope set with backfill migration for existing connections
- [ ] **FOUND6-06**: Engineer can use a separate Pino child logger with explicit allow-list for IdP audit trails (avoids over-redacting fields the audit needs)

### Compliance Document Lifecycle (F1)

- [ ] **COMPL-01**: Admin can view a per-org compliance dashboard showing at-risk contractor count, upcoming-renewal queue, and currently-blocked-payments queue
- [ ] **COMPL-02**: System auto-resolves required documents per contractor based on country + engagement type + classification outcome (IR35 / Scheinselbständigkeit), persisting them as `ContractorComplianceItem` rows
- [ ] **COMPL-03**: System sends reminder cascades at 90 / 60 / 30 / 15 / 7 days before document expiry, with per-recipient daily-digest throttle and per-band idempotency
- [ ] **COMPL-04**: Contractor receives portal-side notification of upcoming expiry with one-click upload-replacement flow that auto-marks the requirement satisfied with a refreshed expiry date
- [ ] **COMPL-05**: Admin payment-run creation is hard-blocked when any selected contractor has an EXPIRED CRITICAL compliance item, with structured per-contractor reason and deep link to the affected document
- [ ] **COMPL-06**: Approval engine evaluates a `complianceCritical(EXPIRED)` condition operator and holds the approval in `PENDING_COMPLIANCE` state when triggered, preventing back-door auto-`READY` transitions
- [ ] **COMPL-07**: System writes an immutable `PaymentRunComplianceCheck` audit row in the same transaction as the bank-file export (mid-batch race protection)
- [ ] **COMPL-08**: Document expiry dates are stored as `@db.Date` (not `DateTime`) with explicit `expiry_jurisdiction_tz` field — "expires today" resolves in contractor jurisdiction, not org HQ
- [ ] **COMPL-09**: Per-jurisdiction policy registry seeds (PL/UK/DE/UAE/SA) cover at minimum: UK Right-to-Work share code (90-day generation expiry), UK UTR, DE A1-Bescheinigung (24-month max), DE Aufenthaltstitel, DE §48b EStG (construction conditional), PL ZUS A1 (12-month max), PL UDT, KSA Iqama (1-year), KSA work permit + Qiwa-auth boolean, UAE Emirates ID, UAE free-zone trade license
- [ ] **COMPL-10**: Admin can trigger `recreateComplianceAssessment(reason)` to regenerate requirements when the compliance-policy rule set version changes (mirrors v5.0 `recreateDraftAfterDrift`); operation is audit-logged and never auto-runs
- [ ] **COMPL-11**: All COMPL surfaces ship en/pl/de parity at message-key level; locked-phrase registry extended with jurisdiction-specific document type names

### IdP Deprovisioning (F2)

- [ ] **IDP-01**: Admin can trigger access revocation for a single contractor via the offboarding workflow's `ACCESS_REVOKE` task; system enumerates connected IdPs and presents a per-IdP impact preview (`describeImpact`) before executing
- [ ] **IDP-02**: System enforces a 14-day cooldown gate after `ContractorAssignment.status = ENDED` before allowing IdP deprovisioning to start (final-invoice race protection)
- [ ] **IDP-03**: Admin can deprovision a contractor's Google Workspace identity — system suspends user, revokes all OAuth grants, and signs the user out of all sessions
- [ ] **IDP-04**: Admin can deprovision a contractor's Slack identity — system invalidates active sessions and SCIM-deactivates the user (`active=false`)
- [ ] **IDP-05**: Admin can deprovision a contractor's Microsoft Entra ID identity — system disables the account and revokes all sign-in sessions, with pre-flight Conditional Access policy enumeration warning when org policies may override the revoke
- [ ] **IDP-06**: Admin can deprovision a contractor's Okta identity — system deactivates the user and clears active sessions
- [ ] **IDP-07**: Admin can deprovision a contractor's GitHub org membership — system removes the org member, explicitly revokes per-PAT credentials, and flags outside-collab repos as manual-task with link
- [ ] **IDP-08**: Each IdP adapter implements both `suspendAccount()` and `revokeAllSessions()`; per-provider integration test asserts revocation is verifiable within 5 minutes
- [ ] **IDP-09**: System runs each provider deprovisioning step as an independent QStash job (no `Promise.allSettled` aggregation); aggregate `DeprovisioningRun.status` resolves to `COMPLETED` / `PARTIAL_FAILURE` / `FAILED`
- [ ] **IDP-10**: Admin can view a `DeprovisioningRun` audit trail showing per-step status, retry attempts, request/response hashes (SOC2 evidence-grade), and last-error message; `PARTIAL_FAILURE` runs surface in an admin reconcile queue
- [ ] **IDP-11**: System detects a v3.0 Google Workspace connection lacking write scopes and presents a re-OAuth prompt with `prompt=consent` rather than silently failing or breaking existing read-only flows
- [ ] **IDP-12**: Admin can manually mark a `MANUAL_ESCALATION` step as complete with a written reason (audit-logged), unblocking the offboarding workflow while preserving the failure record
- [ ] **IDP-13**: Webhook events from IdPs that originate from our own deprovision call are filtered out via short-TTL `IdpChangeProvenance` table — no self-trigger loops with v3.0 GWS directory-import
- [ ] **IDP-14**: System enforces minimum-privilege OAuth scopes per provider (GWS `admin.directory.user`, Entra `User.EnableDisableAccount.All` + `User.RevokeSessions.All`, GitHub `admin:org`, Slack `admin.users.session:write` + `scim:write` org-token, Okta "User Admin" role)
- [ ] **IDP-15**: System has no "reactivate contractor" button — returning contractors create a new engagement with fresh provisioning, by design

### Gulf Operational Polish (F3)

- [ ] **GULF-01**: Admin can record a contractor's UAE free-zone assignment — selecting from 10-zone seed enum (DIFC, DMCC, IFZA, Dubai Internet City, Dubai Media City, Meydan FZ, JAFZA, SHAMS, RAKEZ, ADGM) plus Mainland — with license number, license category, license expiry, and permitted-activities text
- [ ] **GULF-02**: System tracks UAE free-zone trade license expiry as a `ContractorComplianceItem` of severity CRITICAL participating in the F1 reminder cascade and payment-block gate
- [ ] **GULF-03**: System surfaces a permitted-activity scope-mismatch advisory when a contract's activity descriptor falls outside the contractor's free-zone permitted-activities list, with auto-add of NOC required-document for the affected engagement
- [ ] **GULF-04**: Admin can record per-engagement Saudi nationality + `isSaudi` boolean + `qiwaContractAuthenticated` boolean (2026-04-15 reg)
- [ ] **GULF-05**: Admin can manually enter and update the org's current Saudization Nitaqat band (PLATINUM / HIGH_GREEN / MID_GREEN / LOW_GREEN / YELLOW / RED) with industry-segment field; system records last-updated timestamp and prompts quarterly re-entry — system does NOT auto-compute the band
- [ ] **GULF-06**: Admin can view a Saudization dashboard surfacing total headcount, Saudi-national count, nationalisation rate, current band, Qiwa-auth coverage gap, and Iqama expiry roll-up (reusing F1 expiry data)
- [ ] **GULF-07**: Admin offboarding a Saudi-national contractor sees a pre-offboarding impact banner showing the projected Saudization-band trajectory after the offboarding completes
- [ ] **GULF-08**: All GULF surfaces (compliance dashboard, free-zone forms, Saudization dashboard, NOC flow) ship full Arabic localization with RTL CSS logical properties (`ms-` / `me-` / `ps-` / `pe-` only); ESLint guard bans `ml-` / `mr-` in v6.0 surfaces
- [ ] **GULF-09**: Locked-phrase registry extends with UAE/KSA Arabic statutory terms (free-zone authority names, Saudization band labels, Qiwa-auth status)
- [ ] **GULF-10**: Admin can override seed Saudization Nitaqat thresholds + UAE permitted-activity catalogues per-org with audit-logged write; system displays "Custom — verify with adviser" badge on overrides
- [ ] **GULF-11**: System routes ME-region (UAE/KSA) data to the ME database per the existing v4.0 multi-region strategy; new gulf models carry explicit regional-routing annotations and ship with a schema-lint test asserting no cross-region leakage

### Offboarding Hardening (F4)

- [x] **OFFB-01**: Admin offboarding workflow includes 4 role-typed knowledge-transfer seed templates (Software Engineer / Designer / Product Manager / Generic Consultant); template auto-selects from contractor's primary role tag with manual override
- [x] **OFFB-02**: System auto-routes KT tasks to the contractor's manager; if the manager is on PTO (per v2.0 calendar integration) the task delegates to the configured fallback approver
- [x] **OFFB-03**: Admin can extend role taxonomy via per-org `WorkflowRole` model with editable templates; v6.0 ships 4 seed templates, ops customise without engineering involvement
- [ ] **OFFB-04**: System runs an IP-assignment contract clause health check at contract upload via reused `ClaudeOcrAdapter` with `contract-health-tools.ts` tool_use schema, storing `Contract.complianceFlagsJson` + `complianceFlagsCheckedAt` + `complianceFlagsModelVer`
- [ ] **OFFB-05**: Health check returns a tristate verdict (`LIKELY_PRESENT` / `LIKELY_MISSING` / `MANUAL_REVIEW_REQUIRED`) using a regex-first per-jurisdiction phrase library covering UK + DE + PL + KSA + UAE + US wording, including DE Werkvertrag Schöpferprinzip + Nutzungsrechte distinction
- [ ] **OFFB-06**: System hard-blocks the offboarding workflow's `WorkflowRun.completedAt` until the `IP_VERIFICATION` task completes — admin signs the IP-assignment ratification document via existing v2.0 e-sign integration (DocuSign for UK/PL/US, Autenti for DE)
- [x] **OFFB-07**: OWNER-role admin can override the IP_VERIFICATION block with a required reason text + acknowledgement checkbox; override is audit-logged and surfaces a permanent badge on the offboarding record
- [ ] **OFFB-08**: System tracks structured credential-rotation tasks per offboarding — admin records `CredentialReference` rows (label + vault URL + successor user) for each access type; content-validation regex rejects strings shaped like AKIA*, GitHub PATs, JWT structure, or hex≥32 (system stores POINTERS only, never secrets)
- [ ] **OFFB-09**: Admin can view a contract clause health audit log showing every health-check run with model version (`complianceFlagsModelVer`) for replay/audit; manual re-run available
- [x] **OFFB-10**: System adds `WorkflowTaskType.IP_VERIFICATION` and `WorkflowTaskType.CONTRACT_HEALTH_CHECK` to the workflow engine; `workflow:override_blocking_task` permission registered OWNER-only
- [x] **OFFB-11**: All OFFB surfaces ship en/pl/de parity at message-key level; locked-phrase registry extends with Werkvertrag IP-clause canonical wordings

## v7+ Requirements (Future / Deferred)

Acknowledged but not in v6.0 roadmap.

### Compliance & Governance

- **COMPL-FUTURE-01**: AI-suggested document policies based on past contracts
- **COMPL-FUTURE-02**: Department-based per-doc-policy overrides
- **COMPL-FUTURE-03**: Per-org custom required documents beyond seeded jurisdiction registry

### IdP & Identity

- **IDP-FUTURE-01**: Time-delayed and immediate IdP deprovisioning modes (alternative to manual approval gate)
- **IDP-FUTURE-02**: Vacation-responder configuration on deprovision
- **IDP-FUTURE-03**: Drive ownership transfer
- **IDP-FUTURE-04**: Slack DM history export
- **IDP-FUTURE-05**: Additional IdP adapters (1Password SaaS Manager, Jamf, JumpCloud)
- **IDP-FUTURE-06**: 1Password / Bitwarden actual-rotation integration (vs reference-only)

### Gulf Polish

- **GULF-FUTURE-01**: UAE NOC drafting and submission flow
- **GULF-FUTURE-02**: Saudization band auto-compute (likely never — legal liability + quarterly matrix drift)

### Offboarding

- **OFFB-FUTURE-01**: Embedding-similarity contract-clause matching (vs regex)
- **OFFB-FUTURE-02**: AI-generated KT documentation drafts

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---|---|
| OCR auto-extraction of expiry dates | High false-positive risk on multi-format docs; user-entered date is the auditable source of truth |
| Auto-generate compliance documents | EOR territory — we coordinate, we don't generate legal docs |
| Compliance score gamification | Behavioural-design risk in legal-adjacent surface |
| Block invoice intake on expired docs | Wrong gate point — block at payment, not intake (a contractor with an expired doc may still need to bill for completed work) |
| Full SCIM provisioning across all IdPs | We deprovision only — full identity lifecycle is IGA territory |
| Auto-detect orphaned IdP accounts | Out-of-scope discovery noise; v6.0 is targeted-revoke per known contractor |
| Delete-by-default deprovisioning (vs suspend) | Suspend preserves audit trail and recovery path; delete is irreversible operational risk |
| Mailbox auto-forward on deprovision | Privacy + legal risk; admin handles via standard org policy |
| Full UAE permitted-activity catalogue | 600–2000 codes per zone; we ship a 20-category curated list, admin enters detail in free-text |
| Auto-compute Saudization Nitaqat band | Legal liability + thresholds change quarterly; admin enters manually with quarterly reminder |
| Storing actual credentials (`Credential` model) | Blast radius and rotation nightmare; `CredentialReference` only |
| Auto-rotating API keys on offboarding | Out-of-scope PAM territory |
| Auto-generating IP-assignment language | Legal liability — we flag absence, admin owns wording |
| Block offboarding on KT incompleteness | Soft-warn only — KT is human-judgment work, not gate-able |
| AI-generated KT documentation | Confabulation risk; system tracks structure, humans author content |
| "Reactivate contractor" button | Returning contractors get fresh engagement + fresh provisioning |
| Mobile-native v6.0 surfaces | Web-first per existing constraint; mobile responsive only |

## Traceability

Which phases cover which requirements. Filled by roadmapper on 2026-04-26.

| Requirement | Phase | Status |
|---|---|---|
| FOUND6-01 | Phase 70 | Pending |
| FOUND6-02 | Phase 70 | Pending |
| FOUND6-03 | Phase 70 | Pending |
| FOUND6-04 | Phase 70 | Pending |
| FOUND6-05 | Phase 70 | Pending |
| FOUND6-06 | Phase 70 | Pending |
| COMPL-01 | Phase 73 | Pending |
| COMPL-02 | Phase 71 | Pending |
| COMPL-03 | Phase 72 | Pending |
| COMPL-04 | Phase 73 | Pending |
| COMPL-05 | Phase 72 | Pending |
| COMPL-06 | Phase 72 | Pending |
| COMPL-07 | Phase 72 | Pending |
| COMPL-08 | Phase 71 | Pending |
| COMPL-09 | Phase 71 | Pending |
| COMPL-10 | Phase 71 | Pending |
| COMPL-11 | Phase 73 | Pending |
| IDP-01 | Phase 77 | Pending |
| IDP-02 | Phase 76 | Pending |
| IDP-03 | Phase 77 | Pending |
| IDP-04 | Phase 77 | Pending |
| IDP-05 | Phase 78 | Pending |
| IDP-06 | Phase 78 | Pending |
| IDP-07 | Phase 78 | Pending |
| IDP-08 | Phase 76 | Pending |
| IDP-09 | Phase 76 | Pending |
| IDP-10 | Phase 76 | Pending |
| IDP-11 | Phase 76 | Pending |
| IDP-12 | Phase 77 | Pending |
| IDP-13 | Phase 76 | Pending |
| IDP-14 | Phase 76 | Pending |
| IDP-15 | Phase 76 | Pending |
| GULF-01 | Phase 79 | Pending |
| GULF-02 | Phase 79 | Pending |
| GULF-03 | Phase 79 | Pending |
| GULF-04 | Phase 79 | Pending |
| GULF-05 | Phase 79 | Pending |
| GULF-06 | Phase 79 | Pending |
| GULF-07 | Phase 79 | Pending |
| GULF-08 | Phase 79 | Pending |
| GULF-09 | Phase 79 | Pending |
| GULF-10 | Phase 79 | Pending |
| GULF-11 | Phase 79 | Pending |
| OFFB-01 | Phase 74 | Complete |
| OFFB-02 | Phase 74 | Complete |
| OFFB-03 | Phase 74 | Complete |
| OFFB-04 | Phase 75 | Pending |
| OFFB-05 | Phase 75 | Pending |
| OFFB-06 | Phase 75 | Pending |
| OFFB-07 | Phase 74 | Complete |
| OFFB-08 | Phase 75 | Pending |
| OFFB-09 | Phase 75 | Pending |
| OFFB-10 | Phase 74 | Complete |
| OFFB-11 | Phase 74 | Complete |

**Coverage:**
- v6.0 requirements: **54 total** (6 FOUND6 + 11 COMPL + 15 IDP + 11 GULF + 11 OFFB)
- Mapped to phases: **54 / 54** (100%)
- Unmapped: **0** ✓
- Phase distribution:
  - Phase 70 (Foundation): 6 requirements (FOUND6-01..06)
  - Phase 71 (F1 schema + policy): 4 requirements (COMPL-02, 08, 09, 10)
  - Phase 72 (F1 reminder + payment block): 4 requirements (COMPL-03, 05, 06, 07)
  - Phase 73 (F1 dashboard + portal + i18n): 3 requirements (COMPL-01, 04, 11)
  - Phase 74 (F4 workflow + KT + override): 6 requirements (OFFB-01, 02, 03, 07, 10, 11)
  - Phase 75 (F4 health check + IP verify + credentials): 5 requirements (OFFB-04, 05, 06, 08, 09)
  - Phase 76 (F2 capability + saga + cooldown): 8 requirements (IDP-02, 08, 09, 10, 11, 13, 14, 15)
  - Phase 77 (F2 GWS + Slack wedge): 4 requirements (IDP-01, 03, 04, 12)
  - Phase 78 (F2 Entra + Okta + GitHub differentiator): 3 requirements (IDP-05, 06, 07)
  - Phase 79 (F3 Gulf): 11 requirements (GULF-01..11)
  - Phase 80 (verification + UAT): 0 requirements (verification phase covers all v6.0 surfaces)

---
*Requirements defined: 2026-04-26*
*Traceability filled by roadmapper: 2026-04-26 — 54/54 mapped, 100% coverage*
