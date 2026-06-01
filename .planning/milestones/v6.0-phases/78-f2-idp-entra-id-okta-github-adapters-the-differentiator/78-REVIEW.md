---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
artifact: code-review
status: issues_found
depth: deep
date: 2026-06-01
files_reviewed: 17
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
scope_note: >
  Source-level review of phase-78 changed files (adapters, classifier, connection
  routers, scopes, impact-preview union, web-vite provider sections, i18n, flags).
  Focus = what lint guards can't catch: SOLID/DRY vs the 77 GWS/Slack adapters,
  SDK token handling / secret hygiene, the Entra hybrid-AD hard-block, GitHub
  per-PAT revoke correctness, tenant scoping + audit, web-vite conventions, i18n,
  WCAG. The deterministic lint scan is NOT re-reported except the one item the
  task asked to confirm (raw-fetch).
---

# Phase 78 — Code Review (F2 IdP: Entra / Okta / GitHub adapters)

Three vendor adapters (`EntraIdAdapter` raw-Graph, `OktaAdapter` `@okta/okta-sdk-nodejs`,
`GitHubAdapter` `@octokit/rest`), a signal-driven per-provider error classifier extension,
three thin tRPC connection routers, registry/flags wiring, and three web-vite provider
sections. Overall quality is high: token hygiene is real, the hard-block is enforced and
tested, i18n parity across en/de/pl/ar is clean, the UI honours the Page→Container→Hook→Component
layering and WCAG basics. The findings below are the gaps.

---

## CRITICAL

### CR-1 — `lint:raw-fetch` FAILS on `entra-id-adapter.ts` (8 unannotated raw `fetch()` sites)
`packages/integrations/src/adapters/entra-id-adapter.ts:114,158,177,194,219,237,301,336`

The repo ships a blocking guard (`scripts/lint-raw-fetch.mjs`, wired into `lint:ci`) that bans
unannotated raw `fetch()` under `packages/integrations/src/**`. It demands EITHER `fetchWithTimeout`
(preferred — bounds wall-clock + honours `Retry-After`) OR a `// resilience: raw-fetch-OK reason=<why>`
annotation on the line above. The Entra adapter uses bare `await fetch(...)` in all 8 call sites with
neither. Verified empirically:

```
$ node scripts/lint-raw-fetch.mjs
packages/integrations/src/adapters/entra-id-adapter.ts:114: const preRes = await fetch(
...8 entra sites... (also google-workspace-adapter.ts and run-health-check.ts)
```

**Which does the guard want?** The wrapper, not the annotation. These are deprovision mutations
running inside a QStash step with a platform deadline (`timeout: '60s'`); an unbounded `fetch` can
hang the callback past that deadline — exactly the failure mode the guard exists to prevent. The
forensic `signInActivity` poll and the `$count` reads can also hang. Fix: route all 8 through
`fetchWithTimeout` (the Slack adapter's `#scimFetch`/`#adminApi` show the `withResilience(() => fetchWithTimeout(...))`
pattern). Reserve the `raw-fetch-OK` annotation only if a specific call is a deliberate best-effort
no-timeout case (none qualify here).

