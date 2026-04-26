# Phase 70: v6.0 Foundation — Cross-Cutting CI Guards & Observability Baseline - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Engineers cannot land code that introduces:
- A multi-tenant leak (Prisma model without `organizationId` outside the global-lookup allowlist)
- Regulator-grade PII exposure (tRPC request bodies logged in full without an explicit opt-in)
- Message-key drift (i18n key in `en.json` without peers in `de.json`, `pl.json`, `ar.json`)
- Unsigned legal copy (Unleash flag flipped to APPROVED in compliance/idp/gulf/offboarding namespaces without a referencing legal-sign-off ticket; orphan flags refuse to load at boot)
- A break to v3.0 read-only Google Workspace OAuth (existing read-only directory-import must keep working while new scope upgrades for IdP deprovisioning persist `IntegrationConnection.scopeCapabilities`)
- Audit-log fidelity loss (IdP audit lines emit through a separate Pino child with explicit allow-list — never accidentally redacted)

Every CRITICAL-recovery-cost bug class from PITFALLS P27–P31 gets a CI guard that blocks the PR. This phase delivers the foundation only — F1/F2/F3/F4 feature delivery is Phases 71–80.

</domain>

<decisions>
## Implementation Decisions

### Enforcement layer + allowlist
- **D-01:** Guards run in **CI + husky pre-push** (not pre-commit) — fast local commits, blocking gate before code leaves the dev's machine, plus the canonical PR check.
- **D-02:** Allowlists and exemptions live as **typed TS constants per guard** (e.g., `GLOBAL_LOOKUP_MODELS_ALLOWLIST` in the schema-guard package). Compile-time check, code-review gate, no runtime config drift.
- **D-03:** Guard failure output is a **structured diff + remediation pointer** — naming the offending model/router/key plus a path to the documented fix-up procedure. Same shape across all three guards.
- **D-04:** **Three independent scripts** — `pnpm lint:schema`, `pnpm lint:logs`, `pnpm i18n:parity`. No umbrella entrypoint. Each fails independently in CI; husky pre-push runs all three sequentially.

### PII redaction migration
- **D-05:** **Default-redact at the logger factory** in `packages/logger`. Routers opt into body logging via a typed wrapper `withBodyLogging(['contractor.*'])`. Forces every existing logger touch-point to declare intent during migration; default behaviour is safe.
- **D-06:** `LOG_BODY_INCLUDE_PREFIXES` lives as a **typed TS constant in packages/logger** (matches D-02). The CI guard greps the constant directly. Compile-time, reviewable in PRs.
- **D-07:** Pre-cutover leak audit uses an **AST scan via ts-morph in CI guard #2** — the same guard that prevents future regressions reports current offenders. Reuses an existing dependency, no production-like load required (compatible with LOCAL-ONLY constraint).
- **D-08:** **Rollback is per-field allow with PR-reviewed justification.** `LOG_BODY_INCLUDE_PREFIXES` accepts `routerPrefix:fieldA,fieldB` plus a required reason comment in the typed constant. No whole-router escape hatch.

### Sign-off registry (feature flag namespaces)
- **D-09:** Add a **parallel registry** at `packages/feature-flags/src/signoff-registry-flags.ts`. Independent of Phase 64's disclaimer signoff (`packages/validators/src/legal/signoff-registry-schema.ts`) — different approver-role enums, different gate timing, different consumer (flag evaluator vs CI legal-gate-production).
- **D-10:** **Hard process exit on boot** if any flag in a gated namespace is APPROVED but missing from the registry. Structured stderr error: `[FLAG-SIGNOFF] flag 'compliance-portal-self-service' missing registry entry — refusing to boot`. Same shape as Prisma migration drift errors.
- **D-11:** **Gated namespaces:** `compliance-*` (F1, Phases 71–73), `idp-deprovisioning` (F2, Phases 76–78), `gulf-*` (F3, Phase 79), `offboarding-ip-*` (F4, Phases 74–75). Flags outside these namespaces do not require signoff.
- **D-12:** **Required `legalTicketRef` field** on every APPROVED entry — schema validates against `LEGAL-\d+` ticket id format or full URL. CI guard verifies non-empty when status=APPROVED. Greppable, auditable, survives squash-merge.

### OAuth scope upgrade + audit logger
- **D-13:** `IntegrationConnection.scopeCapabilities` is a **tagged-union JSONB** — `{ provider: 'google'|'slack'|'entra'|'okta'|'github', scopes: string[], capabilities: CapabilityEnum[], grantedAt: ISO }`. Code branches on the typed `capabilities` enum, never on raw scope strings. Raw scopes preserved for audit fidelity and drift detection.
- **D-14:** **Backfill via static map per provider in the migration script.** Existing v3.0 GWS connections get `capabilities: ['directory.read']` written for every row in a single transaction. Reproducible, no live API calls during migration, satisfies CI guard #5's backfill assertion.
- **D-15:** **Dedicated factory `getIdpAuditLogger()`** in `packages/logger`. Returns a Pino child with PII redact paths active *and* an explicit allow-list constant of audit fields (`externalUserId`, `actionResult`, `provider`, `connectionId`, `scopeDelta`). Symmetric with `withBodyLogging()` (D-05). Typed at the call site — sloppy callers fail TypeScript before runtime.
- **D-16:** **User-initiated reconnect for v3.0 GWS scope upgrade.** Banner in Integrations page: "Reconnect Google Workspace to enable IdP deprovisioning". Existing read-only directory-import keeps working with the old scope set; new deprovisioning features stay disabled until the user clicks reconnect. OAuth re-prompt uses `prompt=consent` so the user sees the new permission set explicitly.

