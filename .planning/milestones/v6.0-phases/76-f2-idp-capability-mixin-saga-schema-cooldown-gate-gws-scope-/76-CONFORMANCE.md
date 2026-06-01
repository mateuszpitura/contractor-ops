---
status: issues-found
phase: 76
phase_name: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration
audit_type: deep conformance + code-smell (compare-to-analog)
method: semble search + find_related against closest existing sibling for each new module
scope: READ-ONLY — no edits
modules_audited: 11
findings: { high: 0, medium: 4, low: 7, info: 4, total: 15 }
---

# Phase 76 Conformance Audit — make the new code indistinguishable from the rest of the repo

Goal: for each Phase-76 new/changed module, find the CLOSEST EXISTING analog and flag
divergence + smell. Already-FIXED-this-session items (raw-fetch wrapped → CR-1,
idempotencyKey per-org → WR-1, PII hashing → WR-4, mapErrorClassToResult extraction,
settingsJson tx, step-runner org-guard, resolveAdapter fail-fast → WR-3) were
re-verified present and are NOT re-reported. Still-unfixed REVIEW LOW/INFO are folded in
below with their original IDs.

Severity: `MEDIUM` = idiomatic divergence a reviewer would flag in PR / parity gap with
real behavioral consequence; `LOW` = cosmetic / internal-consistency; `INFO` =
acknowledged-by-design, recorded for completeness.

Format: `severity | file:line | smell/divergence | existing analog (path) | idiomatic fix`

---

## packages/idp-saga (NEW package) — analog: packages/compliance-policy (closest: pure date-fns helpers + @db peer)

The package.json / tsconfig.json / vitest.config.ts are a near-exact clone of
`compliance-policy` (same `extends`, `module`/`moduleResolution`, `exclude __tests__`,
date-fns + @date-fns/tz deps, biome scripts). Structurally conformant. Divergences:

- **MEDIUM** | `vitest.config.ts:7` + root `vitest.config.ts:17-30` | idp-saga is NOT
  registered in the root vitest `projects[]` array, so `pnpm test` / `vitest run --coverage`
  from the repo root never runs the 28 saga unit tests and the saga source is excluded from
  the coverage denominator. The "real logic" packages (api, integrations, validators,
  einvoice, feature-flags, gov-api) are all listed there. (compliance-policy is also absent,
  but it is policy-data; idp-saga ships the cooldown gate + run-status state machine.)
  | analog: `vitest.config.ts` root `projects[]` (api/integrations/validators listed);
  `vitest.monorepo.ts` (project-name + groupOrder registry) | fix: add `'packages/idp-saga'`
  to root `projects[]` and `packages/idp-saga/src/**/*.ts` to `coverage.include`; add an
  `idpSaga: { name, groupOrder }` entry to `vitest.monorepo.ts` and consume it (see next).

- **LOW** | `vitest.config.ts:7` | `groupOrder: 14` is a hardcoded literal that (a) collides
  with `apiServer: 14` in the canonical `vitest.monorepo.ts` registry and (b) bypasses that
  registry entirely. The "real package" camp (api/auth/db/integrations/validators/einvoice/
  gov-api/logger/secrets/billing/test-utils) imports `vitestProject.<x>.groupOrder` from
  `vitest.monorepo.ts`. idp-saga follows the minority hardcoded camp (classification=10,
  feature-flags=12, compliance-policy=13, ui=17). | analog: `packages/validators/vitest.config.ts`
  + `vitest.monorepo.ts` | fix: register `idpSaga` in `vitest.monorepo.ts` with a unique
  groupOrder and reference `vitestProject.idpSaga.{name,groupOrder}`.

