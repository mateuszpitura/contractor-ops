---
phase: 21-api-build-fixes-permission-registration
verified: 2026-03-30T10:00:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Confirm stale-dist build order: clone fresh, run pnpm install, then run `pnpm --filter @contractor-ops/auth build && pnpm --filter @contractor-ops/integrations build && pnpm --filter @contractor-ops/api exec tsc --noEmit` in sequence"
    expected: "All three commands exit 0; API tsc produces zero errors"
    why_human: "dist/ is gitignored — automated verification requires sequential dependency builds in a clean environment; cannot be proven from source inspection alone without running the build chain"
  - test: "Verify DOCS-01, CAL-01, CAL-02 requirements assignment — REQUIREMENTS.md maps them to Phase 22, but Phase 21 plans claim them"
    expected: "Either REQUIREMENTS.md phase mapping table is updated to include Phase 21 for these IDs, or the plans' `requirements` frontmatter is corrected to remove DOCS-01, CAL-01, CAL-02"
    why_human: "Cross-phase requirement ownership conflict requires human decision on which document is authoritative"
---

# Phase 21: API Build Fixes & Permission Registration Verification Report

**Phase Goal:** All API packages compile cleanly and runtime bugs in calendar/time routers are eliminated
**Verified:** 2026-03-30T10:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `packages/api` compiles with zero TypeScript errors | VERIFIED | `pnpm --filter @contractor-ops/api exec tsc --noEmit` exits 0 after building auth + integrations deps |
| 2 | All 4 adapter subpath exports resolve correctly from `packages/integrations` | VERIFIED | All 4 entries present in `packages/integrations/package.json`; source adapter files exist; integrations builds cleanly |
| 3 | `time` resource registered in `permissions.ts` — admin time router procedures pass type-check | VERIFIED | `time: ["read", "approve"]` at line 23 of permissions.ts; time.ts uses `requirePermission({ time: [...] })` at 11 locations |
| 4 | `ctx.user.id` used consistently in `calendar.ts` — no runtime crashes | VERIFIED | 5 occurrences of `ctx.user!.id` found (lines 51, 75, 120, 197, 243); zero occurrences of `ctx.userId` |
| 5 | `contract.title` used in `calendar.ts` — `syncContractDeadline` executes without error | VERIFIED | `title: true` in select (line 171); `contractName: contract.title` (line 194); `contractorId` is non-nullable in schema so `contract.contractor.displayName` is safe |
| 6 | `CredentialBlob` cast in `doc-link-service.ts` compiles without error | VERIFIED | `credentials.extra` direct access at lines 241-242; zero occurrences of `credentials as Record` |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `packages/integrations/package.json` | 4 new adapter subpath exports | VERIFIED | Lines 72-90: notion-adapter, confluence-adapter, google-calendar-adapter, outlook-calendar-adapter all present |
| `packages/auth/src/permissions.ts` | time resource registration | VERIFIED | `time: ["read", "approve"]` at line 23 |
| `packages/auth/src/roles.ts` | time permission assignments to roles | VERIFIED | 5 `time:` entries: allPermissions (line 26), admin (line 49), finance_admin (line 59), ops_manager (line 69), team_manager (line 78) |
| `packages/api/src/routers/calendar.ts` | Calendar router with correct context access and field names | VERIFIED | Contains `ctx.user!.id` (5x), `title: true`, `contractName: contract.title`, nullable contractor on invoice |
| `packages/api/src/routers/docs.ts` | Docs router with correct prisma usage and return types | VERIFIED | Contains `attachDocLink(prisma,` (line 67), `): "NOTION" \| "CONFLUENCE" {` (line 26) |
| `packages/api/src/services/doc-link-service.ts` | Doc link service with correct CredentialBlob access | VERIFIED | `credentials.extra` at line 241 |
| `packages/api/src/services/time-entry.ts` | Time entry service with correct transaction type | VERIFIED | `type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]` at line 4; `async (tx: TxClient)` at line 103 |
| `packages/validators/src/helpers.ts` | Restored utility schemas (deviation fix) | VERIFIED | File exists; dist/helpers.js builds correctly |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/time.ts` | `packages/auth/src/permissions.ts` | `requirePermission({ time: [...] })` | WIRED | 11 `requirePermission` calls using `time:` resource at lines 55, 85, 134, 176, 268, 284, 301, 317, 339, 359, 414 |
| `packages/api/src/services/calendar-event-service.ts` | `packages/integrations/package.json` | `import from @contractor-ops/integrations/adapters/google-calendar-adapter` | WIRED | Line 2 imports GoogleCalendarAdapter; line 3 imports OutlookCalendarAdapter; subpath entries exist in package.json |
| `packages/api/src/routers/calendar.ts` | `packages/api/src/services/calendar-deadline-sync.ts` | `syncContractExpiryDeadline / syncPaymentDueDeadline calls` | WIRED | Lines 11-12 import both functions; lines 191, 237 call them |
| `packages/api/src/routers/docs.ts` | `packages/api/src/services/doc-link-service.ts` | `attachDocLink(prisma, ...)` | WIRED | Lines 67, 86, 100 all pass top-level `prisma` (not `ctx.prisma`) |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase fixes compilation errors in API routers and services. No new user-facing rendering components were introduced. All changes are TypeScript type corrections and permission registrations.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| API package compiles with zero TS errors (after deps rebuilt) | `pnpm --filter @contractor-ops/api exec tsc --noEmit` | Exit 0, no output | PASS |
| time resource in permissions.ts source | `grep -c 'time:' packages/auth/src/permissions.ts` | 1 | PASS |
| time permissions in roles.ts (all 5 locations) | `grep -c 'time:' packages/auth/src/roles.ts` | 5 | PASS |
| All 4 adapter exports in integrations package.json | `node -e "const p=require('./packages/integrations/package.json');['notion','confluence','google-calendar','outlook-calendar'].forEach(a=>{if(!p.exports['./adapters/'+a+'-adapter'])throw new Error(a)})"` | No error | PASS |
| No ctx.userId in calendar.ts | `grep -c 'ctx\.userId' packages/api/src/routers/calendar.ts` | 0 | PASS |
| No ctx.prisma in docs.ts | `grep -c 'ctx\.prisma' packages/api/src/routers/docs.ts` | 0 | PASS |
| No unsafe CredentialBlob cast | `grep -c 'credentials as Record' packages/api/src/services/doc-link-service.ts` | 0 | PASS |
| TxClient type alias present | `grep -c 'TxClient' packages/api/src/services/time-entry.ts` | 2 (definition + usage) | PASS |
| Auth dist stale on checkout (before rebuild) | First run of `tsc --noEmit` without rebuilding auth | 15 errors: `time` does not exist in type `Permission` | FAIL — dist/ is gitignored; stale on fresh checkout |
| Integrations dist stale on checkout (before rebuild) | First run of `tsc --noEmit` without rebuilding integrations | 4 errors: Cannot find module adapter paths | FAIL — dist/ is gitignored; stale on fresh checkout |

---

### Requirements Coverage

| Requirement | Source Plan | REQUIREMENTS.md Phase | Description | Status | Evidence |
|-------------|------------|----------------------|-------------|--------|----------|
| TIME-02 | 21-01, 21-02 | Phase 21 | Manager can review and approve/reject submitted time entries | SATISFIED | `time: ["read", "approve"]` registered in permissions.ts and roles.ts; time.ts procedures use correct `requirePermission({ time: [...] })` |
| DOCS-02 | 21-01, 21-02 | Phase 21 | User can search and link Notion/Confluence pages from within Cmd+K | SATISFIED | docs.ts compiles correctly with `prisma` (not `ctx.prisma`); doc-link-service.ts CredentialBlob cast fixed; confluence-adapter and notion-adapter subpath exports present |
| DOCS-01 | 21-01, 21-02 | **Phase 22** (plan claims Phase 21) | User can attach Notion or Confluence page links to workflow steps | CONFLICT | Phase 21 plans claim DOCS-01 but REQUIREMENTS.md maps it to Phase 22 — see Orphaned Requirements below |
| CAL-01 | 21-01, 21-02 | **Phase 22** (plan claims Phase 21) | System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar | CONFLICT | Phase 21 plans claim CAL-01 but REQUIREMENTS.md maps it to Phase 22 — see Orphaned Requirements below |
| CAL-02 | 21-01, 21-02 | **Phase 22** (plan claims Phase 21) | Workflow steps can create calendar events (e.g., onboarding kickoff meeting) | CONFLICT | Phase 21 plans claim CAL-02 but REQUIREMENTS.md maps it to Phase 22 — see Orphaned Requirements below |

#### Orphaned Requirements (REQUIREMENTS.md maps to Phase 22, not Phase 21)

The Phase 21 plan frontmatter (`requirements: [DOCS-01, DOCS-02, CAL-01, CAL-02, TIME-02]`) claims DOCS-01, CAL-01, and CAL-02. However, REQUIREMENTS.md phase mapping table (lines 147, 149, 150) assigns all three to Phase 22:

- `DOCS-01 | Phase 22 | Complete`
- `CAL-01 | Phase 22 | Complete`
- `CAL-02 | Phase 22 | Complete`

This is a documentation ownership conflict. The functional work that enables DOCS-01 (doc-link-service fixes) and CAL-01/CAL-02 (calendar adapter exports, calendar.ts runtime fixes) was performed in Phase 21. However, the REQUIREMENTS.md tracking table says Phase 22 owns these IDs. Human decision needed on which document to update.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/auth/dist/permissions.d.ts` | — | Stale dist on checkout (time resource absent) | WARNING | API package fails to compile until `pnpm --filter @contractor-ops/auth build` is run; dist/ is gitignored so every fresh checkout requires explicit rebuild |
| `packages/integrations/dist/adapters/` | — | Missing adapter dist files on checkout | WARNING | API package fails to compile until `pnpm --filter @contractor-ops/integrations build` is run; same gitignore root cause |
| `packages/validators/dist/` | — | Missing calendar.js, docs.js, calendar.d.ts, docs.d.ts on checkout | WARNING | Any consumer of `@contractor-ops/validators` calendar or docs exports will fail to resolve until validators is rebuilt |

