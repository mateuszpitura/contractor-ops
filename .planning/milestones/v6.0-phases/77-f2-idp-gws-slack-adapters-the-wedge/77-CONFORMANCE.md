---
status: complete
phase: 77-f2-idp-gws-slack-adapters-the-wedge
kind: conformance + code-smell audit (post-fix)
audited: 2026-06-01
mode: read-only
method: per-module compare-to-closest-analog (semble search/find_related + git-grep), incorporating still-UNFIXED items from 77-REVIEW.md
basis: HEAD of branch audit/post-migration-parity (30 *(77*) commits)
analog_corpus: 5 Deprovisionable adapters (GWS, Slack, Entra, Okta, GitHub) + existing web-vite settings/offboarding features
---

# Phase 77 Conformance & Code-Smell Punch-List

Goal: make the new code indistinguishable from the rest of the tree. For each new/changed
module the closest EXISTING analog was located and divergence/smell flagged. Items already
FIXED this session were re-verified (not re-reported as open): see "Verified fixed" at the end.

Severity: **HIGH** = behavioral/correctness or cross-tenant divergence · **MED** = should converge
before relying on the surface · **LOW** = polish/consistency · **INFO** = confirm-only / no action.

The single biggest reframe vs 77-REVIEW.md: the review judged GWS against **Slack** and called
GWS's inline fetch a regression (WR-01). With all 5 Deprovisionable adapters now in the tree, the
**majority idiom is GWS's, not Slack's** — Entra also uses bare `fetchWithTimeout` inlined per
call site with NO `withResilience`; Okta/GitHub use vendor SDKs. **Slack is the outlier.** This
changes the idiomatic fix direction for the HTTP-discipline items below.

---

## packages/integrations/src/adapters/google-workspace-adapter.ts

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| LOW | 410,434,456,486,520,535,563,584 | 8 inline `fetchWithTimeout(this.#usersUrl(...), { headers: this.#authHeaders() }, {...})` call sites — no private `#fetch` helper. Repetitive; a future timeout/header change touches 8 places. | `entra-id-adapter.ts` does the SAME (7 inline `fetchWithTimeout` sites, `#authHeaders()`, no helper) — so GWS is consistent with its closest raw-HTTP sibling. `slack-adapter.ts` `#scimFetch`/`#adminApi` (L395/L415) centralise, but Slack is the lone adapter doing so. | Optional: extract `#gwsFetch(url, init)` to DRY the 8 sites. NOT a divergence from the family (Entra matches). If converging the family on one HTTP discipline is desired, do it for GWS **and** Entra together in a follow-up, not GWS alone. Re-classified DOWN from the review's CRITICAL/WARNING because (a) `fetchWithTimeout` bounds the wall-clock — the QStash-hang reliability defect the review described is gone, and (b) `withResilience` is NOT used by Entra either, so omitting it is the family norm for deprovision mutations, not a GWS-specific regression. |
| LOW | 531,611 | `cacheKey = \`co:idp:preview:GOOGLE_WORKSPACE:${externalUserId}\`` embedded in the returned `ImpactPreview` is org-LESS and is NOT the real Redis key. (77-REVIEW WR-02, still unfixed.) | `cache.ts:310` `CacheKeys.idpPreview(orgId, provider, externalUserId)` = `co:{orgId}:idp:preview:...` — org-scoped. `idp-impact-preview.ts:42` computes the real key but never writes it back into the preview. | Either (a) drop `cacheKey` from the `ImpactPreview` union (it leaks an internal Redis concern to the client and is wrong/dead) — preferred, the web-vite `ImpactPreviewData` union (impact-preview-panel.tsx:54) already omits it; OR (b) have `getImpactPreview` overwrite `preview.cacheKey = key` before return. Same fix applies to Slack + the 3 phase-78 adapters that copy this idiom. |
| INFO | 459-516 | `revokeAllSessions` swallows a non-FAILED (LIKELY_GONE) token-DELETE failure before sign-out; the step's single `errorClass`/`failureKind` reflects only the sign-out call. (77-REVIEW IN-06, still unfixed.) | Intended idempotent behaviour; no adapter surfaces per-sub-action status in the persisted step today. | Acceptable as-is (LIKELY_GONE is success-equivalent). If per-sub-action visibility is wanted in the reconcile UI later, carry the `failedDelete` outcome through to the result, not just its hash in `tokensResSha`. No action this phase. |

