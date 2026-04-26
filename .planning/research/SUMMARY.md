# Project Research Summary — v6.0 Platform Maturity & Operational Hardening

**Project:** Contractor Ops — v6.0 Platform Maturity & Operational Hardening
**Domain:** B2B contractor operations SaaS (multi-tenant, multi-jurisdiction PL/UK/DE/UAE/SA), maturity milestone — no new market entry, four cross-cutting capability additions on a production-grade Turborepo monorepo
**Researched:** 2026-04-26
**Confidence:** HIGH — every recommendation verified against existing v1.0–v5.0 precedents (file-level extension points), official SDK / regulator documentation, or both. MEDIUM only on (a) Saudization Nitaqat threshold values, (b) UAE permitted-activity catalogues, (c) exact Werkvertrag IP-clause wording. All MEDIUM areas have a documented "Needs verification by legal entity before production deploy" post-deploy checkpoint per LOCAL-ONLY / legal-sign-off-DEFERRED constraint.

## Executive Summary

v6.0 is a **maturity milestone**, not a market-entry milestone. It closes four operational gaps that v1.0–v5.0 surfaced but deliberately deferred: (1) per-jurisdiction compliance-document lifecycle with hard payment-block on critical expiry, (2) IdP deprovisioning across Google Workspace / Entra ID / Okta / GitHub / Slack, (3) Gulf operational polish (UAE free-zone tracking + Saudization with the new 2026-04-15 Qiwa-auth requirement), and (4) offboarding hardening (KT templates, IP-assignment verification, contract clause health check, structured credential-rotation tracking). Across all four areas, research converges on a single architectural posture: **extend existing primitives, do not duplicate them**. Of ~15 dependencies a naive plan would add, research keeps **at most three** (`@okta/okta-sdk-nodejs`, `date-fns`, conditionally `octokit`); every other capability composes on existing infrastructure (QStash crons, AES-256-GCM per-provider credential store, `IntegrationProviderAdapter`, Claude Vision OCR with tool_use, R2 + ClamAV + DocumentLink, Unleash flags with PENDING→APPROVED CI gate, Better Auth org RBAC, AsyncLocalStorage tenant scoping, locked-phrases guard).

The recommended approach is **foundation-first**: a new Phase 70 closes cross-cutting CI guards (multi-tenant schema-lint, Pino redaction enumeration, message-key parity per-PR, Unleash signoff CI gate, OAuth scope-capability framework) BEFORE any feature work. This reconciles a real conflict between ARCHITECTURE (F1 first) and PITFALLS (foundation guards first) — see Roadmap Decision Points. F1 (Compliance Document Lifecycle Engine) lands second because two later features compose on it: F3 UAE free-zone license expiry reuses F1's `ContractorComplianceItem` + reminder cron, and F4 IP-clause health check writes findings as `ContractorComplianceItem` rows of severity STANDARD. F4 (Offboarding Hardening) ships before F2 (IdP Deprovisioning) so the 14-day cooldown gate has the final-invoice state machine to reference. F2 ships in two sub-phases: GWS+Slack first (~95% SMB target market, narrowest scope expansion), then Entra+Okta+GitHub (the wedge vs Deel/Rippling). F3 ships last (depends on F1 expiry engine).

The dominant risks are well-understood with v1.0–v5.0 precedents for mitigation. Three milestone-wide patterns warrant promotion: (a) the **drift escape hatch** pattern (mirrors v5.0 `recreateDraftAfterDrift`) reused 3x — for compliance requirement-set drift, Saudization Nitaqat threshold drift, and offboarding role-taxonomy drift; (b) the **locked-phrases guard** (78 phrases in v5.0 → 78+N) extended for every legally-defined document name, jurisdiction-specific clause, and Saudi/UAE Arabic statutory term; (c) the **detect-and-prompt re-OAuth** pattern from v2.0 Jira reused for every IdP whose existing OAuth scope set is read-only and needs write. The single highest-blast-radius pitfall is "deprovisioning runs before final invoice paid" (Pitfall 7) — the cooldown gate is mandatory, not a polish item, and foundation-first ordering is what makes it possible.

## Key Findings

