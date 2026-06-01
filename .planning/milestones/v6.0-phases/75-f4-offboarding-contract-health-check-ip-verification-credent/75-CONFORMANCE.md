---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
doc: conformance + code-smell audit (compare-to-analog)
mode: READ-ONLY
audited: 2026-06-01
branch: audit/post-migration-parity
basis: git log --grep '75-' --name-only + 75-REVIEW.md (still-open LOW/INFO carried in)
---

# Phase 75 — Conformance & Code-Smell Punch-List

Goal: make Phase-75 new code indistinguishable from the rest of the codebase. Each
finding below names the **closest existing analog** in-tree and the **idiomatic fix**.

**Verified FIXED this session (not re-reported, per scope):**
- WR-1 secret-detector embedded-secret bypass — `secret-shape-detector.ts` now ships
  `looksLikeSecretInFreeText` + `looksLikeSecretInFreeTextRefinement` (substring mode) and
  `credential-reference.ts:42,44` applies it to `SAFE_TEXT`/`SAFE_NOTES`; `SAFE_VAULT_URL`
  stays anchored. Invariant restored. ✅
- `run-health-check` raw-fetch — R2 download now goes through `fetchWithTimeout`
  (`run-health-check.ts:271`, commit 4b5ade62). ✅
- 75-08 e-sign loop is **DEFERRED** scope (per `75-08-FINAL-STATUS.txt`) — noted, not a smell.

Severity legend: **WARN** = behavioural/contract divergence or missing mandated state ·
**INFO** = idiom/consistency/polish · **NIT** = cosmetic.

---

## packages/integrations/src/services/contract-health-service.ts

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| WARN | `contract-health-service.ts:65` | `return toolUseBlock.input as ContractHealthToolInput` — unvalidated `as` cast on an **external** (Anthropic) boundary. The repo's own `parse-json-response.ts` ("Audit finding #10") and the gov-API clients (ViesClient/HmrcVatClient) mandate Zod-at-boundary; this is the exact anti-pattern they exist to kill. (WR-6) | `packages/integrations/src/services/parse-json-response.ts` (untracked, fail-closed `parseJsonResponse`); gov-api ViesClient/HmrcVatClient response-Zod. A `citedClauseSchema` already exists in `ip-clauses-results-schema.ts`. | Define a Zod schema mirroring `ContractHealthToolInput` (verdict enum + citedClauses[{citedText,jurisdiction-enum,confidence 0..1}] + optional reasoning) and `schema.parse(toolUseBlock.input)` before returning. Throw a typed error on parse failure so the run records a deterministic outcome. |

## packages/api/src/services/contract-health/run-health-check.ts

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| WARN | `run-health-check.ts:103,107` | `IP_CLAUSES_BY_JURISDICTION[cited.jurisdiction] as Record<…>` then `Object.entries(jurisdictionPhrases)`. `cited.jurisdiction` flows straight from the **unvalidated** Anthropic output (see WR-6); an out-of-enum jurisdiction yields `undefined` → `Object.entries(undefined)` throws → caught by outer catch → persisted **FAILED** instead of the intended **MANUAL_REVIEW_REQUIRED**. Degrades safely but downgrades the wrong way and the cast hides it. | The Zod fix at `contract-health-service.ts:65` (analog above) guarantees the enum, removing the `as` + the throw path. | Once WR-6 validates the tool output, the cast becomes unnecessary; alternatively guard `if (!jurisdictionPhrases) continue;`. Prefer fixing at the boundary. |
| INFO | `run-health-check.ts:151` | Synthetic phraseId `` `${c.jurisdiction.toLowerCase()}.ungrounded@v0` as IpClausePhraseId `` — a type-lie: `IpClausePhraseId` is the union of *real* library IDs, this value is not one of them (it only happens to satisfy the results-schema regex `^(uk\|de\|…)\.[a-z_]+@v\d+$`). | `ip-clauses-results-schema.ts` types `phraseId` as `z.string().regex(PHRASE_ID_REGEX)` — i.e. the *schema* already tolerates synthetic IDs without lying about the union. | Widen the field type to `string` (it is persisted as a regex-validated string anyway) or add an explicit `UngroundedPhraseId` branded type; drop the `as IpClausePhraseId` on a non-library value. |
| INFO | `run-health-check.ts:174,187,198` | Triple `as unknown as object` / `as unknown as Record<string,unknown>` to coerce `resultsJson` into the Prisma JSON column. | OCR/other Prisma-Json writers in-tree cast once at the column via `Prisma.InputJsonValue`. | Type `resultsJson` as `Prisma.InputJsonValue` (or `satisfies IpAssignmentResults`) and cast once; avoid the `as unknown as` double-launder repeated 3×. Cosmetic — schema is already Zod-validated upstream. |