## packages/integrations/src/adapters/slack-adapter.ts

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| LOW | 395-432 | `#scimFetch`/`#adminApi` wrap `withResilience(() => fetchWithTimeout(...))`. This is the cleanest pattern but it is now the **minority** — GWS + Entra do NOT wrap deprovision calls in `withResilience`. Slack diverges from the 4 other Deprovisionable adapters. | GWS L410+, Entra L120+ (bare `fetchWithTimeout`, no resilience). | Not a defect — Slack is the *better* implementation. Flagged only as an asymmetry: pick ONE family discipline. Either keep Slack as the template and add helpers to GWS/Entra (more work, more correct), or accept the split. Document the chosen rule in 77-PATTERNS.md so phase-78+ adapters stop coin-flipping. |
| LOW | 529,567,622 | Same org-less `cacheKey = \`co:idp:preview:SLACK:${externalUserId}\`` as GWS (WR-02). | see GWS row + `cache.ts:310`. | Same fix as GWS — resolve in the union or in `getImpactPreview`. |
| INFO | 509-513 | `revokeAllSessions` maps via `#mapSlackFailure(res.status, body.error, ...)`; Slack Web-API returns HTTP 200 + `{ok:false}` on logical errors, so `res.status` is 200 and classification leans entirely on the `#classifySlackError` string table (L435-455). An unlisted *transient* Slack code would classify `PERMANENT_OTHER` and not retry. (77-REVIEW IN-05, still unfixed.) | `suspendAccount` (L491-501) reads SCIM `res.status` correctly (SCIM uses real HTTP codes). The string table covers `ratelimited`/`not_authed`/`missing_scope`/etc. | Acceptable for providers in scope. If hardening: add a known-retryable Slack error family (e.g. `internal_error`, `service_unavailable`, `fatal_error`) to `#classifySlackError` mapping to a TRANSIENT class before the `classifyError(httpStatus=200)` fallthrough. No action required this phase. |

## packages/integrations/src/idp/error-classifier.ts · deprovision-result.ts · impact-preview.ts

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| INFO | classifier all | Pure, side-effect-free, exhaustive precedence (429/503 → network → 403+ratelimit → 404 → 401 → 403/forbidden-code → other). All 5 adapters consume it. No divergence. | self-consistent; consumed by GWS/Slack/Entra/Okta/GitHub `#mapFailure`. | None — exemplary. `mapErrorClassToResult` extraction (free function, not base-class method) is the documented DRY choice and all 5 adapters use it. Confirmed fixed/sound. |
| INFO | impact-preview.ts 116-117 | JSDoc says cacheKey is `co:idp:preview:{provider}:{externalUserId}` — i.e. the type itself documents the WRONG (org-less) key shape, which is why every adapter built it org-less. | `cache.ts:310` real key is org-scoped. | When fixing WR-02, also correct this JSDoc or remove the field. Root-cause of the org-less-key smell lives here. |

## packages/api/src/services/idp-impact-preview.ts

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| MED | 42,63 | Computes the correct org-scoped `key` and uses it for `cached()`/`invalidate()`, but the cached `ImpactPreview` it returns still carries the adapter's org-less `cacheKey`. The right key exists 20 lines away and is discarded from the payload. | `cache.ts` `cached(key, ...)` idiom is correct; the value-object just disagrees with the storage key. | One-line fix when addressing WR-02: `return { ok: true, preview: { ...preview, cacheKey: key } }` — or drop the field from the union. This is the single place to neutralise the cross-tenant footgun the review flagged. |

## packages/api/src/services/idp-deprovisioning-step-runner.ts

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| INFO | 73,83 | Org-match guard present (`step.organizationId !== body.organizationId` → `StepOrgMismatchError`, non-retryable 400). `sagaDb` cast documented. | matches the router's `run: { organizationId }` defense-in-depth invariant. | None — WR-04 fixed and re-verified. The `as unknown as PrismaClient` cast is the same trusted-internal pattern used in deprovisioning.ts:427/508/511. |

