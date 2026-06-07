# Roadmap: Contractor Ops

## Milestones

- v1.0 MVP - Phases 1-11 (shipped 2026-03-23)
- v2.0 Platform Expansion - Phases 12-27 (shipped 2026-04-01)
- v3.0 Enterprise & Monetization - Phases 28-44 (shipped 2026-04-10)
- v4.0 International Foundation & Gulf Expansion - Phases 45-55 (shipped 2026-04-12)
- v5.0 UK & Germany Expansion - Phases 56-69 (shipped 2026-04-26)
- ✅ v6.0 Platform Maturity & Operational Hardening - Phases 70-81 (shipped 2026-06-07)
- v7.0 GTM Expansion — US Cross-Border + Workforce Management + Integration Marketplace - Phases 82+ (backlog, pre-prod gate; see `.planning/milestones/v7.0-BACKLOG.md`)

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

<details>
<summary>✅ v6.0 Platform Maturity & Operational Hardening (Phases 70-81) — SHIPPED 2026-06-07</summary>

**Goal:** Make the platform production-grade across all supported markets (PL, UK, DE, UAE, SA) by closing four operational gaps deferred across v1.0–v5.0: per-jurisdiction compliance-document expiry blocking payment (F1), IdP deprovisioning across 5 providers (F2), Gulf operational polish (F3 — UAE free-zone + Saudization), and offboarding hardening (F4 — KT templates, IP-assignment verification, contract-clause health check, credential-rotation tracking).

**Shipped:** 12 phases · 90 plans · 392 tasks. Requirements 53/54 satisfied (OFFB-06 deferred). Integration 7/7, E2E flows 5/5.

- [x] Phase 70: v6.0 Foundation — Cross-Cutting CI Guards & Observability Baseline (10/10) — 2026-04-27
- [x] Phase 71: F1 Compliance — Policy Package + Schema + Classification Reconcile (7/7) — 2026-04-27
- [x] Phase 72: F1 Compliance — Reminder Cascade + Payment Block (8/8) — 2026-05-31
- [x] Phase 73: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n (8/8) — 2026-05-31
- [x] Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission (8/8) — 2026-04-27
- [x] Phase 75: F4 Offboarding — Contract Health Check + IP Verification + Credential Vault (8/8) — 2026-05-31 *(PARTIAL: OFFB-06 e-sign signing + webhook atomic flow deferred)*
- [x] Phase 76: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration (10/10) — 2026-05-31
- [x] Phase 77: F2 IdP — GWS + Slack Adapters (the wedge) (5/5) — 2026-05-31
- [x] Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator) (7/7) — 2026-05-31
- [x] Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL (8/8) — 2026-06-03
- [x] Phase 80: v6.0 Verification + Hardening + Manual UAT (5/5) — 2026-06-05
- [x] Phase 81: v6.0 Integration Closure — IdP deprovisioning UI trigger + multi-provider run steps + compliance payment-block recovery (6/6) — 2026-06-06 *(closes INT-01 + INT-02)*

Full details: `.planning/milestones/v6.0-ROADMAP.md`
Audit: `.planning/milestones/v6.0-MILESTONE-AUDIT.md` (gaps_found = verification/UAT process debt only)
Requirements archive: `.planning/milestones/v6.0-REQUIREMENTS.md`
Phase artifacts: `.planning/milestones/v6.0-phases/`
Known gaps / deferred at close: see STATE.md `## Deferred Items` (3 unverified phases 70/71/75; 28 open human-UAT scenarios; OFFB-06; multi-region apply; per-phase code-review debt).

</details>

## Next Milestone

**v7.0 GTM Expansion** — US Cross-Border + Workforce Management + Integration Marketplace — Phases 82+ (backlog, pre-prod gate). See `.planning/milestones/v7.0-BACKLOG.md`. Start with `/gsd:new-milestone`.
