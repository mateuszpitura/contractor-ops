# Feature Research — v6.0 Platform Maturity & Operational Hardening

**Domain:** B2B contractor-ops platform — adding 4 NEW capability areas (compliance lifecycle, IdP deprovisioning, Gulf operational polish, offboarding hardening) to an existing production-grade SaaS for tech companies (10–200 employees, 5–50 contractors) operating across PL / UK / DE / UAE / SA.
**Researched:** 2026-04-26
**Confidence:** HIGH for IdP, compliance lifecycle, Saudization, IP-assignment patterns; MEDIUM for UAE free-zone NOC edge-cases (regulator changes mid-2026, Dubai Law 7/2025 contracting framework) and Werkvertrag-specific IP wording (no-Schöpferprinzip carve-outs vary by lawyer).
**Scope discipline:** Existing platform already has workflow engine, approval engine, notification dispatch (in-app + email + Slack + Teams), document mgmt with R2 + virus scan + versioning, Stripe billing + feature gating, country-specific tax-id validators, settings tabs. v6.0 builds ON these — does NOT rebuild them. Anti-features below are explicit about that.

---

## Area 1 — Compliance Document Lifecycle Engine

### 1.1 Domain framing

The existing platform has a "compliance health card" on the contractor profile (per-factor scoring) AND a generic R2-backed document store, but those two systems are NOT joined by a policy. v6.0 introduces the missing piece: **per-jurisdiction document policy + per-document expiry + reminder cascade + payment-gate enforcement**.

Industry pattern (Deel, Remote, Rippling, Worksuite, Pebl/Velocity Global): the platform owns a **document-policy registry** keyed on (country × engagement type × role), each entry declaring `documentType`, `criticality` (CRITICAL / IMPORTANT / NICE_TO_HAVE), `recurrence` (one-time vs renewable), `defaultValidityDays`, and `enforcementMode` (BLOCK_PAYMENT / BLOCK_OFFBOARDING / WARN_ONLY). Contractors get a **required-document checklist** auto-generated from policy at engagement start; uploads attach to existing Document records but gain `policyEntryId` + `expiresAt` columns; a daily cron evaluates state and emits reminders.

Worksuite explicitly markets "automated reminders for timely renewals." Deel's known weakness (per public reviews): "Deel's system doesn't notify users when ID Documents expire" — ironic given their EOR positioning, and a real wedge for us.

### 1.2 Required-document matrix per jurisdiction (v6.0 minimum policy seed)

| Jurisdiction | Document | Criticality | Recurrence | Default validity | Enforcement |
|---|---|---|---|---|---|
| **UK** | Right-to-Work share code (gov.uk) | CRITICAL | Renewable per engagement; **share code valid 90 days from generation**, follow-up check before status-end-date | one-time + follow-up before time-limited leave expires | BLOCK_PAYMENT until verified. From 2026 (Border Security Act 2025), RTW obligations explicitly extend to sub-contractors and platform/gig engagements — this is no longer optional for B2B contractor mgmt |
| UK | UTR (Self-Assessment) | IMPORTANT | One-time | n/a | WARN_ONLY (we already validate mod-11 in v5.0) |
| UK | VAT registration certificate (if VAT-registered) | IMPORTANT | One-time | n/a | WARN |
| UK | SDS (we generate) | CRITICAL | Per engagement | n/a (status change triggers reassessment) | already wired in v5.0 |
| **DE** | A1-Bescheinigung (ZUS/DRV) — required for cross-border services into DE | CRITICAL | Renewable | **max 24 months** | BLOCK_PAYMENT for cross-border engagements |
| DE | Aufenthaltstitel (residence permit) for non-EU contractors | CRITICAL | Renewable | per-permit (typically 1–3 yrs) | BLOCK_PAYMENT past expiry |
| DE | Freistellungsbescheinigung §48b EStG (construction-services exemption) | CRITICAL **for construction-related engagements only** | Renewable | typically 3 yrs | BLOCK_PAYMENT — without it, payor must withhold 15% Bauabzugsteuer |
| DE | Gewerbeanmeldung / Handelsregisterauszug | IMPORTANT | One-time + change events | n/a | WARN |
| DE | DRV-Statusfeststellung (we already track) | CRITICAL | Per engagement | already wired in v5.0 | BLOCK_PAYMENT on RECLASSIFIED |
| **PL** | A1 ZUS (cross-border posting) | CRITICAL **only for cross-border** | Renewable | **max 12 months** | BLOCK_PAYMENT for cross-border |
| PL | Wpis CEIDG (sole trader registration) | IMPORTANT | One-time + change events | n/a | WARN |
| PL | UDT (Urząd Dozoru Technicznego) cert | NICE_TO_HAVE / role-gated (technical inspection roles only — NOT general SaaS contractor) | renewable per equipment type | n/a | WARN, role-gated default OFF |
| **UAE** | Emirates ID | CRITICAL | Renewable | per-card (typically 1–3 yrs) | BLOCK_PAYMENT |
| UAE | Residence visa | CRITICAL | Renewable | 2-3 yrs | BLOCK_PAYMENT |
| UAE | Freelance permit / free-zone trade license | CRITICAL | Renewable | typically 1 yr (DMCC, IFZA, DIFC differ) | BLOCK_PAYMENT |
| UAE | NOC (when working outside license scope or on mainland from a free-zone permit) | CONDITIONAL CRITICAL | Per engagement | n/a | BLOCK_PAYMENT when triggered (see Area 3) |
| **KSA** | Iqama | CRITICAL | Renewable | 1 yr (or 2-yr employer choice) | BLOCK_PAYMENT past expiry |
| KSA | Work permit (HRSD) | CRITICAL | Renewable | annually | BLOCK_PAYMENT — without renewal, person is auto-excluded from Saudization count anyway |
| KSA | GOSI registration | CRITICAL | Continuous | rolling | WARN if lapsed |
| KSA | Health insurance (CCHI) | CRITICAL | Renewable | annually | WARN (renewal-blocker for Iqama, so deferred) |
| KSA | Saudi Health Council (SHC) classification — **for licensed professions only** (medical, engineering) | role-gated CRITICAL | Renewable | varies | WARN, role-gated default OFF |
| KSA | Qiwa-authenticated employment contract (effective 2026-04-15 — required for Saudization-counting) | CRITICAL **for Saudi nationals only** | One-time per contract | n/a | WARN at org level (see Area 4 — Saudization) |

Cross-cutting (all jurisdictions):
- ID document (passport / EU national ID) — IMPORTANT, renewable, default 10-year validity, WARN at 90 days
- Bank account proof / IBAN confirmation — IMPORTANT, one-time + change events, WARN
- Tax residency certificate (DTAA-treaty engagements) — IMPORTANT, annual, WARN

### 1.3 Reminder cascade — exact pattern

Industry standard (Worksuite, Deel-where-it-works, BambooHR docs, Rippling): 5-step cascade tied to `expiresAt`:
- **T-90 days** — first reminder, low urgency, contractor + admin email
- **T-60 days** — second reminder, contractor + admin
- **T-30 days** — third reminder, escalate (admin notified separately, dashboard "at-risk" surface)
- **T-15 days** — fourth reminder, urgent
- **T-7 days** — final reminder, urgent + Slack/Teams ping
- **T-0** (expiry) — status flips to EXPIRED; dependent engagement gates fire (BLOCK_PAYMENT, etc.)
- **T+1 day** — admin-only daily breach digest until resolved

The platform's existing notification dispatch (in-app + email + Slack + Teams) is the carrier. The new piece is the cron emitter + the per-document state machine `OK → DUE_SOON → URGENT → EXPIRED → REPLACED`.

### 1.4 Hard-block vs soft-warn semantics

**Hard-block** = the action FAILS at the tRPC mutation layer with a structured `PRECONDITION_FAILED` error and a UI that points the user to the upload-replacement screen. Same pattern as v3.0 AI-credit hard-block. Uses Unleash flag `compliance-lifecycle-block-payment` so block can be rolled back if a customer hits an edge case.

**Soft-warn** = the action proceeds but the UI shows a yellow banner and an entry lands in the audit log.

The contract is: **payment runs are the only block surface in v6.0**. Specifically `paymentRun.addInvoice` and `paymentRun.markReady` evaluate document state for each contractor referenced; any contractor with at least one `EXPIRED` CRITICAL doc is excluded with reason. We do NOT block invoice intake, contract creation, or workflow runs — those are warn-only. Rationale: invoice intake is contractor-driven; blocking it punishes the contractor for the org's policy gap. Payment is admin-driven and is the right enforcement point.

A separate hard-block lives on `offboarding.complete` (see Area 4).

### 1.5 Self-service upload portal

Existing v2.0 contractor portal has a documents tab. v6.0 extends it: contractor sees their **personal compliance checklist** scoped to their engagements, with status pills, expiry dates, "upload replacement" buttons that open a presigned-R2 upload directly into the existing virus-scan + versioning pipeline. New uploads create a new Document version AND set `expiresAt` from policy default (admin can override per upload).

### 1.6 Compliance dashboard (admin)

A new top-level "Compliance" nav item OR a new tab on the existing Reports page (recommended: dedicated page, because admin-finance persona will check it weekly). Surfaces:
1. **At-risk count** — contractors with ≥1 CRITICAL doc in URGENT or EXPIRED
2. **Renewals due this week / month** breakdown by jurisdiction
3. **Blocked payments queue** — invoices held by document state, with one-click "request replacement" CTA that triggers an out-of-cycle reminder
4. **Coverage matrix** — per-jurisdiction completeness (X of Y required docs uploaded across all active engagements)
5. CSV export — same engine as v5.0 compliance health (formula-injection neutralized)

