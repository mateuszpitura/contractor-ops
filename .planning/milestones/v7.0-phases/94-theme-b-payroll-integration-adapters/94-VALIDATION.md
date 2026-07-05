---
phase: 94
slug: theme-b-payroll-integration-adapters
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 94 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `94-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map is populated by the planner as tasks are authored.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) — `packages/payroll/package.json` (new), `packages/api/package.json`, `packages/integrations/package.json` |
| **Config file** | `packages/payroll/vitest.config.ts` (new, mirror einvoice); `packages/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/payroll test <path>` / `pnpm --filter @contractor-ops/api test <path>` |
| **Full suite command** | `pnpm --filter @contractor-ops/payroll test` (fast, pure); scoped API suite for feed/router |
| **Estimated runtime** | ~5–15s payroll (pure generators, no DB); ~30s scoped-by-path API |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` (kills Mac RAM).

---

## Sampling Rate

- **After every task commit:** Run scoped `pnpm --filter @contractor-ops/<pkg> test <changed-path>` (< 30s)
- **After every plan wave:** `pnpm -F @contractor-ops/payroll test` + `pnpm -F @contractor-ops/api test` + `pnpm typecheck --filter=@contractor-ops/api` + touched guards (`lint:schema`, `lint:audit-log`, `i18n:parity`, `check:web-vite-*`, `pnpm standards:check`, `pnpm check:no-process-env` when env touched)
- **Before `/gsd:verify-work`:** Full scoped payroll + api suites green + `pnpm check:wiki-brain` green
- **Max feedback latency:** 30 seconds (scoped)

---

## Per-Task Verification Map

> Seed rows map each phase requirement to its automated proof (from RESEARCH § Validation Architecture). Golden-fixture round-trip is the primary proof per D-05.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| (contract) | `registerProfile` throws on duplicate id; `getProfile` fail-fast on unknown; `listProfiles` returns all | unit | `pnpm -F @contractor-ops/payroll test registry` | ❌ W1 |
| (contract) | `engine.generate(profileId, feed)` delegates to `profile.generate`; `listTargets` maps id/country/displayName/flagKey | unit | `pnpm -F @contractor-ops/payroll test engine` | ❌ W1 |
| PAYROLL-PL-01 | Symfonia `generate(feed)` == golden CSV + golden XML (column contract, UTF-8 BOM) | unit (golden) | `pnpm -F @contractor-ops/payroll test symfonia` | ❌ W1 |
| PAYROLL-PL-02 | Comarch Optima import `generate(feed)` == golden fixture | unit (golden) | `pnpm -F @contractor-ops/payroll test comarch` | ❌ W1 |
| PAYROLL-PL-03 | Enova365 `generate(feed)` == golden fixture | unit (golden) | `pnpm -F @contractor-ops/payroll test enova` | ❌ W1 |
| PAYROLL-DE-01 | DATEV Lohn ASCII == golden fixture; exact record length hard-guard; DATEVconnect seam dark | unit (golden) | `pnpm -F @contractor-ops/payroll test datev` | ❌ W1 |
| PAYROLL-DE-02 | Sage DE Personalwirtschaft CSV == golden fixture; `payroll.sage-de` gate | unit (golden) | `pnpm -F @contractor-ops/payroll test sage-de` | ❌ W1 |
| PAYROLL-UK-01 | RTI FPS + EPS XML == golden fixture; XSD validate non-throwing when bundle absent | unit (golden) | `pnpm -F @contractor-ops/payroll test rti-fps rti-eps` | ❌ W1 |
| PAYROLL-US-01 | ADP CSV + Gusto-CSV + QuickBooks-CSV == golden fixture | unit (golden) | `pnpm -F @contractor-ops/payroll test adp gusto-csv quickbooks-csv` | ❌ W1 |
| PAYROLL-US-01 | Gusto/QuickBooks adapter OAuthConfig shape + payload map; live call **conditionally skips** without creds | unit + conditional | `pnpm -F @contractor-ops/integrations test gusto quickbooks` | ❌ W1 |
| PAYROLL-* | `buildPayrollFeed` joins Worker+EmployeeProfile+PersonnelFile; masks PII to last-4; reveal path audited | unit | `pnpm -F @contractor-ops/api test payroll-feed` | ❌ W1 |
| PAYROLL-* | Export procedure enforces `module.workforce-employees` + per-target `payroll.*`; `writeAuditLog` on export | unit | `pnpm -F @contractor-ops/api test payroll-export` | ❌ W1 |
| PAYROLL-* | Cross-org: export never returns another org's employees (IDOR) | integration | `pnpm -F @contractor-ops/api test payroll-cross-org` | ❌ W1 |
| PAYROLL-* | Payroll surface absent from `appRouter` when `module.workforce-employees` OFF (METHOD_NOT_FOUND) | unit (regression) | `pnpm -F @contractor-ops/api test root-router-gating` | ✅ extend |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 1 Requirements (the RED net — seeded before any impl)