### Recommended Stack (HIGH confidence)

Stack research converges on a "do NOT add new infra" stance. Every capability has an existing primitive in v1.0–v5.0; the work is composition, not import.

**New dependencies (at most three):**
- `@okta/okta-sdk-nodejs@8.0.0` — namespaced `client.userApi.deactivateUser` / `revokeUserSessions`
- `date-fns@4.1.0` — cascade-window arithmetic, tree-shake aggressively
- `octokit@5.0.5` (conditional — only if `@octokit/rest` is not already in tree)

**Existing infra reused (NOT new):**
- `googleapis@171.4.0` — GWS Admin SDK (v3.0)
- `@microsoft/microsoft-graph-client@3.0.7` + `@azure/identity@4.13.1` — Entra ID (v3.0 Teams + Outlook)
- `@slack/web-api@7.15.1` + raw `fetch` for SCIM (`scim:write` org-token)
- QStash, Pino via `@contractor-ops/logger`, Unleash OSS, Anthropic SDK with `ClaudeOcrAdapter`, Prisma 7, R2 + ClamAV, Better Auth org RBAC, `requireTier` Stripe middleware

**Explicitly NOT added:** BullMQ / Agenda / node-cron, `pdf-parse` / `pdfjs-dist` / `unpdf`, `@microsoft/msgraph-sdk` Kiota preview, generic secret-share packages, specialised compliance/Saudization npm packages.

**Static seed tables (no library exists):** UAE free-zone catalogue (~25 zones); Saudization Nitaqat 2026–2028 phase rules (~50 sectors × 3 years × 5 size bands). Both with admin-editable override tables and post-deploy legal sign-off checkpoints.

**Minimum-privilege OAuth scopes:** GWS `admin.directory.user` (write), Entra `User.EnableDisableAccount.All` + `User.RevokeSessions.All`, GitHub `admin:org`, Slack `admin.users.session:write` + `scim:write` (org-token), Okta "User Admin" role.

### Expected Features (HIGH confidence)

