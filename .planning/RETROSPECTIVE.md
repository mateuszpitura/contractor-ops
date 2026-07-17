# Retrospective: Contractor Ops

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-23
**Phases:** 11 | **Plans:** 51 | **Tasks:** 98

### What Was Built
- Full B2B contractor lifecycle platform: org setup, RBAC, contractors, contracts, documents, workflows, invoices, approvals, notifications, payments, dashboard, reports, import, onboarding, search
- 214K LOC TypeScript across 698 files in a Turborepo monorepo
- 19 tRPC routers, 40+ Prisma models across 11 bounded contexts
- Full Polish + English i18n with locale-aware formatting
- Complete invoice-to-payment pipeline with audit trail
- Slack integration with inline approve/reject actions

### What Worked
- **Wave-based parallel execution** — spawning 2-3 executor agents per wave kept phases under 15 minutes each
- **Phase-per-feature granularity** — each phase delivered a coherent, testable capability
- **Pattern replication** — establishing patterns early (wizard-dialog, TanStack Table, tsvector search, settingsJson) made later phases faster
- **Discussion → Research → Plan → Execute → Verify pipeline** — caught issues before execution (e.g., UI-SPEC checker flagging CTA copy)
- **Gap closure workflow** — Phase 11 quickly fixed integration issues found by milestone audit

### What Was Inefficient
- **Progress table drift** — ROADMAP.md progress table fell out of sync with actual completion status across phases
- **Phase 01 verification snapshot** — stale VERIFICATION.md caused false positive in milestone audit (ORG-07 tenant isolation)
- **Nyquist compliance** — VALIDATION.md files created but never fully executed; test stubs created but not run

### Patterns Established
- Integer grosze for all monetary fields (no floating-point)
- Local wizard Zod schemas mirroring validators package (avoid cross-package deps)
- base-ui render prop pattern (not Radix asChild) for all trigger components
- settingsJson merge pattern for org-level configuration
- Fire-and-forget pattern for async operations (notifications, virus scanning)
- nuqs for URL-synced table state across all list pages
- `?action=new` URL param pattern for wizard deep-linking from search/onboarding

### Key Lessons
1. **Establish patterns in Phase 1, replicate in Phase 2+** — the wizard-dialog and TanStack Table patterns were copy-pasted 8+ times
2. **i18n per phase, not as a final phase** — each phase included its own translations, preventing a massive i18n cleanup phase
3. **Audit at milestone boundary catches integration gaps** — sidebar nav hrefs and onboarding CTAs were broken across 6 files, only caught by cross-phase integration check
4. **Wave 0 test stubs are cheap insurance** — 50+ test stubs defined behavior contracts that guided implementation
5. **Gap closure phases are fast** — Phase 11 (2 plans, 3 tasks) fixed all audit issues in one wave

### Cost Observations
- Model mix: ~70% Opus (execution), ~30% Sonnet (verification/checking)
- Total context used efficiently — orchestrator stayed at ~10-15%, fresh subagents for each plan
- 6 days from project init to milestone complete

---

## Milestone: v2.0 — Platform Expansion

**Shipped:** 2026-04-01
**Phases:** 16 | **Plans:** 52 | **Tasks:** 103

### What Was Built
- Contractor self-service portal: magic-link auth, contract/invoice/document/payment views, invoice submission with OCR pre-fill, profile management with approval workflow, notification preferences, org branding with custom subdomain routing
- Integration framework: provider adapter pattern with AES-256-GCM credential store, unified webhook pipeline (QStash), OAuth callback with CSRF, proactive token refresh with distributed lock, health monitoring dashboard
- Electronic signatures: DocuSign (embedded iframe) + Autenti (redirect), multi-party signing with routing order, webhook-driven signed PDF archival, portal signing flow
- AI-powered invoice OCR: Claude Vision with native PDF support, per-field confidence scoring, side-by-side review panel, NIP checksum validation
- KSeF national e-invoicing: RSA-OAEP challenge auth, FA(3) XML parser, hourly QStash sync, cross-source duplicate detection
- Time tracking: weekly timesheet grid, Clockify API + Jira OAuth worklog import, manager approval queue, invoice deviation flagging
- Jira bidirectional sync: auto-issue creation from workflows, status mapping with loop prevention, webhook handler, linked issue chips
- Documentation integration: Notion/Confluence page linking in workflows, Cmd+K doc search
- Calendar integration: Google/Outlook deadline auto-push on contract/approval/invoice lifecycle, workflow task event creation
- 6 gap closure phases (21-27) fixing build errors, component mounting, adapter registration, auth wiring, OAuth callbacks

