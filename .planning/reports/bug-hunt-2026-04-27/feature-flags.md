# Bug-hunt: packages/feature-flags — 2026-04-27

## Summary
- Files reviewed: 9 source + 6 tests
- Findings: 0 CRITICAL, 1 HIGH, 4 MEDIUM, 3 LOW
- Top 3 risks (one-liners):
  1. Disclaimer-gate override masquerades as `reason: 'unleash'` — observability blind spot; cannot distinguish a disclaimer-blocked classification flag from a vanilla Unleash false.
  2. `registry.ts` performs `process.exit(1)` at module-load time — side-effect import that can kill any process (CI script, test runner without bypass, future CLI) that touches the package.
  3. `ClassificationDisclaimerGate` is module-scoped mutable state, not anchored on `globalThis` like the client registry — Next.js dev hot-reload can reset it to `null`, silently re-opening the gate until app boot init re-runs.

Overall the package is small, well-commented, ships closed by default, and has solid hardening (deep-frozen registry, null-prototype bags, jurisdiction short-circuit before SDK call, defensive try/catch around `isEnabled`). Test coverage of the compliance invariant is strong. Findings below are surface-area issues, not foundational defects.

## Findings

### [HIGH] Disclaimer-gate override is invisible to callers (lost diagnostic info)
**File:** `src/evaluator.ts:117`
**What:** When `ClassificationDisclaimerGate` returns false and forces `enabled = false`, the returned `EvalResult` is `{ enabled: false, reason: base.reason }` — i.e. `reason: 'unleash'`. Callers, log scrapers, and audit dashboards cannot distinguish "Unleash returned false" from "Unleash said true but disclaimers are PENDING."
**Why it's a bug/risk:** This is a regulatory-relevant override (Phase 64 D-10 — pre-legal-signoff containment). Without a distinct reason code, the audit trail says the operator's Unleash toggle was respected when it actually was overridden. If a regulator asks "why was classification off for org X on date Y", logs show `'unleash'` for both Unleash-disabled and override-blocked cases. The internal `log.warn` line fires only when `base.enabled` was true; it is not part of the structured `EvalResult` consumed by middleware/UI.
**Suggested fix:** Add `'disclaimer-pending'` to `EvalReason` and return `{ enabled: false, reason: 'disclaimer-pending' }` when the override fires. Consumers wanting a single boolean can still ignore the reason; consumers building audit views can branch on it.

```ts
export type EvalReason = 'jurisdiction-mismatch' | 'unleash' | 'client-error' | 'disclaimer-pending';
// …
return { enabled: false, reason: 'disclaimer-pending' };
```

### [MEDIUM] `registry.ts` calls `process.exit(1)` as a module-load side effect
**File:** `src/registry.ts:181-200`
**What:** The boot-gate for-loop runs at the top level when `registry.ts` is imported. On a missing-entry gated flag without `FLAG_SIGNOFF_BYPASS=local`, it writes to stderr and `process.exit(1)`.
**Why it's a bug/risk:** Two concrete failure modes:
  1. Any tooling that imports `@contractor-ops/feature-flags` (a codegen script, a one-off migration runner, a test in a sibling package) will be killed by the package import — there is no way to opt out programmatically without setting an env var. The bypass var is documented as LOCAL-ONLY, so it cannot ship in CI or shared scripts.
  2. The current FLAGS object happens to contain zero gated-namespace keys, so the gate is dormant. The first time a `compliance-`, `gulf-`, `idp-deprovisioning`, or `offboarding-ip-`-prefixed flag lands in `FLAGS`, every importer becomes vulnerable. The boot-gate test (`boot-gate.test.ts:54`) acknowledges this gap — it can't verify the exit path because it would need to mutate the typed registry.
**Suggested fix:** Move the boot-gate body into an exported `assertFlagSignoffsOrExit()` function and have the consuming app (`apps/web/src/lib/feature-flags-init.ts` or equivalent) call it explicitly during boot. Module load stays pure. The current behavior can also be retained behind a `FLAG_SIGNOFF_BOOT_GATE=1` opt-in if you want fail-fast on accidental imports — just make the side effect opt-in, not opt-out.

