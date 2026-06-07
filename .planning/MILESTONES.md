# Milestones

## v6.0 Platform Maturity & Operational Hardening (Shipped: 2026-06-07)

**Phases completed:** 12 phases, 90 plans, 392 tasks

**Known deferred items at close:** verification/UAT process debt only — no functional blockers. Phase 81 closed the two milestone-audit blockers (INT-01 IdP-deprovisioning UI trigger, INT-02 compliance payment-block recovery); re-audited 2026-06-07 at integration 7/7, flows 5/5, requirements 53/54. Deferred: 3 phases never goal-verified (70/71/75); 28 open human-UAT scenarios (72:1, 79:3, 80:21, 81:3); OFFB-06 e-sign IP-ratification (Phase 75); tech debt R-01 (live 76-WR1 index push) + per-phase code-review (72/73/75/76/77/78) + 3-provider-router consolidation + multi-region migration apply. Full list: `STATE.md` `## Deferred Items` + `.planning/milestones/v6.0-MILESTONE-AUDIT.md`.

**Key accomplishments:**

- Wave 0 failing-test scaffolds for FOUND6-01..06 plus the new `@contractor-ops/lint-guards` workspace package — every guard, factory, and migration target now has a RED test that drives Wave 1+ implementation.
- `pnpm lint:schema` CI guard turning Wave 0's RED schema-guard suite GREEN — line-based Prisma SDL parser plus a typed 16-model allowlist that catalogues every existing exemption with a one-line reason comment.
- Default-redact logger bodies + ts-morph AST guard turning Wave 0's RED logger and logs-guard suites GREEN — every body log site is `[REDACTED]` unless its procedure prefix is on the explicit allow-list (which ships empty per D-08), and the live codebase has zero pre-existing offenders.
- `pnpm i18n:parity` CI guard turning Wave 0's RED suite GREEN — generalised the existing DE-only parity check to all four locales (DE+PL+AR), discovered 398 pre-existing missing-key sites in PL+AR, and adopted the lint:logs baseline pattern so the guard ships zero-friction while mechanically preventing all future drift.
- Parallel flag-namespace signoff registry — schema, runtime helpers, gated-prefix list, and an empty data store ready for v6.0 features Phases 71+ to populate. Independent of Phase 64's disclaimer signoff per D-09.
- CI workflow + husky pre-push wired with the three lint scripts. Engineers can no longer push (or land via PR) code that violates schema tenant scoping, body-redaction, or i18n parity.
- Boot-time signoff gate wired into the feature-flags registry. Engineers who flip an Unleash flag in a gated namespace without recording the legal sign-off hit a hard failure at LOCAL boot — exactly the discovery friction the D-10 contract requires.
- `getIdpAuditLogger()` ships — bindings `service: 'idp-audit'`, redact override that preserves audit fields (scopeDelta, body) in plaintext while keeping passwords/tokens/apiKeys [REDACTED]. Wave 0's last logger scaffold turns GREEN; Phases 76–78 IdP deprovisioning consumers can now call into a typed audit channel.
- New @contractor-ops/compliance-policy package + 17 RED tests + 22 it.todo entries mapped to Phase 71's 4 ROADMAP success criteria.
- 13 typed-const policy rules across 5 jurisdictions with TZ-aware expiry helper and 13 PENDING signoff entries.
- 4 nullable columns on ContractorComplianceItem + 1 on ClassificationAssessment + 2 new enums + 1 drift-query index, all in one additive migration.
- classification.submit now wraps body in $transaction; first-classification materialises, outcome change supersedes-with-carry-forward, same outcome no-ops; POLICY_RULE_SET_VERSION snapshotted; 13 GREEN unit tests.
- Bulk admin mutation (1-500 contractors per call) with per-contractor transaction isolation, idempotency precondition, and single-row audit-log emission.
- Functional admin UI: button on per-contractor profile + bulk variant for contractors-list selection toolbar; AlertDialog with reason dropdown; i18n in 4 locales; 9 GREEN tests.
- Idempotent single-region backfill runner for ContractorComplianceItem.policyRuleId/severity/expiryJurisdictionTz; 8 GREEN unit tests; multi-region run pattern documented in packages/db/scripts/README.md.
- Eight header-stamped failing-test files establishing a deterministic RED baseline for the reminder cron orchestrator, payment-block helper, approval operator registry, atomic PaymentRunComplianceCheck audit row, recovery hook, block-modal UI, CI lint guard, and the compliance-payment-block signoff-registry entry.
- Three additive Prisma migrations (reminder-state table + ReminderBand enum; PENDING_COMPLIANCE enum value + complianceHoldsJson JSONB GIN index; PaymentRunComplianceCheck audit table + EligibilityVerdict enum) plus matching schema-file edits and a migration-shape regression test — Prisma client regenerated and in sync.
- `runComplianceReminderScan` — a two-pass band-state-machine cron (90/60/30/15/7 + EXPIRED) that classifies BLOCKING compliance-item expiry, fires per-band dedup-gated transitions with optimistic-concurrency against the renewal-reset listener, and dispatches exactly ONE digest notification per recipient per jurisdiction-day.
- `assertContractorPaymentEligibility` — the single canonical payment-block guard (throws PRECONDITION_FAILED with the D-10 cause shape when a contractor has a BLOCKING+EXPIRED compliance item, or takes the flag-OFF would-block soft-warn path), wired into `payment.create` and enforced across all payment-write entry points by the new `payment-gate-guard` CI lint guard.
- Plug-in approval-engine operator registry with the complianceCritical operator that holds invoice approvals in PENDING_COMPLIANCE at their final step (instead of auto-APPROVE) when the contractor has a BLOCKING+EXPIRED item, plus the auto-recovery hook that re-asserts eligibility and resumes held flows to PENDING when items are satisfied, and a manual admin escape-hatch mutation.
- `payment.lockAndExport` now re-asserts contractor eligibility inside the export transaction (TOCTOU defence) and writes one frozen-snapshot PaymentRunComplianceCheck PASS row per contractor atomic with the PaymentExport row; on a newly-blocked contractor the export aborts with PRECONDITION_FAILED and a separate transaction records FAIL-verdict rows (paymentExportId=null) so every export attempt leaves a forensic trail.
- Accessible web-vite modal that surfaces the D-10 PRECONDITION_FAILED.cause.contractorReasons payload — one collapsible section per blocked contractor with locale-aware deep links into each expired compliance document — wired into the new-payment-run wizard via the Page→Container→Hook→Component boundary (the hook catches the block, the container renders the modal).
- The COMPL-03 compliance-reminder cron orchestrator now fires on the existing `reminders` cron schedule (added crash-safely as a fifth Promise.all member with its own metrics gauges), and the `compliance-payment-block` feature flag is registered PENDING in the signoff registry — completing Phase 72 end-to-end.
- 10 deterministic RED test files across api, compliance-policy, validators, auth, and web-vite that pin every Phase 73 production module (COMPL-01/04/11) before any implementation lands.
- Additive-only Prisma migration adding the WaivedReasonCategory enum + override columns, DocumentStatus.PENDING_REVIEW, a composite dashboard index, and a partial GIN audit-log index — schema tests GREEN, client regenerated for Wave 2.
- compliance:read/override permission with per-role grants, an atomic compliance.overrideItem mutation (status→WAIVED + forensic AuditLog in one transaction), and an org-scoped compliance.itemAuditTrail History query — all Wave 0 scaffolds GREEN.
- Per-jurisdiction (UK/DE/PL/KSA/UAE/US) locked COMPL doc-name registry with en/pl/de/ar phrase maps, 19 PENDING signoff entries, and a data-driven D-17 parity guard that flips the Wave 0 scaffold GREEN (22 assertions).
- Five indexed compliance-dashboard query helpers wired into 4 read-gated tRPC queries, plus defaultExpiryFromUploadDate + PolicyRule.expirySemantic backfilled across all 19 registered rules — Wave 0 scaffolds GREEN.
- TanStack-routed admin compliance dashboard (3 KPI cards driving 3 canonical-DataTable tabs: at-risk, upcoming-renewals, blocked-payments) with permission gate, loading/empty/error states, 60s blocked-payments polling, deep-link drilldown, and full en/de/pl/ar i18n.
- Portal /compliance list + one-click upload-replacement flow (DropZone -> R2 -> PENDING_REVIEW) + home attention banner, over a portalRouter-scoped backend (portal.complianceItems + submitUploadReplacement); Wave 0 scaffolds GREEN.
- Admin approve/reject of contractor uploads (item->SATISFIED / Document->ARCHIVED + audit + best-effort notification), a shared override modal mounted on the Compliance tab + dashboard, an audit-log History disclosure, the WAIVED badge, and the compliance-portal-self-service PENDING flag — all Wave 0 scaffolds GREEN.
- [Rule 1 — Bug fix] @date-fns/tz pinned at ^1.2.0 (plan said ^4.0.0)
- [Rule 1 — Behavior contract] `Object.isFrozen` runtime assertion replaced with reference-stability spot-check.
- Option chosen: A (direct role.statements introspection)
- New tables (org-scoped):
- [Rule 1 — Build environment] Tests use vitest mocks instead of real Prisma integration tests.
- [Rule 1 — Workspace boundary] Used local BusyRange + duck-typed CalendarAdapter interface in pto-detector instead of importing types from @contractor-ops/integrations.
- Deterministic RED baseline (14 NEW failing-test files + 17 PENDING IP-clause signoff entries) that maps 1:1 to Phase 75's 5 success criteria and 5 REQ-IDs; `pnpm typecheck` stays GREEN.
- Landed ContractHealthCheckRun (D-02) + CredentialReference (D-10) + Contract.jurisdiction with a hand-authored, RLS-protected migration carrying the D-03 partial-unique dedup index; regenerated the prisma-client and flipped the schema RED test GREEN.
- Registered 6 universal offboarding-time IP-assignment policy rules (one per jurisdiction, incl. a new US module) that the health-check materialiser uses for LIKELY_MISSING ContractorComplianceItem creation; extended the Jurisdiction union to include US.
- Shipped the regex-grounding half of the D-13 verdict pipeline — 6 per-jurisdiction phrase modules (17 phrases) + the D-06 Zod results schema + the ALL_IP_CLAUSES aggregate; flipped both ip-clauses RED scaffolds to 18 GREEN tests.
- Shipped the credential-vault structural defence — `looksLikeSecret` + Zod-4 `looksLikeSecretRefinement` over 12 ordered secret-shape patterns; flipped the 75-01 RED scaffold to 30 GREEN tests.
- Landed the full IP-assignment health-check pipeline — Anthropic tool_use eval + regex grounding + cross-jurisdiction mismatch + versioned ContractHealthCheckRun persistence + denormalisation + idempotent LIKELY_MISSING materialisation + single-write audit — plus the QStash fire-and-forget trigger, admin re-run mutation, and bulk-rerun script.
- Shipped the `workflow.credentialReference` CRUD namespace (server-side secret-shape rejection + per-mutation audit) and the offboarding-run completion gate — IP_VERIFICATION hard-block (override-aware) + PENDING-credentials soft-warning + force-complete-with-reason.
- Shipped the offboarding UI surfaces (HealthCheckPanel, CredentialsTab + add dialog, PendingCredentialsWarningDialog, IpVerificationEsignButton) re-architected for web-vite, the 6 IP-ratification templates, and i18n in 4 locales. The e-sign signing mutation + webhook IP-ratification atomic flow are DEFERRED to a follow-up slice (STATE.md blocker) — they require schema + render-pipeline work the plan does not concretely specify against the current tree.
- New `@contractor-ops/idp-saga` ESM package (typed stubs for cooldown/run-status/provenance/gc) plus 19 failing-test scaffolds across 7 packages and the `idp-deprovisioning` PENDING signoff entry — a deterministic RED baseline mapping 1:1 to Phase 76's 8 success criteria.
- Three additive Prisma tables (DeprovisioningRun/Step saga state + IdpChangeProvenance self-trigger filter) + 5 enums + nullable `ContractorAssignment.endedAt` cooldown column, with an offline-generated additive migration and multi-region apply docs.
- `Deprovisionable` compile-time contract + GWS minimum-privilege scope/capability typed-consts + a `BaseAdapter & Deprovisionable` registry that rejects non-conforming adapters at the call site, plus 8 saga audit fields on the IdP audit allow-list.
- Cooldown gate (TZ-aware 14-calendar-day boundary), run-status derivation rule + recompute wrapper, concurrent-safe provenance lookup/insert, and 90-day GC — all 25 Wave-0 idp-saga tests flipped GREEN.
- `deprovisioning.getDeprovisioningEligibility` tRPC query — reads the assignment + contractor country, derives the jurisdiction TZ, runs the single source-of-truth cooldown helper, and emits an audit-grade log entry; tenant-isolated via NOT_FOUND.
- `startDeprovisioningRun` (transactional run+steps + independent QStash fan-out) + idempotent `retryDeprovisioningStep` mutations + a Fastify `_step-runner` QStash callback that executes one saga step (provenance-before-adapter, SHA-256 audit hashes, recomputeRunStatus aggregation).
- ts-morph `lint:scopes` guard (4th lint-guards sibling) that fails CI when an IdP adapter inlines a write-capable OAuth scope not traced to a typed-const, wired into the npm script, husky pre-push, and ci.yml.
- Additive `admin.directory.user` write scope (prompt=consent) on the GWS adapter, a 3-state reconnect banner (write-access variant) with 4-locale i18n, and an OAuth callback that derives the scopeCapabilities JSONB — read-only v3.0 directory-import unbroken.
- GoogleWorkspaceAdapter is the first concrete `Deprovisionable` — suspend/revoke/verify against the Admin SDK with SHA-256 audit hashing, plus a `handleWebhook` self-trigger provenance filter that suppresses our own deprovision events.
- 90-day IdpChangeProvenance GC wired into the reminders cron (isolated try/catch), the GWS deprovision test annotated as the per-provider D-16 template, and the SC#7/IDP-15 no-Reactivate invariant locked by a grep guard + 2 render-based RTL assertions.
- Additive type/schema/permission/flag plumbing for the GWS+Slack deprovisioning wedge: `describeImpact` + `LIKELY_GONE` + `ImpactPreview` union + `ErrorClass` classifier + Slack scopes + `MANUAL_COMPLETED`/errorClass Prisma columns + `idp:override_step_failure` + two ship-dark per-provider flags — with the run-status D-11 reconciliation.
- Real GWS deprovisioning against the Admin SDK: suspend (PATCH suspended=true), revokeAllSessions as OAuth-grant-revoke (tokens list+delete at pLimit(5)) + sign-out (both required), verify, and a live cache-fronted describeImpact — all errors mapped through the 77-01 closed-enum classifier.
- Real Slack deprovisioning via the Enterprise-Grid SCIM API (PATCH active=false) + admin.users.session.invalidate, using the org-grid token exclusively — plus the SLACK_ORG_GRID connection sub-kind, layered non-fatal Grid detection, and a best-effort describeImpact.
- Backend that runs the adapters: upgraded QStash step-runner (errorClass + LIKELY_GONE + GWS 3-audit-row sub-actions + connection-token resolution), cached describeImpact preview service with the admin-choice failure flow, the Phase-74-mirror overrideStepFailure mutation, the per-provider enable toggle gated on signoff, and the Slack org-grid OAuth-start entry point.
- Admin UI for the deprovisioning wedge following Page→Container→Hook→Component: the pre-flight impact-preview panel (SC#1, with freshness/refresh + reconnect/admin-choice routing), the saga run/step view with LIKELY_GONE/MANUAL_COMPLETED rendering + the permission-gated override dialog + permanent badge (SC#4/SC#5), and the Slack org-grid connection card + per-provider enable toggle table — all i18n'd across en/de/pl/ar.
- Typed contract layer for the Entra/Okta/GitHub Deprovisionable adapters — two pinned vendor SDKs, three scope-capability consts, a 3-member ImpactPreview union extension, three MSW endpoint mocks, and 20 RED it.todo scaffolds — all typechecking against the shipped Phase 76/77 reality.
- Extended the closed-enum classifyError so the saga's per-class retry budgeting works for Entra/Okta/GitHub — the headline being GitHub's 403-overload split (secondary rate limit → TRANSIENT vs auth-forbidden → PERMANENT) — without widening the ErrorClass enum.
- EntraIdAdapter via raw Microsoft Graph — the differentiator's hardest adapter: a hybrid-AD HARD BLOCK that refuses to disable an on-prem-authoritative account (zero writes), a non-blocking Conditional Access warning, and a single forensic signInActivity poll, all atop the standard suspend/revoke/verify.
- OktaAdapter via the @okta/okta-sdk-nodejs v8 namespaced client — the straightforward IdP: deactivateUser (verify-first LIKELY_GONE short-circuit), revokeUserSessions, getUser-based verify, and best-effort app/factor/group/role/idp impact counts.
- GitHubAdapter via @octokit/rest — the differently-shaped provider: org-member removal, SAML-SSO per-PAT credential-authorization revocation that degrades gracefully on non-SAML orgs, and the headline outside-collaborator back-door flag (repos that survive org removal).
- The integration seam: three adapters registered as Deprovisionable (saga-resolvable by ENTRA/OKTA/GITHUB), three PENDING per-provider signoff flags, the per-org enable toggle extended to all five providers, and three thin tRPC connection routers with session-scoped tenant + signoff gate + audit — monorepo typecheck green.
- Three Entra/Okta/GitHub deprovisioning provider sections (Page→Container→Hook→Component) in Settings > Integrations — flag-gated enable cards with brand icons, Entra hybrid-AD/CA banners, the GitHub outside-collaborator note, full loading/error/empty states, WCAG-compliant switches, and en/de/pl/ar i18n. The 5-provider compliance toggle table was already delivered by Phase 77 + 78-06; only the new provider labels were added.
- Task 1 — 7 RED test scaffolds (commit `ea6b4872`)
- 4 ME-region Gulf Prisma models (FreeZone/Saudization/Headcount/UaeFreeZone) + NitaqatBand/UaeFreeZoneCode enums + additive contractor/contract columns + AE/SA locked-phrase registries + 2 PENDING Gulf flags, landed generate-only with both single- and multi-region applies deferred post-deploy.
- Free-zone license expiry now flows into the existing F1 reminder cascade + payment hard-block: the policy rule is BLOCKING @v2, the compliance item is written out-of-band from the FreeZoneAssignment service with a Mainland gate + supersession isolation, the reminder cron fans out across SUPPORTED_REGIONS so ME items enter the cascade, and a GULF-11 region-leakage lint guards the 4 Gulf models.
- Deterministic ISIC-overlap scope check with auto-NOC (GULF-03) and pure Saudization dashboard derivation + ephemeral offboarding trajectory (GULF-05/06/07) — rate from manual headcount only, band never auto-computed, trajectory advisory-only; C5/C6/C7 GREEN, no engine changes.
- Exposed the Gulf backend through a tenant-scoped, region-aware `gulf` tRPC namespace (free-zone CRUD + per-engagement Saudi fields + Saudization config/headcount/dashboard + GULF-10 audit-logged drift overrides), wired the permitted-activity ISIC scope check into the contract-create transaction, and shipped the D-02 freeform→FreeZoneAssignment backfill + AE-field hide. C9 GREEN.
- Shipped the UAE free-zone assignment surface in web-vite as a Page-ready Container -> Hook -> presentational Form (zone Select focal point over 10 zones + Mainland, license number/category/expiry, permitted-activities text + ISIC code tags, single teal Save CTA), a non-blocking --warning scope-mismatch advisory banner linking to the engagement compliance list, and the D-02 removal of the old freeform UAE inputs from country-compliance-section — all copy via useTranslations (keys land in 79-08), RTL logical-properties only, full loading/empty/error states.
- Shipped the Saudization web-vite surface as layered Container -> Hook -> presentational views: a dashboard with the manual nationalisation rate as the hero focal point, a NEUTRAL (never colorized) Nitaqat band badge, side-by-side headcount with visually-subordinate platform-derived counts, a visibility-only Qiwa-auth gap, an Iqama expiry roll-up and an RTL band donut via useRtlChartConfig; a manual 6-value band/industry-segment/headcount entry dialog (the system never auto-computes the band); a GULF-10 drift-override dialog with the 'Custom — verify with adviser' badge and a destructive reset-to-default confirmation; and an advisory, non-authoritative, NON-GATING offboarding band-trajectory banner — all copy via useTranslations (values land in 79-08), RTL logical-properties only, full loading/empty/error states.
- 1. [Rule 1 - Bug] Duplicate `override` key inside `Saudization` (caught by pre-commit biome)
- One vitest integration test composes F1 payment hard-block + F3 Gulf free-zone/Saudization advisory + F4 offboarding IP hard-block on a single seeded UAE contractor, against one shared mutable mock-Prisma store — 11 assertions green, milestone composition proof for v6.0.
- 80-HUMAN-UAT.md — 21 manual UI UAT scenarios across F1/F2/F3/F4 (F2 IdP fully covered), each with repro steps anchored to real apps/web-vite surfaces, a why_human rationale, and a result:[pending] post-deploy disposition, mirroring 79-/63-HUMAN-UAT format.
- 80-LEGAL-SIGNOFF.md catalogues every "Needs verification by legal entity" annotation across v6.0 under exactly four adviser sections (DE Steuerberater / UK tax-legal / UAE legal / KSA MOL-HRSD+legal), sourced verbatim from the two in-repo signoff registries, framed post-deploy and non-blocking.
- Re-ran all 14 D-04 v6.0 CI/static gates (9 PASS, 3 pre-existing committed offenders, 2 recorded-only) and wrote `80-RETROSPECTIVE.md` — the v6.0 milestone-close artifact recording hard-dependency play-out, the 80-01 integration-test PASS (11/11), all 24 PENDING Unleash flags by namespace with post-deploy approval pointers, and plan-completion velocity of 7.5 plans/phase vs the v5.0 baseline of 5.0 (+50%), closing under the LOCAL-ONLY / DEFERRED Standing Constraint.
- A single composed-scenario test now threads F1 (payment hard-block) + F3 (Saudization advisory) + F4 (IP_VERIFICATION offboarding hard-block) through ONE seeded contractor's shared mock-Prisma store, with the payment-gate and IP-block mocks made load-bearing via a second synthetic tenant.
- Assertion-level failing unit tests for both v6.0 integration seams (INT-01 IdP-trigger server + INT-02 compliance recovery) plus the rewritten `idp:start_run` RBAC invariants — every behavior 81-02/81-03 implement now has a test asserting it first.
- Closed the INT-01 server seam — added the `idp:start_run` permission (owner+admin+it_admin), gated the two previously-ungated deprovisioning procedures with it, replaced the hardcoded GWS-only `PROVIDERS_FOR_RUN` with a per-org dynamic derivation (enabled ∩ signoff ∩ resolver-backed) backed by a single-source `RESOLVER_BACKED_PROVIDERS`, added the missing org-settings read, threw `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` on an empty set, and added the server-side `contractorId → assignmentId` resolver — turning every 81-01 INT-01 RED case GREEN.
- `onComplianceItemSatisfied` is now called inside `approveUploadReplacement`'s `$transaction` for the approved item, so an approved portal upload re-asserts contractor eligibility, resumes any held PENDING_COMPLIANCE ApprovalFlow to PENDING, and unblocks the contractor's payment — closing the INT-02 server seam and turning the 81-01 D-12/D-14 RED cases GREEN.
- Added a focused, non-duplicative regression lock to `slack-adapter.test.ts` asserting the Slack deprovision execution path (suspend SCIM `active=false`, revoke `admin.users.session.invalidate`, `describeImpact` SLACK shape) fires with the org-grid bearer — confirming D-08 with zero change to the adapter source.
- Built the INT-01 deprovisioning trigger UI in web-vite — one shared hook as the sole tRPC boundary serving both entry points (assignment detail + the offboarding ACCESS_REVOKE task card via a server-side contractorId→assignmentId resolve), a container owning the permission/cooldown/existing-run state machine that reuses the existing impact-preview panel + run-view, a presentational confirm-dialog button, and en/de/pl/ar parity — making the F2 differentiator reachable from the UI for owner/admin/it_admin.
- Added `81-int-closure.test.ts` — the binding cross-feature composition that proves BOTH milestone-audit-flagged integration flows now complete end-to-end against the real `createCaller(appRouter)`: Flow 1 (INT-01) resolves a contractor's most-recent ENDED assignment, derives the deterministic per-assignment idempotencyKey, and starts a multi-provider (GWS + Slack) deprovisioning run with one independent QStash job per step; Flow 2 (INT-02) admin-approves a portal upload, fires the in-tx recovery hook that resumes the held PENDING_COMPLIANCE flow to PENDING, and confirms the payment gate releases — closing the F2 composition gap deliberately left in `v6-cross-feature-composition.test.ts:28-30`.

---

## v5.0 UK & Germany Expansion (Shipped: 2026-04-26)

**Phases completed:** 14 phases (56-69), 70 plans

**Key accomplishments:**

- Generic contractor classification engine with UK IR35 (CEST-aligned, 25 questions, dispositive scoring per Atholl House + PGMOL) and German Scheinselbständigkeit (DRV 30/30/25/15 weighted criteria) rule sets, stored per-engagement
- Status Determination Statement (SDS) PDF generation, IR35 chain participants tracking with delivery timestamps, DRV audit defense PDF bundle for compliance evidence
- Automated economic-dependency alerts (70% / 83.33% thresholds) with daily band state-machine cron, reassessment triggers wired to AuditLog scans, Statusfeststellungsverfahren tracking with 90/30/7-day expiry reminders
- Per-market compliance health dashboard with 8 tRPC procedures, CSV export with formula-injection neutralization, and 7-component native-flex visualisation (no chart library)
- XRechnung 3.0.2 CII XML generator with KoSIT 3-layer validation (libxmljs2 XSD + saxon-js EN 16931 + saxon-js XRechnung CIUS Schematron), Leitweg-ID lifecycle (per-contractor / per-contract resolution), Peppol BIS 3.0 transmission via Storecove with capability cache
- ZUGFeRD PDF/A-3 hybrid generator using pdf-lib, structural-check assertions, XMP metadata, and Phase 61 CII generator reuse for embedded XML
- BACS Standard 18 Direct Credit export with VocaLink modulus-check sort-code validation, ASCII transliteration utility, and per-org submitter configuration
- LPCDA-compliant statutory late-payment interest with BoE base-rate poller cron, claim PDF (React-PDF), waiver/revoke flow, and admin BoE-rate management page
- German Skonto early-payment-discount cascade (invoice-level → billing-profile default) with structured BG-20 XRechnung Payment Terms emission per Anhang E (`#SKONTO#TAGE=n#PROZENT=n#BASISBETRAG=n#`) — wired through both XRechnung CII and ZUGFeRD embedded CII (closes audit I-1)
- HMRC VAT validation (OAuth 2.0 client-credentials with 401-refresh and fraud-prevention headers) and VIES qualified USt-IdNr confirmation with graceful soft-fail
- Tax-id-validation orchestrator with 90-day freshness window, reverse-charge rules (gb_eu_post_brexit_b2b + de_domestic_13b_ustg), and Kleinunternehmer service
- German i18n at full message-key parity (4,281 leaf keys) in formal-Sie register, locked DSGVO/tax phrases as compile-time constants (78/78 CI guard), Datenschutzerklärung MDX with BfDI-aligned content, IDOR-safe React-PDF privacy notice download
- UK GDPR privacy notice MDX page + React-PDF template + jurisdiction resolver
- Country-specific contractor profile fields with HMRC-grade validators (UTR mod-11, GB VAT mod-97/9755, Companies House) and German validators (USt-IdNr ISO 7064, SV-Nummer DRV-spec, 16-Bundesland Steuernummer regex map, ~120-court Handelsregister list)
- Legal compliance hardening: Unleash feature-flag wrapper with deployment-time signoff registry (PENDING → APPROVED CI gate), advisory banner component on classification outcomes, escalation logging, ToS reacceptance modal
- When `classification-engine` flag OFF: classification UI fully removed from render tree, tRPC procedures FORBIDDEN/unregistered, document endpoints inaccessible, economic-dependency cron skips execution
- Closed audit I-1 cross-phase wiring defect (Phase 68: 5 plans, 3 waves, 4-layer test coverage proves XRechnung XML + ZUGFeRD embedded CII both emit BG-20)
- Closed FOUND-03 i18n parity gap (Phase 69: 32 missing DE translations authored in formal-Sie register; LPCDA copy uses German with parenthetical English on first occurrence to avoid BGB Verzugszinsen statutory framework confusion)
- Phase 67 produced VERIFICATION.md for Phases 56 + 58 retroactively, surfacing GAP-67-01-01 which Phase 69 then closed
- Phase 65 fixed 4 critical Phase 63 bugs (wrong feature flag key, wrong amount field, missing permission registration, daysOverdue calculation source)
- Phase 66 executed Phase 57's outstanding plan 04 (VAT tRPC routers + invoice pipeline + UI) and produced 57-VERIFICATION.md
- Audit gap-closure trio (65, 66, 67) plus follow-up phases (68, 69) all PASSED verifier — every audit-flagged gap closed before milestone close

Known deferred items at close: 10 (see STATE.md Deferred Items) — all manual UI UAT (post-deploy) or VERIFICATION.md `gaps_found` files whose underlying issues were addressed by gap-closure phases.

---

## v3.0 Enterprise & Monetization (Shipped: 2026-04-10)

**Phases completed:** 17 phases, 47 plans, 91 tasks

**Key accomplishments:**

- Stripe billing backend with subscription schema, idempotent webhook processing, trial credits, trial notification cron, and tRPC billing router
- Atomic OCR credit deduction with Serializable isolation, trial-aware allowances (5 credits per D-08), Stripe Meter reporting, and hard-block on credit exhaustion
- Complete billing UI with Settings tab, 3-tier plan comparison grid (199/449/849 PLN), trial banner, soft-block modal, credit usage with progress bar, and Stripe Checkout integration via tRPC
- Wire getCreditBalance through tRPC so CreditUsageCard displays real OCR credit consumption from the ledger
- LinearAdapter with OAuth + HMAC-SHA256 webhook verification, Zod validators, PENDING_MAPPING status flow, and 6-procedure tRPC router for Linear issue sync foundation
- Bidirectional Linear sync with status mapping (PENDING_MAPPING->CONNECTED D-03), GraphQL issue creation with email assignee lookup, inbound webhook processing, and workflow router integration for auto-issue creation and outbound status sync
- Linear provider section with post-OAuth mandatory mapping flow, status mapping dialog with smart defaults, workflow template team selector, issue chips on workflow task views, and full EN/PL i18n
- Prisma schema with 4 models and 4 enums, Zod validators, RBAC permissions, and 13-endpoint tRPC router for equipment tracking
- Equipment list/detail pages with TanStack Table, CRUD/assignment/shipment dialogs, shipment timeline, contractor profile Equipment tab, and full EN/PL i18n
- Equipment workflow service wiring EQUIPMENT tasks into onboarding/offboarding workflows with shipment-driven auto-completion and multi-shipment gate
- 49 vitest todo stubs across 4 test files covering all GOOG requirements (OAuth, Directory API, sync detection, bulk import, Zod validators)
- Google Workspace Admin SDK adapter with directory/group listing, tRPC router with 5 procedures including server-side RBAC group re-fetch, and QStash daily sync cron
- Complete Google Workspace directory import UI: 9 components with 3-step wizard, TanStack Table with selection/search/filter, role assignment with group mapping, and en/pl i18n
- Directory sync orchestrator with QStash endpoint that detects Google Workspace new hires and departures via email snapshot diffing, dispatching admin notifications without auto-modifying users
- Fixed 3 provider slug string literals from hyphen to underscore, unblocking OAuth connect, health check, disconnect, and post-OAuth wizard auto-open
- MessagingProvider abstraction over Slack with provider iteration in dispatch(), Prisma schema for MICROSOFT_TEAMS/TEAMS/channelTeams, and SlackMessagingProvider delegating to existing slack-client.ts
- TeamsAdapter with Azure AD OAuth, 5 Adaptive Card templates for approval workflow, and Graph API client for channel discovery
- TeamsBotHandler with Zod-validated card actions, TeamsMessagingProvider for proactive messaging, Bot Framework endpoint, tRPC channel router, and Azure Bot Service setup guide
- Teams provider section with channel mapping card, notification preferences Teams column, and full en/pl i18n
- CourierClient interface with InPostClient ShipX wrapper, webhook handler with event deduplication, polling fallback service, and 44 passing tests
- tRPC equipment/portal router extensions with InPost shipment creation, return approval workflow, webhook/cron endpoints, and offboarding auto-shipment
- Complete InPost courier UI: Paczkomat picker with Geowidget iframe, shipment creation form, label viewer with download/print, admin return approval banner, portal equipment tab, and contractor 3-step return flow with en/pl i18n
- Cross-tool onboarding import API with Jira/Linear/Google Workspace/Slack user fetch, email-based merge/dedup with conflict detection, project-to-workflow template conversion, and per-item retry
- 4-step full-page wizard with source selection, merged people review with conflict resolution, project import with editable steps, and async progress tracker with per-item retry
- requireTier tRPC middleware with TIER_RANK gating and getUsageDashboard endpoint aggregating subscription, credits, seats, and plan config
- DPD and UPS courier clients with OAuth token caching, status mappers, polling services, carrier factory, and Zod validators -- all following InPost's CourierClient pattern
- DPD and UPS shipment creation procedures with PRO tier gating, courier config CRUD, and multi-carrier polling cron
- FeatureGate wrapper with tier-based inline upgrade banners and 4-card usage dashboard (plan, seats, credits, billing date) with green/yellow/red credit progress bar
- Unified carrier shipment form with dynamic DPD/UPS/InPost fieldsets, credential setup cards with test/save, and default return carrier selector
- testCourierConnection tRPC procedure closing CarrierCredentialForm verification gap, with getStatus probe and structured success/failure response
- Bidirectional Linear sync wired via QStash webhook dispatch and outbound CANCELLED status sync in cancelRun for both Linear and Jira
- DPD and UPS integration cards mounted in Settings with credential dialogs, and CarrierShipmentForm wired to equipment detail page with carrier-configured visibility gate
- requireTier middleware applied to 10 integration/OCR/audit mutations with global TIER_REQUIRED upgrade toast in QueryClient
- Fire-and-forget checkShipmentTaskCompletion wired into all 4 courier status update paths (InPost webhook, InPost/DPD/UPS polling) with unit and integration tests
- requireTier("PRO") added to 10 ungated procedures across Teams, GWS, and Onboarding Import routers with STARTER-rejection tests
- Extracted generic BaseShipmentParams from InPost-specific CreateShipmentParams, making CourierClient interface carrier-agnostic
- FeatureGate wrapping on 3 PRO-only components (Teams mapping, GWS import, onboarding wizard) for defense-in-depth tier gating
- sendChannelAlert wired into notification-service dispatch loop for 9 activity notification types with channelMapping lookup from integrationConnection configJson
- CreditExhaustedInline mounted in OCR-triggering upload components with TRPCClientError PRECONDITION_FAILED detection and /settings?tab=billing navigation
- FeatureGate wrapping on Linear, Google Workspace, and Teams OAuth sections — STARTER users see upgrade prompt instead of connect buttons
- FeatureGate PRO-tier wrappers on Jira/Calendar sections + ShipmentParams union type fix enabling clean API dist build
- Removed all 13 (trpc as any) proxy workarounds, restoring full type safety across billing, teams, equipment, portal, and settings components
- Fixed ConversationReference key mismatch from tenantId to conversation.id so Teams channel alerts resolve stored refs correctly
- Replaced broken hardcoded /api/oauth URL in onboarding wizard with tRPC getOAuthUrlGeneric call for working OAuth connect flow
- Shared dispatchShipmentNotification helper wired into DPD, UPS, and InPost polling services for terminal status notifications

---

## v2.0 Platform Expansion (Shipped: 2026-04-01)

**Phases completed:** 16 phases, 52 plans, 103 tasks

**Key accomplishments:**

- AES-256-GCM credential encryption with per-provider keys, IntegrationProviderAdapter contract, provider registry, and Prisma schema extension for token expiry tracking
- Unified webhook ingestion pipeline with Slack HMAC-SHA256 and Resend Svix adapters, QStash async processing, and WebhookDelivery audit logging
- Generic OAuth callback with HMAC-signed cross-provider CSRF state, proactive token refresh cron with distributed lock, and lazy refresh fallback
- Health monitoring service with provider card grid, detail sheet (sync log + webhook deliveries), and 30-second polling via TanStack Query
- Wired IntegrationsTab into settings, documented all env vars, and marked legacy Slack/Resend routes deprecated with backward-compat migration path
- PortalSession and PortalMagicToken Prisma models with SHA-256 hashed session service (7-day expiry) and single-use magic link service (15-min expiry, Resend email)
- portalProcedure middleware with cookie auth + 15-endpoint portal tRPC router covering magic link auth, contracts, invoices, documents, payments, and invoice submission
- Portal layout with top bar navigation (5 links + org branding + profile dropdown), magic link login page, token verification with org picker for multi-org contractors, and httpOnly session cookie management via API routes
- Overview dashboard with 4 summary cards and activity log, contracts list/detail with document downloads, documents table, and payments table -- all consuming portal tRPC router with loading skeletons and empty states
- Invoice list with status badges, detail page with 3-layer status tracking (StatusTimeline + ActivityLog), submission form with contract picker and presigned PDF upload, and success confirmation page
- Two Prisma models (change request + notification prefs), change request service with transactional approval, 6 portal endpoints, and 3 admin endpoints for contractor self-service and org branding
- Portal settings page with collapsible profile sections (immediate contact edit + approval-flow financial edit), notification preference toggles with optimistic updates, and Settings nav link in portal navigation
- Portal CSS custom property brand injection, admin branding section with 8-swatch color picker + logo upload, and change request diff cards with approve/reject in approvals tab
- End-to-end portal subdomain routing via Next.js middleware with x-portal-org-subdomain header flow, admin subdomain config UI, and branded unauthenticated portal shell
- 21 it.todo() test stubs across 4 files covering all Phase 14 API behaviors: change request service CRUD, portal profile endpoints, notification preference defaults with SECURITY_ALERTS guard, and branding hex validation
- Prisma signing models (envelope/recipient/event), ESignAdapter interface with 7 operations, and 23 Wave 0 test stubs for DocuSign, Autenti, router, and webhook handler
- DocuSign and Autenti adapters implementing ESignAdapter interface with provider-agnostic orchestration service
- Complete server-side signing lifecycle: tRPC router with 7 procedures, orchestrator for envelope creation/void/completion with R2 PDF storage, and webhook handler with idempotency and contract status mapping
- Complete e-sign UI: SendForSignature dialog with dnd-kit signer reorder and provider picker, signing progress bar with per-signer step indicators, embedded signing modal with DocuSign iframe and Autenti redirect fallback, audit trail sheet, void dialog, and portal pending signatures section
- Claude Vision OCR pipeline with native PDF extraction, NIP checksum validation, confidence scoring, async QStash processing, and tRPC endpoints for admin and portal
- Seven composable OCR review components: react-pdf viewer with zoom/navigation, confidence badges with D-07 thresholds, NIP modulo-11 validation, extraction status bar, processing overlay, and editable line items table with grosze formatting
- OcrReviewPanel split view with PDF + pre-filled form, admin upload auto-trigger, and portal form OCR pre-fill with confidence indicators
- KSeF API client with RSA-OAEP auth, FA(3) XML parser with Zod-validated grosze conversion, and adapter registered in integration registry
- KSeF sync orchestrator with hourly QStash cron, cross-source duplicate detection by invoiceNumber+sellerTaxId, tRPC router with connect/disconnect/triggerSync, and KSEF_SYNC_COMPLETE notification
- 6 KSeF UI components: setup dialog with token/cert auth, provider card with sync controls, invoice table badge, detail metadata section with copyable fields, and cross-source duplicate banner
- 76 vitest it.todo stubs across 6 files covering time entry CRUD, timesheet lifecycle, approval flow, Clockify sync, Jira worklog import, and invoice reconciliation
- Timesheet/TimeEntry Prisma models with DRAFT->SUBMITTED->APPROVED/REJECTED status machine, 12 Zod validators, and core service layer using optimistic locking
- Clockify and Jira adapters with on-demand sync services for external time entry import via API key and OAuth 2.0 3LO
- Portal time tRPC router with 8 endpoints and full contractor UI: weekly timesheet grid with auto-save, single entry dialog, Clockify/Jira sync buttons, and week navigation
- Admin time tRPC router with 8 procedures, manager approval queue with batch operations, per-contractor timesheet review, and rejection dialog with 10-char minimum validation
- Time-vs-invoice reconciliation service with configurable deviation threshold, DeviationFlag badge, ReconciliationCard on invoice detail, and ReconciliationTable in admin time section
- 60 it.todo behavioral contract entries across 4 test stub files for Jira issue sync, webhook handling, status mapping, and adapter webhooks
- Extended JiraAdapter with write/webhook scopes, built issue sync with ADF descriptions, inbound webhook handler with loop prevention and deduplication, and per-project bidirectional status mapping
- Jira tRPC router with 11 procedures (connection status, project/issue type listing, status mapping CRUD, task config, linked issues, recent activity, disconnect), webhook dispatch in _process route, and outbound Jira transitions from workflow task completion
- Jira provider card with OAuth connect, scope expansion detection, status mapping dialog with per-project two-column table, and project/issue type mapping dialog for task templates
- JiraIssueChip, JiraActivitySummary, and JiraTaskConfig components wired into contractor Workflows tab and workflow side panel with status-colored chips and overflow handling
- Mounted orphaned JiraTaskConfig in task-card.tsx and hardened siteUrl derivation removing 'your-site' placeholder fallback
- 43 it.todo test stubs across 6 files covering Notion, Confluence, Google Calendar, Outlook Calendar adapters plus doc-link and calendar-sync services
- Four OAuth adapters (Notion, Confluence, Google Calendar, Outlook Calendar) with Prisma schema changes, Zod validators, and per-user connection support
- Doc link service and tRPC router for attaching/detaching Notion and Confluence pages to workflow steps, with multi-provider search proxy
- Calendar event lifecycle service with Google/Outlook dual-push, 3 deadline sync watchers, task event creation, and 7-procedure tRPC router
- Doc link chips, attach dialog with search, doc links section for workflow task cards, and Cmd+K Docs search group with provider icons
- My Calendar settings page with Google/Outlook provider cards, per-task calendar event config dialog, org calendar section, and Notion/Confluence cards in integrations tab
- Added 4 adapter subpath exports to integrations, registered time permission resource, and restored validators helpers for clean package compilation
- Fixed 4 API source files (calendar, docs, doc-link-service, time-entry) eliminating ~20 TypeScript errors from ctx.userId, ctx.prisma, CredentialBlob cast, and PrismaClient transaction type issues
- Mounted DocLinksSection in workflow run task card and CalendarTaskConfig in template builder task card with correct prop wiring and section ordering
- Fire-and-forget calendar sync hooks wired into 8 contract/approval/invoice lifecycle mutations using void + .catch() pattern
- Restored ClaudeOcrAdapter registry resolution by adding missing slug property and re-registering in registerAllAdapters()
- Wire createJiraIssue fire-and-forget into startRun so TODO tasks with jiraEnabled templates automatically create Jira issues
- Portal signing URL endpoint via portalProcedure with recipient verification and conditional auth switching in EmbeddedSigningModal
- Fixed OAuth URL construction (space scopes, response_type=code, extraAuthParams) and wired createTaskCalendarEvent fire-and-forget into startRun with calendarTaskCount response toast
- registerAllAdapters() added to OAuth callback route + react-pdf CSS converted to dynamic imports for Next.js build compatibility

---

## v1.0 MVP (Shipped: 2026-03-23)

**Phases completed:** 11 phases, 51 plans, 98 tasks

**Key accomplishments:**

- Turborepo monorepo with 6 packages, complete Prisma 7 schema (40+ models across 11 bounded contexts), Neon adapter, tenant isolation via AsyncLocalStorage Client Extension, and soft-delete Client Extension with integer grosze for all monetary fields
- Better Auth with 8-role RBAC organization plugin, tRPC v11 middleware chain (auth/tenant/RBAC/sensitive), and organization/user/settings routers with re-authentication guards on sensitive actions
- Auth screens (register/login/invite), collapsible sidebar with org switcher and RBAC-filtered nav, org settings form, user management table with invite/role-change/deactivate, dark mode, and Indigo theme
- next-intl with Polish/English localization across all Phase 1 UI -- 9 translation namespaces, locale routing, PLN currency/date formatters, and language switcher
- tRPC contractor router with 10 procedures (CRUD, paginated list with FTS, lifecycle state machine, compliance health scoring, GUS BIR1 autofill, bulk operations, CSV/XLSX export) plus Zod validators with NIP mod-11 and IBAN validation
- Contractor list page with TanStack Table (12 columns, server-side pagination/sorting/filtering, bulk actions, side panel), 3-step add wizard with GUS NIP autofill, full Polish/English i18n
- Contractor profile page with header/lifecycle actions, 8-tab navigation (overview + compliance fully implemented), compliance health card with per-factor scoring, and sticky right rail with activity timeline and quick notes
- Contract tRPC router with 10 CRUD/list/status/amendment procedures, Zod validators, FTS tsvector migration, and org-level expiry reminder defaults in settings router
- R2 presigned URL upload/download flow with MIME magic-byte validation, ClamAV virus scanning, document versioning, and entity linking via tRPC router
- Contract list page with TanStack Table (12 columns, FTS search, multi-facet filters, pagination, bulk actions) and slide-out side panel on row click
- 3-step contract wizard with contractor billing pre-fill, drag-and-drop document upload via presigned URLs, and top bar quick action entry point
- Contract detail page with 4-tab layout (Overview, Documents, Amendments, Activity) and 6 reusable document components with drag-and-drop upload, PDF preview, and version history
- Contractor profile tabs replaced with real data (Contracts mini table, Documents cards, Compliance upload), Settings expiry reminder defaults, and full Phase 3 EN/PL translations
- Complete workflow tRPC router with template CRUD, run lifecycle, task actions, condition evaluator, assignee resolver, and overdue detection
- Workflow template builder with dnd-kit sortable task list, collapsible task cards, AND/OR condition builder, and 245-key EN/PL i18n translations
- Main /workflows page with runs TanStack Table, My Tasks list, Templates management, side panel preview, and template picker dialog for starting workflows
- Workflow run detail page with progress bar, task checklist, inline Complete/Skip/Reassign actions, threaded comments, and file attachments using Phase 3 document components
- Workflow engine fully connected: contractor profile Workflows tab, header Start onboarding/offboarding buttons, bulk Launch workflow, sidebar overdue badge, and auto-seeded starter templates
- Invoice tRPC router with 11 procedures, Zod validators, and NIP-based auto-matching engine with score classification and duplicate detection
- Resend Inbound webhook handler that receives emails, verifies signatures, parses org slug from recipient, uploads PDF attachments to R2, and creates Invoice drafts with EMAIL_INTAKE source
- Invoice list page with TanStack Table (11 columns), status chip bar with live counts, slide-out side panel, and multi-file PDF upload area with per-file progress
- Invoice detail page with 60/40 PDF split layout, editable metadata form (14 fields with grosze currency conversion), match card with confidence indicator and manual matching, and duplicate warning banner
- Contractor invoices tab with pre-filtered table, settings invoice matching section with copyable email and deviation threshold, full EN+PL translations
- Approval engine with configurable chain routing, 4-action state machine (approve/reject/delegate/clarify), SLA computation, and 14-procedure tRPC router including bulk ops and audit trail
- Settings > Approvals tab with chain list cards, chain editor dialog (1-3 level cards with user/role approver picker, SLA, required toggle), and condition builder for routing rules
- Approvals page with TanStack Table queue, SLA countdown badges, inline approve/reject, bulk toolbar, and side panel with 4 approval actions (approve, reject, clarify, delegate)
- Horizontal chain tracker stepper with status-colored steps and SLA badges, vertical audit timeline with human/system event split, and submit-for-approval action on invoice detail page
- Complete EN + PL i18n for all approval workflow UI (queue, chain tracker, audit timeline, settings) with SLA breach events verified in audit trail API
- Fixed broken bulk approve/reject wiring by adding onSelectionChange callback from TanStack Table row selection to parent page selectedIds state
- Notification dispatch service with deduplication, preference defaulting, and three tRPC routers for notifications, reminders, and Slack integration
- Slack client with AES-256-GCM encrypted tokens, 6 React Email templates, OAuth/interactivity/cron API routes
- Bell icon popover with 30s unread count polling, scrollable notification list, and full /notifications page with type filters, unread toggle, and pagination
- Notification preference matrix with per-channel toggles, reminder rules CRUD dialog, Slack OAuth connection card, and user mapping table in Settings tabs
- Real notification dispatch wired into approval/workflow/invoice routers with Resend email delivery, Slack Block Kit DMs, and full EN+PL i18n for all Phase 7 surfaces
- Vitest configured in api package with 50 todo test stubs covering payment router procedures, export generators, and bank statement parser
- Payment tRPC router with 12 procedures, 3 export formats (CSV/Elixir/SEPA), bank statement parser with auto-matching, and approval-to-READY transition fix
- Full /payments page with run history table, 3-step new payment run dialog, side panel with status management and D-04 invoice removal, bank statement import, and navigation wiring
- Contractor profile Payments tab with mini TanStack Table, settings transfer title template editor with live preview, and 144-key EN/PL i18n namespace covering all payment UI surfaces
- 64 vitest .todo() stubs across 4 files defining behavior contracts for dashboard KPIs, 5 report types, audit log, and CSV export
- 3 tRPC routers (dashboard/report/audit) with 17 query + 6 mutation procedures, raw SQL spend aggregations, and CSV export service
- Full dashboard with 5 KPI cards (trend indicators + click navigation), Recharts spend area chart with 6m/12m/YTD toggle, deadlines/approval/activity widgets in responsive two-column layout
- Reports page with 5 report types (spend/contractor, spend/team, expiring contracts, overdue invoices, compliance gaps), Recharts charts with drill-down, TanStack tables with server-side pagination, and CSV export
- Audit log viewer in Settings tab with searchable TanStack Table, expandable before/after diff rows, structured filters via nuqs, and CSV export
- Complete EN/PL translations for Dashboard (KPI, spend, deadlines, approvals, activity), with all hardcoded strings externalized from Phase 9 components
- CSV/XLSX import processor with column auto-mapping, row validation, and duplicate detection; unified cross-entity tsvector search router
- Reusable EmptyState component with prerequisite-aware smart sequencing and 5-step onboarding checklist widget on dashboard
- 5-step CSV/XLSX import wizard with column auto-mapping, validation preview, duplicate resolution, and list page integration
- Cmd+K command palette with tRPC global search, recent/pinned items, quick actions, and contextual empty states with smart sequencing across all 7 major list views
- Full English + Polish i18n for all Phase 10 surfaces: import wizard, onboarding checklist, empty states, and command palette via 4 new translation namespaces
- Fixed sidebar navigation hrefs, onboarding CTA links, and wired Cmd+K quick actions to open dialogs via ?action= URL params on 4 list pages
- Confirmed tenantStore.run() already wired in tenant middleware -- ORG-07 audit finding was stale, no code changes needed

---
