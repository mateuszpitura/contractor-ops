---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
artifact: conformance-audit
status: issues_found
depth: deep
date: 2026-06-01
mode: read-only
basis: 78-REVIEW.md (unfixed LOW/INFO carried forward) + fresh compare-to-analog scan
findings:
  high: 0
  medium: 4
  low: 4
  info: 5
  total: 13
scope_note: >
  Conformance + code-smell audit of Phase-78 new/changed modules, comparing EACH
  against its closest existing analog (Phase-77 GWS/Slack adapters, the 5-provider
  deprovisioning toggle router, neighbouring web-vite provider sections). Goal:
  make the new code indistinguishable from the rest of the tree. Items FIXED this
  session were re-verified and are NOT re-reported (see "Verified fixed" below).
---

# Phase 78 — Conformance & Code-Smell Audit (F2 IdP: Entra / Okta / GitHub)

Punch-list format: `severity | file:line | smell / divergence | existing analog (path) | idiomatic fix`,
grouped by file. Severity here is conformance-weighted (does it make the new code
diverge from house style / rot under maintenance), not runtime-risk-weighted.

---

## Verified FIXED this session (re-checked, not re-reported)

- **CR-1 raw-fetch** — `node scripts/lint-raw-fetch.mjs` → `OK — no unannotated raw fetch() in 414 files` (exit 0). `entra-id-adapter.ts` now routes all 8 sites through `fetchWithTimeout`.
- **WR-2 `#mapFailure` DRY** — extracted to the shared free function `packages/integrations/src/idp/deprovision-result.ts` `mapErrorClassToResult(...)`; all 5 adapters (GWS, Slack, Entra, Okta, GitHub) call it. The DESIGN NOTE in that file even documents the "free function, not BaseAdapter method" decision the review asked for.
- **WR-3 empty-cred adapter foot-gun** — `idp-deprovisioning-step-runner.ts:202-219` `resolveAdapter` now fails-fast (throws) for ENTRA/OKTA/GITHUB and for a not-ok GWS/Slack token, instead of returning a bare uncredentialed registry instance.
- **WR-4 cache invalidation** — `entra.ts:78`, `okta.ts:77`, `github.ts:77` all call `void invalidateByPrefix(CacheKeys.settingsPrefix(...))`, matching `deprovisioning.ts:643`.
- **WR-6 GitHub outside-collab scan** — `github-adapter.ts:335-386` bounds the scan at `OUTSIDE_COLLAB_REPO_SCAN_LIMIT = 500` with a logged "partial" warning, and distinguishes 403 (abort + log, report 0) from 404 (not-a-collaborator).

---

## `packages/api/src/routers/integrations/{entra,okta,github}.ts`

### MED-1 — Three per-provider routers are near-verbatim duplicates of the existing 5-provider toggle (DRY / SOLID) — FIX F DEFERRED
`entra.ts` (95 L), `okta.ts` (94 L), `github.ts` (94 L) — byte-identical except `PROVIDER`, `FLAG_KEY`, and two audit-action strings.

- **Smell:** classic "copy-paste × N providers". `getStatus` + `setEnabled` re-implement, per provider, exactly what `deprovisioning.getProviderToggleState` + `deprovisioning.enableProviderForOrg` already do for all five providers.
- **Analog:** `packages/api/src/routers/integrations/deprovisioning.ts:561-657`. `enableProviderForOrg`'s input enum is `z.enum(['GOOGLE_WORKSPACE','SLACK','ENTRA','OKTA','GITHUB'])` (line 615) — ENTRA/OKTA/GITHUB are ALREADY accepted; `getProviderToggleState` already returns each provider's `flagApproved` + `enabled` via `isProviderSignoffSatisfied` + the same `settingsJson.idpDeprovisioningEnabled` storage.
- **Idiomatic fix (deferred per FIX F):** delete the three routers and have the UI hooks call `deprovisioning.enableProviderForOrg({ provider })` + read from `getProviderToggleState`; OR collapse the three into one parameterised `makeProviderToggleRouter(provider, flagKey)` factory. The toggle-table already proves the parameterised path works. NOTE: this is the deferred consolidation — describing the target only, no edit.

### MED-2 — New routers audit via `writeAuditLog`, the analog audits via `auditLog.info` — divergent audit surface for the SAME mutation
`entra.ts:80-90`, `okta.ts:79-89`, `github.ts:79-89`