### 1.7 Tables / Differentiators / Anti-features

#### Table stakes (must have for v1)

| Feature | Why expected | Complexity | Existing-system dependency |
|---|---|---|---|
| Per-jurisdiction policy registry (seed data for PL/UK/DE/UAE/SA) | Without policy, expiry tracking is meaningless | M | None — new domain |
| `expiresAt` + `policyEntryId` on Document model | Core data model | S | extends existing Document |
| 90/60/30/15/7-day reminder cascade cron | Industry standard | M | depends on existing notification dispatch + cron infra |
| Hard-block on `paymentRun.addInvoice` for EXPIRED CRITICAL | This is the wedge ("Deel doesn't notify on expiry") | M | depends on existing payment-run state machine + Unleash flag |
| Contractor self-service upload from portal | Contractor must be able to act on the reminder without emailing admin | S | extends v2.0 portal documents tab |
| Admin compliance dashboard with at-risk count | Operational must-have for finance/COO persona | M | extends existing Reports + Recharts |
| Audit log entries for every state transition | Already a platform constraint | S | uses existing immutable AuditLog |
| Per-doc upload-replacement flow with versioning | Already exists — just hook up | S | uses existing R2 + virus scan + version history |
| Manual override (admin-only, audited) for per-doc validity | Real-world docs sometimes have non-default expiry (e.g. RTW status with hard end date) | S | new admin form |
| Localised reminder emails (EN/PL/DE) | Existing i18n pattern; AR for KSA/UAE if v4.0 AR is wired | S | uses existing i18n |
| Idempotent cron + state-machine recompute | Don't double-send reminders if cron retries | M | uses existing cron infra |

#### Differentiators (vs Deel / Remote / Rippling)

| Feature | Value vs competitors | Complexity |
|---|---|---|
| **Payment hard-block tied to document state, by jurisdiction CRITICALITY tier (not blanket)** | Deel/Remote treat all docs equally or only warn; Rippling blocks payroll holistically. We block per-invoice with a specific reason citing the specific document — actionable for finance, not punitive | M |
| **Conditional documents** (e.g. §48b EStG only for construction-tagged engagements; A1 only for cross-border-tagged engagements) | Reduces false-positive reminders — competitors over-prompt | M |
| **Cross-border posting detection from contract metadata** auto-toggles A1 requirement | Real ops differentiator — no manual flagging | M |
| **Bauabzugsteuer 15% withhold preview** when §48b expires (not just "blocked") | Tells finance the exact DE-specific consequence; competitors say "blocked" | S (calc only — no actual WHT engine until v7) |
| **DRV-Statusfeststellung & SDS docs already integrate with the lifecycle engine** (because v5.0 generated them) | Closed loop: we issue the doc, we monitor its expiry, we re-prompt at threshold | S — wire-up only |
| **Coverage-matrix view per jurisdiction with one-click "fill all gaps for contractor X" requested-document email** | Bulk-fix CTA — competitors require per-doc email | M |
| **Reminder muting per contractor with audit reason** (legitimate scenarios: contractor in dispute, doc replacement in flight via different channel) | Real-world need — competitors force opt-out per type | S |

#### Anti-features (DO NOT build)

| Anti-feature | Why requested | Why problematic | What we do instead |
|---|---|---|---|
| **OCR/auto-extraction of expiry dates from uploaded docs** | "Smart" feature that demos well | Brittle (Iqama vs RTW vs A1 vs Aufenthaltstitel layouts all differ; OCR errors silently set wrong expiry → wrong block); blamable in audit; needs dedicated training data per doc-type | Manual `expiresAt` on upload with policy-default pre-fill; verifier can correct in 1 field |
| **Auto-generate the document itself** (e.g. "we'll prepare your A1 application") | Customer asks: "can you do the A1 for us?" | Out of scope — that's EOR territory (already in PROJECT.md Out-of-Scope); requires powers-of-attorney, regulator integrations | Document templates + checklist of what regulator expects; link to gov.uk / ZUS PUE / Qiwa portal |
| **"Compliance score" gamification** ("you're 87% compliant!") | Easy dashboard metric | Encourages box-ticking over substance; meaningless when 1 missing CRITICAL doc kills payment regardless | Coverage matrix (objective gaps), at-risk count (binary), and per-doc state |
| **Block invoice intake when docs are expired** | "Symmetric enforcement" | Punishes contractor for org's policy gap — invoice INTAKE doesn't cost the org anything; PAYMENT is the right enforcement point | Block only at payment-run level |
| **Broadcast reminders to contractor's manager / external email lists** | "Visibility" | GDPR/PDPL data-minimization issue — manager doesn't need to know contractor's Aufenthaltstitel is expiring | Reminders go to contractor + designated org-compliance-admin role only |
| **Per-document approval workflow on every upload** | "We need to verify" | Existing change-request model in portal already covers profile data; documents don't need approval — they need expiry tracking. Approval-on-upload creates queues that clog finance | Upload directly, but verifier can flag invalid docs in admin view (no separate workflow) |
| **AI-suggested document policies** | "We don't know what to require" | Legal liability — wrong recommendation = wrong block = customer complaint or compliance violation. Legal review is DEFERRED per LOCAL-ONLY posture | Hardcoded seed registry per jurisdiction (auditable, version-controlled, change-reviewed); admin can disable per-org but not invent |

### 1.8 Modal user journey

**Admin onboarding a new German contractor:**
1. Adds contractor with country=DE, engagement type=B2B-services
2. System auto-generates required-doc checklist: ID, Gewerbeanmeldung (one-time), DRV-Statusfeststellung (auto, in flight from v5.0 engine), bank proof
3. If contract metadata flips `crossBorder=true` → A1-Bescheinigung CRITICAL is added
4. If contract metadata flips `industry=construction` → §48b EStG CRITICAL is added with Bauabzugsteuer-warning copy
5. Admin sends "complete your compliance checklist" portal invite (existing magic-link flow)
6. Contractor uploads docs from portal — each gets virus-scanned, versioned, `expiresAt` populated from policy default (editable)
7. T-90 days before expiry: contractor gets EN/DE email "your A1 expires in 90 days, here's how to renew"
8. T-30 days: admin gets dashboard at-risk count incremented
9. T-0: doc flips EXPIRED. Next payment run that includes this contractor's invoice → invoice excluded with reason "DE.A1.EXPIRED" — admin sees "Request replacement" CTA → triggers out-of-cycle email

**Finance running weekly payment batch:**
1. Goes to Payments → New Run → selects 47 invoices
2. System validates → 3 invoices excluded with structured reasons:
   - "Acme GmbH (Müller) — DE.A1.EXPIRED — last valid 2026-03-12"
   - "DataCo (Schmidt) — DE.AUFENTHALTSTITEL.EXPIRED"
   - "Acme GmbH (Khan) — UAE.EMIRATES_ID.EXPIRED"
3. Click "Email all 3 contractors for replacement" → out-of-cycle reminders dispatched
4. Run proceeds with 44 invoices; 3 stay in BLOCKED queue until docs are replaced (then auto-eligible again)

---

## Area 2 — Identity Provider Deprovisioning

### 2.1 Domain framing

The existing platform integrates with Google Workspace (v3.0 directory import), Slack (v1.0 OAuth + DMs + interactivity), and several productivity tools (Jira, Linear, Notion, Confluence, Calendar). v3.0 also added Microsoft Teams. Today these are **inbound integrations only** (sync from them, push notifications to them). v6.0 adds **outbound deprovisioning**: when offboarding completes, we revoke access across these IdPs/SaaS surfaces.

**The crucial scope discipline:** we are NOT building an IGA / IAM platform. We do NOT do full lifecycle provisioning, group sync, role recertification, JIT access, or birthright access policies. We deprovision only. This is a defensible niche — most contractor-ops platforms either ignore deprovisioning entirely (Deel) or only handle their own surface (Rippling has full IAM but bundles it with employee HRIS, which we are not).

### 2.2 What "complete deprovisioning" actually means per IdP

Industry consensus (Torii, Nudge Security, ShiftControl IT-offboarding playbooks, Microsoft 2026 Entra docs, Google Workspace Feb 2026 admin doc, Okta dev forum):

**Google Workspace:**
- `users.update` with `suspended=true` (Admin SDK Directory API) — locks login, locks Gmail POP/IMAP within minutes
- **Critical gotcha (Nudge / Torii 2026):** OAuth grants survive suspension. Each OAuth-connected app keeps working until it next checks user state. Must explicitly call `tokens.delete` on each OAuth grant via `directory.tokens.list` → `tokens.delete`
- Reset sign-in cookies via `users.signOut` (newer endpoint, equivalent to "Sign out from all sessions")
- Revoke security keys / app passwords (admin-side action, not API)
- Drive ownership transfer is a **separate admin-confirm action** — files stay owned by suspended user otherwise
- Email autoresponder: vacation responder via `users.settings.sendAs.update` BEFORE suspension (suspension blocks Gmail API access for the user)
- Final delete: deferred — Google's own playbook says suspend first, delete after data-transfer + retention window