### What Worked
- **Provider adapter pattern** — single infrastructure for 10 integrations (Slack, Jira, DocuSign, Autenti, KSeF, Clockify, Notion, Confluence, Google Calendar, Outlook Calendar), zero per-provider infrastructure code
- **Gap closure phases** — milestone audit identified 7 cross-phase wiring issues; small focused phases (1 plan each) closed all gaps efficiently
- **Fire-and-forget pattern** — `void + .catch()` for calendar sync, Jira issue creation, OCR processing; never blocks user mutations
- **Portal as route group** — sharing auth, DB, tRPC, UI packages avoided duplication while keeping clean separation via `portalProcedure`
- **3-source requirement verification** — VERIFICATION.md + SUMMARY frontmatter + REQUIREMENTS.md traceability caught 2 stale "Pending" entries (INTG-01, OCR-03) that were actually satisfied

### What Was Inefficient
- **Gap closure phase count** — 7 phases (21-27) for wiring fixes that should have been caught during initial phase execution; integration checker at phase boundaries would have prevented most
- **dist/ stale on checkout** — multiple phases tripped over stale TypeScript build artifacts; added postinstall to fix but should have been addressed in Phase 12
- **Test stubs without implementation** — 200+ `it.todo()` stubs created across v2.0 but none implemented; provides behavior contracts but zero regression safety
- **Dead code accumulation** — orphaned tRPC procedures (`getOrgBranding`, `syncContractDeadline`, `syncPaymentDeadline`) shipped and only caught at milestone audit

### Patterns Established
- Per-provider encryption keys via `${SLUG_UPPER}_ENCRYPTION_KEY` env var convention
- BaseAdapter with optional OAuth/webhook/health capabilities
- `registerAllAdapters()` with idempotent guard at module scope for API routes
- QStash for async processing (webhooks, OCR, KSeF sync) with signature verification
- Portal magic-link auth with SHA-256 hashed sessions and httpOnly cookies
- `calendarTaskConfigSchema.safeParse(configJson)` pattern for reading structured task template config
- Dynamic CSS import via `useEffect` for Next.js-incompatible library styles (react-pdf)

### Key Lessons
1. **Run integration checker before gap closure, not after** — 5 of 7 gap closure phases addressed issues visible in a cross-phase wiring check
2. **Bank account encryption was missing** — storing plaintext in a field named "encrypted" is both misleading and a security gap; fixed with AES-256-GCM during milestone completion
3. **postinstall for TypeScript monorepos is mandatory** — `^build` dependency in turbo.json handles ordering but not initial checkout; postinstall closes the gap
4. **Dead code ships silently** — orphaned procedures were never caught until the integration checker listed tRPC endpoints with zero callers
5. **Portal session expiry needs explicit redirect** — relying on tRPC UNAUTHORIZED to fail queries leaves users on a blank page instead of login

### Cost Observations
- Model mix: ~65% Opus (execution, verification), ~35% Sonnet (research, checking, integration)
- 14 days from Phase 12 start to milestone complete
- Gap closure phases averaged <2 min execution each — high ROI for small fixes

---

## Milestone: v5.0 — UK & Germany Expansion

**Shipped:** 2026-04-26
**Phases:** 14 (56-69) | **Plans:** 70

### What Was Built
- Generic contractor classification engine (UK IR35 + German Scheinselbständigkeit) with per-engagement assessments, SDS PDF generation, IR35 chain tracking, DRV audit defense bundle
- Automated economic-dependency alerts (70%/83.33% bands), reassessment triggers, Statusfeststellungsverfahren tracking, per-market compliance health dashboard
- EN 16931 e-invoicing: XRechnung 3.0.2 CII XML generator + ZUGFeRD PDF/A-3 hybrid + KoSIT 3-layer validator (libxmljs2 XSD + saxon-js EN16931 + saxon-js XRechnung CIUS Schematron)
- Leitweg-ID lifecycle (per-contractor / per-contract resolution) + Peppol BIS 3.0 transmission via Storecove with capability cache
- BACS Standard 18 Direct Credit export with VocaLink modulus check + ASCII transliteration; LPCDA-compliant statutory late-payment interest with BoE base-rate poller and claim PDF; German Skonto cascade with structured BG-20 emission (`#SKONTO#TAGE=n#PROZENT=n#`)
- HMRC VAT validation (OAuth + fraud-prevention headers) + VIES qualified USt-IdNr confirmation + tax-id-validation orchestrator with 90-day freshness window
- German i18n at full message-key parity (4,281 leaves, formal-Sie register, 78/78 locked legal phrases CI guard); UK GDPR + German Datenschutzerklärung MDX with React-PDF download (IDOR-safe)
- Country-specific contractor field validators (UTR mod-11, GB VAT mod-97/9755, Companies House; Steuernummer 16-Bundesland regex map, USt-IdNr ISO 7064, SV-Nummer DRV-spec, Handelsregister ~120-court list)
- Legal compliance hardening: Unleash feature-flag with PENDING → APPROVED CI gate, advisory banners, ToS reacceptance, classification flag-OFF render-tree removal + tRPC FORBIDDEN

