# Post-migration parity audit report

> Status: **in progress** (Step 1 complete — branch + scratch + baseline). The summary table, per-area sections, and per-area "ported" appendices are populated incrementally as Steps 2–8 land. The P0 fix log appendix is updated as fixes commit.

## Baseline

- **Cutover commit (deletion of `apps/web/`)**: `62a97d73` — `chore(repo): remove apps/web — migrated to apps/web-vite`
- **Baseline ref used by audit (`62a97d73^`)**: resolved SHA `7fce0d83c8738aed36d55cd642dec4c7902b36fb`
- **Cutover deletion volume**: 1359 files / 229933 deletions (per `git show 62a97d73 --stat`)
- **Audit branch**: `audit/post-migration-parity` (cut from `dry-solid-audit/extract-shared` @ `4fefacb36d67fd877fe831ffdcab078f59393d6a`)
- **Scratch dir** (gitignored): `.audit-scratch/`

### Legacy inventory (verified counts @ `7fce0d83`)

| Area | Path | Count |
|------|------|------:|
| Pages (`page.tsx`) | `apps/web/src/app/**` | 68 |
| API route handlers (`route.ts`) | `apps/web/src/app/api/**` | 41 |
| Middleware (lines) | `apps/web/src/middleware.ts` | 739 |
| Lib files | `apps/web/src/lib/**` | 46 |
| Locale files | `apps/web/messages/*.json` | 4 |
| E2E spec files (`*.spec.ts`) | `apps/web/e2e/**` | 42 |
| E2E tree total (specs + helpers) | `apps/web/e2e/**` | 51 |
| Full `apps/web/src/**` tree | (incl. components, hooks) | 1272 |

## Severity rubric

| Severity | Definition |
|----------|-----------|
| **P0** | Auth break, payment / money flow break, data loss / tenant leak, regulatory webhook break (KSeF / ZATCA / Peppol / Storecove). Inline-fix during audit window or escalate with named blocker. |
| **P1** | User-facing feature regression that does not lose data and is not in a P0 category. |
| **P2** | i18n string gap, test coverage gap, doc gap, cosmetic regression. |

Gap ID schema: `GAP-<AREA>-<NNN>`, areas ∈ {`PAGE`, `ROUTE`, `WEBHOOK`, `MIDDLEWARE`, `I18N`, `OBSERVABILITY`, `SECURITY`, `TEST`}. Numbering is stable per area; rows never renumber after publication.

Row fields (mandatory): `ID | area | legacy path | new path (or MISSING) | severity | evidence (file:line + git show 62a97d73^:<path> excerpt) | status (open / inline-fixed / deferred) | remediation`.

## Summary table

> Placeholder — totals filled in Step 10 after all per-area sweeps land. Each cell = open / inline-fixed / deferred counts.

| Area | P0 | P1 | P2 |
|------|----|----|----|
| PAGE | – | – | – |
| ROUTE | – | – | – |
| WEBHOOK | – | – | – |
| MIDDLEWARE | – | – | – |
| I18N | – | – | – |
| OBSERVABILITY | – | – | – |
| SECURITY | – | – | – |
| TEST | – | – | – |
| **Total** | – | – | – |

---

## Page parity

> Populated in Step 2.

### Gaps

_None recorded yet._

### Ported appendix

_None recorded yet._

---

## API route parity

> Populated in Step 3.

### Gaps

_None recorded yet._

### Ported appendix

_None recorded yet._

---

## Webhook parity (sub-section of API route parity)

> Populated in Step 3. Per-route matrix of: signature verify ✓/✗, idempotency ✓/✗, dead-letter ✓/✗, ALS trace ✓/✗, Sentry-on-failure ✓/✗.

_None recorded yet._

---

## Middleware parity

> Populated in Step 4. Per behavior-block: legacy line range → new home (file:line) → behavior-equivalent (yes / weaker / dropped) → gap row if weaker or dropped.

### Gaps

_None recorded yet._

### Behavior-block map

_None recorded yet._

---

## i18n parity

> Populated in Step 5. Per-locale key diff + ICU shape regressions + formatter parity.

### Gaps

_None recorded yet._

### Message-source state

_TBD — confirm Step 5 whether messages source is still `apps/web/messages/*.json` (legacy path) or `apps/web-vite/messages/*.json` (post `git mv`)._

---

## Observability parity

> Populated in Step 6. Sentry scrub rules, `beforeSend` filters, release/dist/env config, PostHog call-sites, web-vitals contract.

### Gaps

_None recorded yet._

### Ported appendix

_None recorded yet._

---

## Security parity

> Populated in Step 7. CSP, CORS, helmet, rate-limit, audit-log, signature-verify per-rule diff.

### Gaps

_None recorded yet._

### Ported appendix

_None recorded yet._

---

## Test coverage parity

> Populated in Step 8. Legacy test file → behavior-class list → new test mapping; Playwright 42/42 assertion-by-assertion verify.

### Gaps

_None recorded yet._

### Ported appendix

_None recorded yet._

---

## P0 fix log

> Per inline-fix: `GAP-<AREA>-<NNN>` | commit SHA | subject | verification command | test added.

_No P0 fixes landed yet._

---

## Verification (Step 10)

> Run + captured at end:

- [ ] `pnpm typecheck`
- [ ] `pnpm --filter @contractor-ops/api-server test`
- [ ] `pnpm --filter @contractor-ops/cron-worker test`
- [ ] `pnpm --filter @contractor-ops/web-vite test` (path-scoped per memory-pressure rule)
- [ ] `pnpm --filter @contractor-ops/web-vite check:web-vite-data-layer`
- [ ] `pnpm --filter @contractor-ops/web-vite check:web-vite-page-shells`
- [ ] `plannotator annotate goals/post-migration-parity-audit/audit-report.md --gate` → approved