**Azure AD / Entra ID:**
- Set `accountEnabled=false` via Microsoft Graph `PATCH /users/{id}`
- **Feb 2026 update:** `revokeSignInSessions` action now invalidates ALL sessions (previously only MFA). Single Graph call.
- **Continuous Access Evaluation (CAE)** — for CAE-capable apps, Entra propagates revocation in ~minutes; for non-CAE apps, sessions live until token expiry (max ~1 hour for access tokens, longer for refresh)
- Conditional Access policy conflicts: org-level policies that grant access to "guest contractors" group can mask deprovisioning. Solution: pre-flight check enumerates user's CA-grant policies and surfaces conflicts to admin BEFORE deprovision (don't blindly call disable)
- Hybrid AD (on-prem AD synced to Entra): Microsoft's recommendation is disable in on-prem AD first, sync flows up. We don't see on-prem AD — so for hybrid orgs, surface a warning: "this user is hybrid-synced; disable in on-prem AD first or your change will be reverted on next sync"

**Okta:**
- SCIM `PATCH active=false` via Okta API or `users.deactivate` action
- Sessions die immediately for Okta-fronted apps using session cookies; refresh tokens for OIDC apps live up to refresh-token lifetime (configurable per-app, typically hours-to-days)
- Apps without SCIM: ~57% of SaaS apps (Stitchflow data) — Okta deprovision only kills SSO login; tokens at app level remain
- **OAuth refresh tokens** for OIDC apps: must call `revokeUserTokens` per-app explicitly

**GitHub:**
- `DELETE /orgs/{org}/members/{username}` (organization member removal)
- **Critical gotcha (GitHub docs):** revoking a fine-grained PAT does NOT revoke SSH keys created by the token. Org-owned SAML revocation removes SAML authorization but doesn't delete underlying tokens/keys.
- For SAML SSO orgs: `DELETE /orgs/{org}/credential-authorizations/{credential_id}` per credential — list via `GET /orgs/{org}/credential-authorizations`
- Revoke each PAT on the org explicitly
- Repository forks created during membership: deletion of member does NOT delete forks of private repos already cloned. Out of API scope — flag for human review
- Outside collaborator status on repos: separate API (`DELETE /repos/{owner}/{repo}/collaborators/{username}`) per repo

**Slack:**
- SCIM `DELETE` or `PATCH active=false` (workspace-level removal) OR org-level `admin.users.remove`
- Deactivation signs user out, removes from channels, revokes app tokens — all atomic per Slack docs
- DM history: stays searchable with "deactivated" label per existing retention policy. We do NOT touch retention.
- Single-channel guests: same API path; can be auto-deactivated by guest-expiry config (admin-side, not ours)

### 2.3 Trigger model

Three-state trigger:
1. **Manual approval gate** (default for v6.0) — admin clicks "Run deprovisioning" on the offboarding workflow; system shows a per-IdP preview ("will suspend in Google Workspace; will revoke 3 OAuth grants; will remove from 5 GitHub teams") with a confirm step. Recommended because IdP deprovisioning is high-blast-radius and contractor-ops admins are not all SecOps-trained.
2. **Time-delayed** (Pro tier opt-in) — schedule for end-of-business on offboarding date
3. **Immediate-on-trigger** (Enterprise tier opt-in) — fire immediately on workflow completion

We start with #1 in v6.0. The other two are roadmap, gated by Unleash flag + Stripe tier (defense in depth).

### 2.4 Failure handling per IdP

| IdP | Common failure mode | Our handling |
|---|---|---|
| Google Workspace | Rate limits (429) — Directory API: 240 ops/min/admin | Exponential backoff via QStash retry (existing pattern); per-admin token bucket |
| Google Workspace | OAuth scope insufficient (`https://www.googleapis.com/auth/admin.directory.user`, `https://www.googleapis.com/auth/admin.directory.user.security`) | Pre-flight scope check at "Run deprovisioning" click; surface "missing scope X — re-authorize the connection" |
| Azure AD | Conditional Access conflict | Pre-flight CA enumeration; admin sees "user is in CA-policy 'External-Contractors'; deactivation may be reverted by policy refresh — review policy first" with link to Azure portal |
| Azure AD | Hybrid AD synced user | Hard warning: "synced from on-prem AD; disable there first" — block the action with override |
| Okta | App without SCIM | Mark as "best effort — SCIM unavailable; SSO blocked but app tokens may persist"; emit audit entry; surface as a manual-task in offboarding workflow |
| GitHub | SAML SSO authorization revoked but underlying PAT survives | Multi-step: 1) list authorizations, 2) revoke each, 3) per-PAT explicit revoke. Show as a sub-progress UI |
| GitHub | Outside-collaborator on repos outside the org | Out of scope — surface as manual-task with link |
| Slack | Multiple workspaces under one Enterprise Grid | Per-workspace removal; use `admin.users.remove` per workspace, not org-level (less destructive) |
| Any | Token expired / refresh failed | Retry token refresh once (existing v2.0 token-refresh cron pattern); on failure, surface "reconnect provider X" CTA blocking the deprovision |

### 2.5 Audit-trail schema

Every deprovisioning attempt creates a `DeprovisioningRun` record with `contractor_id`, `triggered_by_user_id`, `mode` (manual/scheduled/immediate), `status` (pending/in_flight/partial/complete/failed). Each per-IdP action is a `DeprovisioningStep` with `provider`, `action_type` (suspend/disable/remove/revoke_token/revoke_session/etc), `status`, `executed_at`, `request_payload_hash`, `response_payload_hash`, `error_message`. All steps emit AuditLog entries.

This is the audit-defense story for SOC2 / ISO27001 contractor-access reviews and is a **direct competitive differentiator** vs. Deel (no equivalent surface).

### 2.6 Tables / Differentiators / Anti-features

#### Table stakes (must have for v1)

| Feature | Why expected | Complexity | Existing-system dependency |
|---|---|---|---|
| Google Workspace user suspension via Directory API | Core IdP for our target customer (PL/UK/DE tech) | M | extends v3.0 GWS adapter; needs OAuth scope upgrade |
| Google Workspace OAuth grant revocation per-grant | Otherwise suspended user retains app access (the Nudge/Torii finding) | M | new — directory.tokens API |
| Slack workspace deactivation | Core for any tech-company customer | S | extends v1.0 Slack OAuth + adds SCIM scope |
| Manual approval gate with per-IdP preview | High-blast-radius action; admin confirmation is non-negotiable | M | new UI + tRPC mutation |
| Per-IdP success/failure status with retry | Network/rate-limit/scope failures must not silently break offboarding | M | uses QStash + existing retry |
| AuditLog entry for every step | Already a platform constraint; required for SOC2 evidence | S | uses existing AuditLog |
| Pre-flight scope/permission check | Don't fire deprovisioning if we lack the scope; tell admin upfront | S | new helper per adapter |
| Offboarding workflow integration — "Run deprovisioning" task | The trigger surface | S | extends existing Workflow engine |
| Reconnect-provider CTA on token failure | Existing pattern from v2.0 health monitoring | S | uses existing IntegrationConnection health flow |

#### Differentiators (vs Deel — they don't deprovision; vs Rippling — they bundle with full IAM)

| Feature | Value | Complexity |
|---|---|---|
| **Per-IdP step-by-step audit trail (request/response hashes, executed_at, error_message)** | SOC2-evidence-ready; competitors give a single "deprovisioned" boolean | M |
| **Pre-flight conflict detection for Entra Conditional Access** | Prevents the most common silent-failure mode in Microsoft shops | M |
| **Hybrid-AD detection with hard warning** | Saves the customer from a deprovision-then-resync embarrassment | S |
| **OAuth grant enumeration UI before deprovision** ("user has 14 OAuth grants — here they are") | Admin sees what's at stake; shadow-IT discovery side-effect | M |
| **Azure AD / Entra ID, Okta, GitHub coverage in addition to Google + Slack** | Most contractor-ops vendors stop at Google. Going broad is the wedge | L (4 adapters × auth flow + revoke API) |
| **Best-effort marking for non-SCIM apps** with explicit manual-task generation | Honest UX vs Rippling's "✓ deprovisioned" lie when SSO ≠ deprovisioning | S |

#### Anti-features (DO NOT build)

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Full SCIM provisioning (create + update + delete)** | "If we deprovision, why not provision?" | Provisioning is full IGA — requires birthright policies, group sync, role recertification. Out-of-scope per PROJECT.md (SSO/SCIM line is "v4+"). Conflates contractor-ops with HRIS — we are NOT an HRIS | Onboarding wizard already imports from connected tools (v3.0); admins create accounts in IdPs manually and we deprovision |
| **Real-time access reviews / access certifications** | SOC2 demand | Out of scope — IGA territory (SailPoint, Saviynt). Audit log of deprovisions is enough | Audit log + report on "active contractors with active integration grants" — that's the report, not a workflow |
| **Auto-detect & deprovision orphaned accounts** ("Mary left 6 months ago and still has Slack access") | Common cleanup ask | Inferring orphan-status without ground-truth (HRIS) leads to false positives = wrongly disabling people = trust-killer | Surface a "contractors marked offboarded but with unrevoked grants" report; admin manually triggers per-row |
| **Delete (vs suspend) by default** | "Cleaner" | Deletion in Google Workspace destroys mailbox; in Azure soft-deletes for 30 days; in Slack deactivates (no true delete). Asymmetric semantics → asymmetric data loss | Suspend always; admin can manually delete after retention window — out of v6 scope |
| **Mailbox auto-forward / vacation responder configuration** | "Their replacement should get their mail" | Privacy issue (forwarding contractor email to org member is GDPR-risky); responder text is org-policy domain | Optional vacation-responder text field on offboarding workflow with explicit admin opt-in; we set responder, no forward |
| **Drive/SharePoint file ownership transfer** | "We need their files" | Massive scope (per-file transfer logic, permission preservation, bulk-move limits). Google's own admin doc treats this as separate manual confirm step | Surface as a manual-task in offboarding ("transfer Drive ownership in Google admin console") with deep link |
| **Slack DM export / archive** | "We need their conversations" | Slack's own retention policy is the source of truth; exporting DMs is Plus-tier-only and creates compliance/privacy issues | Out of scope; rely on Slack's native retention |
| **Password vault / 1Password integration to revoke shared credentials** | "What about the shared bitwarden vault?" | Real concern but a separate domain (PAM/secrets); 1Password / Bitwarden / HashiCorp have native APIs but no consistent contractor-IdP linkage | Surface as a manual-checklist item in offboarding-hardening (Area 4); not an IdP integration |