### What Worked
- **Audit-driven gap-closure phases** — v5.0 milestone audit surfaced 5 audit findings; each got its own dedicated phase (65-69) with traceable VERIFICATION.md, rather than retrofitting onto original phases. Clean traceability story for every requirement.
- **Single-source-of-truth pattern for cross-cutting business rules** — `resolveSkontoTerm` in `services/skonto.ts` was authored in Phase 63 and re-consumed (not re-implemented) in Phase 68 across two new call sites
- **Locked-phrase compile-time CI guard** — Phase 56 pattern extended cleanly through Phases 58, 59, 60, 62, 63, 64 (78/78 final count) without drift
- **`api → einvoice` dependency direction** — strict one-way enforcement let Phase 68's wiring fix avoid creating bidirectional coupling
- **4-layer regression test coverage for audit I-1 closure** — Layer A (profile unit) + Layer B (finalize integration) + Layer C router (mocked) + Layer C deeper (real-PDF byte-level CII extraction). Belt-and-suspenders for a CRITICAL audit finding.
- **Background manager dispatching** — running plan-phase + execute-phase in parallel for adjacent phases compressed wall time without sacrificing isolation

### What Was Inefficient
- **`milestone.complete` SDK helper bug** — handler delegates to `phasesArchive([], projectDir)` with empty args instead of `[version]`; the milestone-close workflow had to fall back to direct `phases.archive` invocation. Filed for SDK fix.
- **Cross-package build coordination** — `packages/api` consumes `packages/einvoice`'s compiled `dist/`, requiring rebuilds between cross-package edits within a single phase
- **Phase 67 verification surfaced GAP-67-01-01 late** — i18n parity drift from Phases 63 + 64 wasn't caught at those phases' own ship time because each only verified its own surface area
- **Pre-existing `packages/api` test suite breakage** — 56 failed test files / 36 failed tests rooted in `auth/src/roles.ts` permission DSL; predates v5.0; carried forward as tech debt
- **Stale milestone audit at close time** — v5.0-MILESTONE-AUDIT.md was generated before Phases 65-69 closed its flagged gaps; the audit's `gaps_found` status persisted in the file even though the actual gaps were all closed

### Patterns Established
- **Symmetric DE profile contracts** — `XRechnungDEProfile.generate(invoice, opts)` and `ZugferdDEProfile.generate(invoice, opts)` accept the same shape so cross-DE callers stay format-agnostic
- **`payment.ts:1213-1294` Skonto cascade pattern** — eager-load `skontoTerms` via Prisma include + call `resolveSkontoTerm` inline at every consumption site
- **Foreign-statute parenthetical-English convention** — when translating UK/EU statute names into DE locale, primary in German with canonical English in parens on first occurrence; avoids BGB conflation
- **Forward-only fixes for LOCAL-ONLY deploy posture** — Phases 65/68/69 all skipped historical-data backfill scripts per Standing Project Constraints
- **KoSIT validator-bundle as a black-box pinned release** — never patched; custom Schematron deferred (Phase 68 D-11 parked the BG-20 assertion as out-of-scope)
- **Audit-grade test coverage for CRITICAL audit findings** — 4 layers (unit + integration + router + real-byte) for Phase 68 vs single-layer for normal feature work
- **Standing Project Constraints in STATE.md as a referenced contract** — every phase's CONTEXT.md cited "STATE.md §Standing Project Constraints" for deferral rationale (Steuerberater, manual UI UAT, backfill scripts), keeping disposition consistent across 14 phases

