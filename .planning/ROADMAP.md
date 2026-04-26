# Roadmap: Contractor Ops

## Milestones

- v1.0 MVP - Phases 1-11 (shipped 2026-03-23)
- v2.0 Platform Expansion - Phases 12-27 (shipped 2026-04-01)
- v3.0 Enterprise & Monetization - Phases 28-44 (shipped 2026-04-10)
- v4.0 International Foundation & Gulf Expansion - Phases 45-55 (shipped 2026-04-12)
- v5.0 UK & Germany Expansion - Phases 56-69 (shipped 2026-04-26)
- v6.0 Platform Maturity & Operational Hardening - Phases 70-73 (planned)

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

**Milestone Goal:** Make the platform production-grade across all supported markets (PL, UK, DE, UAE, SA) by closing critical operational gaps — compliance document lifecycle, automated access deprovisioning, Gulf operational polish, and offboarding hardening. No new market entry; focus on reliability and security for real users.

- [ ] **Phase 70: Compliance Document Lifecycle Engine** - Per-country required document definitions, automated expiry tracking with 90/60/30/15/7-day alerts, hard payment blocking on expired critical documents, automated contractor reminders via email/portal, compliance dashboard with at-risk contractor count
- [ ] **Phase 71: Identity Provider Deprovisioning** - Google Workspace auto-suspend, Azure AD/Entra ID auto-disable, Okta SSO revocation, GitHub org member removal, Slack workspace deactivation on offboarding, full audit trail of access revocation per contractor
- [ ] **Phase 72: Gulf Operational Polish** - UAE free zone entity tracking with permitted activity scope per zone and license expiry monitoring; Saudization workforce composition dashboard with nationality tracking (visibility only, not Nitaqat band simulation or advisory)
- [ ] **Phase 73: Offboarding Hardening** - Structured knowledge transfer checklist templates per role type, IP assignment verification workflow blocking offboarding completion, documentation handover task with repo/wiki/credential links, contract clause health check flagging missing IP assignment language

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
| 70. Compliance Document Lifecycle Engine       | v6.0      | 0/?            | Not started | -          |
| 71. Identity Provider Deprovisioning           | v6.0      | 0/?            | Not started | -          |
| 72. Gulf Operational Polish                    | v6.0      | 0/?            | Not started | -          |
| 73. Offboarding Hardening                      | v6.0      | 0/?            | Not started | -          |