- [ ] `packages/payroll/src/__tests__/registry.test.ts` + `engine.test.ts` — contract (RED via missing registry/engine module until 94-01 lands them; then GREEN as part of the foundation gate)
- [ ] `packages/payroll/src/__tests__/{symfonia,comarch,enova}.test.ts` + `fixtures/*.golden.{csv,xml}` — PL profiles (RED via missing profile module)
- [ ] `packages/payroll/src/__tests__/{datev,sage-de}.test.ts` + `fixtures/*.golden.{txt,csv}` — DE profiles (RED)
- [ ] `packages/payroll/src/__tests__/{rti-fps,rti-eps}.test.ts` + `fixtures/*.golden.xml` — UK RTI (RED)
- [ ] `packages/payroll/src/__tests__/{adp,gusto-csv,quickbooks-csv}.test.ts` + `fixtures/*.golden.csv` — US CSV floor (RED)
- [ ] `packages/integrations/src/adapters/__tests__/{gusto,quickbooks}-adapter.test.ts` — native OAuth config + payload map; live call `it.skipIf(!creds)` (RED via missing adapter module)
- [ ] `packages/api/src/services/__tests__/payroll-feed.test.ts` — feed-builder join + PII mask (RED via missing service)
- [ ] `packages/api/src/routers/__tests__/payroll-export.test.ts` — flag gate + audit (RED via missing router)
- [ ] `packages/api/src/routers/__tests__/payroll-cross-org.test.ts` — two-org IDOR (RED via missing router)

**tsconfig guard:** the new `packages/payroll/tsconfig.json` MUST exclude `src/**/__tests__/**` so RED scaffolds that import not-yet-built profiles do not brick `tsc --noEmit` (mirror the api/integrations exclusion Phase 88 added).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Gusto/QuickBooks OAuth round-trip | PAYROLL-US-01 native | Needs a partner OAuth app + client secret (external) | Set `GUSTO_*`/`QUICKBOOKS_*`, flip `payroll.gusto`/`payroll.quickbooks` APPROVED, connect an org sandbox, confirm token exchange + a sandbox push; conditional-skip tests auto-flip GREEN when creds land |
| ADP native push | PAYROLL-US-01 (ADP) | ADP Marketplace approval + mTLS → v7.1 | v7.0 verifies ADP **CSV** export only; native seam stays dark behind `payroll.adp` |
| Statutory format legal correctness (DATEV Lohn, RTI FPS/EPS, świadectwo/Symfonia layouts) | PAYROLL-DE-01/UK-01/PL-01 | Legal/tax-adviser judgment; local-only, sign-off deferred | Golden fixtures prove structural fidelity; adviser-verify annotation carried; Steuerberater/doradca review is a post-deploy checkpoint — do NOT hard-block |
| Import into a real vendor instance (Symfonia/Comarch/Enova/Sage/DATEV) | all file-export reqs | Requires a licensed vendor install | Founder imports a generated file into a vendor sandbox at enablement; golden fixture is the automated stand-in |
| RTI FPS/EPS strict XSD validation | PAYROLL-UK-01 | HMRC year XSD bundle is an offline download | Drop the year bundle into the RTI schema-bundle dir; the non-throwing validate seam tightens to strict; export ships without it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 1 RED dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 1 covers all MISSING references (every profile + feed + router)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