- **Divergence:** the three `setEnabled` mutations write the audit trail through the canonical `writeAuditLog(...)` service (DB-backed `AuditLog` row). The analog `enableProviderForOrg` for the identical state change uses a logger call (`auditLog.info({ auditEvent: 'idp.deprovisioning.provider_toggled', ... })`) — log-only, no DB row.
- **Consequence:** two write paths to `settingsJson.idpDeprovisioningEnabled` now produce TWO DIFFERENT audit shapes (a DB `AuditLog` row with `action: 'idp.entra.deprovisioning_enabled'` vs a log line with `auditEvent: 'idp.deprovisioning.provider_toggled'`). An auditor reconstructing "who toggled Entra" must union two sources with different keys.
- **Analog:** `deprovisioning.ts:645-654` (`auditLog.info`) vs the canonical `packages/api/src/services/audit-writer.ts` `writeAuditLog`.
- **Note:** the new routers' choice (`writeAuditLog` → durable DB row on a sensitive mutation) is arguably the BETTER one and matches CLAUDE.md ("sensitive mutations → `writeAuditLog`"). The conformance gap is the *inconsistency*: pick one. If MED-1 is taken (collapse into `enableProviderForOrg`), align that procedure onto `writeAuditLog` too so the toggle is durably audited from every surface.

### LOW-1 — `isFlagSignoffSatisfied()` re-implemented per router instead of sharing `isProviderSignoffSatisfied`
`entra.ts:24-28`, `okta.ts:23-27`, `github.ts:23-27` (each identical, comment says "mirrors deprovisioning.ts isProviderSignoffSatisfied")

- **Smell:** the bypass+approval gate is copy-pasted three times and explicitly admits it mirrors a shared helper. The `FLAG_SIGNOFF_BYPASS==='local'` env read is also duplicated 3× (and reads `process.env` directly — see LOW-2).
- **Analog:** `deprovisioning.ts` `isProviderSignoffSatisfied(provider)` — already provider-parameterised.
- **Idiomatic fix:** export `isProviderSignoffSatisfied` (or a `flagKeyForProvider(provider)` map) from a shared module and call it; folds away when MED-1 is taken.

### LOW-2 — Direct `process.env.FLAG_SIGNOFF_BYPASS` read in router source
`entra.ts:26`, `okta.ts:25`, `github.ts:25` (`if (process.env.FLAG_SIGNOFF_BYPASS === 'local')`)

- **Divergence:** CLAUDE.md bans raw `process.env` in app code (`pnpm check:no-process-env`); env access goes through a package `env` schema. The analog `deprovisioning.ts` reads the same var the same way, so this is a *propagated* pre-existing pattern, not a phase-novel one — flagged for consistency, lowest priority. Confirm whether `check:no-process-env` excludes this path; if not, this triples an existing violation.

### MED-3 — Concurrent read-modify-write of `Organization.settingsJson` (lost-update race), multiplied 3× write entry points
`entra.ts:62-77`, `okta.ts:61-76`, `github.ts:61-76` (pre-existing in `deprovisioning.ts:627-642`)

- **Smell:** `findUnique(settingsJson)` → spread-merge `idpDeprovisioningEnabled[PROVIDER]` → `update(settingsJson)` inside a `$transaction` that does NOT lock the row. Two concurrent toggles on the same org (card + toggle-table, or Entra+Okta in quick succession) can interleave read-read-write-write and drop one provider's change. `settingsJson` is a single JSON blob with no optimistic-concurrency guard.
- **Analog / origin:** identical pattern at `deprovisioning.ts:627-642` — pre-existing, but Phase 78 adds three MORE writers to the same blob, raising collision probability.
- **Idiomatic fix:** a single DB-layer JSONB merge (`jsonb_set`) via `$executeRaw`, or `updateMany` guarded on the prior value (optimistic concurrency), or — cleanest — serialise every write through the single `enableProviderForOrg` (MED-1 again). Carries the dual-surface risk noted in INFO-1.

---

## `packages/integrations/src/adapters/entra-id-adapter.ts`

### MED-4 — Entra adapter skips the `withResilience` + `parseJsonResponse` (Zod) wrappers that the Phase-77 GWS/Slack adapters use on every external call
`entra-id-adapter.ts:120,165,188,206,253,318,355` (bare `fetchWithTimeout`) and `:125,177,193,212,240,261,324` (bare `await res.json().catch(() => ({})) as <shape>`)