### 2.7 Modal user journey

**Admin completing offboarding for contractor "Jane Doe":**
1. Workflow run shows "Run deprovisioning" task. Admin clicks Open.
2. System shows per-IdP preview:
   - Google Workspace: ✓ ready — will suspend `jane@acme.com`, revoke 11 OAuth grants, sign out all sessions, vacation responder will be set
   - Slack: ✓ ready — will deactivate `@jane` in 1 workspace
   - GitHub: ⚠ 1 outside-collab repo `acme/legacy-billing` outside org — manual task generated
   - Azure AD: ⚠ user is in CA-policy "External-Contractors-Allow" — review policy before deactivation
3. Admin reviews CA-policy in Azure portal, returns, clicks Confirm
4. System fires QStash jobs per IdP; UI streams status
5. After 90 seconds: 3 of 4 IdPs done; Azure AD shows "session revocation in flight (CAE)"
6. After 5 minutes: all green except the manual GitHub outside-collab task (now an open task on workflow)
7. Audit log shows 11 entries (one per atomic action); DeprovisioningRun record visible in audit-defense report

---

## Area 3 — Gulf Operational Polish

### 3.1 UAE free-zone entity tracking

#### Domain framing

UAE-licensed contractors operate under a **free-zone entity license** (or mainland trade license) that defines the **permitted activity scope**. Working outside that scope without an NOC is a regulatory violation that exposes both the contractor and the engaging company. The 2025 Dubai Law No. 7 introduced a unified contracting framework across mainland + DIFC + free zones with a 1-year regularization window (effective ~Jan 2027) — so this is precisely the right v6 timing.

The platform already has v4.0 country-specific contractor profile fields (freelance permits, trade licenses). v6.0 adds **structured permitted-activity scope + license expiry tracking + scope-mismatch detection**.

#### Which zones matter

Confirmed by zone-comparison sources:
- **DIFC** — financial services + premium professional firms (legal, audit, fintech)
- **DMCC** — commodities + trading credibility (broad activity catalog, premium positioning)
- **IFZA** — cost-effective Dubai setup (popular with small contractors / freelancers)
- **JAFZA** — logistics + industrial (less relevant for tech contractors)
- **Meydan Free Zone** — startup-friendly, low-cost
- **Dubai Internet City / Dubai Media City** — tech / media specialization (highly relevant for our SaaS-customer ICP)

Recommendation: ship with **DIFC, DMCC, IFZA, Dubai Internet City, Dubai Media City, Meydan FZ, JAFZA, Sharjah Media City (SHAMS), RAKEZ, Abu Dhabi Global Market (ADGM)** as a seeded enum (10 zones covers ~95% of typical SaaS-customer contractor base in UAE per RIZ MONA + SetupUAE comparison data). Mainland is the 11th option.

#### Permitted activity tracking

UAE free zones publish activity catalogs (e.g. DMCC has ~600 activities; IFZA ~2,000; DED for mainland ~2,000+). Each license names specific activities. Source-of-truth is the regulator's catalog, not us.

For v6.0 we DON'T ship the full catalog. We ship a **free-text activity description per license** + a **category tag** from a ~20-entry curated list (Software Development, IT Consulting, Trading, Marketing Services, Design Services, Engineering Consultancy, Financial Advisory, etc.). This is enough to power scope-mismatch detection at engagement-classification time.

#### Scope mismatch detection

When a UAE contractor is engaged for work that doesn't match their license category (engagement.workCategory ≠ contractor.licenseCategory), system raises a yellow banner: "This contractor's license is for 'Trading'; engagement is 'Software Development' — NOC may be required from [Free Zone Authority Name]." Does NOT hard-block — this is advisory. Hard-blocking on regulatory interpretation is legal-review territory (DEFERRED per LOCAL-ONLY constraint).

#### License expiry monitoring

Free-zone licenses are typically 1-year with renewal cycle. Track `licenseExpiresAt` on contractor profile (already a v4.0 field — extend with `freeZoneAuthority`, `licenseCategory`, `permittedActivitiesText`). Hooks into the Area 1 reminder cascade — reuse, don't rebuild.

#### NOC tracking

When scope-mismatch flag fires AND admin acknowledges, system creates a "NOC required" document in the contractor's required-doc checklist (Area 1) with criticality CRITICAL. Contractor uploads NOC; lifecycle engine handles expiry.

### 3.2 Saudization (Nitaqat) workforce composition dashboard

#### Domain framing

Saudization (Nitaqat) is the KSA workforce-composition compliance regime. Companies are classified into 5-6 bands: **Platinum, High Green, Mid Green, Low Green, Yellow, Red** based on Saudi-national headcount % of total workforce, varying by sector × company-size. Bands have direct operational consequences (visa block, Iqama renewal block at Yellow/Red).

Our customer is a SaaS company with 10–200 employees engaging 5–50 B2B contractors. **The Saudization picture they actually need is for THEIR KSA entity** (if they have one), not for us as a platform. We're a data-aggregation + visualization layer over their Qiwa-entity reality.

**Critical 2026 update:** Effective 2026-04-15, **Saudi employees are only counted toward Saudization if their employment contract is electronically authenticated via Qiwa** (Qiwa contract documentation = Saudization credit). This means we need a `qiwaContractAuthenticated: boolean` field on KSA-national engagement records and clear surfacing — without it, the contractor doesn't count even if employed.

#### What counts toward Saudi headcount

Per HCM Global, Centuro, Qureos, and Setup-in-Saudi 2026 sources:
- Saudi nationals employed full-time + Qiwa-authenticated → 1.0 weighting
- GCC nationals (UAE, Bahrain, Kuwait, Oman, Qatar) → typically counted as Saudi (1.0) — confirmed by multiple sources, but with sector-specific exceptions
- Half-Saudi (children of Saudi mothers) → 0.5 weighting in some sectors
- Female Saudi nationals → 1.5–2.0× in some sectors as part of Vision 2030 incentives (sector-dependent)
- Disabled Saudi nationals → up to 4× weighting (Mowaamah program)
- Expats with PR (Premium Residency / Iqama Distinguished) → NOT counted as Saudi
- Dependents of expats → NOT counted

The exact weighting matrix is **sector × subsector × headcount-tier**, published by HRSD and updated quarterly. We do NOT replicate the matrix in code (legal review territory + change frequency). We surface **the inputs** (headcount by nationality + by Qiwa-auth status) and **link to the customer's Qiwa portal for the authoritative band**.

#### Dashboard specification