### Key Lessons
- **Cross-phase wiring needs cross-phase verification.** Per-phase VERIFICATION.md proved its own surface area but didn't test the production wiring at boundaries — that's exactly how I-1 (Skonto BG-20 not threaded through finalize) slipped past Phases 61, 62, 63 individually. The fix is at the milestone audit layer, not the phase layer.
- **Milestone audits should be re-run after gap-closure phases ship** — running a fresh audit at close time would have flipped the milestone status from `gaps_found` to `passed` automatically.
- **Locked compile-time legal phrases scale to 78 entries with zero drift** — the pattern from Phase 56 (CI guard + named imports + grep assertion) held cleanly through 7 more phases of additions.
- **Single-source-of-truth pays off when re-used** — `resolveSkontoTerm` was written once in Phase 63 D-21 and consumed three times. Zero drift, zero re-implementation, zero per-call-site test boilerplate.
- **Foreign-statute terminology matters for legal traceability** — translating LPCDA `statutory interest` directly to BGB `Verzugszinsen` would have misled DE users into thinking BGB rules apply. Phase 69 D-02 caught this because the discussion phase explicitly compared the two regimes.
- **Gap-closure phases compound the milestone audit signal** — five gap-closure phases (65-69) shipped in <12 hours of background-agent execution because they were narrow, well-scoped, single-purpose.

### Cost Observations
- Background manager dispatching consumed ~62 minutes of total background-agent execution for Phases 68 + 69 (plan + execute each)
- Plan-phase agents averaged ~12 min, execute-phase agents averaged ~20 min
- 4 background agents spawned in this session; all returned READY/PASSED on first iteration with no revision loops
- Notable: gap-closure phases averaged <2 min planning per plan vs ~5 min for v5.0 original phases — narrower scope translates directly to faster planning loops

---

## Milestone: v6.0 — Platform Maturity & Operational Hardening

**Shipped:** 2026-06-07
**Phases:** 12 (70–81) | **Plans:** 90 | **Tasks:** 392

### What Was Built
F1 Compliance Document Lifecycle Engine (per-jurisdiction policy package, 90/60/30/15/7-day reminder cascade, hard payment-block + auto-recovery, admin dashboard, portal self-service). F2 Identity Provider Deprovisioning saga across 5 providers (GWS/Slack/Entra/Okta/GitHub) with 14-day cooldown, suspend+revoke contract, and a UI trigger on the offboarding ACCESS_REVOKE task. F3 Gulf polish (UAE free-zone tracking, Saudization dashboard, Arabic RTL). F4 Offboarding hardening (KT templates, IP-assignment verification, credential vault, contract-clause health check). Cross-cutting `@contractor-ops/lint-guards` CI package + default-redact logger + feature-flag signoff registry.

### What Worked
- **Audit → closure-phase loop.** The milestone audit caught two integration blockers (INT-01/INT-02) where server logic shipped + was per-phase-verified, but the cross-phase seam was never wired (feature UI-unreachable). A dedicated closure phase (81) wired both, and the re-audit flipped 16 partial requirements to satisfied. Goal-backward integration checking catches what per-phase verification structurally cannot.
- **Sequential-on-symlink execution.** `.planning/phases` is a symlink; worktree executors would lose SUMMARY.md on `git add` ("beyond a symbolic link"). Running Phase 81 sequentially on the main tree with real-milestone-path commits avoided the loss entirely.
- **Code-review-as-gate found a real auth bug.** Phase 81's review caught `retryDeprovisioningStep` ungated (any org member could re-fire destructive SUSPEND/REVOKE) — exactly the subsystem the phase was hardening.

### What Was Inefficient
- **GSD tooling instability** (missing `model-catalog.json`) repeatedly blocked plan/execute mid-milestone (Phases 75/77/78), forcing inline orchestration and leaving stale blocker notes in STATE.md.
- **`apps/web` → `apps/web-vite` drift** stranded Phase 73's UI plans (authored against the deleted Next.js app), forcing a full re-plan.
- **Verification debt accrued silently.** 3 phases (70/71/75) shipped with no VERIFICATION.md and 28 human-UAT scenarios stayed open — surfaced only at milestone-close audit, not during execution.

### Patterns Established
- Per-phase `<threat_model>` STRIDE registers feeding a retroactive `secure-phase` audit (Phase 81: 24/24 threats verified in code).
- `@contractor-ops/lint-guards` ts-morph/AST CI guards (schema tenant-scope, body-redaction, i18n parity, OAuth scopes) — mechanical drift prevention with zero-friction baselines.
- Single canonical guard for cross-cutting business rules (`assertContractorPaymentEligibility`, `idp:start_run`) instead of scattered checks.

### Key Lessons
- Per-phase verification ≠ integration verification. A milestone needs a goal-backward cross-phase audit before close — server-complete + UI-unwired reads as "done" in SUMMARY frontmatter.
- A symlinked planning tree silently breaks worktree-isolated executors; detect it up front and drop to sequential + real-path commits.
- "Claimed complete, unverified" (Slack D-08) and "stale audit blocker" classes both resolve by re-checking source, not trusting prior artifacts.