- **Divergence 1 (resilience):** the analog adapters wrap each provider call in `withResilience(() => fetchWithTimeout(...), { provider })` — circuit-breaker + retry + bulkhead. Slack centralises this in `#scimFetch`/`#adminApi` (`slack-adapter.ts:395-412`); GWS wraps its mutation/list calls (`google-workspace-adapter.ts:172,229,293,345`). The Entra adapter calls `fetchWithTimeout` directly with `retries: 0` and NO `withResilience` on any of its 8 sites — so a flapping Graph endpoint gets no breaker, and the adapter is the only Deprovisionable that bypasses the package's resilience seam.
- **Divergence 2 (response validation):** the package ships `parseJsonResponse`/`safeParseJsonResponse` (`packages/integrations/src/services/parse-json-response.ts`) — text → guarded JSON.parse → Zod, the documented replacement for bare `as` casts ("Audit finding #10"). GWS and Slack use it on every read body. The Entra adapter uses bare `(await res.json().catch(() => ({}))) as { accountEnabled?... }` everywhere (e.g. `:125`, `:240`, `:261`). On the hybrid-AD pre-flight read (`:125-128`) a drifted/garbage body silently coerces `onPremisesSyncEnabled` to `undefined`, which fails OPEN past the hard-block — the one read where a `safeParseJsonResponse` guard matters most for the security-critical gate.
- **Analog:** `slack-adapter.ts:395-412` (resilience seam) + `google-workspace-adapter.ts:172-200` (`withResilience` → `fetchWithTimeout` → `parseJsonResponse`).
- **Idiomatic fix:** add a private `#graphFetch(path, init)` helper mirroring Slack's `#scimFetch` that wraps `withResilience(() => fetchWithTimeout(...), { provider: 'entra' })`, and replace the bare `as` body casts with `safeParseJsonResponse(res, <zod>, 'entra:<op>')` — at minimum on the hybrid-AD pre-flight read where a malformed body must not silently bypass the block.

### INFO-1 — Entra hard-block reuses `PROVIDER_ERROR` / `PERMANENT_FORBIDDEN` instead of a dedicated kind (accepted deviation)
`entra-id-adapter.ts:150-160`

- `DeprovisionFailureKind` is a closed Phase-76 enum with no `HYBRID_AD_AUTHORITATIVE` member, so the block returns `failureKind:'PROVIDER_ERROR' + errorClass:'PERMANENT_FORBIDDEN' + reason:'hybrid_ad_authoritative'`. Documented in the SUMMARY, test-enforced (no PATCH fires). Correct minimal-blast-radius choice in an autonomous phase; `reason` is the real discriminator. No action — noted so a future reader knows.

---

## `packages/integrations/src/adapters/{okta,github,entra-id}-adapter.ts`

### INFO-2 — Per-call SDK / client construction (no instance reuse) — UNFIXED, accept-as-noted
`okta-adapter.ts:49-51` (`new Client(...)` per `#client()` call), `github-adapter.ts:62-64` (`new Octokit(...)` per `#octokit()`), `entra-id-adapter.ts` (`#authHeaders()` rebuilt per call — no client object to reuse)

