# Phase 70 Research — v6.0 Foundation: Cross-Cutting CI Guards & Observability Baseline

**Researched:** 2026-04-26
**Phase Goal:** Block every CRITICAL-recovery-cost bug class from PITFALLS P27–P31 with a CI/pre-push guard. Foundation only — F1/F2/F3/F4 feature delivery is Phases 71–80.
**Phase Requirements:** FOUND6-01, FOUND6-02, FOUND6-03, FOUND6-04, FOUND6-05, FOUND6-06
**Confidence:** HIGH — every pattern this phase introduces has a near-twin already in the codebase (locked-phrases-guard, signoff-registry, push-all-regions, PII redact paths, deep-frozen flag registry).

---

## What we already have (foundation we extend, do NOT duplicate)

| Asset | Location | Phase 70 role |
|---|---|---|
| Pino root logger with `redact.paths` already populated for UK + DE PII | `packages/logger/src/index.ts`, `packages/logger/src/pii-mask.ts` | D-05 modifies the factory to add **default body redaction**; D-15 adds `getIdpAuditLogger()` child |
| ts-morph (already in repo via codegen/validators) | `packages/validators` codegen, lockfile | D-07 reuses for AST scan in `lint:logs` — no new dependency |
| Disclaimer signoff registry (PENDING/APPROVED + Zod refine + JSON store + boot-time `parse()`) | `packages/validators/src/legal/signoff-registry-{schema,ts,json}.ts` | D-09 clones the **shape** for flag-namespace signoff, kept **independent** (different approver-role enum, different consumer, different gate timing) |
| Deep-frozen feature flag registry with TS `as const satisfies` | `packages/feature-flags/src/registry.ts` | D-10's namespace gate hooks the registry-load path |
| Multi-region migration runner | `packages/db/scripts/push-all-regions.ts` | D-14 backfill **must** run via this script (EU + ME) |
| `IntegrationConnection.configJson Json?` field | `packages/db/prisma/schema/integration.prisma` | D-13 adds a sibling `scopeCapabilities Json?` field (same JSONB pattern) |
| Existing GWS OAuth config with `prompt: 'consent'` already set | `packages/integrations/src/adapters/google-workspace-adapter.ts` line 63 | D-16 reconnect banner triggers re-auth through the existing flow — **no OAuth code changes** in Phase 70 |
| `de-locale.test.ts` parity assertion for EN ⊂ DE | `apps/web/src/i18n/__tests__/de-locale.test.ts` lines 61–72 | Pattern lifted to a CI script for EN ⊂ {DE, PL, AR} (FOUND6-03) |
| Husky `pre-push` hook running format + lint + check:no-process-env | `.husky/pre-push` | D-01: append three new commands sequentially |
| `.github/workflows/ci.yml` (Lint, Typecheck & Test) + per-concern security/verapdf workflows | `.github/workflows/` | D-04: add three new commands as **steps inside ci.yml** (no new umbrella workflow) |

---

## Technical Approach Per Decision

### Area 1 — Enforcement Layer (D-01..D-04)

**D-04 — three independent scripts:**
- `pnpm lint:schema` → `node scripts/lint-schema.mjs` (FOUND6-01, P27)
- `pnpm lint:logs` → `node scripts/lint-logs.mjs` (FOUND6-02 audit, P28)
- `pnpm i18n:parity` → `node scripts/i18n-parity.mjs` (FOUND6-03, P29)
- A fourth script `pnpm lint:flags` is folded into the **boot-time** registry load (D-10) plus a CI grep (D-12) — no new pnpm script needed; the gate runs as part of the existing `pnpm test` (registry boot test).

**D-01 — placement:**
- Add steps to existing `.github/workflows/ci.yml` (run before `Test`):
  ```yaml
  - name: Lint Prisma schema for tenant scoping
    run: pnpm lint:schema
  - name: Lint logger call sites for body-redaction drift
    run: pnpm lint:logs
  - name: Verify i18n message-key parity
    run: pnpm i18n:parity
  ```
- Append same commands to `.husky/pre-push`:
  ```sh
  pnpm run format:check && pnpm run lint && pnpm run check:no-process-env \
    && pnpm run lint:schema && pnpm run lint:logs && pnpm run i18n:parity
  ```