- **LOW** | `package.json:25-30` | declares `@contractor-ops/db` as BOTH a `peerDependency`
  AND a `devDependency`. The only other peer-dep package (`packages/ui`) lists peers
  (react/motion) WITHOUT also self-listing them in devDeps. The closest analog
  (compliance-policy) and offboarding-templates just put `@contractor-ops/db` in plain
  `dependencies`. idp-saga consumes `PrismaClient` as a *type-only* import in 3 files, so the
  peer/dev split is over-engineered for a workspace package. | analog:
  `packages/offboarding-templates/package.json` (`@db` in `dependencies`) /
  `packages/ui/package.json` (peers, no dev self-listing) | fix: move `@contractor-ops/db`
  to plain `dependencies` (workspace:* always resolves), matching the offboarding-templates
  sibling — or drop the redundant devDep if the peer pattern is intended.

### packages/idp-saga/src/cooldown.ts — analog: packages/compliance-policy/src/expiry.ts (Phase 71, explicitly cited in the source comment)

- **MEDIUM (= REVIEW WR-2, unfixed)** | `cooldown.ts:43` | the human-facing `reason` date is
  off-by-one for east-of-UTC jurisdictions. `earliestDate` is the UTC instant of LOCAL
  midnight (endedAt+14d) in the jurisdiction TZ; `.toISOString().slice(0,10)` then renders
  the UTC calendar date of that instant — for `Asia/Riyadh`(+03)/`Asia/Dubai`(+04) (both in
  `COUNTRY_TZ`, deprovisioning.ts:83-84) local midnight maps to the PREVIOUS UTC day, so the
  reason string + eligibility tooltip show a date one day early. The gate comparison itself
  (line 42) is correct. | analog: `compliance-policy/src/expiry.ts:62-64` `jurisdictionDate(now, tz)`
  — the repo already has a TZ-aware `yyyy-MM-dd` formatter for exactly this (it formats
  `startOfDay(TZDate(...))` then slices, on a value that is already TZ-local). | fix: mirror
  `jurisdictionDate` — format `earliestDate` in `input.jurisdictionTz` (e.g.
  `format(new TZDate(earliestDate, tz), 'yyyy-MM-dd')`) instead of slicing the UTC ISO string;
  or carry `jurisdictionTz` to the UI and format there.

- **LOW** | `cooldown.ts:37` | hand-rolled date math `new Date(endedAt.getTime() + COOLDOWN_DAYS*24*60*60*1000)`
  instead of date-fns `addDays`. The analog file uses `addDays/addMonths/addYears`
  consistently (expiry.ts imports them) and idp-saga already depends on date-fns. Raw
  ms-arithmetic is a smell next to a date-fns-based sibling and ignores DST/leap semantics
  (immaterial for a UTC instant, but inconsistent). | analog:
  `compliance-policy/src/expiry.ts:9` (`addDays`) | fix: `addDays(input.endedAt, COOLDOWN_DAYS)`.

### packages/idp-saga/src/run-status.ts — analog: pure derivation + async-wrapper idiom

- **INFO (= REVIEW IN-4, unfixed by design D-02)** | `run-status.ts:54-57` | `recomputeRunStatus`
  re-derives `finishedAt = new Date()` on every terminal recompute with no
  "only-set-once" guard, so a late concurrent re-derivation that still sees a terminal
  aggregate overwrites the existing `finishedAt` with jitter. Pure derivation makes the
  STATUS converge; only the timestamp drifts. | analog: terminal-timestamp set-once patterns
  elsewhere use `finishedAt: existing ?? new Date()` or a `WHERE finishedAt IS NULL` guard.
  | fix (only if `finishedAt` is SLA evidence): `data: { status, ...(finishedAt && { finishedAt }) }`
  via a conditional update, or `finishedAt: { set: existingFinishedAt ?? finishedAt }`.

### packages/idp-saga/src/provenance.ts — internal-consistency