> Note (confirm, don't dwell): the **pre-existing Phase-77 `google-workspace-adapter.ts` also trips
> this guard** (~8 sites). The Entra adapter faithfully copied a non-compliant precedent. That GWS
> already violates the guard while the milestone is "Complete" strongly implies `lint:raw-fetch` is
> **not actually gating green CI** today (or is suppressed). Worth a separate confirmation — if the
> guard is live, phase 77 should already be red. Either way, the Entra additions make it worse.

---

## WARNING

### WR-1 — Three per-provider routers are near-verbatim duplicates of an existing 5-provider router (DRY / SOLID)
`packages/api/src/routers/integrations/entra.ts`, `okta.ts`, `github.ts` (all ~90 lines, byte-near-identical)

`deprovisioning.enableProviderForOrg` + `getProviderToggleState` (in `deprovisioning.ts:554-649`)
**already** handle all five providers — ENTRA/OKTA/GITHUB included — with `isProviderSignoffSatisfied`,
the same `settingsJson.idpDeprovisioningEnabled` storage, and audit. The three new routers re-implement
that for one provider each, differing only in three constants (`PROVIDER`, `FLAG_KEY`, audit action
strings). This is the classic "copy-paste × N providers" smell the codebase elsewhere avoids via the
`DEPROVISIONING_TOGGLE_PROVIDERS` table. Fix: either delete the three routers and have the UI call
`enableProviderForOrg({ provider })` / `getProviderToggleState` (the toggle-table already does), or
collapse them into one parameterised factory. Same applies to the 5× duplicated `#mapFailure` /
`#mapDeprovisionFailure` across the adapters — see WR-2.

### WR-2 — `#mapFailure` DeprovisionResult-mapping duplicated across all 5 adapters (DRY; candidate shared base)
`entra-id-adapter.ts:353-391`, `okta-adapter.ts:247-279`, `github-adapter.ts:352-379`,
`slack-adapter.ts:626-656`, plus the GWS adapter

Each adapter has a private `#mapFailure(...)`/`#mapDeprovisionFailure(...)` with the identical
shape: classify → throw on TRANSIENT_* → LIKELY_GONE branch on PERMANENT_NOT_FOUND → FAILED with
`failureKind = AUTH_EXPIRED ? 'AUTH_REVOKED' : 'PROVIDER_ERROR'`. Only the error-message string and
the input signal differ. This is ~30 lines duplicated 5×. The task's framing ("should they share a
base?") — yes: a `mapErrorClassToResult(errorClass, { requestSha256, responseSha256, providerLabel })`
helper (in `saga-canonicalize`'s neighbourhood or a new `deprovision-result.ts`) would remove the
duplication and guarantee the saga contract stays uniform. `BaseAdapter` is the wrong home (it has no
Deprovisionable knowledge) — a free function or a `DeprovisionableMixin` is the right seam. Not a bug,
but it's the single largest maintainability debt in the phase.

### WR-3 — ENTRA/OKTA/GITHUB adapters resolve with EMPTY credentials in the step-runner (latent foot-gun)
`packages/api/src/services/idp-deprovisioning-step-runner.ts:174-184`

`resolveAdapter()` only injects a token for `GOOGLE_WORKSPACE` and `SLACK`; every other provider falls
through to `return getDeprovisionableAdapter(body.provider)` — the bare registry instance with
`#accessToken=''` / `#token=''` / `#org=''`. `OktaAdapter.withCredentials` and `GitHubAdapter.withCredentials`
are never called anywhere outside their own definitions + tests (verified). So if an ENTRA/OKTA/GITHUB
step ever reached the runner it would call the provider with an empty bearer / empty org.

Today this is dormant and fails CLOSED: `startDeprovisioningRun` only fans out `PROVIDERS_FOR_RUN = ['GOOGLE_WORKSPACE']`
(`deprovisioning.ts:69`), and an empty-token Entra call 401s into `PERMANENT_AUTH_EXPIRED` rather than
mutating. This is the documented "ENTRA/OKTA enum gap / deferred" state. BUT there is no fail-fast guard:
the day someone adds a provider to `PROVIDERS_FOR_RUN` (or hand-publishes a QStash job — the
`stepRunnerBodySchema` already accepts all five) the adapter silently runs uncredentialed. Fix: make
`resolveAdapter` throw (or return a typed `not_wired` failure) for providers without a resolver, instead
of returning a bare instance. Cheap insurance against a future foot-gun on a security-critical path.

### WR-4 — New `setEnabled` routers omit the settings-cache invalidation that `enableProviderForOrg` performs (consistency)
`entra.ts:71-74`, `okta.ts:70-73`, `github.ts:70-73`

`deprovisioning.enableProviderForOrg` calls `void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId))`
after the `organization.update` (matching `core/settings.ts`'s four write paths). The three new
`setEnabled` mutations write the SAME `settingsJson` field but do NOT invalidate. The two surfaces now
diverge: a write via the toggle-table (`enableProviderForOrg`) clears the settings cache; a write via a
provider card (`entra.setEnabled`) does not. Since these specific reads (`org.findUnique` in `getStatus`)
aren't currently cache-fronted, this is not a live data-staleness bug today — but it's an inconsistency that
becomes a real stale-read the moment org settings get a read-through cache, and it's user-reachable because
both surfaces are rendered on the same tab (see INFO-1). Add the same `invalidateByPrefix` call, or fold
into `enableProviderForOrg` (WR-1).

### WR-5 — Concurrent read-modify-write of `Organization.settingsJson` (lost-update race)
`entra.ts:61-74`, `okta.ts:60-73`, `github.ts:60-73` (and pre-existing in `deprovisioning.ts:620-634`)

Each `setEnabled` does `findUnique(settingsJson)` → spread-merge `idpDeprovisioningEnabled[PROVIDER]` →
`update(settingsJson)`. Two concurrent toggles for different providers on the same org (e.g. an admin
flipping Entra and Okta in quick succession, or the card + toggle-table firing together) can interleave
read-read-write-write and drop one provider's change. `settingsJson` is a single JSON blob with no
optimistic-concurrency guard. Pre-existing pattern (not introduced here), but the phase multiplies the
write entry points 3×, raising the collision probability. Fix: a single `update` with a JSONB merge at the
DB layer, or an `updateMany` guarded on the prior value, or serialise via the shared `enableProviderForOrg`.

### WR-6 — GitHub `describeImpact` outside-collaborator count is an unbounded N+1 over all org repos
`github-adapter.ts:316-345` (`#countOutsideCollabRepos`)

When the user is an outside collaborator, the adapter paginates EVERY repo in the org and fires a
`repos.checkCollaborator` per repo (capped at `pLimit(5)`). For a large org (thousands of repos) that's
thousands of API calls on a single preview, easily blowing the GitHub rate budget and the preview's
latency/cache window. The `catch {}` swallows 403 rate-limit identically to 404 not-a-collaborator, so a
mid-scan rate-limit silently under-counts the back-door (the headline security signal) rather than
surfacing "unavailable". Fix: prefer `GET /repos/{owner}/{repo}/collaborators?affiliation=outside` filtering,
or cap the scan with an explicit "partial — N repos checked" marker, and distinguish 403 from 404 so a
throttled scan reports `null`/unavailable instead of a falsely-low count.

---

## INFO

### INFO-1 — Two independent enable surfaces for the same state on one tab (UX redundancy)
`apps/web-vite/src/components/settings/integrations-tab.tsx:127-134`

The tab renders the three provider cards (each with its own enable Switch via `entra/okta/github.setEnabled`)
AND `IdpDeprovisioningToggleTableContainer` (which toggles the same 5 providers via `enableProviderForOrg`).
Two controls, same underlying `idpDeprovisioningEnabled[provider]`, two different mutations — one cache-invalidating
(WR-4), one not. After toggling one surface the other can show a stale value until refetch. Decide on one
canonical control, or have both call the same mutation and share a query key.

### INFO-2 — Hook surfaces the raw tRPC error KEY to the user on toggle failure
`hooks/use-entra-provider-section.ts:30` (and the okta/github twins)

`onError: err => toast.error(err.message || t('toggleFailure'))`. On a FORBIDDEN reject, `err.message` is
the i18n KEY string `deprovisioningProviderSignoffPending` (`packages/api/src/errors.ts:402`), not a translated
message — the toast shows the raw key. The repo has a `use-translated-error` helper + `api-error-message`
component for exactly this. Practically low-impact (the Switch is `disabled` when `!flagApproved`, so the
FORBIDDEN path is only reachable via a race / direct call), and many existing org hooks do the same raw
`err.message` — so this is a repo-wide pattern, not a phase regression. Flagged for consistency.

### INFO-3 — Entra hard-block reuses `PROVIDER_ERROR`/`PERMANENT_FORBIDDEN` instead of a dedicated kind (accepted deviation)
`entra-id-adapter.ts:143-153`

The hybrid-AD block returns `failureKind: 'PROVIDER_ERROR'` + `errorClass: 'PERMANENT_FORBIDDEN'` +
`reason: 'hybrid_ad_authoritative'` because `DeprovisionFailureKind` is a closed Phase-76 enum without a
`HYBRID_AD_AUTHORITATIVE` member. This is documented in the SUMMARY and is the correct minimal-blast-radius
choice (no schema change in an autonomous phase). The block itself is correct and tested
(`entra-deprovision.test.ts:56` asserts NO PATCH fires). Noted only so a future reader knows the reason
string is the real discriminator, not the kind.

### INFO-4 — `token_last_eight` is not in the canonicalize denylist
`github-adapter.ts:150,164` / `saga-canonicalize.ts:15-40`

The GitHub revoke hashes `lastEight: masked.sort()` into `responseSha256`. `token_last_eight` is GitHub's
own already-masked, non-secret identifier and it's only one-way hashed, so this is acceptable. But the key
isn't on the `DENYLIST_KEYS` set, so the same field under a differently-named wrapper elsewhere wouldn't be
stripped. Cheap hardening: add `token_last_eight` to the denylist for defence-in-depth.

### INFO-5 — `classifyError` accepts both `ENTRA` and `ENTRA_ID` provider hints (intentional, but a smell)
`error-classifier.ts:38-44`

The `ClassifyErrorProvider` union carries both `'ENTRA'` and `'ENTRA_ID'` to let callers reading either the
Prisma enum (ENTRA) or the plan spec (ENTRA_ID) compile. Behaviour is signal-driven so the hint is cosmetic,
but two literals for one provider invites drift. Since the whole codebase standardised on `ENTRA`, consider
dropping `ENTRA_ID` from the hint union (the classifier doesn't branch on it anyway).

### INFO-6 — Okta `describeImpact` constructs the SDK client but `getUser` failure path is the only one that throws
`okta-adapter.ts:147-209`

`describeImpact` correctly throws only on a non-404 user-read failure (Phase-77 D-03 proceed-without-preview),
and degrades every count/collect to `0`/`[]` on failure. Good. One observation: `#client()` is re-instantiated
on every method call (also Entra/GitHub do per-call client construction). For the SDK adapters this means a
fresh `Octokit`/`Client` per suspend/revoke/verify/describe — negligible cost, but if the SDK does any
connection pooling it's discarded. Not worth changing; noted for awareness.

---

## By-severity summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 1 | CR-1 (raw-fetch guard fails on Entra adapter — wants `fetchWithTimeout`, not annotation) |
| Warning  | 6 | WR-1 (router DRY), WR-2 (`#mapFailure` DRY / shared base), WR-3 (empty-cred adapter foot-gun), WR-4 (missing cache invalidation), WR-5 (settingsJson lost-update race), WR-6 (GitHub outside-collab N+1 + 403/404 conflation) |
| Info     | 6 | INFO-1 (dual toggle surfaces), INFO-2 (raw error key in toast), INFO-3 (hard-block kind reuse — accepted), INFO-4 (token_last_eight denylist), INFO-5 (ENTRA/ENTRA_ID dual hint), INFO-6 (per-call SDK client) |

**Strengths confirmed:** token hygiene is genuine — tokens are never logged or embedded in thrown errors,
`canonicalize` strips auth/secret/PII before any audit hash, and the no-secret response is unit-asserted
(`idp-deprovision-connections.test.ts:191`). The Entra hybrid-AD HARD BLOCK truly prevents writes (no PATCH
fires; test-enforced). GitHub per-PAT revoke is correct: SAML-absent orgs degrade to SUCCEEDED-with-warning,
404 = idempotent already-revoked, transient → retry, permanent → FAILED. The 403-rate-limit-vs-forbidden
classifier disambiguation is right and ordered before the forbidden branch. Tenant scoping is clean — every
router derives `organizationId` from session context, no client-supplied tenant id in any schema, audit
written on the sensitive toggle. i18n parity is exact across en/de/pl/ar with real Arabic copy, and the UI
is WCAG-correct (label/`useId` association, `aria-label` on switches, `aria-hidden` decorative icons,
loading/error/empty states present).

**Top priority:** CR-1 (will break `lint:ci` if the guard is live — and confirm why phase-77 GWS already
trips it). Then WR-3 (fail-fast for uncredentialed adapters on a security path) and WR-1/WR-2 (the
duplication that will rot as more providers land).