**D-03 — failure output shape (uniform across 3 guards):**
```
[lint:<guard>] FAIL: <one-line offence summary>

  offending: <model | router | key>
  expected: <what should be true>
  found:    <what was found>

  remediation: <docs/lint-<guard>-remediation.md#section-anchor>

(<N> additional offences — full list above)
```
- All three scripts exit 1 on offence, 0 on clean.
- Remediation pointers live as Markdown files in `docs/lint-remediation/` (new directory) — `lint-schema.md`, `lint-logs.md`, `i18n-parity.md`. Each is keyed by anchor (`#missing-organization-id`, `#unredacted-body-log`, `#missing-translation-key`).

**D-02 — typed allowlist constants:**
- `scripts/lint-schema/global-lookup-allowlist.ts` exports
  ```ts
  export const GLOBAL_LOOKUP_MODELS_ALLOWLIST = ['Country', 'Currency', 'IsicCode', 'IndustryCode', 'ExchangeRate', /* ... */] as const;
  ```
- `scripts/lint-logs/log-body-include-prefixes.ts` exports `LOG_BODY_INCLUDE_PREFIXES` (the redaction allowlist — D-06).
- The lint scripts `import` these constants (TS source) via tsx at runtime; CI greps them for review.

### Area 2 — PII Redaction Migration (D-05..D-08)

**D-05 — default-redact at logger factory:**
- Extend `baseOptions.redact.paths` with **a new wildcard `'*.body'` redaction** that fires on every `log.info({ body: req.body })` call site by default. Existing UK/DE PII paths stay (defense in depth).
- Introduce `withBodyLogging(loggerOrChild, prefixes: string[]): Logger` factory in `packages/logger/src/index.ts`:
  ```ts
  export function withBodyLogging(parent: Logger, includePrefixes: readonly string[]): Logger {
    // Returns a child whose redact paths EXCLUDE 'body' for procedures matching includePrefixes.
    // Implemented as a child with a serializer that re-attaches body when binding.procedure starts with a listed prefix.
  }
  ```
- Routers wanting body logs call `const log = withBodyLogging(createTrpcLogger({...}), ['contractor.create', 'invoice.draft']);`. Default `createTrpcLogger()` continues redacting bodies.

**D-06 — typed-constant include-prefixes:**
- File: `packages/logger/src/log-body-include-prefixes.ts`
  ```ts
  /**
   * APPROVED-FOR-BODY-LOGGING router prefixes / individual fields.
   * Every entry MUST have a code-comment justification visible in the diff.
   * Format: 'router.procedure' OR 'router.procedure:fieldA,fieldB' (per-field allow)
   */
  export const LOG_BODY_INCLUDE_PREFIXES: readonly string[] = [
    // Phase 70 baseline: NO prefixes — every existing router migrates to default-redact.
    // Add entries here only after manual review (D-08: per-field allow with reason comment).
  ] as const;
  ```

**D-07 — pre-cutover audit via ts-morph in `lint:logs`:**
- Script walks every `import { ... } from '@contractor-ops/logger'` call site.
- For each `logger.info({ body: ... })` / `log.info({ body: ... })` (any object literal with key `body` passed to a logger method): record file, line, router-prefix-if-discoverable, snippet.
- Emit single artefact `.lint-logs-baseline.json` in repo root. Initial run produces the **complete pre-cutover offence list** — committed alongside the guard so future regressions can be diffed against it.
- Guard fails when:
  - A new `body:` log site appears NOT covered by a prefix in `LOG_BODY_INCLUDE_PREFIXES`, OR
  - A site exists that was in the baseline but no longer redacts (regression check), OR
  - The `LOG_BODY_INCLUDE_PREFIXES` constant lacks a code comment for any entry.

**D-08 — rollback per-field allow:**
- The `withBodyLogging` factory honours the `:fieldA,fieldB` suffix syntax — emits redact paths for everything except the listed fields.
- The lint script enforces presence of a `// reason: <text>` line on the same or preceding line of each include-prefix entry.

### Area 3 — Sign-off Registry for Feature Flag Namespaces (D-09..D-12)

**D-09 — parallel registry (NOT extending Phase 64):**
- New files (mirror Phase 64 layout):
  - `packages/feature-flags/src/signoff-registry-flags-schema.ts` — Zod schema, similar shape to `signoff-registry-schema.ts` but with **`approverRole` enum drawn from legal-flag-approval roles** (e.g. `LEGAL_LEAD`, `COMPLIANCE_OFFICER`, `PRIVACY_COUNSEL`) and a **mandatory `legalTicketRef`** (D-12).
  - `packages/feature-flags/src/signoff-registry-flags.json` — JSON data store.
  - `packages/feature-flags/src/signoff-registry-flags.ts` — runtime module: parses JSON via Zod at load, exports `getFlagSignoff(key)`, `assertSignoffForGatedNamespace(key, status)`.