None of these are BLOCKER anti-patterns in the source code — they are build orchestration gaps. The source changes are correct. The issue is that the phase execution happened in a worktree and dist artifacts were not committed (and cannot be, per `.gitignore`). The build chain must be run in order on a fresh checkout.

---

### Human Verification Required

#### 1. Build Chain Order on Fresh Checkout

**Test:** In a fresh checkout (or after `git clean -xfd packages/*/dist`), run the following in sequence:
```
pnpm --filter @contractor-ops/validators build
pnpm --filter @contractor-ops/auth build
pnpm --filter @contractor-ops/integrations build
pnpm --filter @contractor-ops/api exec tsc --noEmit
```
**Expected:** All four commands exit 0; API tsc reports zero errors.
**Why human:** The dist/ directories are gitignored. The source changes are correct and verified, but the build chain must be validated end-to-end in a clean environment to confirm no hidden dependency issues remain.

#### 2. Requirements Phase Ownership Conflict

**Test:** Review whether DOCS-01, CAL-01, CAL-02 should be credited to Phase 21 or Phase 22.
**Expected:** REQUIREMENTS.md phase mapping table and plan `requirements` frontmatter agree on which phase owns each requirement ID.
**Why human:** This is a documentation ownership decision. The functional work enabling DOCS-01/CAL-01/CAL-02 was done in Phase 21 (doc-link-service fixes, calendar router fixes, adapter exports). REQUIREMENTS.md says Phase 22. One document needs to be updated.

---

### Gaps Summary

No source-code gaps found. All 6 roadmap success criteria are met by the source changes.

The two items flagged for human verification are:

1. **Build chain validation in a clean environment** — the worktree execution correctly modified source files, but the dist-based type resolution means the full goal ("API packages compile cleanly") depends on running builds in the right order. This has been confirmed interactively during this verification session, but should be validated in a clean CI-like environment.

2. **Requirements documentation conflict** — DOCS-01, CAL-01, CAL-02 are claimed by Phase 21 plans but mapped to Phase 22 in REQUIREMENTS.md. The functional work is done; only the tracking document needs reconciliation.

---

_Verified: 2026-03-30T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