## apps/api/src/routes/contract-health.ts

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| INFO | `contract-health.ts:28` | Uses `createWebhookLogger('contract-health-check')`. This is a **QStash worker** route (internal `_run` callback), not an inbound provider webhook. 6 of 8 sibling QStash worker routes (ocr/ksef/outbox/exports/late-interest/google-workspace) use `createCronLogger`; only zatca shares the webhook-logger choice. | `apps/api/src/routes/ocr.ts:35` (`createCronLogger('ocr-process')`) — the nearest analog (also an Anthropic-bound `_run`). | Switch to `createCronLogger('contract-health-run')` for consistency with the QStash-drain logger family. |
| INFO | `contract-health.ts:86-96` | No `withBackpressure` despite being an **Anthropic-bound** worker — the exact spike-protection OCR documents ("an Anthropic spike doesn't sink other QStash consumers", `ocr.ts:6`). The three heavy worker routes that call Anthropic/render (ocr, exports, late-interest) all wrap with `withBackpressure`; contract-health does not. | `ocr.ts:104-122` (`withBackpressure(BackpressureRoutes.OCR_PROCESS, …)` around `withQueueObservability`). | Add a `BackpressureRoutes.CONTRACT_HEALTH_RUN` key and wrap the handler the same way, with the 429 + `Retry-After` rejection branch. Bulk re-run can enqueue up to 1000 jobs (see INFO-7) — backpressure is the matching guard. |
| INFO | `contract-health.ts:38-54` | 400 body is `{ error: 'Invalid body' }` (flat). The nearest analog enriches the message with the failing Zod paths. | `ocr.ts:75-79` builds `Missing or invalid: ${issues.map(i => i.path.join('.'))}`. | Mirror ocr's issue-path detail for parity + debuggability. Minor. |

## packages/api/src/routers/core/contract.ts (rerunHealthCheck)

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| INFO | `contract.ts:781-832` | `contractIds` (≤1000) are enqueued to QStash **without** an org pre-filter. Downstream run is org-scoped so no cross-tenant leak, but a caller can queue up to 1000 wasted Anthropic-bound jobs for arbitrary/foreign IDs (cost/abuse). (WR-/INFO-7) | **Same file**: `bulkTransition` (`contract.ts:689-773`) does `findMany({ where:{ id:{ in }, organizationId } })`, builds a `foundIds` Set + a `failed[]` list, and acts only on `valid[]`. | Pre-filter `contract.findMany({ where:{ id:{ in:input.contractIds }, organizationId } })`, enqueue only matches, and return `{ enqueuedCount, requestedCount, skipped }` — mirrors `bulkTransition`'s found-ID discipline already living one screen up. |

## apps/web-vite/src/components/contracts/health-check-panel-container.tsx · workflow/credentials-tab-container.tsx (+ dialogs/button)

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| WARN | `health-check-panel-container.tsx` (whole) · `credentials-tab-container.tsx` (whole) | **Feature is dark.** Zero non-test importers of `HealthCheckPanelContainer`, `CredentialsTabContainer`, `HealthCheckPanel`, `PendingCredentialsWarningDialog`, `IpVerificationEsignButton` (grep across `apps/web-vite/src` returns only `__tests__`). 75-06/75-07 user-facing deliverables are unreachable. (WR-2) | `contracts/contract-detail/*` tabs + `pages/dashboard/workflows/detail.tsx` mount their domain containers directly. | Mount `HealthCheckPanelContainer` on the contract-detail page (feeding `contract.complianceFlagsJson`) and `CredentialsTabContainer` on the OFFBOARDING run detail — or record the wiring as deferred alongside 75-08 (the e-sign button) if intentional. |

## apps/web-vite/src/components/workflow/hooks/use-credentials-tab.ts

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| WARN | `use-credentials-tab.ts:33-48` | `create`/`markRotated`/`remove` define only `onSuccess` — **no `onError`**. The `looksLikeSecretRefinement` BAD_REQUEST (the *primary* secret-paste server defence) produces no toast/inline feedback; the dialog just stays open and appears inert. (WR-4) | `components/payments/hooks/use-payment-run-side-panel.ts:74-118` and `invoices/hooks/use-intake-detail-actions.ts:54-95` — every mutation pairs `onSuccess` with `onError: err => toast.error(...)`. Repo even ships `hooks/use-resource-mutation.ts` that wires success/error toasts automatically. | Add `onError: err => toast.error(...)` to each mutation (translated; surface the secret-paste rejection explicitly), or adopt `useResourceMutation`. |
| WARN | `use-credentials-tab.ts:55-56` + `credentials-tab-container.tsx:13-44` | Hook exposes `isError`/`refetch` but the container never threads them and `CredentialsTab` renders only loading/empty/data — **no error state**. CLAUDE.md mandates loading+empty+**error** for every user-facing flow. (WR-3) | Sibling list views render an error block + retry from the same `isError`/`refetch` the hook already returns. | Pass `isError`/`refetch` into `CredentialsTab` and render an error branch with a retry action. |