**D-11 — gated namespaces:**
- Constant in `signoff-registry-flags.ts`:
  ```ts
  export const GATED_FLAG_NAMESPACE_PREFIXES = [
    'compliance-',         // F1, Phases 71–73
    'idp-deprovisioning',  // F2, Phases 76–78 (exact match also supported)
    'gulf-',               // F3, Phase 79
    'offboarding-ip-',     // F4, Phases 74–75
  ] as const;
  ```
- Helper `isGatedFlag(key: FlagKey): boolean` returns true if any prefix matches.

**D-10 — boot-time hard exit:**
- Hook into `packages/feature-flags/src/registry.ts` at module load time (after `deepFreeze`). Iterate `FLAG_KEYS`, for each gated key:
  - If signoff entry **missing** OR signoff status === `APPROVED` and entry has no `legalTicketRef` → `process.stderr.write('[FLAG-SIGNOFF] flag <key> ...')` then `process.exit(1)`.
  - Wording mirrors Prisma migration drift errors: structured one-line, then a 2-line remediation pointer.
- **LOCAL-ONLY bypass** (Standing Constraint): respect env var `FLAG_SIGNOFF_BYPASS=local` — when set, log a `warn` instead of exiting. Documented in remediation pointer; CI sets `FLAG_SIGNOFF_BYPASS=` (empty) so CI always enforces.

**D-12 — `legalTicketRef` validation:**
- Zod schema:
  ```ts
  legalTicketRef: z.string().regex(/^(LEGAL-\d+|https?:\/\/.+)$/)
  ```
- `.refine` clause: when status === `APPROVED`, `legalTicketRef` must be non-empty.

### Area 4 — OAuth Scope Upgrade Storage + IdP Audit Logger (D-13..D-16)

**D-13 — `IntegrationConnection.scopeCapabilities` JSONB:**
- Migration adds `scopeCapabilities Json?` to the model (sibling of `configJson`).
- TS contract (NOT in Prisma — we model the JSON shape in TypeScript):
  ```ts
  // packages/db/src/types/scope-capabilities.ts
  export type CapabilityEnum =
    | 'directory.read' | 'directory.write'
    | 'user.deprovision' | 'user.suspend'
    | 'group.read' | 'group.write'
    | 'audit.read';
  export interface ScopeCapabilities {
    provider: 'google' | 'slack' | 'entra' | 'okta' | 'github';
    scopes: string[];                  // raw OAuth scope strings — preserved for audit + drift detection
    capabilities: CapabilityEnum[];    // typed enum branched on by app code
    grantedAt: string;                 // ISO timestamp
  }
  ```
- Code branches **only on `capabilities` enum**, never on raw scope strings.

**D-14 — backfill migration:**
- Single transaction per region; idempotent (`UPDATE IntegrationConnection SET scopeCapabilities = ... WHERE provider = 'GOOGLE_WORKSPACE' AND scopeCapabilities IS NULL`).
- Static map per provider:
  ```ts
  const PROVIDER_BACKFILL: Record<IntegrationProvider, ScopeCapabilities> = {
    GOOGLE_WORKSPACE: {
      provider: 'google',
      scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly',
               'https://www.googleapis.com/auth/admin.directory.group.readonly'],
      capabilities: ['directory.read', 'group.read'],
      grantedAt: '<existing connectedAt or migration date>',
    },
    // other providers default to []
  };
  ```
- Migration script lives at `packages/db/scripts/backfill-scope-capabilities.ts`. Run **per region via `push-all-regions.ts` pattern** — author a sibling `run-script-all-regions.ts <script>` runner OR shell-loop in the migration's README.

**D-15 — `getIdpAuditLogger()`:**
- New factory in `packages/logger/src/index.ts`:
  ```ts
  /**
   * Audit logger for IdP deprovisioning events. Returns a Pino child with:
   *   - PII redact paths from PII_MASK_PATHS (inherits root config — passwords, tokens, contractor PII still redacted)
   *   - Allow-list constant of audit fields that MUST appear in plaintext
   * Caller MUST pass an object whose keys are subset of IDP_AUDIT_ALLOWED_FIELDS.
   * Compile-time enforcement via the IdpAuditEvent type.
   */
  export function getIdpAuditLogger(): Logger { ... }

  export const IDP_AUDIT_ALLOWED_FIELDS = [
    'externalUserId', 'actionResult', 'provider', 'connectionId', 'scopeDelta',
    'organizationId', 'userId', 'auditEvent', 'timestamp',
  ] as const;
  export type IdpAuditEvent = {
    [K in (typeof IDP_AUDIT_ALLOWED_FIELDS)[number]]?: unknown;
  } & { auditEvent: string };  // auditEvent always required
  ```
