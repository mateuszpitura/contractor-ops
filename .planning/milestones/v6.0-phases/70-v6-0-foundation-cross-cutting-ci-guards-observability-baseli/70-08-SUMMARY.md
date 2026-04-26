---
phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
plan: 08
subsystem: infra

requires:
  - phase: 70-03
    provides: Logger root default-redact for body / *.body paths

provides:
  - "getIdpAuditLogger() factory — returns Pino child with bindings { service: 'idp-audit' } and redact paths inheriting PII_MASK_PATHS minus 'body' and '*.body'"
  - "createIdpAuditChild(parent) helper — same contract, accepts arbitrary parent (used by tests with an in-memory Writable sink)"
  - "IDP_AUDIT_ALLOWED_FIELDS readonly array of 9 canonical audit fields"
  - "IdpAuditEvent type — partial mapped over allow-list with mandatory `auditEvent` string"

affects: []

tech-stack:
  added: []
  patterns: ["Internal-helper-with-public-wrapper test pattern: production function delegates to a parameterised helper that tests can drive against custom destinations"]

key-files:
  created:
    - packages/logger/src/idp-audit-logger.ts
  modified:
    - packages/logger/src/index.ts (re-export idp-audit surface)
    - packages/logger/src/__tests__/idp-audit-logger.test.ts (Writable-sink test pattern)

key-decisions:
  - "Exposed `createIdpAuditChild(parent)` alongside `getIdpAuditLogger()` so tests can mount a parent with a known destination. Same trick used by the with-body-logging tests in Plan 70-03."
  - "PII redact paths use `*.password` (depth-2 wildcard); the test wraps creds in a `creds` object to exercise the path properly. Top-level `password` would not be redacted by the existing pii-mask paths anyway — that's a property of the existing system, not a Phase 70 regression."
  - "Both `body` and `*.body` are filtered out of the audit child's redact paths — covers the depth-1 case (`{ body: ... }`) and the depth-2 case (`{ req: { body: ... } }`)."

patterns-established:
  - "Audit logger pattern: dedicated factory + bindings-namespace + explicit redact override that subtracts default-redact paths."

requirements-completed: [FOUND6-06]

duration: 22min
completed: 2026-04-26
---

# Phase 70 · Plan 08 Summary

**`getIdpAuditLogger()` ships — bindings `service: 'idp-audit'`, redact override that preserves audit fields (scopeDelta, body) in plaintext while keeping passwords/tokens/apiKeys [REDACTED]. Wave 0's last logger scaffold turns GREEN; Phases 76–78 IdP deprovisioning consumers can now call into a typed audit channel.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3
- **Files created:** 1
- **Files modified:** 2

## Accomplishments
- `getIdpAuditLogger()` factory + `createIdpAuditChild(parent)` test-friendly helper
- `IDP_AUDIT_ALLOWED_FIELDS` (9 canonical fields) + `IdpAuditAllowedField` + `IdpAuditEvent` types
- Public surface re-exported from `@contractor-ops/logger`
- 6/6 idp-audit-logger test cases pass (Wave 0 turns GREEN)
- Full logger suite: 38/38 pass (every Wave 0 logger scaffold is now GREEN)
- T-70-08-02 verified: `body` field emits in plaintext from the audit child; default-redact does not bleed in

## Task Commits

1. **Tasks 1–3: idp-audit-logger module + tests + index re-exports** — `741f62f0` (feat)

## Files Created/Modified

- `packages/logger/src/idp-audit-logger.ts` — factory + helper + types + allow-list constant
- `packages/logger/src/index.ts` — public re-exports
- `packages/logger/src/__tests__/idp-audit-logger.test.ts` — 6 cases via Writable-sink pattern

## Decisions Made
- Exposed `createIdpAuditChild(parent)` to mirror the test-friendly pattern used by `withBodyLogging`. Production code calls `getIdpAuditLogger()` (which delegates).
- Both `body` and `*.body` are filtered out of the audit child's redact paths — covers depth-1 + depth-2.

## Deviations from Plan

**1. [Test infra mismatch — Plan 70-03 lesson] Switched stdout-spy to Writable-sink test pattern**
- **Found during:** First test run after Task 2.
- **Issue:** Same as Plan 70-03 — `vi.spyOn(process.stdout, 'write')` doesn't capture pino-pretty's buffered output in dev mode. Plan 70-03's solution (mount a fresh pino into an in-memory Writable) translates directly: I exposed `createIdpAuditChild(parent)` so the test can drive an arbitrary parent.
- **Fix:** New test file uses Writable sink + parent pino + createIdpAuditChild helper.
- **Files modified:** `packages/logger/src/__tests__/idp-audit-logger.test.ts`, `packages/logger/src/idp-audit-logger.ts` (added the helper)
- **Verification:** 6/6 tests pass with all Plan 08 acceptance criteria met.
- **Committed in:** `741f62f0`

**2. [Pii-mask depth] Test wraps creds in a `creds` object to exercise depth-2 wildcard**
- **Found during:** First successful run; one assertion failed because top-level `password` is not in PII_MASK_PATHS (the existing path is `*.password`).
- **Fix:** Wrap the creds payload in `{ creds: { password, token, apiKey } }` so the depth-2 wildcard fires. Documents the pii-mask convention for future audit consumers.
- **Verification:** Final run — 6/6 pass.
- **Committed in:** `741f62f0`

---

**Total deviations:** 2 — both test infrastructure adjustments, no functional scope change. The deviations are consistent with the patterns already established by Plan 70-03.

## Issues Encountered

None functional — only the test-infra surface area noted above.

## Next Phase Readiness
- All Wave 2 plans complete. Wave 3 starts at plan 70-09 (multi-region migration — `autonomous: false` checkpoint).

---
*Phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli*
*Completed: 2026-04-26*