- **Question the task posed ("does the codebase reuse clients?"):** the Deprovisionable instances ARE long-lived singletons (registered once in `register-all.ts:126-134`), but each method re-instantiates the vendor SDK client. `describeImpact` in Okta/GitHub constructs ONE client up front and reuses it within the method (`okta-adapter.ts:150`, `github-adapter.ts:220`) — good — but suspend/revoke/verify each build a fresh client.
- **House pattern:** the raw-fetch adapters (GWS/Slack/Entra) have no SDK client to pool — they carry a token on the instance and build headers per call, so "reuse" is moot there. For the two SDK adapters, the cost is a cheap object alloc; the only loss is discarded keep-alive connection pooling between the suspend→revoke→verify steps of one run (which are separate QStash steps anyway, so a pooled connection wouldn't survive between them).
- **Verdict:** negligible. If consolidating, build the client once in `withCredentials` and cache it on the instance (reset on re-credential). Not worth a standalone change. Matches review INFO-6.

---

## `packages/integrations/src/idp/error-classifier.ts`

### LOW-3 — `ClassifyErrorProvider` carries both `'ENTRA'` and `'ENTRA_ID'` for one provider (dual-literal smell) — UNFIXED
`error-classifier.ts:38-44`

- **Smell:** two literals for one provider invites drift. The whole tree standardised on `ENTRA` (Prisma `DeprovisioningProvider`, `register-all.ts:128` `registerDeprovisionableAdapter('ENTRA', ...)`, the saga key, `enableProviderForOrg`'s enum). `ENTRA_ID` exists only to let a caller reading the plan-spec name compile; the classifier is signal-driven and never branches on it (verified — no `provider === 'ENTRA_ID'` anywhere).
- **Idiomatic fix:** drop `'ENTRA_ID'` from the union; the single live caller `entra-id-adapter.ts:381` already passes `'ENTRA'`. Cosmetic, zero behaviour change. Matches review INFO-5.

---

## `packages/integrations/src/services/saga-canonicalize.ts` + `github-adapter.ts`

### LOW-4 — `token_last_eight` not on the canonicalize `DENYLIST_KEYS` (defence-in-depth gap) — UNFIXED
`github-adapter.ts:160,174` (hashes `lastEight: masked.sort()` into `responseSha256`) / `saga-canonicalize.ts:15-40`

- **Assessment:** `token_last_eight` is GitHub's already-masked, non-secret identifier and it is only one-way hashed into the SHA, so this is acceptable today (review INFO-4 agrees). But it isn't in `DENYLIST_KEYS`, so the same field under a differently-named wrapper elsewhere would NOT be stripped.
- **Idiomatic fix:** add `'token_last_eight'` (and lowercase `'tokenlasteight'`) to `DENYLIST_KEYS` for defence-in-depth. One-line.

---

## `apps/web-vite/src/components/integrations/hooks/use-{entra,okta,github}-provider-section.ts`

### MED-2-UI / INFO-3 — Raw tRPC error KEY shown in toast instead of the translated-error idiom — UNFIXED
`use-entra-provider-section.ts:30`, `use-okta-provider-section.ts:28`, `use-github-provider-section.ts:28` — all `onError: err => toast.error(err.message || t('toggleFailure'))`

- **Divergence:** on a FORBIDDEN reject, `err.message` is the i18n KEY string `deprovisioningProviderSignoffPending` (`packages/api/src/errors.ts:402` — verified the constant's value is the raw camelCase key, and it is NOT present in `apps/web-vite/messages/en.json`'s `Errors` namespace). So the toast shows the literal `deprovisioningProviderSignoffPending`. The `|| t('toggleFailure')` fallback never fires because `err.message` is a truthy string.
- **Analog (the idiom this repo built for exactly this):** `apps/web-vite/src/i18n/use-translated-error.ts` (`useTranslatedError()` resolves `shape.data.errorKey` through the `Errors` namespace and falls back to `Errors.generic` for unknown keys) and `apps/web-vite/src/hooks/use-resource-mutation.ts` (whose docblock explicitly says: "The previous `error.message?.length ? error.message : ''` fallback is removed so a raw camelCase key can never reach the toast").
- **Idiomatic fix:** `const translateError = useTranslatedError();` then `onError: err => toast.error(translateError(err))` — OR migrate the mutation onto `useResourceMutation` (gives success+error translation + invalidate in one). Folds all three hooks onto the same contract.
- **Mitigation noted:** the Switch is `disabled` when `!flagApproved`, so the FORBIDDEN path is only reachable via a race / direct call — low live impact. Many existing org hooks do the same raw `err.message`, so this is a repo-wide pattern; flagged for consistency, and because the three new hooks are net-new code that should land on the better idiom.

### LOW-5 (informational) — Three hooks + three containers are byte-identical except the provider literal (UI-side of MED-1)
`use-{entra,okta,github}-provider-section.ts` (identical but `trpc.<provider>` + namespace) and `{entra,okta,github}-provider-section-container.tsx` (identical but component names)

- **Smell:** mirrors the router triplication. If MED-1 collapses the routers, these collapse too — a single `useIdpProviderSection(provider)` hook + one generic container parameterised by provider would remove all six near-duplicate files.
- **Analog for the generic shape:** `IdpDeprovisioningToggleTableContainer` already drives all 5 providers from one component. Deferred with MED-1.

---

## `apps/web-vite/src/components/settings/integrations-tab.tsx`

### INFO-4 — Two independent enable surfaces for the same state on one tab (UX redundancy) — UNFIXED
`integrations-tab.tsx:127-134`

- The tab renders the three provider cards (each toggling via `entra/okta/github.setEnabled`) AND `IdpDeprovisioningToggleTableContainer` (toggling the same 5 providers via `enableProviderForOrg`) right below them. Two controls bind the SAME `settingsJson.idpDeprovisioningEnabled[provider]` via two different mutations with two different query keys — after toggling one surface the other shows a stale value until refetch, and (per MED-2) they audit differently.
- **Idiomatic fix:** decide on ONE canonical control. Either drop the per-provider cards' toggle (keep them as informational/branding + banners, route enable through the table), or drop the table and let the cards own it — but then the table's GWS/Slack rows need a home. Cleanest end-state: cards become presentation-only (Entra hybrid-AD + CA banners are their real value) and the single toggle-table owns every enable. Matches review INFO-1.

---

## `apps/web-vite/src/components/integrations/{entra,okta,github}-provider-section-container.tsx`

### INFO-5 — Error-state retry uses a raw `<button className="text-sm underline">` instead of the `Button` component (repo-wide idiom)
all three containers, e.g. `entra-provider-section-container.tsx:15-21`

- **Divergence:** the error fallback is a hand-rolled `<div role="alert">` + raw `<button>`. The repo's overwhelming idiom for action buttons in settings is the shadcn `Button` component (`provider-connection-card.tsx:171/193`, `dpd-provider-section.tsx:59`, ~25 settings call sites). The a11y `role="alert"` is present (good), but the raw `<button>` loses the focus-ring / variant styling tokens.
- **Immediate analog (why this is LOW, near-INFO):** the pattern is copied VERBATIM from the direct sibling `apps/web-vite/src/components/settings/idp-deprovisioning-toggle-table-container.tsx:21-23` — so within the IdP-deprovisioning cluster it is internally consistent; it only diverges from the broader settings tree.
- **Idiomatic fix:** swap the raw `<button>` for `<Button variant="outline" size="sm" onClick={onRetry}>`. If pursued, fix the Phase-77 toggle-table sibling in the same pass so the cluster stays uniform.

---

## By-severity summary

| Severity | Count | IDs |
|----------|-------|-----|
| High     | 0 | — |
| Medium   | 4 | MED-1 (router triplication vs 5-provider toggle — FIX F deferred), MED-2 (divergent audit surface: `writeAuditLog` vs `auditLog.info`), MED-3 (`settingsJson` lost-update race ×3 writers), MED-4 (Entra skips `withResilience` + `parseJsonResponse` the GWS/Slack analogs use) |
| Low      | 4 | LOW-1 (`isFlagSignoffSatisfied` re-impl), LOW-2 (raw `process.env` read ×3), LOW-3 (`ENTRA`/`ENTRA_ID` dual hint), LOW-4 (`token_last_eight` not denylisted) + UI LOW-5 (hook/container triplication) |
| Info     | 5 | INFO-1 (Entra hard-block kind reuse — accepted), INFO-2 (per-call SDK client — accepted), INFO-3/MED-2-UI (raw error key in toast — has translated-error idiom), INFO-4 (dual toggle surfaces), INFO-5 (raw `<button>` vs `Button`) |

**Deferred (note only, idiomatic target described):** MED-1 router consolidation + the matching UI hook/container collapse (LOW-5) are FIX F / deferred — target is `enableProviderForOrg` + `getProviderToggleState` as the single 5-provider surface, with the cards demoted to presentation. The ENTRA/OKTA `IntegrationProvider` enum gap is also deferred (verified: `integration.prisma:138-150` has `GITHUB` but no `ENTRA`/`OKTA`; `getProviderToggleState:572-575` already documents and works around it by deriving their `connected` state from settings only).

## Top items to make the new code indistinguishable from the tree
1. **MED-4** — give the Entra adapter the same `withResilience` + `safeParseJsonResponse` treatment as GWS/Slack (it is the only Deprovisionable bypassing both seams; the bare-`as` body cast on the hybrid-AD pre-flight read can fail the security gate OPEN).
2. **MED-2 + INFO-2-UI (raw error toast)** — unify the audit surface (one of `writeAuditLog`/`auditLog.info`, prefer the durable `writeAuditLog`) and route the three hooks through `useTranslatedError` / `useResourceMutation` so a raw i18n key can never hit a toast.
3. **MED-1 / LOW-5 (deferred)** — collapse the router + hook + container triplets onto the existing parameterised `enableProviderForOrg` / `getProviderToggleState` + a single generic hook/container; resolves INFO-4 (dual surface) and MED-3 (race) in one move.
4. **Cheap one-liners** — LOW-3 (drop `'ENTRA_ID'`), LOW-4 (denylist `token_last_eight`).