## packages/api/src/routers/integrations/deprovisioning.ts

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| MED | 357-391 | `getDeprovisioningRun` selects `manualOverrideNote` + `manualOverriddenByUserId` and returns them under `requirePermission({ integration: ['read'] })` — a WIDER read audience than the `idp: ['override_step_failure']` writer gate. Free-text operator rationale (may hold incident detail/names) readable by anyone with `integration:read`. (77-REVIEW WR-06, still unfixed.) | The override note is deliberately kept out of the audit log ("lives only in the column", L501). The writer is narrowly `idp:override_step_failure`-gated; the reader is not. | Confirm intent. If the note is meant for override-author/admin only: gate the `manualOverrideNote` field on `idp:read` (add an `idp:['read']` permission), or omit it from the list query and fetch on demand behind a narrower gate. Blast radius is small today (`integration:read` ≈ owner/admin per use-permissions.ts:36/56) so MED not HIGH. |
| MED | 542-554 | `connectSlackOrgGrid` returns `\`${apiUrl}/api/oauth/slack-org-grid/start\``, but no such route exists under `apps/api/src` yet — Connect 302s to a 404. (77-REVIEW WR-05; flagged as DEFERRED in 77-VERIFICATION.) | `getOAuthUrlGeneric` indirect-redirect F-SEC-05 pattern (the doc comment cites it). | Per the audit brief this is a **deferred** route, not a smell — noted, not actioned. Track that the org-grid OAuth start/callback route must land before the card's Connect is live. |
| LOW | 100,148,282 | Phase-76 siblings `getDeprovisioningEligibility`/`startDeprovisioningRun`/`retryDeprovisioningStep` are bare `tenantProcedure` (NO `requirePermission`), while the new Phase-77 read procedures DO gate on `integration:['read']`. The new code is MORE conservative than its older siblings. | The new procedures' gating is the better pattern; the ungated mutations are the pre-existing inconsistency. | Not a Phase-77 regression — the divergence is the older procedures lacking a gate, not the new ones. If tightening: add `requirePermission` to start/retry (they enqueue real provider mutations). Out of Phase-77 scope; note for a follow-up. |
| INFO | 561-604 | `getProviderToggleState` uses `settings:['read']` and `enableProviderForOrg` uses `settings:['update']` — different resource (`settings`) from the run/preview reads (`integration`). | The toggle lives in `Organization.settingsJson`, so `settings:*` is the right resource; the run/preview reads operate on integration data, so `integration:*` is right. | None — the split is principled (resource-aligned), not accidental. Confirm-only. |

## apps/web-vite/src/components/idp/deprovisioning-run-view.tsx

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| LOW | 54,91-100 | `<OverrideStepDialog>` rendered as a direct child of `<ul>`, sibling to the `<li>` rows. Only `<li>`/script-supporting elements are valid `<ul>` children. Radix portals to `document.body` at runtime so it renders fine, but the JSX tree is invalid and can trip a11y/hydration lint. (77-REVIEW IN-01, still unfixed.) | Neighboring list+dialog features render the dialog OUTSIDE the list — e.g. `organization/projects/pending-merges-inbox.tsx`, the contractor wizard host pattern. No other web-vite list nests a `<DialogContent>` inside `<ul>`. | Wrap the `<ul>` and the dialog in a fragment/`<div>`: move the `{overrideStepId ? <OverrideStepDialog .../> : null}` block to a sibling of `<ul>`, not a child. Pure structural move, no behavior change. |

## apps/web-vite/src/components/idp/impact-preview-panel.tsx

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| LOW | 20-54 | Re-declares `GwsPreview`/`SlackPreview`/`ImpactPreviewData` locally, hand-mirroring the integrations `ImpactPreview` union (and dropping `cacheKey`). Drifts if the server union changes; the comment "Mirrors the integrations ImpactPreview" acknowledges the duplication. | Other web-vite presentational components type props from the tRPC inferred output rather than re-declaring server shapes by hand. | Prefer deriving from the router output type (or a shared `@contractor-ops/integrations` import of the union minus `cacheKey`) so a server-side metric change is a compile error here, not silent drift. LOW — the dropped `cacheKey` is actually the correct client posture (see WR-02). |

## apps/web-vite/src/components/settings/hooks/use-slack-org-grid-card.ts

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| MED | 16-24 | `isConnected` derives from `integration.getHealth({ provider: 'slack' })` — the WORKSPACE bot connection — not the `SLACK_ORG_GRID` sub-kind connection this card represents. Card can show "Connected" when only the workspace token exists and the org-grid deprovision token (the one `resolveDeprovisionToken` requires) is absent. (77-REVIEW WR-05, still unfixed.) | `getProviderToggleState` (deprovisioning.ts:584-598) ALREADY derives Slack-connected correctly — it checks `configJson.connectionSubKind === 'SLACK_ORG_GRID'`. The card's hook should mirror that, not the bot-health probe. | Gate `isConnected` on the org-grid sub-kind connection lookup (reuse the `getProviderToggleState` Slack-row logic, or add a dedicated org-grid health field). Until then the connected-state is *incorrect*, not merely incomplete. The dead Connect route (WR-05 part 2) is the deferred item above. |

## apps/web-vite/src/components/idp/step-override-badge.tsx · override-step-dialog.tsx · toggle-table.tsx · slack-org-grid-card.tsx · containers + hooks