- Inside the factory: child logger with **no `body` redaction inherited** (audit needs `scopeDelta` plaintext) but PII paths kept. Bindings include `service: 'idp-audit'` so log routing can splay these to a separate Axiom dataset later (deferred — out of Phase 70).

**D-16 — user-initiated reconnect banner:**
- Component: `apps/web/src/components/integrations/google-workspace-reconnect-banner.tsx`
- Visibility logic: render in `google-workspace-provider-section.tsx` when:
  - Provider is `GOOGLE_WORKSPACE`, AND
  - `connection.scopeCapabilities?.capabilities` does NOT include the new IdP capability set (e.g., `'user.deprovision'`).
- Clicking "Reconnect" hits the existing OAuth flow with the upgraded scope set. **Phase 70 does NOT add new OAuth scopes** — those land in Phase 76. This phase only ships the **storage + display infrastructure** so 76 has somewhere to write.
- Banner copy added to all 4 locales (`en`, `de`, `pl`, `ar`). Existing `en`-only adds would be caught by the new `i18n:parity` script — eat our own dog food.

---

## Validation Architecture (Nyquist sampling)

> Every guard must be testable in isolation in <3s on a developer's machine — Nyquist requires sample rate ≥2× the change rate. Schema/log/i18n changes happen on every PR; tests must run faster than dev keystrokes.

| Guard | Sample point | Sample rate | Detection latency target |
|---|---|---|---|
| `lint:schema` | Vitest unit test against `scripts/lint-schema.mjs` parsing fixture `.prisma` files | <1s for 3 fixtures (clean, missing-orgId, allowlisted) | Per-PR CI + pre-push |
| `lint:logs` | Vitest unit test against `scripts/lint-logs.mjs` parsing fixture TS files via ts-morph | <2s | Per-PR CI + pre-push |
| `i18n:parity` | Vitest unit test against `scripts/i18n-parity.mjs` parsing fixture JSON dirs | <1s | Per-PR CI + pre-push |
| Logger default-redact | Vitest unit test in `packages/logger/__tests__/default-body-redact.test.ts` — boot logger, log `{ body: { secret: 'x' } }`, assert serialized output contains `[REDACTED]` not `secret` | <1s | Per-PR CI |
| `withBodyLogging` opt-in | Vitest unit test asserting body NOT redacted when prefix is included | <1s | Per-PR CI |
| `getIdpAuditLogger()` allow-list | Vitest unit test asserting `externalUserId` plaintext, `password` still redacted | <1s | Per-PR CI |
| Flag-signoff boot fail | Vitest test importing `packages/feature-flags/src/registry.ts` with a mocked malformed signoff JSON; expects `process.exit` spy to be called with 1 | <2s | Per-PR CI |
| `scopeCapabilities` migration | Two parts: (1) Prisma schema diff test asserts field exists; (2) Migration unit test runs the backfill script against an in-memory dataset, asserts `directory.read` set on every GWS connection | <3s | Per-PR CI |
| Banner visibility | Vitest+RTL test against `google-workspace-reconnect-banner.tsx` — renders when capabilities lack `user.deprovision`, hidden when present | <1s | Per-PR CI |

**Sample artefact (Nyquist Dimension 8):** `.lint-logs-baseline.json` — committed once at end of Phase 70; serves as both the audit record AND the regression baseline for every future PR.

---

## Plan Sequencing (proposed)

Strategy: **scaffold-tests-first** (Wave 0) → **infra & libraries** (Wave 1, parallel) → **CI wiring + boot-time gate** (Wave 2) → **migration + UI banner** (Wave 3, parallel after schema lands).