### Claude's Discretion
- Exact CI workflow file structure (`.github/workflows/`) — researcher/planner can choose the minimal-diff layout
- Husky pre-push hook script exact bash — boilerplate is non-controversial
- ts-morph traversal performance tuning — `lint:logs` is allowed to be slow as long as it's correct
- The internal naming of capability enum members (e.g., `directory.read` vs `DirectoryRead`) — pick the convention that aligns with existing `IntegrationProvider` enum
- The exact stderr error format — match the closest existing failure message (Prisma migration drift)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Logger / observability baseline
- `packages/logger/src/index.ts` — current Pino root logger; D-05/D-15 modify the factory
- `packages/logger/src/pii-mask.ts` — current `PII_MASK_PATHS` redact list (baseline; do not regress)

### Sign-off registry pattern (extension target for D-09 to D-12)
- `packages/validators/src/legal/signoff-registry-schema.ts` — Phase 64 D-12 disclaimer signoff schema; the new flag-namespace registry follows the same Zod-schema-with-refine pattern but is independent

### Feature flags
- `packages/feature-flags/src/registry.ts` — current flag registry; D-10's boot-time gate plugs in here
- `packages/feature-flags/src/evaluator.ts` — flag evaluator; D-10's namespace check happens at registry load time, not eval time

### IdP / OAuth scope storage (extension target for D-13/D-14)
- `packages/db/prisma/schema/integration.prisma` — `IntegrationConnection` model; D-13 adds the `scopeCapabilities` Json field, D-14 migration backfills

### Multi-region DB layout (impacts D-14 backfill scope)
- `packages/db/scripts/push-all-regions.ts` — backfill must run per region (EU + ME)

### Pitfalls being mitigated
- `.planning/PROJECT.md` (PITFALLS section P27–P31, if present) — the recovery-cost bug classes this phase guards against. If pitfalls live elsewhere, planner should locate them before sequencing tasks.

### Standing Project Constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY deploy, legal review DEFERRED. Means the boot-fail behaviour of D-10 must not block local development for engineers without a populated registry; recommend a bypass env var documented in remediation pointers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/logger`** — Pino factory with `PII_MASK_PATHS` already wired; D-05/D-15 extend it without rewriting it.
- **`packages/validators/src/legal/signoff-registry-schema.ts`** — Zod schema-with-refine pattern; D-09's parallel schema clones the structure for flags.
- **`packages/feature-flags`** — registry + evaluator already split into two files; D-10 hooks into the registry-load path.
- **`packages/db/prisma/schema/integration.prisma`** — `IntegrationConnection.configJson` already JSONB; D-13 adds a sibling `scopeCapabilities` Json field with the same multi-region considerations.
- **`packages/db/scripts/push-all-regions.ts`** — multi-region migration runner; D-14 backfill follows the same shape.
- **ts-morph** — already a dependency (used by codegen/validators); D-07 reuses it for the AST scan in `lint:logs`.

### Established Patterns
- **Typed-constant configuration over runtime config** (D-02, D-06) — already the norm; this phase reinforces it.
- **CI guards run in `.github/workflows/` per concern, no umbrella** (D-04) — matches existing per-concern workflow files.
- **Multi-region migrations are mandatory** — `push-all-regions.ts` is the authoritative path; D-14 must hit every region.
- **Standing constraint: LOCAL-ONLY + legal DEFERRED** — D-10's boot-fail must have a documented dev-bypass that doesn't ship to non-local envs.

### Integration Points
- **`packages/logger/src/index.ts`** factory signature changes to default-redact bodies — every existing `import { ... } from '@contractor-ops/logger'` is a touch-point that needs the AST scan from D-07.
- **`packages/feature-flags/src/registry.ts`** registry-load path gains the namespace-signoff check — boot ordering: registry load happens before flag evaluation, so the gate fires before any feature flag is read.
- **`packages/db/prisma/schema/integration.prisma`** schema change triggers a migration that must be applied per region.
- **OAuth flow handler for Google** (locate during planning) — gains `prompt=consent` on re-auth and persists `scopeCapabilities` after token grant.
- **Integrations page UI** (locate during planning, likely `apps/web/src/app/(authenticated)/integrations/`) — banner component for the v3.0→v6.0 reconnect prompt.

</code_context>

<specifics>
## Specific Ideas

- The flag-signoff boot-fail message should mirror Prisma migration drift errors in shape — engineers already recognise that pattern.
- Pre-existing v3.0 GWS users must keep their existing read-only directory-import working for the entire lifetime of v6.0; never silently break it during a reconnect-required state.
- AST-scan-based audit (D-07) should produce a single artefact (e.g., `.lint-logs-baseline.json`) the team can review at PR time to spot scope creep in the redaction allowlist.
- The boot-fail in D-10 is the strongest contract: a dev who flips an Unleash flag and forgets the registry entry must hit the failure during local boot, not in staging.

</specifics>

<deferred>
## Deferred Ideas

- **Runtime PII redaction sampling + Axiom dashboard.** Useful as a defense-in-depth layer once we're not LOCAL-ONLY. Out of scope for Phase 70; revisit when Standing Constraints lift.
- **Inline signoff metadata on the flag definition itself.** Considered in Area 3; deferred in favour of a parallel registry. If the parallel registry duplicates information unsustainably, revisit at v7.0.
- **Force re-OAuth on next admin login.** Faster scope rollout but worse UX; rejected for the user-initiated banner. Revisit if reconnect uptake is too slow during F2 IdP rollout (Phases 76–78).
- **PR-comment-based guard output.** Rich markdown PR comments were rejected for the structured-diff + remediation-pointer format. Re-evaluate if engineers report the structured diff is hard to read in failed-CI logs.

</deferred>

---

*Phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli*
*Context gathered: 2026-04-26*
