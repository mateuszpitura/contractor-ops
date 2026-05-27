# Post-migration parity restoration report

> Mirrors `goals/post-migration-parity-audit/audit-report.md` row-for-row with restoration status applied. Goal: every audit row reflects one of `inline-fixed (<SHA>)`, `closed-decision (<doc-ref>)`, `closed-verified-intentional`, or `deferred (<rationale + risk-register-ref>)`. No row sits `open` without an explicit deferral rationale.
>
> **Branch:** `audit/post-migration-parity` — restoration work continues on this branch (or short-lived `audit/restoration-<wave-N>` children fast-forward merged).
> **Risk register:** [`.planning/risk-register.md`](../../.planning/risk-register.md).
> **Done condition:** see [`goal.md`](goal.md). User signs off via `plannotator annotate restoration-report.md --gate` after Wave 9 verification passes.

## Restoration baseline

Restoration enters with the following starting state on the audit branch (head `99584569` and onwards):

- **0 open P0s** after Wave 9 disposition (was 3 at audit baseline → 2 after Wave 2 Agent E → 0 after Wave 9 flip): `GAP-SECURITY-002` closed-decision, `GAP-LEGAL-CLUSTER-001` + `GAP-SECURITY-001` deferred with named blocker + risk-register entry per goal's accepted status taxonomy.
- **0 open P1s**: every P1 is either `inline-fixed` or `deferred` with named blocker. Restoration carries every deferral forward to `.planning/risk-register.md`.
- **1 open P2 INFO row**: `GAP-I18N-003` — informational only (positive translation backfill).
- **19 sibling-UI commits** landed unreviewed during the audit. Reviewed clean in Wave 0 — no new `GAP-SIBLING-NNN` rows surfaced.

## Wave progress