### [MEDIUM] Disclaimer-gate callback is module-scoped, not anchored on `globalThis`
**File:** `src/evaluator.ts:21`
**What:** `ClassificationDisclaimerGate` lives as a `let` inside the evaluator module. The Unleash client map (`client.ts:74`) is deliberately anchored on `globalThis.__contractorOpsFlagClients` to survive Next.js dev `require.cache` invalidation; the disclaimer-gate callback is not.
**Why it's a bug/risk:** In Next.js dev hot-reload, when the evaluator module re-evaluates, `ClassificationDisclaimerGate` resets to `null`. Until `apps/web/src/lib/feature-flags-init.ts` re-runs (which only happens at the next request that imports it), `evaluate('module.classification-engine', ctx)` returns whatever Unleash says — even when the validators registry has PENDING disclaimers. This is a dev-only divergence from prod semantics; a developer running locally with disclaimer-gate-relevant scenarios may see false-positive "enabled" while disclaimers are still PENDING. Not a prod risk (no hot-reload), but it can mask the prod-correct behavior during local QA.
**Suggested fix:** Anchor on `globalThis` the same way as the client map:

```ts
type GateRegistry = { __contractorOpsClassificationGate?: (() => boolean) | null };
const g = globalThis as unknown as GateRegistry;
export function registerClassificationDisclaimerGate(fn: () => boolean): void {
  g.__contractorOpsClassificationGate = fn;
}
// inside evaluate():
const gate = g.__contractorOpsClassificationGate;
if (key === 'module.classification-engine' && base.enabled && gate) { … }
```

Bonus: log a warn if `registerClassificationDisclaimerGate` is called twice (suggests the init module is being imported multiple times — diagnostic).

### [MEDIUM] Kill-switch with `default: true` is non-killable while Unleash is unreachable
**File:** `src/registry.ts:65-72`
**What:** `killswitch.ai-invoice-parser` has `default: true`. The semantics in the registry comment ("set to `true` for kill-switches") encode "flag value true == feature enabled; flip to false to kill". When the EU/ME Unleash is unreachable, the stub client returns the fallback (`true`), so the AI invoice parser keeps running — operators cannot kill it during an Unleash outage.
**Why it's a bug/risk:** The point of a kill-switch is incident response. If AI invoice parsing produces bad output during a Claude Vision incident, ops flips the toggle in Unleash to false. If Unleash is itself down (network, deploy, config drift), the kill is ineffective. There is no "treat unreachable as killed" mode for these flags. Not regulatory, but it is an operational footgun the registry doesn't surface.
**Suggested fix:** Two options:
  1. Add a `killWhenUnknown: boolean` field to flag definitions; have `evaluateAgainst` short-circuit to false when the client is the stub. Minor surgery, opt-in per flag.
  2. Document the semantics explicitly in the kill-switch entry's `description` so the next operator knows "Unleash outage = parser keeps running."

### [MEDIUM] No validation that the Unleash SDK returned a boolean
**File:** `src/evaluator.ts:84`
**What:** `client.isEnabled(...)` is typed `boolean` per the local `FlagClient` interface, but the underlying `unleash-client` SDK is JS at runtime and a defective custom strategy could return `undefined`/`null`/non-boolean. The result is returned directly as `enabled` without coercion.
**Why it's a bug/risk:** A non-boolean leaks into the FlagBag (`Record<FlagKey, boolean>`), and downstream code doing `if (bag.values[key])` would still short-circuit on falsy values, but `=== true` comparisons (which the bag itself uses on read) would not — i.e. the bag's own `isEnabled` would correctly return false, but external code reading `bag.values[key]` directly may treat `'true'` (string) as truthy. Vanishingly unlikely with stock Unleash; the local `FlagClient` interface and the test stubs all preserve boolean. Listing here for completeness.
**Suggested fix:** Coerce defensively:

```ts
const raw = client.isEnabled(def.key, toUnleashContext(ctx), def.default);
const enabled = raw === true;
return { enabled, reason: 'unleash' };
```

Same pattern already present in `flag-bag.ts:50` for the bag's read-side.