- **LOW** | `provenance.ts:23` | uses `Date.now()` directly while the package's own stated
  convention (cooldown.ts:20 "deterministic via the optional `now` parameter") and `gc.ts:16`
  (`now: Date = new Date()`) make `now` an injectable param. provenance.ts cannot be
  deterministically clock-tested without mocking the global. | analog: `idp-saga/src/gc.ts:16`,
  `idp-saga/src/cooldown.ts:33` (sibling helpers in the SAME package) | fix: add
  `now: Date = new Date()` param to `provenanceLookup` and compute `cutoff` from it.

---

## packages/integrations — Deprovisionable interface + registry (Phase 76 D-13) — analog: the OCR + CompanyRegistry capability registries in the SAME file

The Deprovisionable registry sits alongside two existing capability-registry siblings in
`registry.ts` (OCR adapters, CompanyRegistry adapters). The compile-time
`BaseAdapter & Deprovisionable` enforcement at the register call-site is a genuinely good,
SOLID pattern (REVIEW confirmed). Two convention divergences from the in-file siblings:

- **MEDIUM** | `registry.ts:175-176` | `registerDeprovisionableAdapter` THROWS on double
  registration, whereas the two sibling registries in the same file
  (`registerOcrAdapter`:85-90, `registerCompanyRegistryAdapter`:125-130, and `registerAdapter`:28-30)
  `log.warn` + overwrite — explicitly to tolerate Vitest-worker test leakage. Throwing means a
  second `registerAllAdapters()` in a long-lived process / re-import in tests hard-crashes
  instead of warning. | analog: `registry.ts:83-92` (`registerOcrAdapter`) | fix: match the
  siblings — `if (deprovisionableAdapters.has(provider)) log.warn(...)` then overwrite; or, if
  fail-fast is intentional for the security path, document WHY it diverges (the siblings'
  comment explains their choice; this one doesn't).

- **LOW** | `registry.ts:57-61` vs `194-197` | `clearAdapters()` clears `adapters` + `ocrAdapters`
  + `companyRegistryAdapters` ("to keep the two registries in sync for tests", line 54-55) but
  does NOT clear `deprovisionableAdapters`; the saga registry has a separate
  `_resetDeprovisionableAdapters()`. A test calling the conventional `clearAdapters()` leaves
  Deprovisionable adapters registered → cross-test leakage. | analog: `clearAdapters()` lines
  57-61 (clears the other two capability maps) | fix: add `deprovisionableAdapters.clear()` to
  `clearAdapters()`, OR document that the throw-on-dup + separate reset is the deliberate
  isolation contract.

- **LOW (= REVIEW IN-5, unfixed; contained by interface doc)** |
  `adapters/google-workspace-adapter.ts:519-528` | `verifyDeprovisioned` does
  `res.json().catch(() => ({}))` then `Boolean(data?.suspended)`, so any 5xx/429/parse failure
  returns `false` — indistinguishable from "user still active". The interface doc
  (`types/deprovisionable.ts:103-110`) says this is TEST-TIME only and production relies on
  `suspendAccount`'s status, so impact is contained today. | analog: the adapter's own
  `suspendAccount`/`revokeAllSessions` (same file) branch on `res.ok` and route non-ok through
  `#mapDeprovisionFailure` rather than coercing to a bool. | fix: throw on non-404 non-ok so a
  future caller can distinguish "confirmed active" from "couldn't check".

---

## packages/api/src/routers/integrations/deprovisioning.ts — analog: sibling tenant-scoped tRPC routers

Tenant scoping, Zod inputs, `findOrThrow`, `writeAuditLog(tx)` in a single `$transaction`,
free-text override note excluded from audit — all conformant (REVIEW confirmed; WR-1 composite
unique now applied here). Remaining smells:

- **LOW (= REVIEW IN-3, unfixed)** | `deprovisioning.ts:30-35`, `45-51`, `404`, `615` +
  `idp-deprovisioning-step-runner.ts:24` | the 5-member provider union is hand-redeclared
  THREE times inside packages/api alone (router type `DeprovisioningToggleProvider`, the
  `as const` tuple, and two bare `z.enum([...])`), plus once more in the step-runner z.enum.
  The integrations↔idp-saga duplication is justified (no-cycle, documented at registry.ts:159-162),
  but the three in-package copies share no cycle. | analog: any router that defines one
  `z.enum` const + derives the TS type via `z.infer` (e.g. the `MANUAL_OVERRIDE_CATEGORIES`
  const in THIS file, line 59-65, does exactly that and is reused at line 462). | fix: declare
  one `const DEPROVISIONING_PROVIDERS = [...] as const` + `z.enum(DEPROVISIONING_PROVIDERS)` and
  reuse it for the type, the tuple, and both z.enums (export it to the step-runner).

- **LOW** | naming drift across packages | the same concept is named `DeprovisioningProvider`
  (idp-saga/types.ts:34), `DeprovisioningProviderId` (registry.ts:164), and
  `DeprovisioningToggleProvider` (deprovisioning.ts:30). Three names for one 5-literal union
  reads as accidental divergence. | analog: single-named domain unions elsewhere
  (`CompanyRegistryProvider`, `ProviderId` in scope-capabilities.ts) | fix: converge on one
  exported name per the no-cycle boundary (idp-saga owns `DeprovisioningProvider`; integrations'
  local copy and the api copy should reuse that name or a clearly-scoped `*Id` suffix
  consistently).

- **INFO (= REVIEW IN-2, unfixed)** | `deprovisioning.ts:306,310,332` | `retryDeprovisioningStep`
  computes `nextAttempt = step.attempts + 1` for the QStash `deduplicationId` while resetting
  the row to `attempts: 0` (deliberate — manual retry grants a fresh MAX_ATTEMPTS budget).
  Harmless (dedup ids only need per-enqueue uniqueness) but a readability trap. | analog: the
  start mutation's dedup id is `${run.id}:${step.id}:0` (line 243) | fix: one-line comment
  "dedup id must differ from the prior enqueue; attempts is reset deliberately" — the start
  path's `:0` and the retry's `:nextAttempt` otherwise look contradictory.

---

## apps/api/src/routes/idp-deprovisioning.ts — analog: sibling QStash worker routes (ksef.ts, ocr.ts)

Registered inside the raw-body webhook plugin scope (webhooks/index.ts:90) so QStash HMAC +
ALS reseed via `guard.run` are inherited (REVIEW confirmed). Divergences from the two closest
QStash-worker siblings:

- **MEDIUM** | `idp-deprovisioning.ts:82` | the handler is `guard.run(() => handlerInner(...))`
  with NO `withQueueObservability('idp-deprovisioning-step-runner', ...)` wrapper. BOTH sibling
  QStash routes wrap their handler in it (`ksef.ts:73`, `ocr.ts:113`) for F-ASYNC-17 per-tick
  duration metrics. The IdP saga step-runner is invisible to the queue-observability dashboard.
  | analog: `apps/api/src/routes/ksef.ts:72-74`, `apps/api/src/routes/ocr.ts:110-114` | fix:
  wrap with `withQueueObservability('idp-deprovisioning-step-runner', () => handlerInner(...))`
  inside `guard.run`, matching siblings (import from `@contractor-ops/api/services/cron-monitor`).

- **LOW** | `idp-deprovisioning.ts` (whole file) | does NOT call `registerAllAdapters()` at
  module load, unlike every sibling QStash/OAuth route (`ksef.ts:35`, `ocr.ts:44`, `oauth.ts:66`).
  Currently benign because `resolveAdapter` constructs `new GoogleWorkspaceAdapter()`/`new SlackAdapter()`
  directly (WR-3 fix) and never touches the registry — but the omission means the file diverges
  from the established "Adapter registry is process-singleton; registerAllAdapters()" convention,
  and any future code path that resolves via `getDeprovisionableAdapter` would throw on cold start.
  | analog: `apps/api/src/routes/ksef.ts:34-35` (`// Adapter registry is process-singleton.` +
  `registerAllAdapters()`) | fix: add the same two lines at module load for forward-safety + parity,
  even though the direct-construction path makes it currently unnecessary.

- **LOW** | `idp-deprovisioning.ts:41` | invalid-body 400 returns a flat `{ error: 'Invalid body' }`,
  while the sibling `ksef.ts:51-54` builds a `Missing or invalid: <field,...>` detail from the
  zod issue paths. Minor DX/observability parity gap on a QStash route where the body is
  trusted-internal but failures are otherwise opaque. | analog: `apps/api/src/routes/ksef.ts:50-54`
  | fix: mirror ksef's `parsed.error.issues.map(i => i.path.join('.'))` detail builder.

---

## apps/web-vite — GWS scope-upgrade reconnect banner — analog: Alert primitive + advisory-banner.tsx

Layering is correct: `google-workspace-reconnect-banner.tsx` is pure presentational (props in,
JSX out, no tRPC), fed by `google-workspace-provider-section` (view) ← `use-google-workspace-provider-section`
(hook). RTL logical classes, `aria-label`, three-state decision tree, i18n keys all present
(REVIEW confirmed). One design-consistency divergence:

- **LOW** | `google-workspace-reconnect-banner.tsx:103-122` | implements a warning banner with
  `Card`/`CardHeader`/`CardFooter` + `role="region"` + hand-rolled `border-amber-500/50 bg-amber-50`
  classes. The repo has a dedicated `Alert` primitive (`packages/ui/.../shadcn/alert.tsx`,
  `role="alert"`, `destructive` variant, logical `ps-`/`start-` icon classes) used by ~18
  web-vite components for exactly this, plus a sibling `advisory-banner.tsx` (`role="note"` +
  amber div). Using `Card` (a content-container, not an alert) for a single-action warning is a
  semantic + visual-consistency divergence. | analog: `packages/ui/src/components/shadcn/alert.tsx`
  + `apps/web-vite/src/components/classification/advisory-banner.tsx` | fix: render via `<Alert>`
  (with `AlertTitle`/`AlertDescription` and an inline reconnect `<Button render={<a/>}>`) so the
  amber styling, ARIA role, and icon placement match the 18 existing alert call-sites.

---

## apps/cron-worker — provenance GC wiring — analog: the advisory-locked reminders tx

- **INFO (= REVIEW IN-1, unfixed; now documented as deliberate)** |
  `jobs/handlers/reminders/index.ts:335` | `gcIdpProvenance` runs inside the
  `pg_try_advisory_xact_lock` reminders transaction (via the tick), but calls
  `gcExpiredProvenance(prismaRaw)` on the raw (non-tx) client, so the `deleteMany` is NOT
  serialized by the reminders advisory lock. The new comment (lines 326-328) documents it as a
  deliberate cross-org sweep on the non-tenant client, and GC is idempotent, so this is
  acceptable — recorded only because the lock gives no protection here and the mental model is
  slightly off. | analog: the other reminder sub-tasks use `tx` | fix (optional): pass the
  advisory-locked `tx` to `gcExpiredProvenance` if concurrent-tick GC serialization is wanted;
  otherwise the doc comment now correctly captures intent.

---

## Verified-conformant (re-checked, no action)

- **idp-deprovisioning.prisma** — tenantBound annotations, `@@unique([runId,provider,stepKind])`
  double-fan-out guard, `@@unique([organizationId,idempotencyKey])` (WR-1 fix present),
  cascade deletes, indexes for reconcile/GC/audit. Matches sibling schema-file conventions.
- **packages/lint-guards/scopes-guard** — exact layout + export shape of the 3 sibling guards
  (schema/logs/payment-gate/i18n-parity): `run-guard.ts` + `format-offence.ts` + `__tests__` +
  `__fixtures__`, exporting `runScopesGuard`/`formatScopesOffences`/types from index.ts. Fully
  conformant. (Minor: `index.ts:1-3` header comment is stale — lists only "Plans 02/03/04",
  omits payment-gate + scopes — not Phase-76-specific.)
- **scopes/google-workspace-deprovision-scopes.ts** — `as const satisfies readonly CapabilityEnum[]`
  pattern, single-source-of-truth comment, matches the typed-const convention the guard enforces.
- **saga-canonicalize.ts** (integrations) — PII + auth-header denylist + key-sort; placement in
  `integrations/services` (not idp-saga) is correct: it is consumed by GoogleWorkspaceAdapter
  which lives in integrations, and idp-saga must not depend on integrations.
- **idp-audit-logger.ts** — WR-4 resolved: explicit PII note + `hashExternalUserId` contract;
  the "no PII" claim is now accurate because callers hash. Matches the existing audit-logger idiom.
- **oauth.ts scope-upgrade callback** — `registerAllAdapters()` at module load, additive
  write-scope capability derivation via the typed-const, `__Host-` cookie + atomic challenge
  consume. Conformant with the existing OAuth route pattern.
- **idp-deprovisioning-step-runner.ts** — WR-3 fixed (`resolveAdapter` fail-fasts on
  not-connected / unresolvable provider instead of returning a token-less registry adapter),
  org-mismatch guard, `hashExternalUserId` on audit lines, provenance-insert-before-call ordering.

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| HIGH     | 0     | — |
| MEDIUM   | 4     | idp-saga absent from root vitest `projects[]` (tests + coverage skipped); WR-2 Gulf cooldown date off-by-one in `reason`/tooltip; Deprovisionable registry THROWS on dup vs siblings' warn+overwrite; step-runner route missing `withQueueObservability` (F-ASYNC-17) |
| LOW      | 7     | hardcoded vitest groupOrder (collides + bypasses registry); `@db` peer+dev duplication; raw ms date-math vs `addDays`; `Date.now()` non-injectable in provenance.ts; `clearAdapters()` doesn't clear deprovisionable map; provider-union triplicated within packages/api (IN-3) + 3-name drift; route missing `registerAllAdapters()`; route flat 400 detail; reconnect banner uses `Card` not `Alert` primitive |
| INFO     | 4     | finishedAt re-derivation jitter (IN-4); retry dedup-id vs attempts:0 labeling (IN-2); GC not in advisory tx (IN-1); verifyDeprovisioned swallows non-404 as false (IN-5) |
| **Total**| **15**| |

### Top items (highest indistinguishability payoff)

1. **MEDIUM — register idp-saga in root `vitest.config.ts` `projects[]` + `vitest.monorepo.ts`.**
   Right now the saga's 28 unit tests (the cooldown gate + run-status state machine — the
   highest-risk logic in the phase) never run under root `pnpm test` / coverage. This is the
   single most "this package was bolted on" tell.

2. **MEDIUM — WR-2: format the cooldown `earliestDate` in the jurisdiction TZ** (mirror
   `compliance-policy/src/expiry.ts:jurisdictionDate`) instead of slicing the UTC ISO string.
   Gulf admins are shown the wrong earliest-deprovisioning date (off-by-one), and the string is
   audit evidence.

3. **MEDIUM — wrap the QStash step-runner route in `withQueueObservability(...)`** to match
   `ksef.ts`/`ocr.ts`; the saga worker is currently invisible to per-tick queue metrics.

4. **MEDIUM — reconcile the Deprovisionable registry's throw-on-dup with the sibling registries'
   warn+overwrite + `clearAdapters()` sync** (registry.ts), or document the deliberate divergence
   the way the OCR/CompanyRegistry blocks document theirs.

5. **LOW (high readability payoff) — collapse the 3 in-package copies of the provider union into
   one `z.enum` const + `z.infer`** (IN-3) and converge the three type names
   (`DeprovisioningProvider`/`Id`/`ToggleProvider`).