## apps/web-vite/src/components/contracts/hooks/use-health-check-panel.ts

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| WARN | `use-health-check-panel.ts:14-22` | `rerunHealthCheck` mutation has `onSuccess` only — a failed enqueue gives the user no feedback (button just stops spinning). (WR-4) | Same `onError + toast.error` idiom as `use-payment-run-side-panel.ts`. | Add `onError` → `toast.error` (translated). |

## apps/web-vite/src/components/workflow/credentials-tab.tsx

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| WARN | `credentials-tab.tsx:82-88` | `onRemove(row.id)` hard-deletes (`credential-reference.ts:204 tx.credentialReference.delete`) on a **single ghost-button click** — no confirm for an irreversible delete of offboarding compliance evidence. (WR-5) | `settings/e-invoicing/leitweg-id-delete-dialog.tsx`, `admin/boe-rate/delete-boe-rate-dialog.tsx`, `contracts/contract-detail/detail-header.tsx:171` — all gate destructive deletes behind `AlertDialog` (`variant="destructive"`); `use-payment-run-side-panel.ts` uses `useDoubleConfirmation`. | Gate `onRemove` behind an `AlertDialog` confirm (or `useDoubleConfirmation`), matching the repo's destructive-action pattern. |
| INFO | `credentials-tab.tsx:63,71` | Renders raw DB enums `{row.vaultProvider} · {row.accessType}` and `{row.status}` (SCREAMING_SNAKE_CASE) instead of i18n labels. `Workflow.credentials.columns.*` keys exist in all 4 locales but are unused, and there are no value-label maps for the enum *values*. (INFO-1) | Enum→label maps are standard elsewhere (e.g. status/role label catalogs in settings tables). | Add `Workflow.credentials.providers.*` / `accessTypes.*` / `status.*` label maps and render `t(...)` instead of the raw enum. |
| INFO | `credentials-tab.tsx:48-49` | Loading state is a bare `<p>…</p>` (untranslated ellipsis), not the skeleton/spinner used across web-vite. (INFO-6) | Neighboring list/tab loading states use `Skeleton`/`Loader2`. | Replace with a `Skeleton` row set (also removes the untranslated `…` literal). |