For a 10–200-employee tech company with a KSA entity, the Saudization dashboard surfaces:
1. **Total KSA-engagement headcount** (employees + B2B contractors with KSA tax-residency)
2. **Nationality breakdown** — Saudi / GCC / Other-expat with counts and %
3. **Qiwa-auth coverage among Saudi nationals** — X of Y Qiwa-authenticated; warns about anyone not authenticated
4. **Self-reported band** (admin enters from Qiwa portal — we don't compute) + last-updated timestamp + reminder-to-refresh cadence
5. **Headcount trajectory chart** (Saudi % over last 12 months) — surfaces band-pressure trend
6. **Iqama / work-permit expiry roll-up** — reused from Area 1 lifecycle engine; shows Iqama renewals due in 30/60/90 days because Iqama lapse drops the expat from headcount → Saudi-% mechanically rises (band can move favorably) but operationally it's a problem
7. **Pre-deprovisioning impact** — when admin offboards a Saudi national, banner: "Offboarding this contractor reduces Saudi % from 32.5% to 31.2% (your last-recorded band: Mid Green)" — admin operational context, not a block

#### Anti-features here

- **Auto-compute the band** — legal-review territory + matrix changes quarterly. Stale code = wrong advice = customer audit failure
- **Build the Qiwa contract authentication flow** — that's a regulator-API integration, separate from our scope; surface a manual checklist item
- **Recommend hiring Saudis** — not our place
- **Auto-track GCC-national edge cases** beyond a binary flag — too many sub-rules

### 3.3 Tables / Differentiators / Anti-features (combined)

#### Table stakes

| Feature | Why expected | Complexity | Dependency |
|---|---|---|---|
| UAE free-zone enum (10-zone seed: DIFC, DMCC, IFZA, Dubai Internet City, Dubai Media City, Meydan, JAFZA, SHAMS, RAKEZ, ADGM, + Mainland) on contractor profile | Without it, we can't differentiate scope/expiry | S | extends v4.0 contractor fields |
| `licenseCategory` enum (~20 categories) on contractor profile | Powers scope-mismatch detection | S | new enum |
| `licenseExpiresAt` + `permittedActivitiesText` on contractor profile | Lifecycle hooks need the date | S | extends v4.0 |
| Free-zone license expiry hooks into reminder cascade | Reuse | S | depends on Area 1 |
| Scope-mismatch advisory banner on engagement create | Real-world UAE risk | M | new logic |
| NOC required-doc auto-add when scope-mismatch acknowledged | Closes the loop | M | depends on Area 1 |
| KSA contractor: Saudi national / GCC / expat selector | Required for Saudization dashboard | S | new field |
| `qiwaContractAuthenticated` boolean on KSA-national engagement | 2026-04-15 reg requirement | S | new field |
| Saudization dashboard (5 widgets above) | Customer must surface band-pressure | M | new page |
| Manual self-reported band entry with cadence reminder | We don't compute — they do | S | new field + reminder |
| Iqama / work permit expiry roll-up reused from Area 1 | Reuse | S | depends on Area 1 |
| Pre-offboarding impact banner on Saudi-national offboarding | Operational context | S | wires into existing offboarding workflow |
| Arabic-localized labels on Saudization + UAE surfaces | We're already RTL/AR per v4.0 | S | uses existing i18n |

#### Differentiators

| Feature | Value vs Deel/Remote | Complexity |
|---|---|---|
| **Free-zone-specific NOC requirement detection** (scope mismatch → NOC doc auto-required) | Deel/Remote treat UAE as monolithic; we surface zone-specific reality | M |
| **Saudization-band trajectory chart** with offboarding-impact preview | Most platforms show static %; we show the trend + decision support | M |
| **Qiwa-auth coverage gap surfacing** (the 2026-04-15 reg) | Brand-new requirement; first-mover advantage if we ship within 2026 | S |
| **License-expiry → reminder-cascade integration** (no separate UAE-specific reminder system) | Architectural elegance — one expiry pipeline | S |
| **AR-localized + RTL Saudization dashboard** | KSA admins want this; competitors typically English-only | S — we have the i18n framework |

#### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Full UAE free-zone activity catalog** (DMCC ~600, IFZA ~2,000) | "Be precise" | Catalogs change by regulator, no public stable API, maintenance burden | Free-text + curated 20-entry category enum; advisory only |
| **Auto-compute Saudization band** | "Why doesn't it just tell me?" | Sector × subsector × headcount-tier matrix changes quarterly; legal liability | Surface inputs; admin enters band from Qiwa |
| **Qiwa portal direct integration for contract authentication** | "Automate it!" | Government API, certificate auth, separate domain — same risk profile as KSeF (which itself is v2/v4 work) | Manual checklist item with link to Qiwa |
| **Auto-issue NOC-application drafts** | "Help us with the paperwork" | Legal authoring → out-of-scope per LOCAL-ONLY posture | Document template + checklist + link to free-zone authority portal |
| **Saudization compliance score / gamified band-progression UI** | Nice marketing | Trivializes a real compliance risk; cross-cultural UX risk | Plain numbers + trend chart |
| **DIFC / ADGM-specific common-law contract template generator** | "We operate under English law" | Legal authoring; DIFC + ADGM are common-law islands within civil-law UAE — non-trivial nuances | Out of v6 — link to existing v5.0 contract repository for customer-uploaded templates |

### 3.4 Modal user journey

**Admin engaging a UAE-based DMCC contractor for software development work:**
1. Adds contractor with country=UAE, freeZoneAuthority=DMCC, licenseCategory=Trading, permittedActivitiesText="General Trading", licenseExpiresAt=2026-09-30
2. Creates engagement with workCategory=Software Development
3. System raises advisory: "Contractor's DMCC license is 'Trading'; engagement category is 'Software Development'. NOC from DMCC may be required. [Acknowledge & require NOC] [Edit license category] [Dismiss]"
4. Admin clicks "Acknowledge & require NOC" → NOC doc added to contractor's required-doc checklist as CRITICAL
5. Contractor receives portal email; uploads NOC PDF; expiry tracked
6. T-90 days before license expiry (2026-09-30): contractor + admin reminder cascade fires (reusing Area 1 engine)

**KSA-entity admin checking Saudization status (Sunday morning routine):**
1. Opens Saudization dashboard
2. Sees: 47 total headcount, 16 Saudi nationals (34%), last self-reported band: Mid Green (entered 2026-03-01, "refresh due in 4 days")
3. Trajectory chart: Saudi % was 36% in Jan, 34% in Apr — slight downtrend
4. Qiwa-auth gap: 2 of 16 Saudi-national contractors do NOT have Qiwa-authenticated contracts → red row, link to Qiwa portal
5. Iqama expiry roll-up: 3 expat Iqamas due in next 60 days
6. Offboarding queue: shows 1 Saudi-national contractor on offboarding workflow — banner: "Completing this offboarding moves Saudi % from 34.0% to 31.9% — verify your band can absorb"

---

## Area 4 — Offboarding Hardening

### 4.1 Domain framing

Existing platform (v1.0) has an offboarding workflow template + workflow engine. v6.0 hardens it with:
1. **Knowledge transfer checklist templates per role type**
2. **IP assignment verification workflow** that BLOCKS offboarding completion
3. **Documentation handover task with credential links**
4. **Contract clause health check** flagging contracts missing IP-assignment language

This is a maturity layer on existing infrastructure — workflow engine exists, blocking logic mostly exists. v6.0 adds the templates, the IP-assignment verification, the credential capture surface, and the contract-clause scanner.

### 4.2 Knowledge transfer best-practice templates

Per Enboarder, 360Learning, FutureCode, Multishoring, and Cal Poly's own offboarding template (Apr 2026 sources): high-functioning teams use a **role-typed handover template** combining:

1. **Architecture overview** — system diagrams, "what exists, why decisions were made, what's in flight"
2. **Repository inventory** — repos owned/contributed-to, active branches, branching conventions, CI ownership
3. **Runbooks** — one per recurring operational task (deploy, on-call, incident response)
4. **Active work-in-flight log** — branches not merged, half-done features, technical debt the contractor knows about
5. **Stakeholder map** — internal + external contacts the contractor "owns" (e.g. "Joe at Stripe handles our billing escalations")
6. **Tribal knowledge** — undocumented conventions, "we did X for reason Y", things that bit them
7. **Paired walk-through session(s)** — recorded video for async review later
8. **Exit interview** — separate from KT, captures process improvements

For v6.0 we ship 4 role-typed seed templates:
- **Software Engineer** — repos, runbooks, active branches, paired walkthrough, architecture doc
- **Designer** — Figma file ownership transfer, design system contributions, asset library, brand guidelines
- **Project Manager** — stakeholder map, in-flight projects, vendor contacts, recurring meetings, tooling ownership
- **Generic Consultant** — deliverables list, stakeholder map, exit interview

Each template instantiates as workflow tasks via the existing template builder. New: structured fields per task type (e.g. KT-Repo task has `repository_url`, `current_branches`, `successor_user_id`).

### 4.3 IP assignment verification workflow

The legal pattern (UK Cooley GO + Sprintlaw + Fox Williams; DE comp-lex + IT-Recht-Kanzlei + Kraus-Ghendler; US Cooley):

**UK consultancy agreement:** standard clause "Consultant hereby irrevocably assigns to Client all right, title and interest worldwide…" (mid-clause example from BizTech Lawyers / Cooley). Without the clause, contractor RETAINS IP per default UK contractor law — opposite of employee default.

**DE Werkvertrag / freier Mitarbeiter Vertrag:** Schöpferprinzip (§7 UrhG) — Urheberrecht (moral right) **cannot be transferred**. Only Nutzungsrechte (exploitation rights) are transferable, and the standard clause is "ausschließliches, unwiderrufliches, unbefristetes, übertragbares und in jeder Hinsicht unbeschränktes Verwertungs- und Nutzungsrecht für alle bekannten und noch unbekannten Verwertungs- und Nutzungsarten" (per Kraus-Ghendler / IHDE / it-recht-kanzlei standard wording). Critical for German engagements — boilerplate UK assignment language is INSUFFICIENT and possibly invalid in DE.

**US 1099 IC agreement:** "work for hire" clauses are ONLY valid for narrow categories of works under 17 USC §101 (commissioned works in 9 specific categories — software is NOT one of them). Practical result: independent assignment language required even in "work for hire" agreements.

**KSA / UAE service agreements:** civil-law jurisdictions; explicit assignment required; common-law-style "work for hire" insufficient. ADGM + DIFC are common-law islands but operate within UAE civil-law context for cross-border IP.

#### IP assignment verification flow

On offboarding workflow start, system performs a **contract clause health check** — a regex-based scan of the contract text (or the structured contract metadata if uploaded as a structured template) for IP-assignment language tagged per jurisdiction. Three outcomes:

1. **Pass** — assignment clause detected with high confidence + jurisdiction match → green check, IP-verification task auto-completes
2. **Warn** — clause detected but jurisdiction may be wrong (e.g. UK boilerplate in a DE Werkvertrag) → yellow, requires legal-review task
3. **Fail** — no assignment clause detected → red, requires explicit per-deliverable IP-assignment ratification before offboarding can complete

In Fail-mode, system generates an **IP Assignment Ratification document** for contractor signature via existing v2.0 e-sign integration (DocuSign/Autenti), listing all deliverables created during engagement. Cannot complete offboarding workflow until signed.

**Hard-block on offboarding completion** — separate Unleash flag from payment block.

### 4.4 Documentation handover task with credential links

Categories of credentials the platform must capture (per ShiftControl + FutureCode + 360Learning checklists):

1. **Cloud provider accounts** — AWS IAM users, GCP service accounts, Azure subscriptions
2. **SaaS app logins** — listed by integration (we already know about Slack, Google Workspace, Jira, Linear, Notion, Confluence, Calendar, etc.)
3. **API keys** — Stripe, SendGrid, Twilio, Anthropic, OpenAI, etc.
4. **Signing keys** — code signing, package signing (npm, PyPI, etc.)
5. **SSH keys** — repo access, server access (GitHub already covered in Area 2; raw server access is separate)
6. **Doc-store admin** — Notion workspace, Confluence space, Google Drive folder ownership
7. **DNS / domain registrar** — high-blast-radius
8. **Payment processor accounts** — Stripe Connect identities, bank-portal logins
9. **Vendor account ownership** — "Jane was the Stripe admin"

For each, a structured task with: credential name, system, current-owner-username, successor-user-id (must be assigned), rotation-required boolean (default true for shared secrets), rotation-completed-at timestamp, notes.

**The platform does NOT store the credentials themselves.** It tracks the WORKFLOW STATE of the rotation/transfer. Storing secrets is PAM territory (1Password, HashiCorp Vault, Bitwarden) and out of scope.

This is the one thing competitors get wrong — Deel/Remote/Rippling have generic "return equipment" boxes but no structured credential-rotation surface.

### 4.5 Contract clause health check

A scheduled scan + on-demand scan that examines all active contracts for missing IP-assignment language. Surfaces:
- **At onboarding** — if contract uploaded without assignment clause, warning banner during contract creation
- **Bulk audit** — admin can run "Audit all contracts for IP assignment" → table of contracts missing the clause, grouped by jurisdiction with appropriate clause template suggestion
- **At offboarding** — last-line defense as in 4.3

Implementation: regex per jurisdiction, with embedding-similarity fallback for edge cases (using existing Claude integration). Confidence score surfaces; any low-confidence triggers manual review.

### 4.6 Tables / Differentiators / Anti-features

#### Table stakes

| Feature | Why expected | Complexity | Dependency |
|---|---|---|---|
| 4 role-typed offboarding workflow seed templates | Workflow templates already exist — just seed | S | uses existing workflow templates |
| Structured KT task types (KT-Repo, KT-Runbook, KT-Stakeholder, KT-Pairing) | Generic tasks too freeform | M | extends workflow task model |
| IP-assignment verification task with e-sign integration | Core legal hygiene | M | uses existing v2.0 e-sign |
| Hard-block on offboarding-complete when IP not verified | Legal must-have | S | extends workflow state machine |
| Contract clause regex scan per jurisdiction (UK, DE, PL, KSA, UAE, US) | Foundation | M | new |
| At-onboarding warning when contract missing assignment language | Catch it before it matters | S | extends contract create flow |
| Bulk "audit contracts" admin action | Existing fleet has uncovered contracts | S | new admin action |
| Structured credential-rotation task | Differentiator vs equipment-return-only competitors | M | extends workflow tasks |
| Successor-user-id required field on credential tasks | "Where does this go?" is non-negotiable | S | new field |
| Audit log entry on every IP-verification + credential-rotation task completion | SOC2 evidence | S | uses existing AuditLog |

#### Differentiators

| Feature | Value | Complexity |
|---|---|---|
| **Jurisdiction-aware contract clause scanner** (UK boilerplate flagged in DE Werkvertrag) | No competitor does jurisdiction-typed legal-clause scanning | M |
| **Structured credential-rotation tracking with successor assignment** | Closes the "freelancer-credentials-outlive-engagement" gap (Multishoring finding) | M |
| **e-Sign-backed IP ratification document for low-coverage cases** | Makes failure recoverable, not blocking | M — uses existing e-sign |
| **Pre-offboarding contract-coverage audit at engagement-start time** | Prevents the offboarding-time surprise | S |
| **Werkvertrag-specific clause detection** (Urheberrecht vs Nutzungsrechte distinction) | German market wedge — no competitor knows the Schöpferprinzip nuance | M |
| **Role-typed KT templates with structured fields** (repo URL, branch list, successor user) | Vs. generic checkbox lists | M |

#### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Store credentials in our system** | "Help me track passwords" | PAM/secrets domain; massive security/compliance burden (encryption-at-rest with HSM, audit, secret rotation) | Track rotation WORKFLOW state; secrets live in 1Password/Vault — link out only |
| **Auto-rotate API keys** for connected providers | "Automate the rotation" | Provider-specific APIs, partial coverage (most providers don't have rotation APIs), high blast radius if wrong | Manual rotation tasks with completion tracking |
| **Auto-generate IP assignment language for contract templates** | "Suggest the clause" | Legal authoring → DEFERRED per LOCAL-ONLY posture; jurisdiction-specific drafting is lawyer work | Reference standard clause templates as static read-only reference; "consult your lawyer" framing |
| **Block offboarding on KT incompleteness** | "Force the handover" | KT is qualitative; binary completion forces shallow box-ticking; real KT happens in pairing sessions and runbooks, not checklists | Soft warning + manager-acknowledgment task before complete; do NOT hard-block |
| **AI-generated KT documentation from chat / git history** | Demos great | Data-leak / privacy risk; access to full chat + git history is a massive perm escalation; output quality depends on input we don't have | Out — surface a "draft your runbook" task with link to existing Notion/Confluence integration |
| **Forced exit interview survey** | "We want feedback" | Forcing it makes it dishonest; not a v6 platform-hardening priority | Optional task in template; export to CSV — admin's responsibility |
| **Block offboarding on equipment-return** | "Can't lose laptops" | Equipment is tracked in v3.0 already with shipment integration; blocking on courier in-flight creates support tickets | Existing equipment workflow already handles; no new block |
| **Real-time KT-progress public dashboard** | "Pressure them to complete" | Toxic UX — exit-process is sensitive | Private to manager + offboarder only |

### 4.7 Modal user journey

**Manager triggering offboarding for senior backend engineer Marcus:**
1. Click "Start offboarding" on Marcus's profile
2. System asks role-type: pre-fills Software Engineer template
3. Workflow runs auto-creates 18 tasks across 5 categories (KT, IP, credentials, IdP deprov, equipment)
4. **Contract clause health check** runs immediately — Marcus's contract has UK boilerplate but jurisdiction is DE → Warn (yellow) → "Legal review required" task added
5. Manager works through KT tasks; pairs with Marcus on 3 runbooks; records 2 video walkthroughs (linked, not stored by us)
6. Credential-rotation tasks: 7 rotations, each requires successor assignment + rotation-completed checkbox; Marcus completes the "current owner" side, manager confirms successor
7. **IP verification task:** Marcus signs an IP Assignment Ratification document via Autenti (DE jurisdiction triggers Autenti default) — captures all deliverables created during 14-month engagement, transfers Nutzungsrechte explicitly
8. **IdP deprovisioning task** (Area 2) runs after manager confirms — see Area 2 journey
9. **Equipment return task** — InPost shipment created (v3.0), waits for courier delivery confirmation
10. **Offboarding-complete button is DISABLED** until: IP verified ✓, all credential rotations completed ✓, equipment received OR explicitly waived ✓
11. Once enabled, manager clicks Complete — workflow run closes; AuditLog records completion; Marcus's portal access continues for 30 days for tax-doc retrieval (existing v2.0 portal feature)

---

## Cross-Area Feature Dependencies

```
[Existing v1-v5 platform]
├── Workflow engine + templates   ──used-by──> [All 4 v6 areas]
├── Notification dispatch          ──used-by──> [Area 1 reminder cascade]
├── Document mgmt + R2 + virus     ──used-by──> [Area 1 uploads]
├── Audit log                      ──used-by──> [All 4 v6 areas]
├── Approval engine                ──used-by──> [Area 1 admin overrides]
├── Payment run state machine      ──used-by──> [Area 1 hard-block]
├── e-Sign (DocuSign + Autenti)    ──used-by──> [Area 4 IP ratification]
├── Equipment + courier            ──used-by──> [Area 4 offboarding]
├── Contractor portal              ──used-by──> [Area 1 self-service uploads]
├── Unleash feature flags          ──used-by──> [All 4 v6 areas — phase rollback]
├── Stripe tier gating             ──used-by──> [Areas 2 + 4 advanced features]
├── i18n (EN/PL/DE/AR)             ──used-by──> [All 4 v6 areas]
├── Integration framework          ──used-by──> [Area 2 IdP adapters]
├── GWS adapter (v3.0)             ──extended-by──> [Area 2 deprov scopes]
├── Slack OAuth (v1.0)             ──extended-by──> [Area 2 SCIM]
├── DRV-Statusfeststellung (v5.0)  ──used-by──> [Area 1 DE doc lifecycle]
├── SDS doc (v5.0)                 ──used-by──> [Area 1 UK doc lifecycle]
└── Compliance health card (v1.0)  ──extended-by──> [Area 1 dashboard]

[Area 1: Compliance Lifecycle]
├── Document policy registry       ──required-by──> [Area 3 NOC tracking]
├── Reminder cascade engine        ──used-by──> [Area 3 license expiry, Iqama expiry]
└── Hard-block on payment          ──parallel-with──> [Area 4 hard-block on offboarding]

[Area 2: IdP Deprovisioning]
├── Per-IdP adapter expansion      ──independent──>
└── Manual approval gate UI        ──depends-on──> [Existing workflow + e-sign UX patterns]

[Area 3: Gulf Polish]
├── Free-zone enum + license mgmt  ──depends-on──> [Area 1 lifecycle for expiry]
├── Saudization dashboard          ──depends-on──> [Area 1 Iqama expiry roll-up]
└── Pre-offboarding impact banner  ──depends-on──> [Area 4 offboarding workflow]

[Area 4: Offboarding Hardening]
├── KT templates                   ──depends-on──> [Existing workflow templates]
├── IP-assignment verification     ──depends-on──> [e-Sign integration]
├── Contract clause scanner        ──independent──>
└── Credential rotation tracker    ──parallel-with──> [Area 2 IdP deprov]
```

### Phase ordering (recommendation)

Phases for v6.0 should be ordered:

1. **Foundation: Document Policy Registry + Lifecycle Engine** (Area 1 core) — unlocks Area 3 reuse
2. **Reminder Cascade + Self-Service Portal Surface** (Area 1 UX)
3. **Payment Hard-Block + Compliance Dashboard** (Area 1 enforcement)
4. **IdP Deprovisioning Foundation: GWS + Slack** (Area 2 — narrowest scope, highest customer overlap)
5. **IdP Deprovisioning Expansion: Entra ID + Okta + GitHub** (Area 2)
6. **UAE Free-Zone Tracking + NOC Workflow** (Area 3 — depends on Area 1)
7. **Saudization Dashboard** (Area 3 — depends on Area 1 Iqama expiry)
8. **Offboarding Hardening: KT Templates + Credential Rotation** (Area 4 — independent)
9. **Offboarding Hardening: IP Verification + Clause Scanner** (Area 4)

Rationale: Area 1 underpins Area 3; Areas 2 and 4 are largely independent and can run in parallel; Area 4 depends on existing e-sign and workflow infrastructure — already mature in v2.0.

---

## MVP Definition (within v6.0 itself)

### Launch with v6.0 (the milestone)

**Area 1 — Compliance Document Lifecycle (P1):**
- [ ] Document policy registry (PL/UK/DE/UAE/SA seed)
- [ ] `expiresAt` + `policyEntryId` on Document model
- [ ] 90/60/30/15/7-day reminder cascade
- [ ] Hard-block on payment-run for EXPIRED CRITICAL
- [ ] Contractor self-service upload from portal
- [ ] Admin compliance dashboard (at-risk count + renewals + blocked-payments queue)
- [ ] Manual override (admin-only, audited)

**Area 2 — IdP Deprovisioning (P1):**
- [ ] Google Workspace suspend + OAuth grant revoke + sign-out
- [ ] Slack workspace deactivation
- [ ] Manual approval gate with per-IdP preview
- [ ] Per-step audit trail
- [ ] Pre-flight scope check
- [ ] Reconnect-provider CTA on token failure

**Area 2 expansion (P2 — same milestone):**
- [ ] Azure AD / Entra ID disable + revoke sessions + CAE handling
- [ ] Okta deactivation + per-app token revoke
- [ ] GitHub member removal + per-PAT revoke + SAML credential revoke

**Area 3 — Gulf Polish (P1):**
- [ ] UAE free-zone enum + licenseCategory + permittedActivitiesText + licenseExpiresAt
- [ ] Scope-mismatch advisory + NOC required-doc auto-add
- [ ] Saudization dashboard (5 widgets) — manual band entry, no auto-compute
- [ ] Qiwa-auth coverage gap surfacing
- [ ] Pre-offboarding impact banner for Saudi nationals

**Area 4 — Offboarding Hardening (P1):**
- [ ] 4 role-typed KT templates (Software Engineer, Designer, PM, Generic Consultant)
- [ ] IP-assignment verification task with e-sign-backed ratification
- [ ] Hard-block on offboarding-complete for unverified IP
- [ ] Contract clause regex scanner (UK + DE + PL + KSA + UAE + US)
- [ ] At-onboarding warning + bulk-audit admin action
- [ ] Structured credential-rotation tasks with successor assignment

### Defer to v6.x or v7

- Time-delayed and immediate-on-trigger IdP deprovisioning modes (gated behind tier — currently always manual-approval)
- AR-translation completeness pass for new v6 surfaces
- Vacation-responder configuration on Google Workspace deprov
- Additional IdP adapters (1Password SaaS Manager, Jamf for device, JumpCloud)
- Free-zone-specific NOC application drafting
- Saudization band auto-compute (legal-review territory — likely never)
- Embedding-similarity contract-clause matching (regex first; AI fallback only if regex precision insufficient)
- Department / cost-center based per-doc-policy overrides

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Document policy registry + reminder cascade | HIGH (universal) | MEDIUM | P1 |
| Payment hard-block on EXPIRED CRITICAL | HIGH (the wedge) | MEDIUM | P1 |
| Compliance dashboard | HIGH (operational) | MEDIUM | P1 |
| GWS + Slack deprovisioning | HIGH (universal in tech) | MEDIUM | P1 |
| Per-step audit trail for deprov | HIGH (SOC2) | LOW | P1 |
| Entra ID + Okta + GitHub deprov | HIGH (broad coverage = wedge) | HIGH | P1/P2 |
| UAE free-zone enum + license tracking | HIGH (UAE customer-base) | LOW | P1 |
| NOC scope-mismatch detection | HIGH (UAE legal risk) | MEDIUM | P1 |
| Saudization dashboard | HIGH (KSA customer-base) | MEDIUM | P1 |
| Qiwa-auth coverage gap | HIGH (2026-04-15 reg) | LOW | P1 |
| Role-typed KT templates | MEDIUM (operational hygiene) | LOW | P1 |
| IP-assignment verification + hard-block | HIGH (legal hygiene) | MEDIUM | P1 |
| Contract clause scanner | HIGH (audit defense) | MEDIUM | P1 |
| Structured credential-rotation tasks | HIGH (real differentiator) | MEDIUM | P1 |
| Werkvertrag-specific Schöpferprinzip clause detection | MEDIUM (DE-only) | LOW (regex addition) | P1 |
| Coverage-matrix per jurisdiction | MEDIUM | LOW | P2 |
| Pre-offboarding Saudization impact preview | MEDIUM | LOW | P2 |
| Time-delayed IdP deprovisioning | LOW (v6.0 manual is enough) | LOW | P3 |
| AI fallback on contract clause scanner | LOW (regex first) | MEDIUM | P3 |

---

## Competitor Feature Analysis

| Feature | Deel | Rippling | Worksuite | Our Approach |
|---|---|---|---|---|
| Document expiry notifications | Reportedly DOES NOT notify on ID expiry (public review) | Flags compliance issues holistically | Automated renewal reminders | 90/60/30/15/7-day cascade, jurisdiction-typed, with payment hard-block |
| Hard-block on missing docs | Soft warn at onboarding only | Holistic payroll block | Reminder-based | Per-invoice payment-run exclusion with structured reason |
| GWS deprovisioning | Not advertised | Yes (full IGA via Rippling Identity) | No | Yes (focused on contractor offboarding only — not full IGA) |
| Entra / Okta / GitHub deprovisioning | No | Yes (their Identity product) | No | Yes — narrow scope (deprovision only, no provisioning) |
| OAuth-grant revocation post-suspend | Unclear | Yes (Rippling Identity) | No | Yes — explicit, surfaced in preview UI |
| UAE free-zone NOC tracking | Generic UAE EOR coverage | Not advertised | Localized contracts | Zone-specific enum + scope-mismatch detection |
| Saudization dashboard | KSA EOR coverage | Not | Generic 180-country | KSA-specific 5-widget dashboard with Qiwa-auth gap |
| IP-assignment verification | Boilerplate templates | Not | Localized contracts | Jurisdiction-aware contract scanner + e-sign ratification |
| Werkvertrag-specific IP wording | EOR uses standard templates | Not | Localized templates | Schöpferprinzip-aware regex + Nutzungsrechte distinction |
| Credential rotation workflow | Equipment return only | Yes (Rippling Identity) | No | Structured rotation-state tracking; secrets stay in PAM |
| Knowledge transfer templates | Generic | Generic | Generic | 4 role-typed seed templates with structured fields |
| Audit log for offboarding actions | Yes (high-level) | Yes | Yes | Per-step request/response-hash level (SOC2-grade) |

**Positioning:** v6.0 is "Rippling-Identity-quality deprovisioning + Worksuite-quality compliance reminders, but specifically for B2B contractor ops in PL/UK/DE/UAE/SA, without the full HRIS/IGA bundling that prices those competitors out of the 10-200-employee tech-company segment."

---

## Sources

**Compliance Document Lifecycle:**
- [GOV.UK — Right to Work Share Code](https://www.gov.uk/prove-right-to-work/get-a-share-code-online) (HIGH)
- [Right to Work Checks: Complete Employer Guide 2026 — VettingHub](https://vettinghub.co.uk/post/right-to-work-checks-employer-compliance-guide-2026) (MEDIUM — secondary commentary on Border Security Act 2025)
- [Bundesportal — A1 certificate](https://verwaltung.bund.de/leistungsverzeichnis/en/leistung/99107062012000) (HIGH)
- [premote — A1 certification 24-month max](https://www.premote.de/en/wiki/a1-bescheinigung-zusammenfassung) (MEDIUM)
- [W&W Personaleinsatz — Bescheinigungen / §48b EStG](https://daily-naturals.com/en/bescheinigungen/) (MEDIUM)
- [Stripe — Tax clearance certificates in Germany](https://stripe.com/resources/more/tax-clearance-certificate-germany) (MEDIUM)
- [ZUS — A1 Certificate authenticity confirmation](https://lang.zus.pl/about-zus/a1-certificate-authenticity-confirmation-service) (HIGH)
- [InPL Group — A1 ZUS overview](https://inpl.eu/en/certificate-a1-zus---what-does-it-mean) (MEDIUM)
- [Worksuite — Independent Contractor Compliance](https://worksuite.com/platform/compliance) (MEDIUM)
- [Worksuite — Global Contractor Compliance 2025: 10 Legal Risks](https://worksuite.com/resources/insights/global-contractor-compliance-2025-legal-risks) (MEDIUM)
- [Deel vs Rippling — Thrivea comparison](https://thrivea.com/blog/deel-vs-rippling/) (LOW — secondary)

**IdP Deprovisioning:**
- [Google — OAuth 2.0 token revocation upon password change](https://support.google.com/a/answer/6328616?hl=en) (HIGH)
- [Google Cloud Blog — Increased account security via OAuth 2.0 token revocation](https://cloud.google.com/blog/products/application-development/increased-account-security-via-oauth-2-0-token-revocation) (HIGH)
- [Nudge Security — OAuth Risks After Suspending Google Workspace Users](https://www.nudgesecurity.com/post/oauth-grants-the-hanging-chads-of-suspended-google-workspace-users) (HIGH)
- [Torii — Google Workspace Deactivation: SaaS Licenses 2026](https://www.toriihq.com/articles/google-workspace-deactivation-saas-licenses) (MEDIUM)
- [Microsoft Learn — Revoke user access in an emergency in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access) (HIGH)
- [Topedia — Microsoft Entra: Revoke sessions invalidates all sessions (Mar 2026)](https://blog-en.topedia.com/2026/03/microsoft-entra-revoke-sessions-now-invalidates-all-user-sessions/) (MEDIUM)
- [office365itpros — Entra ID Rationalizes Revoke Sessions (Jan 2026)](https://office365itpros.com/2026/01/09/revoke-sessions-button/) (MEDIUM)
- [Okta Developer — Understanding SCIM](https://developer.okta.com/docs/concepts/scim/) (HIGH)
- [Stitchflow — Okta SSO Works. Provisioning Doesn't (98.8% of apps)](https://www.stitchflow.com/blog/okta-sso-vs-provisioning) (MEDIUM)
- [GitHub Docs — Reviewing and revoking PATs in your organization](https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/reviewing-and-revoking-personal-access-tokens-in-your-organization) (HIGH)
- [Slack — Deactivate a member's account](https://slack.com/help/articles/204475027-Deactivate-a-members-account) (HIGH)
- [Torii — 3 Ways to Deprovision Users from Slack 2026](https://www.toriihq.com/articles/slack-user-removal) (MEDIUM)
- [ShiftControl — Offboarding Employees in Google Workspace](https://shiftcontrol.io/learn/offboarding-employees-google-workspace) (MEDIUM)

**UAE Free Zone:**
- [Henry Club — DMCC vs IFZA vs JAFZA 2026](https://henryclub.ae/business-setup/free-zones/free-zones-comparison/) (MEDIUM)
- [SetupUAE — DMCC vs IFZA vs Shams 2026](https://setupuae.ai/blog/dmcc-vs-ifza-vs-shams-2026) (MEDIUM)
- [RIZ MONA Consultancy — List of Free Zones in UAE 2026](https://www.rizmona.com/blog/list-of-free-zones-in-uae/) (MEDIUM)
- [u.ae — Verify business licences (UAE government portal)](https://u.ae/en/information-and-services/business/important-digital-services/inquire-about-licences-names-and-activities) (HIGH)
- [Kayrouz & Associates — DIFC Business Setup 2026](https://www.kayrouzandassociates.com/insights/difc-business-setup) (MEDIUM)
- [Audit Firms Dubai — Add Activities to Trade License UAE 2026](https://auditfirmsdubai.ae/en/resources/blog/add-activities-trade-license-uae) (MEDIUM)
- [Virtuzone — NOC Meaning UAE](https://virtuzone.com/blog/noc-meaning/) (MEDIUM)
- [Meydan FZ — No Objection Certificate Dubai](https://www.meydanfz.ae/blog/no-objection-certificate-dubai) (MEDIUM)
- [Shuraa — NOC UAE 2026](https://www.shuraa.com/no-objection-certificate-uae-noc-meaning-and-benefits/) (MEDIUM)

**Saudization:**
- [HCM Global — Navigating the New Nitaqat Phase (Apr 2026)](https://hcmglobalgroup.com/is-your-business-ready-navigating-the-new-nitaqat-phase-april-2026/) (MEDIUM)
- [Visasupdate — Saudi Arabia Tightens Nitaqat Rules: Qiwa Documentation Mandatory](https://www.visasupdate.com/post/saudi-arabia-tightens-nitaqat-rules-qiwa-contract-documentation-mandatory) (HIGH)
- [Saudi Gazette — Saudi Arabia updates Nitaqat Saudization calculation through Qiwa](https://saudigazette.com.sa/article/659791/saudi-arabia/saudi-arabia-updates-nitaqat-saudization-calculation-through-qiwa-contracts) (HIGH)
- [Qureos — Guide to Saudization And The Nitaqat Program (Apr 2026)](https://www.qureos.com/hiring-guide/guide-to-saudization-nitaqat-program) (MEDIUM)
- [Centuro Global — Saudization](https://www.centuroglobal.com/article/saudization/) (MEDIUM)
- [SCPL KSA — Nitaqat Categories Explained](https://scplksa.com/nitaqat-categories-guide-employers/) (MEDIUM)
- [HRSD — Issue and Renew Work license](https://www.hrsd.gov.sa/en/ministry-services/services/70093) (HIGH)
- [Middle East Briefing — Saudi Arabia Iqama and Visa Rules Q1 2026](https://www.middleeastbriefing.com/news/saudi-arabia-iqama-and-visa-rules-what-changed-in-q1-2026/) (MEDIUM)
- [Setup in Saudi — Saudization Requirements](https://www.setupinsaudi.com/en/saudization) (MEDIUM)

**IP Assignment / Knowledge Transfer:**
- [Cooley GO — What You Need in Your Contractor Agreements](https://www.cooleygo.com/absolutely-need-contractor-agreements/) (HIGH)
- [Cooley — What Do You Absolutely Need in Your Contractor Agreements](https://www.cooley.com/protect-pages/2020/03/what-do-you-absolutely-need-in-your-contractor-agreements) (HIGH)
- [Sprintlaw UK — Consultant Contracts: Must-Have Clauses](https://sprintlaw.co.uk/articles/consultant-contracts-musthave-clauses-uk/) (MEDIUM)
- [Fox Williams — Why employment contracts need an IP clause](https://www.foxwilliams.com/2016/10/03/why-employment-contracts-need-an-intellectual-property-clause/) (MEDIUM)
- [comp-lex — IP-Übertragungsvertrag (DE)](https://comp-lex.de/ip-uebertragung/) (HIGH)
- [Kraus-Ghendler — Freier Mitarbeiter Vertrag Klauseln](https://anwalt-kg.de/unternehmensrecht/recruiting/freier-mitarbeiter-vertrag-klauseln/) (HIGH)
- [it-recht-kanzlei — Nutzungsrechte an den Leistungsergebnissen von Freelancern](https://www.it-recht-kanzlei.de/nutzungsrechte-leistungsergebnisse-freelancer.html) (HIGH)
- [Medienrecht-Urheberrecht — Programmierer als freier Mitarbeiter](https://www.medienrecht-urheberrecht.de/it-recht/190-vertrag-programmierer-als-freier-mitarbeiter.html) (MEDIUM)
- [Enboarder — Knowledge Transfer for Successful Employee Handovers](https://enboarder.com/blog/checklist-knowledge-transfer/) (MEDIUM)
- [FutureCode — Offboarding Checklist for IT Tech](https://future-code.dev/en/blog/offboarding-checklist-for-it-tech-in-depth-guide/) (MEDIUM)
- [Rippling — Offboarding Checklist: 6 Steps](https://www.rippling.com/blog/offboarding-checklist) (MEDIUM)
- [Multishoring — IT Project Handover Checklist](https://multishoring.com/blog/it-project-handover-checklist-steps-for-a-seamless-transition/) (MEDIUM)

---

*Feature research for: B2B contractor-ops platform v6.0 (Compliance Lifecycle + IdP Deprovisioning + Gulf Polish + Offboarding Hardening)*
*Researched: 2026-04-26*
*Confidence: HIGH on IdP, compliance lifecycle pattern, Saudization Qiwa-auth requirement, IP-assignment patterns; MEDIUM on UAE NOC edge cases under Dubai Law 7/2025 (mid-2026 regulator clarifications expected) and exact Werkvertrag clause wording (lawyer-dependent).*