### Cost Observations
- Phase 81 (closure) executed sequentially: 6 plans on opus, code-review + 4 fixes, verification (sonnet), secure-phase (opus), all scoped-test only (web-vite full suite avoided per RAM constraint).
- Milestone-close: re-audit (integration-checker on sonnet) flipped gaps_found's functional blockers to closed; remaining gate is verification/UAT process debt.

---

## Milestone: v7.0 — GTM Expansion

**Shipped:** 2026-07-17
**Phases:** 20 (82–101) | **Themes:** A (US cross-border) / B (workforce) / C (integration platform), run in parallel

### What Was Built
US tax + payment rail (treaty engine, TIN-match → 1099/1042-S → IRIS e-file, USD ACH/Fedwire); six-market workforce (Worker abstraction, EmployeeProfile ×6, akta/ewidencja, leave + KP-grade time, payroll export + native Gusto/QuickBooks, Personio/BambooHR sync, employee portal, HR dashboard); public REST API + keys/scopes/rate-limits + OWASP-gated outbound webhooks + Zapier/n8n/Make marketplace + dev portal + sandbox.

### What Worked
- **Discuss → parallel-plan → parallel-execute** at fleet scale: discussing 94–97 fed a parallel agent fleet that planned + built them concurrently; the manager terminal stayed the single point of coordination.
- **Investigate-before-reconcile** caught three different failure modes behind a "20/20 complete" facade: 98 was pure summary-backfill drift (safe rubber-stamp), 92 hid a real 3-market functional gap (UAE/KSA statutory leave/WT), and 101 hid three genuinely-unbuilt plans. Blindly marking complete would have shipped all three unnoticed.
- **Milestone audit's integration-checker** found two latent **built-but-unwired producer seams** (outbound-webhook emit, TIN-match trigger) — dark-masked behind flags, so invisible until a flag flipped — and both were closed before archive.
- **business-logic-shield** (S1-wired / S2-seam-test / T1-audit-in-tx) on every gap fix kept the money/compliance wiring honest; the proven `enqueueHrisEmployeePush` mirror made the webhook wiring mechanical.

### What Was Inefficient
- **Summary-backfill drift** recurred at three scales (plan, phase, milestone-traceability): the fleet executed code without writing SUMMARYs / updating the requirements status column, so GSD state undercounted delivery and required reconciliation passes. A post-execute summary/traceability sync would prevent it.
- **Per-phase VERIFICATION.md skipped** on ~12 fleet-built phases — verification became a milestone-close scramble instead of a per-phase gate.

### Patterns Established
- **Build-now, flag-defer-approvals** for external-dependency surfaces (marketplace submissions, IRS PAF, npm publish): ship the buildable artifact behind a default-off flag + an EXTERNAL-ENABLEMENT row; never gate GA on an external reviewer.
- **Correct-by-design absence documented in code** (US statutory-leave / FLSA no-cap; UAE Emiratisation manual-headcount) — so an audit doesn't re-flag it as a gap.
- **Dark-masked ≠ safe:** a producer seam wired only behind a default-off flag still needs its emit wired, or the whole downstream deliverable is hollow when the flag flips.

### Key Lessons
- A milestone at "N/N phases complete" is a claim, not a fact — audit the *integration seams* and the *requirements traceability* independently before archiving.
- Reconcile, don't rubber-stamp: verify whether "drift" is untracked-but-built vs genuinely-unbuilt before flipping status.

### Cost Observations
- Heavy use of parallel worktree executors (opus) for fleet build + gap fixes; the manager terminal orchestrated inline while background agents did the multi-file work.
- Investigate-first (cheap read-only cavecrew-investigator passes) repeatedly prevented expensive duplicate-execution on already-built code.

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | LOC | Key Pattern |
|-----------|--------|-------|------|-----|-------------|
| v1.0 MVP | 11 | 51 | 6 | 214K | Wave-based parallel execution |
| v2.0 Platform Expansion | 16 | 52 | 14 | +44K | Provider adapter pattern, gap closure phases |
| v5.0 UK & Germany Expansion | 14 | 70 | 14 | +142K TS | Audit-driven gap-closure phases (65-69), locked compile-time legal phrases (78/78), single-source-of-truth cross-phase business rules |
| v6.0 Platform Maturity & Operational Hardening | 12 | 90 | ~41 | n/a | Audit-driven integration-closure phase (81 closed INT-01/INT-02), lint-guards CI package, secure-phase STRIDE verification, sequential-on-symlink execution |