## apps/web-vite/src/components/workflow/credential-add-dialog.tsx

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| INFO | `credential-add-dialog.tsx:21-28,137` | `onSubmit` type includes `notes?` and the `dialog.fields.notes` i18n key exists, but **no Notes input is rendered** and `onSubmit({...})` omits `notes` — a dead contract. (INFO-3) | — | Either render a `Textarea` for notes (it's already a `SAFE_NOTES` server input) or drop `notes` from the prop type + i18n key. |
| INFO | `credential-add-dialog.tsx:103-127` | Native `<select className="w-full rounded border p-2 text-sm">` for provider/accessType — diverges from the shadcn `Select` primitive used by most web-vite forms (focus ring, RTL for `ar`, a11y parity). Also the option labels render the bare enum (`AWS`, `p`-style), the only Phase-75 user-facing strings not driven through `useTranslations`. (INFO-2/INFO-4) | `packages/ui/src/components/shadcn/select.tsx`; used in `settings/invite-dialog.tsx`, `settings/org-settings-form.tsx`, `idp/override-step-dialog.tsx`. (Native `<select>` is not unprecedented in-tree — ~6 other files — so this is a consistency preference, not a hard rule.) | Swap to the shadcn `Select` and render translated option labels (shared with the INFO-1 enum-label maps). |

## apps/web-vite/src/components/contracts/health-check-panel.tsx

| sev | file:line | smell / divergence | existing analog | idiomatic fix |
|-----|-----------|--------------------|-----------------|---------------|
| INFO | `health-check-panel.tsx:108-112,121-125` | `<sup>¹</sup>` pending-phrase marker is purely visual — a screen reader announces "1" with no link to the `pendingPhraseFooter` explanation. (INFO-5) | a11y-associated markers elsewhere use visually-hidden text / `aria-label` / `Tooltip`. | Add an `aria-label` (or visually-hidden span) tying the `¹` to the footnote, or use a `Tooltip`/`title` for the pending rationale. |
| NIT | `health-check-panel.tsx:80` | Inline `border-amber-300 bg-amber-50 text-amber-900` for the mismatch callout — raw Tailwind palette rather than semantic tokens. | Other warning callouts use semantic/`muted`/`destructive` tokens. | Optional: extract to a semantic warning token for theme/RTL consistency. Cosmetic. |

---

## Clean (verified — matches analog, no action)

- **dedup.ts** — thin typed wrapper over the partial unique index; idiomatic.
- **cross-jurisdiction.ts** — pure functions, alpha-2/alpha-3 ISO map, sensible no-jurisdiction → MANUAL_REVIEW fallback.
- **materialise.ts** — single-item idempotent create on `(contractorId, policyRuleId)`; explicitly (and correctly) does NOT reuse Phase-71 `materialiseFromPolicy`; structural `MaterialiseClient` mirrors `compliance-supersession.ts`'s `SupersessionClient`.
- **model.ts** — typed-const model pin; mirrors Phase-71 `POLICY_RULE_SET_VERSION` philosophy.
- **compliance-policy IP rules** (de/uk/pl/us/ksa/uae) — reuse Phase-71 `registerPolicyRule` cleanly; jurisdiction-correct framing (DE Nutzungsrechte vs UK assignment); all carry PENDING legal-review markers per project policy. (DE rule is `WARNING` vs Phase-71 DE `BLOCKING` — a deliberate domain call, not a divergence.)
- **ip-clauses-*.ts + ip-clauses-index.ts + ip-clauses-results-schema.ts** — uniform entry shape, versioned library constant, aggregated via `IP_CLAUSES_BY_JURISDICTION`/`ALL_IP_CLAUSES`; results schema is `.strict()` + versioned. Good DRY/SOLID.
- **secret-shape-detector.ts** — post-fix, dual anchored/substring patterns; exports wired through `validators/index.ts`.
- **credential-reference.ts** — Zod on every procedure, tenant-scoped `findFirst` before mutate, ownership re-check on update/markRotated/remove, `writeAuditLog` with `tx` inside every transaction, OFFBOARDING-only server gate. Audit payloads omit `vaultUrl`/`notes` (defence-in-depth). Fully idiomatic vs sibling routers.
- **QStash route HMAC** — `guardQStashRequest` first, fail-closed, always-200 on handler failure (documented anti-retry-storm), registered inside the raw-body webhook plugin scope. Matches `ocr.ts` shape (aside from the two INFO divergences above).
- **PendingCredentialsWarningDialog** — DialogBody+DialogFooter convention; ≥20-char reason + acknowledge gate; correct.

---

## Counts & top items

| severity | count | ids |
|----------|-------|-----|
| WARN | 6 | WR-6 unvalidated Anthropic cast (`contract-health-service.ts:65`) · its downstream throw→FAILED (`run-health-check.ts:103`) · WR-2 feature dark (containers unmounted) · WR-4 mutations no `onError` (×2 hooks) · WR-3 CredentialsTab no error state · WR-5 destructive remove no confirm |
| INFO | 9 | logger factory (createWebhookLogger vs createCronLogger) · missing withBackpressure · flat 400 body · INFO-7 rerun no org pre-filter · synthetic phraseId type-lie · `as unknown as object` JSON casts · INFO-1 raw-enum labels · INFO-3 dead `notes` prop · INFO-6 ellipsis loading · INFO-2/4 native select + untranslated options · INFO-5 footnote a11y |
| NIT | 1 | raw amber Tailwind palette on mismatch callout |

**Top 3 to make the code indistinguishable:**
1. **WR-6 / `run-health-check.ts:103`** — Zod-validate the Anthropic tool output (adopt the `parse-json-response.ts` pattern). This is the single divergence from a *codebase-wide mandated* idiom (gov-API clients + the untracked helper exist precisely for this) and it also removes the unsafe casts and the wrong-direction FAILED downgrade.
2. **WR-2** — wire the two containers onto their pages (or record as deferred). The deliverable is invisible otherwise.
3. **WR-4 + WR-5 + WR-3** — add `onError → toast.error`, an `AlertDialog` remove-confirm, and an error branch. The repo has first-class analogs (`use-payment-run-side-panel.ts`, `leitweg-id-delete-dialog.tsx`, `useResourceMutation`); the Phase-75 hooks are the only credential-touching surfaces missing them.