**Must have (table stakes):**
- F1: per-jurisdiction policy registry (UTR, A1-Bescheinigung 24mo, Aufenthaltstitel, §48b EStG, Iqama 1yr, Emirates ID, free-zone trade license, RTW share code 90d); 90/60/30/15/7-day reminder cascade; hard-block on payment-run for EXPIRED CRITICAL with structured per-contractor reason; contractor self-service upload from existing v2.0 portal; admin compliance dashboard
- F2: manual approval gate with per-IdP preview; GWS suspend + OAuth grant revoke + sign-out (the Nudge/Torii finding); Slack `admin.users.session.invalidate` + SCIM `active=false`; per-step audit trail with request/response hashes (SOC2); pre-flight scope check; partial-failure manual reconcile queue
- F3: UAE free-zone enum (10-zone seed: DIFC, DMCC, IFZA, Dubai Internet City, Dubai Media City, Meydan FZ, JAFZA, SHAMS, RAKEZ, ADGM + Mainland) with `licenseCategory` + `permittedActivitiesText` + `licenseExpiresAt`; Saudization dashboard (manual band entry — we don't compute); `qiwaContractAuthenticated` boolean (2026-04-15 reg); pre-offboarding impact banner; Iqama/work permit expiry roll-up reused from F1; Arabic + RTL via CSS logical properties
- F4: 4 role-typed KT seed templates (Software Engineer / Designer / PM / Generic Consultant); IP-assignment verification with e-sign-backed ratification (existing v2.0 DocuSign + Autenti); hard-block on offboarding-complete for unverified IP; contract clause regex scanner (UK + DE + PL + KSA + UAE + US); structured credential-rotation tasks — **`CredentialReference` only, never actual credentials**; OWNER-role override path for unresponsive contractors

**Should have (differentiators vs Deel / Rippling / Worksuite):**
- Payment hard-block per-invoice with specific document reason (vs Deel "no notify on expiry", Rippling holistic block)
- Conditional documents (§48b EStG construction-only, A1 cross-border-only) — reduces false-positive reminders
- Pre-flight Conditional Access conflict detection for Entra (silent-failure mode in MS shops)
- OAuth grant enumeration UI before deprovision (shadow-IT discovery side-effect)
- Werkvertrag-specific Schöpferprinzip + Nutzungsrechte distinction (DE wedge — UK boilerplate "hereby assigns" is INSUFFICIENT under §7 UrhG)
- Saudization-band trajectory chart with offboarding-impact preview
- Qiwa-auth coverage gap surfacing (2026-04-15 reg first-mover advantage)

**Defer to v6.x or v7+:** time-delayed/immediate IdP deprovisioning modes, vacation-responder configuration, Drive ownership transfer, Slack DM export, 1Password/Bitwarden actual-rotation integration, additional IdP adapters (1Password SaaS Manager, Jamf, JumpCloud), free-zone NOC drafting, Saudization band auto-compute (likely never), embedding-similarity contract-clause matching, department-based per-doc-policy overrides.

**Anti-features (explicit NO):** OCR auto-extraction of expiry dates, auto-generate documents (EOR territory), compliance score gamification, block invoice intake on expired docs, AI-suggested document policies, full SCIM provisioning, auto-detect orphaned accounts, delete-by-default (vs suspend), mailbox auto-forward, full free-zone activity catalog, auto-compute Saudization band, store actual credentials, auto-rotate API keys, auto-generate IP language, block offboarding on KT incompleteness, AI-generated KT documentation, "reactivate contractor" button.

### Architecture Approach (HIGH confidence — extension points file-verified)

**Major components:**
1. **`packages/compliance-policy` (NEW thin package)** — per-country profile modules, pure-function `resolveRequirements`; mirrors einvoice + classification country-profile pattern; classification outcome is INPUT, never policy itself
2. **F1 Compliance Document Engine** — extends `ContractorComplianceItem` (NOT a parallel model); reminder cron at `compliance-expiry-scan.ts` (port of `economic-dependency-scan.ts`); two payment-block hooks (paymentRouter primary at `payment.ts:352` + approval-engine condition operator secondary defence-in-depth); reuses existing `Notification` + `NotificationCronDedup` for idempotency
3. **F2 IdP Deprovisioning** — `Deprovisionable` capability mixin on existing `IntegrationProviderAdapter`; `DeprovisioningRun` + `DeprovisioningStep` saga state models with idempotent retry (NOT global compensation — re-provisioning offboarded contractor is unsafe); workflow-task driven via `WorkflowTaskType.ACCESS_REVOKE` (already exists in `workflow.prisma:173`); per-provider QStash jobs (NOT `Promise.allSettled`); `PARTIAL_COMPLETE` aggregate state surfaces in admin reconcile UI
4. **F3 Gulf Polish** — `packages/gulf-regulatory` package with `src/profiles/uae/free-zones.ts` + `src/profiles/sa/nitaqat.ts`; `UaeFreeZone` global ref table + `FreeZoneAssignment` per-org; `SaudizationConfig` (denormalised band+rate, indexable — NOT JSON blob); daily `saudization-recompute.ts` cron + event-triggered fire-and-forget
5. **F4 Offboarding Hardening** — new `WorkflowTaskType.IP_VERIFICATION` + `CONTRACT_HEALTH_CHECK` enum values (NOT a parallel BlockingTaskType); `Contract.complianceFlagsJson` + `complianceFlagsCheckedAt` + `complianceFlagsModelVer`; reused `ClaudeOcrAdapter` with new `contract-health-tools.ts` tool_use schema (model-version stored for replay); 4 role-typed KT seed templates via existing v1.0 template builder; new `workflow:override_blocking_task` permission with required reason text + RBAC OWNER role
6. **Cross-cutting CI guards (FOUNDATION)** — schema-lint enforcing `organizationId` OR explicit global-lookup-list registration; `LOG_BODY_EXCLUDE_PREFIXES` opt-in body logging (stricter default); message-key parity per-PR; Unleash legal-sensitive flag PENDING→APPROVED gate; `IntegrationConnection.scopeCapabilities` JSONB with detect-and-prompt re-auth

**Where existing patterns are limiting:** country-profile pattern is pure-data — F2 needs `IntegrationProviderAdapter` (stateful); `WorkflowTaskRun.status=BLOCKED` is informational — F4 IP_VERIFICATION needs `overrideBlockingTask` mutation; `ComplianceRequirementTemplate` lacks severity/country — extend additively (do NOT fork); `Organization.settingsJson` JSON blob fine for low-frequency — F3 Saudization promotes band+rate to first-class indexable columns.

### Critical Pitfalls (HIGH confidence — 31 pitfalls catalogued)

Top 5 critical:
1. **Mid-payment-batch document expiry race (P1)** — two-phase expiry gate (selection + export atomic, same Postgres `current_timestamp`); immutable `PaymentRunComplianceCheck` audit row in same transaction as bank-file export
2. **IdP deprovisioning vs final-invoice race (P7)** — 14-day cooldown gate before deprovisioning; portal magic-link enforced as non-IdP-dependent email
3. **Refresh-token semantic drift across IdPs (P8)** — `IdpDeprovisioningAdapter` interface MUST require BOTH `suspendAccount()` AND `revokeAllSessions()`; per-provider integration test asserts revocation within 5 minutes
4. **Re-OAuth breaks v3.0 GWS read-only (P9)** — detect-and-prompt pattern (mirrors v2.0 Jira); per-org `scopeCapabilities` JSONB; NEVER force global re-OAuth
5. **Rule-set drift mass-flagging contractors (P5/P17/P24)** — milestone-wide drift escape hatch pattern: `RULE_SET_VERSION` constant + `complianceRequirementSetVersionSnapshot` field + `recreateComplianceAssessment(reason)` admin mutation mirrors v5.0 `recreateDraftAfterDrift`

Other notable: reminder fatigue cascade (P2 — daily digest before per-doc cron); TZ drift (P3 — `@db.Date` not `DateTime`, store `expiry_jurisdiction_tz`); document-type conflation (P4 — country-profile pattern); i18n locked-phrase leakage (P6); partial-failure saga (P10 — per-provider QStash jobs, NEVER `Promise.allSettled`); reactivation resurrects access (P11 — no "reactivate" button, only "new engagement"); Pino over-redacting audit fields (P12 — separate child logger with allow-list); webhook self-trigger loop (P13 — `IdpChangeProvenance` filters own writes); Azure CA override (P14 — verify post-revoke via `signInActivity`); UAE permitted-activity scope (P15 — ISIC code field, not free text); three-clock conflation (P16); GCC partial-credit (P18); regional-routing default drift (P19); RTL drift (P20 — ESLint banning `ml-`/`mr-`); credential vault stores secrets (P21 — `CredentialReference` schema, content-validation regex rejecting AKIA*/PATs/JWT-shape/hex≥32); IP-clause false-negative (P22 — tristate verdict + operator-confirmation gate); IP-clause false-positive at upload (P23 — heuristic only at offboarding); hard-block on unresponsive contractor (P25 — OWNER override with required reason); PTO manager spam (P26 — OOO-aware routing). Cross-cutting: missing tenantId (P27), PII in Pino (P28), message-key parity drift (P29), feature flag without signoff (P30), OAuth scope cohabitation (P31).

## Implications for Roadmap

### Roadmap Decision Points (cross-source conflicts requiring synthesis)

**Decision 1 — Foundation phase before F1, or F1 first?**
- ARCHITECTURE proposes Phase 70 = F1 Foundation
- PITFALLS argues for separate v6.0 Foundation phase BEFORE F1 (P27, P28, P29, P30, P31)
- **Synthesis: PITFALLS wins. Foundation first.** Each cross-cutting CI guard prevents a class of bug whose recovery cost is CRITICAL (cross-tenant leak, regulator-grade PII exposure, unsigned legal copy ships, breaking v3.0 customers). Pattern mirrors v5.0 Phase 56 establishing locked-phrases guard before any locked phrases were added.

**Decision 2 — F2 phase ordering: GWS+Slack first or last?**
- FEATURES recommends GWS+Slack first (P1 in v6.0 MVP) — narrowest scope, highest customer overlap
- ARCHITECTURE puts F2 last (phases 77-79)
- **Synthesis: ARCHITECTURE wins on overall position (F2 ships after F4 — Pitfall 7 cooldown gate dependency), BUT split F2 into two sub-phases per FEATURES — GWS+Slack as the wedge, Entra+Okta+GitHub as the differentiator (same milestone).**

### Standing Constraints (apply to every v6.0 phase)

- App is **LOCAL-ONLY**; legal sign-off **DEFERRED**. Every locked legal phrase needs the v5.0 `locked-phrases-guard` pattern + post-deploy "Needs verification by legal entity" note.
- No `console.*` in source — `@contractor-ops/logger` factories or raw `pino` only.
- Feature flags = self-hosted Unleash OSS + thin code wrapper. Every legal-sensitive v6.0 capability gets a flag in `compliance-*` / `idp-deprovisioning` / `gulf-*` / `offboarding-ip-*` namespace, registered PENDING in code-side signoff registry, gated by CI.
- **Stripe tier gating recommendation (lock at requirements):** GWS+Slack deprovisioning at Starter (the wedge); Entra+Okta+GitHub at Pro (the differentiator); auto-enforcement / hard-payment-block at Enterprise (cost-of-fines tier — UAE permitted-activity hard-block in particular). F1 advisory dashboard at Starter; F1 hard-block at Pro+. F4 KT templates all tiers; F4 IP-clause scanner + hard-block at Pro+.

### Milestone-Wide Patterns (promote in roadmap)

- **Drift escape hatch (3x reuse)** — mirrors v5.0 `recreateDraftAfterDrift`. Required for: (a) F1 compliance requirement-set drift, (b) F3 Saudization Nitaqat threshold drift, (c) F4 offboarding role-taxonomy drift. Every drift handler emits an opt-in admin mutation + audit log + PDF watermark.
- **Locked-phrases guard extension** (78 → 78+N) — F1 jurisdiction-specific document type names; F3 UAE free-zone authority + Arabic Saudization band labels; F4 Werkvertrag IP-clause canonical wordings. CI count grows monotonically.
- **Detect-and-prompt re-OAuth** — F2 GWS scope upgrade, F2 Slack SCIM scope, F2 Entra session-revoke; future-proofs Jira/Teams/Calendar v7+.
- **Two-step suspend + revoke contract** — F2 adapter interface MUST require both methods; per-provider integration test asserts token-revoked-within-5-min.

### Phase Structure (suggested — phases continue from v5.0 Phase 69)

**Phase 70: v6.0 Foundation — Cross-Cutting CI Guards & Observability Baseline**
- Schema-lint CI script (model has `organizationId` OR global-lookup-list); `LOG_BODY_EXCLUDE_PREFIXES` opt-in body logging; message-key parity per-PR; Unleash legal-sensitive flag PENDING→APPROVED CI gate; per-org `IntegrationConnection.scopeCapabilities` JSONB with backfill migration; child-logger pattern documented
- Addresses: P27, P28, P29, P30, P31
- Research flag: STANDARD pattern (mirrors v5.0 locked-phrases-guard)

**Phase 71: F1 Compliance Document Engine — Foundation**
- `packages/compliance-policy` package with per-jurisdiction profile modules; pure-function `resolveRequirements`; schema delta (`severity`, `appliesToCountry`, `policyRuleId`, `lastReminderBand`, `blocksPaymentAt`, `expiry_jurisdiction_tz`); `@db.Date` not `DateTime` for expiry; fire-and-forget reconcile-on-classification hook
- Addresses: P3, P4, P5
- **Research flag: NEEDS RESEARCH** — per-jurisdiction document seed data dense (Border Security Act 2025, A1 24mo, §48b EStG, Iqama+Qiwa-auth)

**Phase 72: F1 Compliance Document Engine — Reminder Cascade + Payment Block**
- `compliance-expiry-scan.ts` band-state-machine cron (port of `economic-dependency-scan.ts`); `complianceReminderDigest` cron BEFORE per-doc cron; `requireValidCompliance` tRPC middleware at `paymentRouter.create`; `complianceCritical(EXPIRED)` condition operator in approval engine; immutable `PaymentRunComplianceCheck` audit row in same transaction as bank-file export; per-recipient throttle Redis SETNX max 1/24h
- Addresses: P1, P2, P6
- Research flag: STANDARD (port of v5.0 `economic-dependency-scan.ts`)

**Phase 73: F1 Compliance Document Engine — UI + i18n + Self-Service Portal**
- Admin compliance dashboard (at-risk count + renewals + blocked-payments queue + coverage matrix); contractor portal compliance tab; per-doc upload-replacement flow; manual override (audited); en/pl/de/ar parity
- Addresses: P16, P20, P29
- Research flag: STANDARD

**Phase 74: F4 Offboarding Hardening — Workflow Foundation + KT Templates**
- `WorkflowTaskType.IP_VERIFICATION` + `CONTRACT_HEALTH_CHECK` enum additions; `workflow:override_blocking_task` permission OWNER-only; required reason text + acknowledgement on override; 4 role-typed KT seed templates (Software Engineer / Designer / PM / Generic Consultant); per-org `WorkflowRole` model with editable templates; OOO-aware task routing + delegate fallback
- Addresses: P24, P25, P26
- Research flag: STANDARD (extends v1.0 template builder)

**Phase 75: F4 Offboarding Hardening — Contract Health Check + IP Verification + Credential Vault**
- `Contract.complianceFlagsJson` + `complianceFlagsCheckedAt` + `complianceFlagsModelVer`; reused `ClaudeOcrAdapter` with `contract-health-tools.ts` tool_use schema; tristate verdict `LIKELY_PRESENT` / `LIKELY_MISSING` / `MANUAL_REVIEW_REQUIRED`; per-jurisdiction phrase library (UK + DE + PL + KSA + UAE + US; Werkvertrag Schöpferprinzip + Nutzungsrechte detection); IP-assignment ratification via existing v2.0 e-sign; hard-block on offboarding-complete for unverified IP; `CredentialReference` schema (NEVER `Credential`); content-validation regex rejecting AKIA*/PATs/JWT-shape/hex≥32; structured credential-rotation tasks with successor-user-id required
- Addresses: P21, P22, P23
- **Research flag: NEEDS RESEARCH** — Werkvertrag wording lawyer-dependent; Claude Vision tool_use schema needs Context7 validation

**Phase 76: F2 IdP Deprovisioning — Schema + Capability Mixin + GWS Scope Migration**
- `Deprovisionable` capability mixin on `IntegrationProviderAdapter`; `DeprovisioningRun` + `DeprovisioningStep` saga models; new `IntegrationProvider` enum members `ENTRA_ID` + `OKTA`; detect-and-prompt re-OAuth UI flow with `prompt=consent`; backfill migration `['directory.read']`; `IdpChangeProvenance` short-TTL table for webhook-loop guard; separate Pino child logger with allow-list; 14-day cooldown gate referencing F4 final-invoice-paid event
- Addresses: P7, P9, P11, P12, P13
- Research flag: STANDARD (mirrors v2.0 Jira scope-expansion + v2.0 webhook pipeline + v5.0 saga model)

**Phase 77: F2 IdP Deprovisioning — GWS + Slack Adapter Implementations (the wedge)**
- `GoogleWorkspaceDeprovisionAdapter` extending v3.0 GWS with `users.update({ suspended: true })` + `directory.tokens.list` → `tokens.delete` + `users.signOut`; `SlackDeprovisionAdapter` extending v1.0 Slack with `admin.users.session.invalidate` + SCIM `PATCH active=false` (raw `fetch`); per-IdP preview UI; manual approval gate; per-step audit trail with request/response hashes; per-provider QStash jobs (NEVER `Promise.allSettled`); `PARTIAL_COMPLETE` aggregate state with admin reconcile UI; `LIKELY_GONE` idempotent semantic
- Addresses: P8, P10
- **Research flag: NEEDS RESEARCH** — GWS `tokens.delete` behaviour, Slack SCIM `scim:write` org-token requirement, current rate-limits via Context7

**Phase 78: F2 IdP Deprovisioning — Entra ID + Okta + GitHub Adapter Implementations (the differentiator)**
- `EntraIdDeprovisionAdapter` extending v3.0 Teams Graph adapter with `accountEnabled: false` + `revokeSignInSessions`; pre-flight Conditional Access enumeration with admin-action banner; hybrid-AD detection with hard warning; post-revoke verification via `signInActivity`; `OktaDeprovisionAdapter` (NEW `@okta/okta-sdk-nodejs@8.0.0`); `GitHubDeprovisionAdapter` with `octokit.rest.orgs.removeMember` + per-PAT explicit revoke + SAML credential-authorization revocation; outside-collab repos as manual-task with link
- Addresses: P14
- **Research flag: NEEDS RESEARCH** — Entra `revokeSignInSessions` CA interaction, Okta 8.x namespaced API, GitHub SAML credential-authorization endpoint via Context7

**Phase 79: F3 Gulf Polish — UAE Free-Zone Tracking + Saudization Dashboard**
- `packages/gulf-regulatory` package with UAE free-zones static catalogue + Saudization band thresholds + GCC sector-specific multiplier matrix; `UaeFreeZone` global + `FreeZoneAssignment` per-org + `UaeFreeZoneOverride` admin-editable; `SaudizationConfig` (denormalised, indexable) + `SaudiHeadcount` per-engagement nationality; `qiwaContractAuthenticated` boolean; schema-lint annotation classifying every new model tenant-scoped or global-lookup; manual self-reported band entry with quarterly cadence reminder; trajectory chart; pre-offboarding impact banner; free-zone trade license participates in F1 reminder cascade; permitted-activity scope-mismatch advisory + NOC required-doc auto-add; en/pl/de/ar parity with `ms-`/`me-`/`ps-`/`pe-` only; locked-phrase registry extension for UAE/KSA Arabic terms
- Addresses: P15, P16, P17, P18, P19, P20
- **Research flag: NEEDS RESEARCH** — Saudization Nitaqat 2026–2028 rates verified against Qiwa portal at seed time; UAE free-zone permitted-activity lists cross-referenced against each authority's portal; Dubai Law No. 7/2025 contracting framework; Qiwa-auth 2026-04-15 requirement

**Phase 80: v6.0 Verification + Hardening + Manual UAT**
- Cross-feature integration tests (F1 + F3 + F4 composition); manual-UAT checkpoints document (mirrors v5.0 `63-HUMAN-UAT.md`); post-deploy legal sign-off list (Steuerberater for §48b EStG/A1/Aufenthaltstitel/Werkvertrag IP wording; Saudi MOL/HRSD for Saudization rates; UAE legal for free-zone permitted-activity; UK legal for Border Security Act; KSA legal for Iqama+Qiwa-auth flow); v6.0 retrospective
- Research flag: STANDARD (mirrors v5.0 phase 69)

### Phase Ordering Rationale

1. **Foundation before features (70 → 71+)** — reconciles ARCHITECTURE-vs-PITFALLS in favour of PITFALLS; CI guards prevent CRITICAL-recovery-cost bugs
2. **F1 before F3 + F4** — hard schema dependency; both compose on `ContractorComplianceItem` + reminder cron
3. **F4 before F2** — hard workflow dependency; Pitfall 7 cooldown gate evaluates F4's final-invoice-paid state
4. **F2 GWS+Slack before F2 Entra+Okta+GitHub** — maximises wedge speed; ~95% SMB market with narrowest scope expansion

### Research Flags

- **NEEDS RESEARCH (5 phases):** 71, 75, 77, 78, 79
- **STANDARD pattern (6 phases):** 70, 72, 73, 74, 76, 80

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SDK choices verified via Context7 + npm registry (2026-04-26). MEDIUM only on Saudization + UAE free-zone reference data — no maintained npm packages exist; static seed tables + admin overrides + post-deploy legal sign-off is the only viable path. |
| Features | HIGH | IdP, compliance lifecycle, Saudization Qiwa-auth, IP-assignment patterns verified across ~50 sources. MEDIUM only on UAE NOC under Dubai Law 7/2025 (mid-2026 regulator clarifications expected) and Werkvertrag wording (lawyer-dependent). |
| Architecture | HIGH | All extension points verified at file-level (`contractor.prisma:209-285`, `payment.ts:352`, `workflow.prisma:173-220`, `IntegrationProviderAdapter` interface, `economic-dependency-scan.ts`, `equipment-workflow.ts`). MEDIUM on per-IdP implementation details (Context7 verification needed before each adapter build). |
| Pitfalls | HIGH | All 31 pitfalls grounded in concrete v1.0–v5.0 precedents. Where docs need verification (Google `tokens.delete`, Okta session semantics, Azure CA interaction), recommendation is Context7 at implementation time, not training data. |

**Overall confidence: HIGH**

### Gaps to Address (Open Questions for Requirements Definer)

- **Per-org policy customization scope (F1)** — admin override of severity per-jurisdiction? Lock during requirements definition.
- **Regex-vs-ML for clause scanner (F4)** — recommendation: regex first, Claude Vision tool_use as MANUAL_REVIEW_REQUIRED escape only. Confirm during requirements.
- **Arabic localization scope** — recommendation: F3 surfaces ship FULL AR + RTL (KSA/UAE customer-facing); other v6.0 surfaces en/pl/de only with AR added in v6.x. Lock during requirements.
- **GCC counting weighting matrix (F3)** — per-sector multiplier matrix in `gulf-regulatory/profiles/sa/nitaqat.ts`; values are seed data with annual review per Standing Constraints. Lock during requirements + Phase 79 manual UAT checkpoint.
- **Stripe tier gating exact mapping** — recommendation locked above; requirements definer to confirm with billing/product strategy.
- **Anthropic SDK tool_use schema for Phase 75** — Phase 75 plan-phase research-needs flag set.
- **Per-IdP deprovisioning APIs for Phase 77 + 78** — Context7 lookup mandatory before each adapter implementation.
- **Manual UAT checkpoint capture for legal sign-off** — Phase 80 generates consolidated post-deploy legal sign-off list.

## Sources

### Primary (HIGH confidence)
**Context7 / official SDK docs:** `googleapis_dev_nodejs_googleapis`, `microsoftgraph/microsoft-graph-docs-contrib`, `okta/okta-sdk-nodejs`, `octokit/octokit.js`, `slack_dev_reference_methods`, `date-fns/date-fns@v3.5.0`

**Official documentation:** Microsoft Graph `revokeSignInSessions` API, Microsoft Graph SDK overview, Slack SCIM API, GitHub REST `Remove an organization member`, Okta Lifecycle Management, GOV.UK Right to Work Share Code, Bundesportal A1 certificate, ZUS A1 confirmation, MHRSD Nitaqat Mutawar Program, Saudi Gazette Qiwa Saudization update, Cooley GO contractor agreements, comp-lex IP-Übertragungsvertrag, Kraus-Ghendler Freier Mitarbeiter Vertrag, it-recht-kanzlei Nutzungsrechte, Google OAuth 2.0 token revocation, Microsoft Learn Entra ID emergency revoke, Slack Deactivate member, u.ae verify business licences

**Internal precedents:** `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `contractor.prisma:209-285`, `workflow.prisma:173-220`, `payment.ts:352`, `packages/integrations/src/types/provider.ts`, `economic-dependency-scan.ts`, `equipment-workflow.ts`

### Secondary (MEDIUM confidence)
Nudge Security OAuth-Risks, Torii GWS Deactivation, Stitchflow Okta SSO-vs-Provisioning, Topedia Entra Revoke Sessions, Worksuite Compliance, VettingHub Right-to-Work 2026 (Border Security Act 2025), premote A1 24-month, Henry Club / SetupUAE / RIZ MONA UAE free zones, HCM Global / Qureos / SCPL Nitaqat, Sprintlaw UK Consultant Contracts, Enboarder + FutureCode Knowledge Transfer, ContractEval LLMs Clause-Level (Aug 2025), Anthropic Legal summarization guide, Bayanat UAE Open Data Portal

### Tertiary (LOW confidence — needs validation)
Vertix UAE free zones list, RSBM zone comparison, Jisr HRMS Nitaqat calculator (reference UI only), Thrivea Deel-vs-Rippling competitive comparison

### Internal references
- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