| sev | line | smell / divergence | existing analog | idiomatic fix |
|-----|------|--------------------|-----------------|---------------|
| INFO | step-override-badge.tsx all | Faithful mirror of `offboarding/override-badge.tsx` (Badge + Tooltip + actor/date/reason). Tooltip trigger has focus-visible ring + aria-label. Sound. | `offboarding/override-badge.tsx` (cited in the file header). | None — exemplary analog adherence. |
| INFO | override-step-dialog.tsx all | DialogBody/DialogFooter used correctly (check:web-vite-dialog-pattern OK); useId for label/error association; aria-invalid/aria-describedby; client min-20 with server authoritative; no useMutation (data-layer check OK). | canonical dialog pattern (project Dialog body/footer convention). | None — conformant. |
| INFO | toggle-table.tsx all | Raw `<Table>` correctly allowlisted in check-web-vite-table-pattern (settings matrix); disabled Switch wrapped in Tooltip with aria-label. | other settings matrices in check-web-vite-table-pattern PERMANENT/MIGRATION lists. | None. |
| INFO | run-view-container.tsx, use-deprovisioning-run.ts | Page→Container→Hook→Component layering correct: container owns loading/error/empty + permission read, hook is the sole tRPC boundary (useQuery/useMutation + invalidate + toast), component is props-in/JSX-out. Mirrors `use-run-header.ts` (cited). | `use-run-header.ts`, `wizard-dialog-container.tsx`. | None — layering sound; both web-vite guards green. |

---

## Verified FIXED this session (re-checked, NOT open)

- **CR-01 / "GWS raw unbounded fetch"** — GWS now uses `fetchWithTimeout` (wall-clock bound) at all 8 sites; `node scripts/lint-raw-fetch.mjs` exits **0** ("OK — no unannotated raw fetch() calls in 414 scanned files"). The review's "lint:raw-fetch actually FAILS" + IN-02 `/**` false-positive are both stale — guard is green for this phase. The QStash-hang reliability defect is resolved by the timeout (note: `withResilience` is still absent, but that matches Entra — see GWS LOW row, not a defect).
- **WR-03 / enableProviderForOrg lost-update** — now a `$transaction` read-modify-write (deprovisioning.ts:627-642) + `invalidateByPrefix(CacheKeys.settingsPrefix(...))` cache invalidation.
- **WR-04 / step-runner org guard** — `StepOrgMismatchError` thrown on `step.organizationId !== body.organizationId` (step-runner.ts:83), surfaced as non-retryable 400 in the route (idp-deprovisioning.ts:58-63).
- **mapErrorClassToResult extraction** — shared free function consumed by all 5 adapters; the review's "GWS inlining vs Slack helpers" asymmetry for the classify-then-branch logic is gone (both call `mapErrorClassToResult`). Confirmed.
- **settingsJson tx + cache invalidation** — see WR-03.

## Count & top items

**Open items: 11** — HIGH 0 · MED 4 · LOW 5 · INFO (open, confirm-only) 2.
(Plus ~9 INFO confirm-only "sound/conformant" rows and 5 verified-fixed items.)

**Top items (fix to make the new code indistinguishable):**
1. **MED — WR-02 org-less `cacheKey`** (impact-preview.ts union + idp-impact-preview.ts:63 + both adapters): single-source the real org-scoped key or drop the field. One service-line fix neutralises the cross-tenant footgun; also corrects the misleading union JSDoc that propagated the smell to phase-78 adapters.
2. **MED — WR-05 org-grid card reads workspace health** (use-slack-org-grid-card.ts:16-24): mirror `getProviderToggleState`'s `connectionSubKind === 'SLACK_ORG_GRID'` check so "Connected" reflects the deprovision token, not the bot token.
3. **MED — WR-06 override note read-gate** (deprovisioning.ts:357-391): the free-text rationale is readable by a wider audience (`integration:read`) than its writer gate (`idp:override_step_failure`) — confirm intent or narrow the field selection.
4. **LOW — IN-01 dialog inside `<ul>`** (deprovisioning-run-view.tsx:91-100): move `<OverrideStepDialog>` to a sibling of `<ul>` (fragment/`<div>` wrap) — invalid HTML vs every neighboring list+dialog feature.
5. **LOW — adapter HTTP-discipline split**: Slack wraps deprovision calls in `withResilience`; GWS+Entra don't. Pick one family rule and document it in 77-PATTERNS.md so phase-78 stops diverging — do NOT "fix" GWS toward Slack in isolation (GWS already matches the majority idiom).

Sound by design (no action): error-classifier purity/exhaustiveness, mapErrorClassToResult DRY, audit-on-override + audit-on-toggle, QStash HMAC verification + non-retryable-mismatch handling, Page→Container→Hook→Component layering, DialogBody/Footer, raw-Table allowlisting, i18n Idp.* parity (en/de/pl/ar balanced), resource-aligned permission split (settings vs integration).