### [LOW] `Region` and `evalContextSchema.region` are independently declared
**File:** `src/client.ts:7` vs `src/schemas.ts:34`
**What:** `Region = 'EU' | 'ME'` in `client.ts` and `region: z.enum(['EU', 'ME'])` in `schemas.ts` are two independent literal definitions. Adding a region (e.g. `'UK'`, `'US'`) to one without the other compiles cleanly (the eval-context type is inferred from the schema, the client's `Region` is hand-typed) but introduces silent runtime drift.
**Why it's a bug/risk:** Low for now — one package, two short literals. If `Region` ever expands and the schema is forgotten, callers can construct an `EvalContext` with the new region but `getFlagClient` lookup (`process.env[`UNLEASH_URL_${region}`]`) would silently produce a stub. Hard to detect.
**Suggested fix:** Derive one from the other. Either:

```ts
// schemas.ts
export const regionSchema = z.enum(['EU', 'ME']);
export type Region = z.infer<typeof regionSchema>;
// then in client.ts:
import { type Region } from './schemas.js';
```

or vice versa. One source of truth.

### [LOW] `evaluate`'s disclaimer-gate branch is hardcoded by string equality
**File:** `src/evaluator.ts:107`
**What:** The override condition is `if (key === 'module.classification-engine' && base.enabled && …)`. There is a typed alias `CLASSIFICATION_ENGINE_FLAG` in `registry.ts:162` for exactly this purpose, but it isn't used here.
**Why it's a bug/risk:** Renaming the flag (or future refactors) requires touching two places. The whole point of the typed alias is single-point-of-rename. Cosmetic but worth aligning.
**Suggested fix:**

```ts
import { CLASSIFICATION_ENGINE_FLAG } from './registry.js';
// …
if (key === CLASSIFICATION_ENGINE_FLAG && base.enabled && ClassificationDisclaimerGate !== null) { … }
```

### [LOW] `lazyFlagBag` materializes on first `values` getter access too
**File:** `src/flag-bag.ts:62-64`
**What:** The getter for `values` calls `build()` and returns the full bag, which triggers the full evaluation across every flag. The whole motivation of `lazyFlagBag` (per the docstring) is "procedures that never consult a flag pay zero Unleash-SDK overhead." A consumer that does `JSON.stringify(bag)` or even DevTools-inspects `bag` materializes everything.
**Why it's a bug/risk:** Not a bug — the docstring promises `isEnabled` laziness, not `values` laziness. But the risk is that a serializer (e.g. tRPC's superjson, a logger that dumps args) silently triggers full evaluation, defeating the point. The eager `values` getter is a footgun for the lazy variant.
**Suggested fix:** Either remove `values` from `lazyFlagBag` (forcing callers through `isEnabled`), or document that any access to `values` materializes. Personally I'd narrow the public type:

```ts
export interface LazyFlagBag {
  isEnabled(key: FlagKey): boolean;
}
export function lazyFlagBag(ctx: EvalContext): LazyFlagBag { … }
```

Caller that needs the materialized bag for serialization explicitly calls `buildFlagBag` instead.

## Files reviewed
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/index.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/evaluator.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/registry.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/client.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/schemas.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/flag-bag.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/signoff-registry-flags.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/signoff-registry-flags-schema.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/signoff-registry-flags.json`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/__tests__/evaluator.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/__tests__/hardening.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/__tests__/boot-gate.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/__tests__/is-gated-flag.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/__tests__/signoff-registry-flags.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/__tests__/signoff-registry-flags-compliance-entries.test.ts`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/package.json`
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/README.md`

## Notes that did NOT make the cut (intentionally not flagged)
- The jurisdiction short-circuit fails CLOSED for region-restricted flags even when Unleash returns true — verified across `evaluator.test.ts` and `hardening.test.ts`. Working as designed.
- Singleton client map anchored on `globalThis` correctly survives Next.js dev hot-reload. Cache key is `Region` (only two values, no per-org/per-user collision risk).
- `buildFlagBag` and `emptyFlagBag` use `Object.create(null)` for prototype safety — explicit, justified, tested.
- Deep-freezing `FLAGS` to make jurisdiction immutable at runtime is a strong defense and tested in `hardening.test.ts`.
- No secrets are logged. The `'ready'` event handler explicitly notes the URL is omitted to avoid future credential leakage.
- The error-swallowing `try/catch` around `isEnabled` (`evaluator.ts:83`) logs `err` and falls back to code default — appropriate, not error-swallowing.
- No SSR/client mismatch surface — package is server-only; FlagBag boolean values serialize cleanly.
- No `as any` / unjustified `as unknown as` outside the `globalThis` registry pattern, which is the standard Next.js workaround.