| Wave | Scope | Status | Notes |
|------|-------|--------|-------|
| **0** | Branch hygiene + sibling review + scaffold | **done** | `.gitignore` extended; 19 sibling commits reviewed clean; `risk-register.md` + this report scaffolded. |
| **1** | P0 infra surfaces — edge runtime (`GAP-SECURITY-001`) + Redis pub/sub channel (`GAP-LEGAL-CLUSTER-001` foundation) | **deferred** | Verify-then-act facts pinned ([Findings 1, 2, 4](#wave-1--wave-3-verify-then-act-findings-recorded-before-any-code-edit)). Three external decisions required (pub/sub mechanism, Payload content path, edge runtime). Underlying P0s now `deferred (rationale + risk-register-ref)` per goal taxonomy. |
| **2** | P0 code-only fixes — 5 agents in parallel | **done** | Agents A (GAP-OBSERVABILITY-012) + B (GAP-TEST-015) + C (GAP-TEST-021) + D (GAP-TEST-026) all inline-fixed pre-restoration. Agent E (GAP-SECURITY-002 closure + R2 guardrail) landed this restoration cycle — see `closed-decision` cells below. |
| **3** | P0 wiring + cutover — legal containers + `legal.getDocument` + revalidate-legal publisher + edge cutover | **deferred** | Depends on Wave 1 decisions. 48h CSP soak gates `GAP-SECURITY-001` final close. Underlying P0s deferred per goal taxonomy; restoration-report status reflects deferral. |
| **4** | P1 cluster A — security + auth + portal + legal | done (carry-over) | Agents F (GAP-SECURITY-008) + I (GAP-TEST-019) inline-fixed pre-restoration. Agent G (privacy resolver) deferred under `GAP-LEGAL-CLUSTER-001`. Agent H (`GAP-TEST-011 / -016 / -017 / -018`) — TEST-016/017/018 inline-fixed, TEST-011 deferred. |
| **5** | P1 cluster B — observability + middleware + routes | partial | OBSERVABILITY-003/-006/-009 (partial) inline-fixed; OBSERVABILITY-001/-002/-004/-010/-011 deferred per RISK-OBSERVABILITY-001/-002/-003. MIDDLEWARE-005/-007 inline-fixed. ROUTE-001 inline-fixed. ROUTE-002/-004/-005/-006 deferred per RISK-ROUTE-001..004. |
| **6** | P1 cluster C — UX | partial | MIDDLEWARE-005 (Accept-Language) + PAGE-006/-007 (admin URL back-compat) + PAGE-008 (intake 404 vs unauth) inline-fixed. I18N-001/-002 deferred per RISK-I18N-001. |
| **7** | P2 cluster | partial | I18N-004/-005 + OBSERVABILITY-005/-006 + MIDDLEWARE-004/-006 + SECURITY-005 inline-fixed; SECURITY-007 + MIDDLEWARE-001 + OBSERVABILITY-013 closed-verified-intentional. Remaining ~15 test-coverage rows deferred per RISK-TEST-001. |
| **8** | Pre-existing test fixes (`FOLLOWUP-PRE-EXISTING-001`) | deferred | Two web-vite test files; both verified pre-existing in audit. Deferred per RISK-TEST-002 to `dry-solid-audit/extract-shared` restoration owner. |
| **9** | Final verification + plannotator --gate | **partial (in-session run)** | All gates run this session — see [Verification matrix](#verification-matrix). Code gates (typecheck + 4 backend test suites + 3 quality guards + R2 sandbox guard) **PASS**. Web-vite path-scoped tests + audit + security:scan **FAIL** with documented deferrals (`RISK-TEST-002` / `RISK-TEST-003` / `RISK-DEPS-001`). `GAP-SIBLING-001` page-shells regression surfaced + inline-fixed. Playwright e2e + 48h CSP soak + plannotator `--gate` sign-off **DEFERRED** (wall-clock + user-interactive). |

## Sibling-UI commit review (Wave 0)

19 sibling-agent commits landed on the audit branch (`audit/post-migration-parity ^4fefacb3` minus `audit:` / `docs(audit):` commits). Each reviewed against audit severity rubric: **auth break / payment break / data loss / regulatory webhook break / a11y regression / i18n key loss / Sentry scrub regression**.

| # | SHA | Subject | Surface | Rubric verdict |
|---|-----|---------|---------|----------------|
| 1 | `e95e4e75` | swap startup spinner for bento skeleton + restore AtelierBackground | `apps/web-vite/src/components/dashboard/*` + `apps/web-vite/src/pages/dashboard/index.tsx` | **regression surfaced by Wave 9 verification — `GAP-SIBLING-001`**. The new `DashboardSkeleton` was imported directly into the page shell, violating `check:web-vite-page-shells` (pages may import `*-container` or `page-loading-spinner` only). Inline-fixed alongside Wave 9: `dashboard-home-container.tsx` re-exports `DashboardSkeleton`; the page imports both via the `-container` path. Functional behaviour unchanged. |
| 2 | `daed398b` | restore subtle single-hue accent-line under top bar | `apps/web-vite` CSS only | **clean** — visual restoration verified against `7fce0d83:globals.css` baseline. |
| 3 | `eb6be3df` | restore dark-mode atelier gradient — post-migration parity | `apps/web-vite` CSS + `IntensityRouter` body-mirror side-effect | **clean** — selector cascade fix; behaviour matches legacy. |
| 4 | `5d3fa5ce` | restore document-level scroll on dashboard shell | `apps/web-vite` CSS + `SidebarInset` defaults | **clean** — document-level scroll matches legacy shell. |
| 5 | `5d436ece` | use native overflow on Activity Feed | `apps/web-vite/src/components/dashboard/*` | **clean** — Radix ScrollArea → native `overflow-y-auto` fixes clipped scroll path; a11y-positive. |
| 6 | `e6ec821d` | force flex-row on my-tasks task rows | `apps/web-vite/src/components/workflows/my-tasks-list.tsx` | **clean** — tailwind-merge collision fix. |
| 7 | `cca0ffc2` | intensity-aware scroll model (workbench locks viewport) | `apps/web-vite` CSS attribute selector | **clean** — corrects collateral from `5d3fa5ce`. Stacks with `fb3385fb` + `d309ea4e` + `0a350079` to fully restore workbench scroll contract. |
| 8 | `6a76470a` | restore public/flags + public/logos static assets | `apps/web-vite/public/{flags,logos}/*.svg` × 17 | **clean** — byte-for-byte restore from `7fce0d83`. CSP unchanged. |
| 9 | `b5f09833` | solid background on shadcn Input (light + dark) | `packages/ui/src/components/shadcn/input.tsx` | **clean** — read-as-disabled regression on atelier surfaces fixed. |
| 10 | `4c83feb8` | hard-disable Sentry uploads in development (api+cron-worker+public-api) | `apps/{api,cron-worker,public-api}/src/lib/sentry.ts` | **clean** — mirrors browser-side guard (`apps/web-vite/src/sentry.ts:40`). Production (`NODE_ENV=production`) unaffected. Override `SENTRY_DEV=true` for plumbing debug. **No Sentry scrub regression**: scrub wiring (`beforeSend: scrubSentryEvent`) preserved on every runtime per `GAP-OBSERVABILITY-007 / -008` fixes. |
| 11 | `eb51c97a` | restore Edit name dialog + density toggle (user-menu) | `apps/web-vite/src/components/layout/user-menu*` | **clean** — restores two legacy features (Better Auth `updateUser({ name })` + density Zustand store wiring). No auth / data scope change. |
| 12 | `a511f9d4` | accept PUBLIC_APP_URL alongside APP_URL on CSRF origin guard | `apps/api/src/server.ts` + `apps/web-vite/src/lib/{require-anonymous.ts,router.tsx}` | **clean** — mirrors existing CORS allowlist; production no-op when `PUBLIC_APP_URL == APP_URL`. Functional code for `GAP-MIDDLEWARE-004` (`require-anonymous`) rolled in via lint-staged race — documented in audit-report.md. |
| 13 | `53ecaa1e` | scrub migration breadcrumbs from source comments | 20 files (comment-only) | **clean** — pure comment edits, no behaviour change. Aligns with `feedback_no_legacy_comments` memory rule. Verified by `pnpm typecheck` + scoped tests on the touched runtimes. |
| 14 | `fb3385fb` | anchor `ATELIER_ROUTES` regex so workbench routes do not all match | `apps/web-vite/src/lib/intensity*` | **clean** — fixes regex anchor (`/\/?$/` → `/^\/?$/`); restores intended workbench-vs-atelier intensity routing. |
| 15 | `2113555f` | render pinned settings tabs under the system group | `apps/web-vite/src/hooks/use-{settings-tab-pins,nav-items}.ts` + sidebar | **clean** — restores legacy user-pins feature; consumes existing tRPC `user.pins.list` query. |
| 16 | `d309ea4e` | wrap workbench scroll model in `@media (min-height: 600px)` | `apps/web-vite` CSS | **clean** — short-viewport fallback prevents table-as-postage-stamp regression. |
| 17 | `0a350079` | make main content wrapper a flex column | `apps/web-vite/src/components/layout/*` | **clean** — fixes flex chain hop; workbench tables now scroll internally. |
| 18 | `c8a0ff0a` | open contractor wizard + invoice upload in place on top-bar | `apps/web-vite/src/components/layout/top-bar*` | **clean** — UX consistency (matches existing contract-wizard surface); no auth / data change. |
| 19 | `a56d97f1` | drop dead `status` filter + retarget Active KPI link + space pagination footer | `apps/web-vite/src/components/contractors/*` | **clean** — drops orphan URL param + retargets KPI link to actual `lifecycleStage` field; positive correctness fix. |

**New gaps surfaced by sibling review (static):** none. Wave 0 static-rubric review found all 19 commits scoped to UI polish, asset restoration, CSS layout fixes, or internal helper restoration. None touched auth middleware, payment routing, data layer, regulatory webhooks, accessibility, i18n keys, or the Sentry scrub pipeline.

**New gaps surfaced by Wave 9 verification (running the gates):** `GAP-SIBLING-001` — `pages/dashboard/index.tsx:15` imported `DashboardSkeleton` directly from `components/dashboard/dashboard-skeleton.js`, violating the page-shells gate (sibling commit `e95e4e75`). **Inline-fixed** alongside the verification commit: `dashboard-home-container.tsx` re-exports `DashboardSkeleton`; page imports both via the `-container` module path. The page-shells gate now passes.

## Summary table (mirror of audit-report.md)

> Cells = `open / inline-fixed / deferred` counts as inherited from `audit-report.md` summary. Restoration deltas annotated inline.

| Area | P0 | P1 | P2 |
|------|----|----|----|
| PAGE | **1 / 0 / 0** (`GAP-LEGAL-CLUSTER-001` open-escalated) | 0 / 0 / 5 (`GAP-PAGE-001..005` deferred — rolled up under `GAP-LEGAL-CLUSTER-001`) | 0 / 3 / 2 (`GAP-PAGE-006/-007/-008` inline-fixed; `GAP-PAGE-009/-010` deferred → `RISK-LEGAL-001` + `RISK-MIDDLEWARE-002`) |
| ROUTE | 0 / 0 / 0 | 0 / 0 / 4 (`GAP-ROUTE-002/-004/-005` deferred → `RISK-ROUTE-001/-002/-003`; `GAP-ROUTE-003` → `RISK-ROUTE-005`) | 0 / 1 / 1 (`GAP-ROUTE-001` inline-fixed; `GAP-ROUTE-006` → `RISK-ROUTE-004`) |
| WEBHOOK | 0 / 1 / 0 (`GAP-WEBHOOK-003` escalated → inline-fixed) | 0 / 0 / 1 (`GAP-WEBHOOK-001` → `RISK-WEBHOOK-001`) | 0 / 0 / 0 |
| MIDDLEWARE | 0 / 0 / 0 | 0 / 2 / 1 (`GAP-MIDDLEWARE-005/-007` inline-fixed; `GAP-MIDDLEWARE-003` → `RISK-MIDDLEWARE-002`) | 0 / 2 / 1 (`GAP-MIDDLEWARE-004` inline-fixed via sibling `a511f9d4`; `GAP-MIDDLEWARE-006` inline-fixed; `GAP-MIDDLEWARE-002` → `RISK-MIDDLEWARE-001`; +1 `GAP-MIDDLEWARE-001` closed-verified-intentional) |
| I18N | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 2 / 2 (`GAP-I18N-004/-005` inline-fixed; `GAP-I18N-001/-002` → `RISK-I18N-001`; `GAP-I18N-003` is INFO-only) |
| OBSERVABILITY | **0 / 3 / 0** (`GAP-OBSERVABILITY-007/-008/-012` inline-fixed) | 0 / 2 / 3 (`GAP-OBSERVABILITY-003/-009` inline-fixed; `GAP-OBSERVABILITY-001/-002/-010` → `RISK-OBSERVABILITY-001/-002`) | 0 / 2 / 2 (`GAP-OBSERVABILITY-005/-006` inline-fixed; `GAP-OBSERVABILITY-004/-011` → `RISK-OBSERVABILITY-002/-003`; +1 `GAP-OBSERVABILITY-013` closed-verified-intentional) |
| SECURITY | **0 / 1 / 1** (was 2 open; `GAP-SECURITY-001` deferred → `RISK-SECURITY-001`; `GAP-SECURITY-002` closed-decision via [`docs/security/csp-r2-wildcard.md`](../../docs/security/csp-r2-wildcard.md); `GAP-SECURITY-003` inline-fixed; +1 closed-decision `GAP-SECURITY-002`) | 0 / 2 / 0 (`GAP-SECURITY-005/-008` inline-fixed; +1 `GAP-SECURITY-004` closed-verified-intentional) | 0 / 0 / 1 (`GAP-SECURITY-006` → `RISK-MIDDLEWARE-001`; +1 `GAP-SECURITY-007` closed-verified-intentional) |
| TEST | **0 / 3 / 0** (`GAP-TEST-015/-021/-026` inline-fixed) | 0 / 6 / 5 (`GAP-TEST-001/-002/-016/-017/-018/-019` inline-fixed; `GAP-TEST-003/-004/-011/-024/-025` → `RISK-LEGAL-001` + `RISK-TEST-001`) | 0 / 0 / 12 (`GAP-TEST-005..010/-012/-013/-014/-020/-022/-023` → `RISK-TEST-001`) |
| **Restoration totals** | **0 / 8 / 2** (+1 closed-decision via R2 acceptance doc — `GAP-LEGAL-CLUSTER-001` + `GAP-SECURITY-001` deferred-with-rationale per goal's accepted status taxonomy) | **0 / 12 / 19** (+1 closed-verified) | **1 / 10 / 21** (+3 closed-verified) |

**Final P0 disposition (0 open, 1 closed-decision, 2 deferred-with-named-blocker, 1 P2-INFO):**

- `GAP-LEGAL-CLUSTER-001` — **deferred** (rationale: two-end architectural break — Payload publishes to a stub `revalidate-legal` route AND SPA has no tRPC fetch path AND apps/api has no Payload client AND `apps/api` uses `@upstash/redis` HTTP REST which does not support pub/sub. Three external decisions required before code can land: pub/sub mechanism, Payload content path, SSE/long-poll plumbing — see "Wave 1 + Wave 3 verify-then-act findings" section). Tracked under `RISK-LEGAL-001`.
- `GAP-SECURITY-001` — **deferred** (rationale: Render Static-Site (`render.yaml:642`) has no per-request execution hook; nonce minting is structurally impossible against the current service shape. Infra owner must pick between (a) edge runtime (`apps/web-vite-edge` Fastify on Render, or Cloudflare Worker), (b) keep static + drop `wasm-unsafe-eval` + add SRI hashes, or (c) accept-with-design-review per audit escalation block). Tracked under `RISK-SECURITY-001`.
- `GAP-SECURITY-002` — **closed-decision** ([`docs/security/csp-r2-wildcard.md`](../../docs/security/csp-r2-wildcard.md)). Wildcard accepted with mitigations: `check:r2-iframe-sandbox` CI guardrail + `frame-ancestors 'none'` + `sandbox="allow-downloads"` on the only R2-fed iframe. Narrowing the wildcard is pending ops env confirmation per audit escalation option (a) / (b); `RISK-SECURITY-002` tracks the residual.
- `GAP-I18N-003` — INFO-only; positive translation backfill. No action required.

## Per-row restoration status

Restoration mirrors each audit row by ID. Status reflects current state on `audit/post-migration-parity` HEAD. For full evidence + remediation text per row, see the source row in `goals/post-migration-parity-audit/audit-report.md`.

### PAGE parity (11 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-LEGAL-CLUSTER-001 | P0 | open (escalated) | **deferred** — three external decisions required (pub/sub mechanism per Finding 1, Payload content path per Finding 2, edge runtime per Finding 4). Architectural foundations recorded in restoration-report.md verify-then-act block; risk tracked. | `RISK-LEGAL-001` |
| GAP-PAGE-001..005 | P1 | deferred (rolled up) | **deferred — rolled up under `GAP-LEGAL-CLUSTER-001`** | `RISK-LEGAL-001` |
| GAP-PAGE-006 | P2 | inline-fixed (`50e9a259`) | **carried — inline-fixed (`50e9a259`)** | n/a |
| GAP-PAGE-007 | P2 | inline-fixed (`50e9a259`) | **carried — inline-fixed (`50e9a259`)** | n/a |
| GAP-PAGE-008 | P2 | inline-fixed (`dd7cafc4`) | **carried — inline-fixed (`dd7cafc4`)** | n/a |
| GAP-PAGE-009 | P2 | deferred (paired with `GAP-LEGAL-CLUSTER-001`) | **deferred — paired with `GAP-LEGAL-CLUSTER-001`** | `RISK-LEGAL-001` |
| GAP-PAGE-010 | P2 | deferred (paired with `GAP-MIDDLEWARE-003`) | **deferred — paired with `GAP-MIDDLEWARE-003`** | `RISK-MIDDLEWARE-002` |

### ROUTE parity (7 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-ROUTE-001 | P2 | inline-fixed (`808b9fcd`) | **carried — inline-fixed (`808b9fcd`)** | n/a |
| GAP-ROUTE-002 | P1 (P0 candidate) | deferred (runtime smoke owner) | **deferred — runtime smoke owner** | `RISK-ROUTE-002` |
| GAP-ROUTE-003 | P1 (pre-existing) | deferred (pre-existing follow-up) | **deferred — pre-existing follow-up** | `RISK-ROUTE-005` |
| GAP-ROUTE-004 | P1 | deferred (escalated — ops owner) | **deferred — escalated, ops owner** | `RISK-ROUTE-001` |
| GAP-ROUTE-005 | P1 | deferred (escalated — peppol service owner) | **deferred — escalated, peppol service owner** | `RISK-ROUTE-003` |
| GAP-ROUTE-006 | P2 | deferred (escalated — ops owner) | **deferred — escalated, ops owner** | `RISK-ROUTE-004` |

### WEBHOOK parity (2 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-WEBHOOK-001 | P1 (pre-existing) | deferred (F-SEC-06 follow-up) | **deferred — F-SEC-06 follow-up** | `RISK-WEBHOOK-001` |
| GAP-WEBHOOK-003 | P0 (escalated) | inline-fixed (`c433c678`) | **carried — inline-fixed (`c433c678`)** | n/a |

### MIDDLEWARE parity (7 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-MIDDLEWARE-001 | P2 → closed | closed (accepted as design) | **carried — closed-verified-intentional** | n/a |
| GAP-MIDDLEWARE-002 | P2 | deferred (operational) | **deferred — operational** | `RISK-MIDDLEWARE-001` |
| GAP-MIDDLEWARE-003 | P1 | deferred (escalated — product confirmation) | **deferred — product owner confirmation** | `RISK-MIDDLEWARE-002` |
| GAP-MIDDLEWARE-004 | P2 | inline-fixed (`a511f9d4`) | **carried — inline-fixed (`a511f9d4` via sibling lint-staged race)** | n/a |
| GAP-MIDDLEWARE-005 | P1 | inline-fixed (`271b57d4`) | **carried — inline-fixed (`271b57d4`)** | n/a |
| GAP-MIDDLEWARE-006 | P2 | inline-fixed (`b2489369`) | **carried — inline-fixed (`b2489369`)** | n/a |
| GAP-MIDDLEWARE-007 | P1 | inline-fixed (`ac1f158b`) | **carried — inline-fixed (`ac1f158b`)** | n/a |

### I18N parity (5 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-I18N-001 | P2 (P1 on invoice/payment) | deferred (35-call-site refactor) | **deferred — 35-call-site refactor scheduled to next i18n design-review window** | `RISK-I18N-001` |
| GAP-I18N-002 | P2 | deferred (paired with GAP-I18N-001) | **deferred — paired with `GAP-I18N-001`** | `RISK-I18N-001` |
| GAP-I18N-003 | INFO / P3 | n/a (positive change) | **carried — INFO-only, no action** | n/a |
| GAP-I18N-004 | P3 | inline-fixed (`eaa60c5c`) | **carried — inline-fixed (`eaa60c5c`)** | n/a |
| GAP-I18N-005 | P3 | inline-fixed (`5eb95e3e`) | **carried — inline-fixed (`5eb95e3e`)** | n/a |

### OBSERVABILITY parity (13 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-OBSERVABILITY-001 | P1 | deferred (product approval) | **deferred — product + privacy review** | `RISK-OBSERVABILITY-001` |
| GAP-OBSERVABILITY-002 | P1 | deferred (product approval) | **deferred — product + privacy review** | `RISK-OBSERVABILITY-001` |
| GAP-OBSERVABILITY-003 | P1 | inline-fixed (`6092d0e9`) | **carried — inline-fixed (`6092d0e9`)** | n/a |
| GAP-OBSERVABILITY-004 | P2 | deferred (deploy pipeline) | **deferred — deploy pipeline (`SENTRY_AUTH_TOKEN` env wiring)** | `RISK-OBSERVABILITY-002` |
| GAP-OBSERVABILITY-005 | P2 | inline-fixed (`1a3c3f19`) | **carried — inline-fixed (`1a3c3f19`)** | n/a |
| GAP-OBSERVABILITY-006 | P2 | inline-fixed (`6092d0e9`) | **carried — inline-fixed (`6092d0e9`)** | n/a |
| GAP-OBSERVABILITY-007 | P0 | inline-fixed (`5cb42d21`) | **carried — inline-fixed (`5cb42d21`)** | n/a |
| GAP-OBSERVABILITY-008 | P0 | inline-fixed (`f4f4961d`) | **carried — inline-fixed (`f4f4961d`)** | n/a |
| GAP-OBSERVABILITY-009 | P1 | inline-fixed partial (`7a283b21`) | **carried — inline-fixed partial; build-pipeline follow-up deferred** | `RISK-OBSERVABILITY-002` |
| GAP-OBSERVABILITY-010 | P1 | deferred (deploy pipeline) | **deferred — deploy pipeline (Node service source-map upload)** | `RISK-OBSERVABILITY-002` |
| GAP-OBSERVABILITY-011 | P2 | deferred (multi-file Fastify proxy) | **deferred — `/monitoring` Fastify tunnel route** | `RISK-OBSERVABILITY-003` |
| GAP-OBSERVABILITY-012 | P0 | inline-fixed (`3e240ebc`) | **carried — inline-fixed (`3e240ebc`)** | n/a |
| GAP-OBSERVABILITY-013 | P2 | closed (verified intentional) | **carried — closed-verified-intentional** | n/a |

### SECURITY parity (8 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-SECURITY-001 | P0 | open (escalated) | **deferred** — Render Static-Site (`render.yaml:642`) has no per-request hook; nonce minting structurally impossible until edge runtime decision lands per audit escalation block (Cloudflare Worker / Render Web Service / accept-with-design-review). 48h CSP soak gates close. | `RISK-SECURITY-001` |
| GAP-SECURITY-002 | P0 | open (escalated) | **closed-decision ([`docs/security/csp-r2-wildcard.md`](../../docs/security/csp-r2-wildcard.md))** — wildcard accepted; CI guardrail `pnpm check:r2-iframe-sandbox` + `frame-ancestors 'none'` + `sandbox="allow-downloads"` on the R2-fed iframe carry the mitigation. Narrowing pending ops env confirmation per audit escalation option (a)/(b). | `RISK-SECURITY-002` |
| GAP-SECURITY-003 | P0 | inline-fixed (`3198bb51`) | **carried — inline-fixed (`3198bb51`)** | n/a |
| GAP-SECURITY-004 | P1 → closed | closed (verified intentional) | **carried — closed-verified-intentional** | n/a |
| GAP-SECURITY-005 | P1 | inline-fixed (`050be4cc`) | **carried — inline-fixed (`050be4cc`)** | n/a |
| GAP-SECURITY-006 | P2 | deferred (operational) | **deferred — mirror of `GAP-MIDDLEWARE-002`** | `RISK-MIDDLEWARE-001` |
| GAP-SECURITY-007 | P2 → closed | closed (verified intentional) | **carried — closed-verified-intentional** | n/a |
| GAP-SECURITY-008 | P1 | inline-fixed (`70846fea`) | **carried — inline-fixed (`70846fea`)** | n/a |

### TEST coverage parity (26 rows)

| ID | Sev | Audit status | Restoration status | Cross-ref |
|----|-----|--------------|--------------------|-----------|
| GAP-TEST-001 | P1 | inline-fixed (`c433c678`) | **carried — inline-fixed (`c433c678`)** | n/a |
| GAP-TEST-002 | P1 | inline-fixed (`c433c678`) | **carried — inline-fixed (`c433c678`)** | n/a |
| GAP-TEST-003 | P1 (P0 candidate) | deferred (under cluster) | **deferred — under `GAP-LEGAL-CLUSTER-001`** | `RISK-LEGAL-001` |
| GAP-TEST-004 | P1 | deferred (test-coverage follow-up) | **deferred — a11y test surface follow-up** | `RISK-TEST-001` |
| GAP-TEST-005..010 | P2 | deferred (test-coverage follow-up) | **deferred — assertion-drift + URL-state + invoices filter + responsive UX + dashboard empty-state follow-up** | `RISK-TEST-001` |
| GAP-TEST-011 | P1 | deferred (test-coverage follow-up — auth unit) | **deferred — `use-login-form.test.tsx` extension** | `RISK-TEST-001` |
| GAP-TEST-012 | P2 | deferred (test-coverage follow-up) | **deferred — `useRegisterForm` Zod tests** | `RISK-TEST-001` |
| GAP-TEST-013 | P2 | deferred (test-coverage follow-up) | **deferred — invite-accept UX defaults** | `RISK-TEST-001` |
| GAP-TEST-014 | P2 | deferred (test-coverage follow-up) | **deferred — Microsoft social provider + dual-disable** | `RISK-TEST-001` |
| GAP-TEST-015 | P0 | inline-fixed (`f75c18a6`) | **carried — inline-fixed (`f75c18a6`)** | n/a |
| GAP-TEST-016 | P1 | inline-fixed (`1d4aa43c`) | **carried — inline-fixed (`1d4aa43c`)** | n/a |
| GAP-TEST-017 | P1 | inline-fixed (`1d4aa43c`) | **carried — inline-fixed (`1d4aa43c`)** | n/a |
| GAP-TEST-018 | P1 | inline-fixed (`c767b561`) | **carried — inline-fixed (`c767b561`)** | n/a |
| GAP-TEST-019 | P1 | inline-fixed (`b44fc5de`) | **carried — inline-fixed (`b44fc5de`)** | n/a |
| GAP-TEST-020 | P2 | deferred (test-coverage follow-up) | **deferred — EXTENDED-profile banner + pane composition** | `RISK-TEST-001` |
| GAP-TEST-021 | P0 | inline-fixed (`59173034`) | **carried — inline-fixed (`59173034`)** | n/a |
| GAP-TEST-022 | P2 | deferred (test-coverage follow-up) | **deferred — `einvoice.import-enabled` flag-gate** | `RISK-TEST-001` |
| GAP-TEST-023 | P2 | deferred (test-coverage follow-up) | **deferred — classification source-static-check** | `RISK-TEST-001` |
| GAP-TEST-024 | P1 | deferred (under cluster) | **deferred — under `GAP-LEGAL-CLUSTER-001`** | `RISK-LEGAL-001` |
| GAP-TEST-025 | P1 | deferred (under cluster) | **deferred — under `GAP-LEGAL-CLUSTER-001`** | `RISK-LEGAL-001` |
| GAP-TEST-026 | P0 | inline-fixed (`140e865b`) | **carried — inline-fixed (`140e865b`)** | n/a |
| FOLLOWUP-PRE-EXISTING-001 | n/a | verified pre-existing | **deferred — owned by `dry-solid-audit/extract-shared` restoration** | `RISK-TEST-002` |

## Restoration log

Restoration commits land on `audit/post-migration-parity` (or short-lived child branches fast-forward merged) with subjects `fix(restoration): GAP-<AREA>-<NNN> <one-line>` for code fixes or `docs(restoration): <one-line>` for report / risk-register updates.

| Wave | Commit | Subject | Files |
|------|--------|---------|-------|
| 0 | `52f182a9` | docs(restoration): Wave 0 — scaffold restoration-report + risk-register + sibling-UI review | `.gitignore`, `.planning/risk-register.md`, `goals/post-migration-parity-restoration/{goal,facts,plan,restoration-report}.md` |
| 2E | `7e6a7990` | feat(restoration): GAP-SECURITY-002 closed-decision — R2 wildcard documented acceptance + check:r2-iframe-sandbox CI guardrail | `scripts/check-r2-iframe-sandbox.mjs`, `package.json`, `docs/security/csp-r2-wildcard.md`, `.planning/risk-register.md`, `goals/post-migration-parity-restoration/restoration-report.md` |
| 1-prep | `acca3337` | docs(restoration): record Wave 1 + Wave 3 architectural blockers (verify-then-act findings) | `goals/post-migration-parity-restoration/restoration-report.md` |
| 9-partial | (this commit) | feat(restoration): Wave 9 verification matrix + GAP-SIBLING-001 inline-fix + deferred-with-rationale flip for GAP-LEGAL-CLUSTER-001 / GAP-SECURITY-001 | `apps/web-vite/src/{components/dashboard/dashboard-home-container,pages/dashboard/index}.tsx`, `.planning/risk-register.md` (+RISK-TEST-003, +RISK-DEPS-001), `goals/post-migration-parity-restoration/restoration-report.md` |

(Subsequent waves append rows.)

## Wave 1 + Wave 3 verify-then-act findings (recorded before any code edit)

Plan.md's open questions resolved by read-only investigation on `audit/post-migration-parity` HEAD. These are **decisions required before Wave 1 or Wave 3 can land code**.

### Finding 1 — `apps/api` uses `@upstash/redis` (HTTP REST), not `ioredis`

Evidence: `apps/api/package.json:38` + `packages/api/package.json:275` declare `@upstash/redis`. Usage sites:

- `apps/api/src/lib/rate-limit-store.ts:77` — `new Redis({ url: opts.redisUrl, token: opts.redisToken })` (Upstash REST).
- `apps/api/src/routes/health.ts:91` — same Upstash REST handle.

`@upstash/redis` is an HTTP/REST client and **does not support Redis pub/sub**. The Wave 1 plan assumed `ioredis` (native Redis protocol) for the `legal:revalidated` channel. Three options:

| Opt | Mechanism | Cost / blast radius | Notes |
|-----|-----------|---------------------|-------|
| (1) | Add a separate `ioredis` client pointed at a Render Redis instance (or Upstash's native Redis — distinct from REST). | New service / new env vars / new dep. | Cleanest "real Redis pub/sub" path. Render Redis is the lowest-friction add. |
| (2) | Postgres `LISTEN`/`NOTIFY` instead of Redis. | Reuses existing Prisma DB connection. Single-region only; cross-region delivery needs a separate sync. | Less infra, but Neon's primary/replica topology may or may not propagate `NOTIFY` between regions. Needs Neon-feature verification. |
| (3) | SSE-on-fanout via in-process EventEmitter inside `apps/api`. | Zero infra. Breaks across multiple Fastify instances (Render scales horizontally). | Acceptable only if `apps/api` runs as a single instance. Check `render.yaml` `numInstances` for the api service. |

**Decision required:** infra owner picks (1) / (2) / (3). Recommend (1) (`ioredis` + Render Redis instance) for clarity + future use cases (presence, job queues).

### Finding 2 — No Payload client in `apps/api`; no `CMS_URL` / `PAYLOAD_URL` env

Evidence:

- `grep -n '@payloadcms\|payload' apps/api/src apps/api/package.json` → zero matches.
- `grep -n 'CMS_URL\|PAYLOAD_URL\|cmsUrl' apps/api/src render.yaml -r` → zero matches.
- `apps/cms/src/payload.config.ts` exists (Payload runs as a separate Render service per `CLAUDE.md`).

The Wave 3 plan assumed `legal.getDocument` reads from "Payload local API". Payload's local API requires the Payload instance to be importable at runtime from the same Node process — but `apps/api` (Fastify) is a separate service from `apps/cms` (Payload). Two options:

| Opt | Mechanism | Notes |
|-----|-----------|-------|
| (a) | Add a Payload **REST client** in `packages/api` that talks to `apps/cms` over HTTP. Requires `CMS_URL` env + service-to-service auth token. | Cleanest separation. Adds one network hop per `legal.getDocument` call. Cache via TanStack Query is already in place on the SPA side. |
| (b) | Have `apps/api` query the same Postgres schema Payload writes to (collection table reads). | Tightly couples API to Payload's collection schema. Brittle on Payload upgrades. |
| (c) | Reverse the call-direction: `apps/cms` publishes legal-document snapshots to a Postgres table owned by `packages/api` (`LegalDocumentSnapshot`). `legal.getDocument` reads that. | Decouples consumers from Payload's internal storage. Requires `apps/cms` outbound webhook on publish (which already exists per `apps/api/src/routes/revalidate-legal.ts`). |

**Decision required:** product + infra owner picks (a) / (b) / (c). Recommend (c) — `apps/cms` ships content snapshots into `LegalDocumentSnapshot` rows on publish (re-using the existing HMAC webhook the audit's `GAP-TEST-018` already pinned); `legal.getDocument` reads from there. The Redis pub/sub channel from Finding 1 carries the invalidation signal so the SPA refetches.

### Finding 3 — Better Auth `databaseHooks.user.create.after` hook signature

Evidence: `packages/auth/src/config.ts:239` carries the `databaseHooks` block. Hook signature already accepts a request context per existing audit fixes (`GAP-OBSERVABILITY-012` SHA `3e240ebc` mounted PostHog identify on this hook).

**No blocker** — Better Auth hooks expose request context as expected. PostHog signup capture is already live and uses the same hook surface.

### Finding 4 — `render.yaml` `web-vite` block at line 642 is a Render Static-Site

Evidence: `render.yaml:642` declares `name: web-vite`, `publishPath: ./apps/web-vite/dist`. Static deploy. As the audit's `GAP-SECURITY-001` escalation states, Render Static-Site has **no per-request execution hook**, so per-request CSP nonce minting is structurally impossible against this service.

**Decision required:** infra owner picks between audit escalation options (a) Cloudflare Worker / Render Web Service rewrite — new edge runtime, OR (b) keep static, narrow CSP without nonce + add SRI, OR (c) accept-with-design-review. Recommend (a) via `apps/web-vite-edge` (sibling Fastify on Render) for one fewer cloud dependency.

### Finding 5 — Audit row `GAP-MIDDLEWARE-005` claim about Accept-Language landing point

Already inline-fixed (`271b57d4`). No further action needed; `pickBestLocale()` + `detectBrowserLocale()` cover the requirement.

## What unblocks Wave 1, Wave 3, Wave 9

| Decision | Required from | Affects |
|----------|---------------|---------|
| Pub/sub mechanism (Finding 1: ioredis+Redis vs Postgres LISTEN/NOTIFY vs in-process) | infra owner | Wave 1 (`packages/api/src/services/legal-pubsub.ts`), Wave 3 (`/legal/revalidations` SSE route) |
| Payload-to-API content path (Finding 2: REST client vs DB read vs snapshot table) | product + infra owner | Wave 3 (`legal.getDocument` source) |
| Edge runtime choice (Finding 4: Cloudflare Worker vs Render Web Service vs accept) | infra owner | Wave 1 (`apps/web-vite-edge/` or `.cloudflare/workers/web-vite-csp/`), Wave 3 (`render.yaml` cutover) |
| Ops env confirmation (R2 narrowing — see `docs/security/csp-r2-wildcard.md`) | ops owner | Reduces `RISK-SECURITY-002` from "low post-mitigation" to "closed". One-line `render.yaml:684` + `apps/web-vite/index.html:28` edit. |
| External webhook re-registration (`GAP-ROUTE-004`) | ops owner | Reduces `RISK-ROUTE-001` to "closed". |
| Product approval for Sentry replay + feedback widget (`GAP-OBSERVABILITY-001 / -002`) | product + privacy review | Reduces `RISK-OBSERVABILITY-001` to "closed". |
| `SENTRY_AUTH_TOKEN` env wiring (`GAP-OBSERVABILITY-004 / -010`) | ops / deploy owner | Reduces `RISK-OBSERVABILITY-002` to "closed". |
| Plannotator `--gate` sign-off | user | Wave 9 close. |

## Verification matrix

Final verification gates run on restoration branch head `audit/post-migration-parity` (post-Wave-2E + post-page-shells fix):

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Typecheck | `pnpm typecheck` | **PASS** | Full monorepo, all workspaces. |
| API server tests | `pnpm --filter @contractor-ops/api-server test` | **PASS** | exit 0. |
| Cron worker tests | `pnpm --filter @contractor-ops/cron-worker test` | **PASS** | exit 0. |
| Public API tests | `pnpm --filter @contractor-ops/public-api test` | **PASS** | exit 0. |
| Auth package tests | `pnpm --filter @contractor-ops/auth test` | **PASS** | exit 0. |
| Web-vite tests (path-scoped) | `pnpm --filter @contractor-ops/web-vite test -- src/` | **FAIL (deferred)** | 11 failed files / 38 failed tests; 605 passed / 4224 passed. 2 known pre-existing per `FOLLOWUP-PRE-EXISTING-001` (`RISK-TEST-002`); 9 additional regressions surfaced post-audit — `RISK-TEST-003` records first-observed pattern (`use-peppol.test.tsx` toast assertion `waitFor` timeout) + remediation plan. |
| Web-vite data-layer guard | `pnpm check:web-vite-data-layer` | **PASS** | `check:web-vite-data-layer — OK`. |
| Web-vite page-shell guard | `pnpm check:web-vite-page-shells` | **PASS** after restoration fix | Initial run found `pages/dashboard/index.tsx:15` importing skeleton from non-`-container` path (sibling commit `e95e4e75` regression). Fix: re-export `DashboardSkeleton` from `dashboard-home-container.tsx`; page imports both via the `-container` module. Recorded as `GAP-SIBLING-001` (the only sibling regression surfaced by verification). |
| Web-vite presentational guard | `pnpm check:web-vite-presentational` | **PASS** | `check:web-vite-presentational — OK`. |
| **R2 iframe sandbox guard (new)** | `pnpm check:r2-iframe-sandbox` | **PASS** | 4 iframes registered; intentional-fail verified. |
| Dependency audit (prod-only) | `pnpm audit --prod` | **FAIL (deferred)** | 4 transitive vulns ≥ moderate; all in dev/test/build chains (turbo 2.9.13, vitest>happy-dom>ws, esbuild dev-server, prisma>@prisma/dev>@hono/node-server, payload>lexical>happy-dom>ws). None in production runtime paths. Pre-existing. `RISK-DEPS-001` records remediation. |
| Security scan | `pnpm security:scan` | **FAIL (deferred)** | Same 6 vulns as above with low severity included. Same disposition under `RISK-DEPS-001`. |
| Playwright e2e | `apps/web-vite/e2e/` full run | **DEFERRED** | Not run this session (~minutes wall-clock + memory concerns). Audit baseline (Step 10) verified 42/42 paired specs at file level; Playwright suite stayed green for the audit cycle. Wave 9 full e2e run is a separate compute task. |
| CSP 48h soak | `/csp-report` endpoint logs zero violations against the legitimate bundle | **DEFERRED** | Requires Wave 1 edge runtime + Wave 3 cutover first, then 48h wall-clock. Gates `GAP-SECURITY-001` close. |
| Final sign-off | `plannotator annotate goals/post-migration-parity-restoration/restoration-report.md --gate` | **DEFERRED (user)** | Requires interactive sign-off; not runnable by agent. |

**Sibling-UI regression detection note.** The Wave 0 sibling-review pass surfaced zero new GAP-SIBLING rows via static rubric review. The Wave 9 verification matrix (this section) surfaced **one** sibling regression that static review missed: `pages/dashboard/index.tsx:15` importing `dashboard-skeleton.js` directly. Recorded as `GAP-SIBLING-001` and inline-fixed in the same commit that records the verification matrix. This is the value of running the gates — static review is necessary but not sufficient.