| Wave | Plan | Title | Decisions covered | Requirements covered |
|---|---|---|---|---|
| 0 | 70-01 | Test scaffolds + remediation docs (RED state) | D-01 D-02 D-03 D-09 D-13 | All — failing tests for every guard |
| 1 | 70-02 | `lint:schema` Prisma tenant-scoping guard | D-01 D-02 D-03 D-04 | FOUND6-01 |
| 1 | 70-03 | `lint:logs` body-redaction AST audit + logger factory default-redact + `withBodyLogging` + `LOG_BODY_INCLUDE_PREFIXES` | D-04 D-05 D-06 D-07 D-08 | FOUND6-02 |
| 1 | 70-04 | `i18n:parity` script (EN ⊂ {DE, PL, AR}) | D-04 | FOUND6-03 |
| 1 | 70-05 | Flag-namespace signoff registry (parallel to Phase 64 disclaimer registry) | D-09 D-11 D-12 | FOUND6-04 (schema + data half) |
| 2 | 70-06 | CI workflow + husky pre-push wiring + remediation docs | D-01 D-03 D-04 | All guards land in CI |
| 2 | 70-07 | Boot-time flag-signoff gate + LOCAL-ONLY bypass | D-10 D-11 D-12 | FOUND6-04 (boot-fail half) |
| 2 | 70-08 | `getIdpAuditLogger()` factory + IDP_AUDIT_ALLOWED_FIELDS + IdpAuditEvent type | D-15 | FOUND6-06 |
| 3 | 70-09 | Prisma `scopeCapabilities` field + multi-region backfill migration + ScopeCapabilities TS types | D-13 D-14 | FOUND6-05 (storage + backfill half) |
| 3 | 70-10 | GWS reconnect banner + i18n strings (proves i18n:parity green) | D-16 | FOUND6-05 (UX half) |

**Why this sequencing:**
- Wave 0 establishes failing tests for everything — Nyquist requires test-first.
- Wave 1 plans are mutually independent (different packages) → maximum parallelism.
- Wave 2 wires Wave-1 outputs into CI + adds the boot gate — depends on Wave 1.
- Wave 3 depends on Wave 1 (`i18n:parity` must exist before banner adds 4-locale strings) and Wave 2 wiring; the schema migration is itself independent of the banner so they parallelise.

Plan count: **10 plans** across **4 waves**. Estimated executor effort: ~2–3 hours per plan, ~24h total — proportionate for foundation phase that gates 11 downstream phases.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `lint:logs` AST scan slow on large repo (D-07 says "allowed to be slow as long as it's correct") | MEDIUM | LOW — annoyance only | Cache ts-morph project across files; only re-parse changed files in pre-push (CI does full scan); accept up to 10s wall time for full scan |
| `LOG_BODY_INCLUDE_PREFIXES = []` baseline breaks existing log statements that depend on body for debugging | MEDIUM | MEDIUM — observability gap during migration | Wave 1 logger plan ships **simultaneously** with the AST baseline that catalogs every offending site; followup PRs add to include list with reason comments. Acceptable observability loss during migration window — bodies were leaking PII anyway |
| Boot-time `process.exit(1)` (D-10) trips local dev who hasn't pulled signoff JSON | HIGH (during F1/F2 rollout) | LOW — fast to recover | LOCAL-ONLY bypass env var `FLAG_SIGNOFF_BYPASS=local` documented in remediation pointer; sample `.env.example` entry |
| Backfill migration (D-14) collides with concurrent OAuth flows writing to same row | LOW | MEDIUM — race writes | Migration uses `WHERE scopeCapabilities IS NULL` (idempotent) and runs in a single transaction per region; OAuth callback (Phase 76) will use UPSERT on the same column |
| ScopeCapabilities JSON shape drifts between TS type and runtime data | MEDIUM | MEDIUM — silent type lies | Add a Zod parse on every read (`packages/db/src/scope-capabilities.ts`); fail loud at the boundary |
| i18n:parity script doesn't catch DE/PL/AR drift introduced via tooling that bypasses CI (e.g., direct production hotfix) | LOW | LOW — caught on next PR | Acceptable — CI is the canonical gate; pre-push is courtesy. Add husky `prepare-commit-msg` reminder later if needed |
| New `[FLAG-SIGNOFF]` boot error message conflicts with existing Prisma drift detection | LOW | LOW | Use distinct prefix `[FLAG-SIGNOFF]` (Prisma uses `[Prisma migration]`) — no collision |

---

## Open Questions (resolved during planning, not blocking)

1. **Should `lint:schema` also enforce `@@index([organizationId, ...])` on every multi-tenant model?** → No. Index strategy is a separate concern (Phase 67-style); this guard is solely "has the column". Defer index linting to a later phase.
2. **Should `withBodyLogging` accept a Zod schema for body type-checking?** → Out of scope for Phase 70. Add as v7.0 polish if observability platform demands it.
3. **Should `IDP_AUDIT_ALLOWED_FIELDS` be enforced at runtime (warn on extra fields)?** → No. The TS type catches it at compile time; runtime enforcement adds latency to audit hot path. Trust the type.

---

## RESEARCH COMPLETE
