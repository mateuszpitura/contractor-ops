---
name: business-logic-shield
description: >
  Mandatory composition and business-logic gate for contractor-ops before any
  feature, fix, or multi-layer change touching domain rules, money, compliance,
  workflows, portal/public-api, cron, or cross-package seams. Encodes the 2026-07-08
  business-logic review systemic patterns (S1–S10, T1–T11) so agents prevent
  built-but-unwired, mock-masked seams, audit-not-in-tx, check-then-act races,
  dual-status drift, EU-pinning, and fix-with-new-bug regressions. Trigger:
  /shield, [shield], bulletproof, before implementing or reviewing logic in
  packages/api, apps/api, apps/cron-worker, apps/public-api, portal routers,
  payment/compliance/classification/workforce/integrations domains, or when
  touching router↔service↔engine↔UI seams across layers.
disable-model-invocation: false
---

# Business Logic Shield

Preventive gate distilled from `.planning/handoffs/business-logic-review-2026-07-08.md` and `.planning/reviews/business-logic-review-2026-07-08.md`. **Not a generic code review** — this skill catches **composition failures**: correct pieces that never connect, guards missing on sibling surfaces, tests that mock both sides of a seam.

## When this skill is mandatory

Activate **before writing code** when ANY of:

| Trigger | Examples |
|---------|----------|
| New or changed **business rule** | approval step, payment gate, classification verdict, leave balance |
| **Money / tax / filing** | skonto, WHT, bank export, 1099/1042-S, invoice totals |
| **State machine / status** | invoice, payment run, workflow task, compliance item |
| **Cross-layer seam** | router → service → engine; staff → portal → public-api |
| **Cron / outbox / webhook** | background job, regional drain, async producer |
| **Multi-file domain fix** | 3+ files in same flow (use shield even if user didn't say `/shield`) |

**Skip only** for: typos, pure formatting, comment-only, lockfile-only, test-only assertion tweaks with zero behavior change, docs-only wiki with no product code.

User prefixes **`[shield]`** or **`/shield`** → read this file + [patterns.md](patterns.md) first, then proceed.

### Claude Code / Codex hooks (opt-in)

| Prefix | Blocks |
|--------|--------|
| `[shield]` | Logic-path `Write`/`Edit` until skill read + `shield-scope.json` |
| `[shield-strict]` | Same + `Grep`/`Glob` until skill read |
| `/shield-workflow-off` | Disable |

Hook paths: `packages/api/`, `apps/api/`, `apps/cron-worker/`, `apps/public-api/`, `packages/einvoice/`, `packages/classification/`, `packages/compliance-policy/`, `packages/payroll/`, `packages/validators/`, `packages/db/scripts/`, web-vite `use-*` hooks. Implementation: `.claude/hooks/shield-workflow-lib.js`. Wiki: [[patterns/business-logic-shield]].

---

## Phase 0 — Scope map (2 min)

Before edits, persist **Shield Scope** for hook-enforced sessions (`[shield]` / `[shield-strict]`):

**Write** `.claude/hooks/.state/shield-scope.json`:

```json
{
  "flow": "invoice approve → payment run → SEPA export",
  "surfaces": ["staff tRPC", "cron"],
  "seams": ["payment export IBAN"],
  "patternsAtRisk": ["S1", "S4", "T1", "T2"],
  "testsToRun": ["packages/api/src/routers/__tests__/payment.test.ts"],
  "reference": "wiki/domains/payments-and-bank-files"
}
```

Hooks block logic-path edits until this file exists with valid JSON (`flow`, `surfaces`, `patternsAtRisk`). Also output the same block in chat for the user:

```markdown
## Shield Scope
- **Flow:** [e.g. invoice approve → payment run → SEPA export]
- **Surfaces touched:** [staff tRPC | portal | public-api | cron | web-vite hook]
- **Seams crossed:** [list from seams-registry if any]
- **Pattern classes at risk:** [S1, S2, T1, … from patterns.md]
- **Reference:** [wiki domain page or handoff section if non-trivial]
```

Discovery order (binding):

1. `semble search` / `semble find-related` on symbols you will touch
2. graphify query for call path if refactor spans 3+ files (`.planning/graphs/graph.json`)
3. `.planning/brain/wiki/hot.md` → domain page for **why**, not for file locations

---

## Phase 1 — Pre-write gate (20 questions)

Read [patterns.md](patterns.md). For each applicable class, answer **PASS / FAIL / N/A** in the Shield Scope block. **Any FAIL → resolve design before coding.**

Minimum set (always answer):

1. **S1 Wired?** Every new handler/export/job has ≥1 **production** caller (not test-only). Verify with semble/graphify.
2. **S9 Backfill?** Seed/template/cron fix also reaches **existing** orgs (not seed-only no-op when templates already exist).
3. **S4 Siblings?** If staff path gets a guard, portal + public-api + cron siblings get the **same** guard (or documented intentional gap).
4. **S10 Same-file sibling?** If one function in a handler fans out regions, every new function in that file uses the same pattern (not EU `prisma` next to regional reconcile).
5. **T1 Audit-in-tx?** Sensitive mutations use `writeAuditLog({ tx })` inside the same `$transaction`.
6. **T2 Atomic transition?** Status changes use guarded `updateMany({ where: { id, status: expected } })` and assert `count === 1` (or DB unique backstop).
7. **T7 Regional db?** Uses `ctx.db` / regional client — never global `prisma` for tenant data in routers/services (ME org risk).
8. **S2 Seam test?** Each new/changed router↔engine seam gets **one unmocked round-trip test** (real Zod + real enum, no mock on far side). See [seams-registry.md](seams-registry.md).
9. **T9 Nullable edges?** NULL taxId / countryCode / timezone → skip or fail-closed, never silent wrong math (100% share, skip-all holidays).
10. **S5 Single source of status?** Not writing one column while readers use another; document if multiple columns must stay in sync.
11. **UI/API contract?** If input schema changes, **all** callers updated (web-vite hooks, portal, tests) in same change set.
12. **S8 Same-file completeness?** Fixing a filter/query → grep file for stale `!` / old field names on same entity (TZ-null band burn lesson).

Full pattern checklist: [patterns.md](patterns.md).

---

## Phase 2 — During implementation

### Hard stops (fix before continuing)

| Stop | Rule |
|------|------|
| Dead code path | Fix **caller** and **callee** in same PR — branch without production caller = FAIL |
| Mock both sides | Integration test must import **real** module on at least one side of seam |
| Post-commit audit | Move `writeAuditLog` inside `tx`; audit failure must roll back mutation |
| Idempotency before validation | Reserve idempotency key **after** eligibility checks (public-api lesson) |
| Enqueue in tx | Outbox/queue publish **after** transaction commit unless explicitly safe |
| Gross vs net | Money comparisons use same basis (`amountToPayMinor` vs `totalMinor`) — state which |
| Enum casing | Map member roles ↔ Prisma `UserRole` via **one helper** at every write/compare |
| Boolean → legal enum | Never guess confession/tax codes from `true` — map unknown to blank + warn (kirchensteuer) |
| Batch collision / IDs | `findMany` used for stable IDs needs explicit `orderBy`; collision probe must be deterministic |
| FSM guard completeness | Status rank map must allow real provider flows (FAILED→RETURNED redelivery); add guard tests |
| Parser/generator fields | Gross vs VAT column semantics must round-trip (KSeF `P_11A` vs `P_11Vat`) |
| Fix same file grep | After changing expiry/TZ/filter logic, grep file for old `field!` / removed filters |
| Loop errors | Per-row catch must log — never silent swallow; SAVEPOINT loops should RELEASE |
| Test tolerates broken | Never loosen assertion to accept INVALID/broken output — fix production code |
| Mocks follow tx API | New `$executeRawUnsafe` / `prismaRaw.contractor` → update test mocks same PR |

### Propagation matrix (S4)

When adding a guard to one entry point, scan siblings:

| Staff router | Also check |
|--------------|------------|
| `payment-*` | `routers/public-api/payment-run.ts`, export routers |
| `invoice-*` | `portal-invoices-router`, intake, KSeF/Peppol inbound |
| `approval-*` | Slack/Teams adapters, bulk paths, portal manager leave |
| `compliance-*` | payment gate, reminder scan, materialisation on create/import |
| `workforce/*` | portal leave, HRIS push/pull, payroll feed |
| Cron handler | Producer enqueue sites, regional fan-out pattern |

Pattern for multi-region (S6): iterate `SUPPORTED_REGIONS` — copy from `compliance-reminder-scan.ts` fan-out, not EU-pinned drain. **S10:** if `reconcilePendingZatcaChains` fans out in the same cron handler, `reconcileMissingZatcaSubmissionEnqueues` must too.

---

## Phase 3 — Post-write gate (before "done")

Run commands from [verify-commands.md](verify-commands.md) for touched packages.

### T11 — Run tests on every touched module (mandatory)

Adversarial round 2 (2026-07-10): fixer shipped 16 red tests across 4 files without running suites.

**Rule:** for each production file edited, run its colocated `__tests__` / `routers/__tests__` file before Shield Verdict. List paths in scope `testsToRun` and in verdict.

```bash
pnpm exec vitest run path/to/touched.module.test.ts
```

**BLOCK merge** if any touched-module test file is red. Do not claim ✅ without command output.

### Anti-regression checklist (from adversarial audits)

- [ ] `seed-dev.ts` / fixtures match enum/schema fix (role casing, slaHours, shapes)
- [ ] Golden files regenerated from **correct** implementation — not blessing a bug
- [ ] New error codes added to **all 4 locales** (`errors-i18n-parity.test.ts`)
- [ ] Tests import **real** schemas — no tautological local copy of Zod schema
- [ ] Deleted tests restored or replaced — no gutted suite with fewer behavioral cases
- [ ] web-vite hooks updated if API input changed
- [ ] Wiki updated if product behavior changed (`pnpm check:wiki-brain`)
- [ ] UI surface exists if backend added user-visible state (compliance hold, bank settings, etc.)
- [ ] **Round 2:** nullable inputs fail-closed; same-file stale refs grepped; seed fix has backfill plan; FSM guard allows real courier flows; boolean enums not guessed

### Shield verdict

End every shielded task with:

```markdown
## Shield Verdict
- **Patterns:** [list PASS / fixed FAILs]
- **Seams tested:** [file:test name or "N/A"]
- **Verify run:** [commands + result]
- **Residual risk:** [explicit gaps or "none"]
```

**BLOCK merge** if: typecheck red, i18n parity red, **any touched-module vitest red (T11)**, seam test missing for new cross-boundary code, or FAIL pattern left unresolved.

---

## Relationship to other skills

| Skill | Use when |
|-------|----------|
| **business-logic-shield** (this) | Before/during/after domain logic — **composition & flow correctness** |
| `gsd-code-review` | Phase-complete review artifact |
| `cavecrew-reviewer` | Quick diff severity pass |
| `gsd-debug` | Runtime failure investigation |

Run **shield first**, then cavecrew-reviewer on the diff if user asks for review.

---

## Reference files

| File | Contents |
|------|----------|
| [patterns.md](patterns.md) | S1–S10, T1–T11 — detection cues, fixes, review examples |
| [seams-registry.md](seams-registry.md) | Known critical seams in this repo + required round-trip tests |
| [verify-commands.md](verify-commands.md) | Copy-paste verify commands by touched area |

Source audits (historical detail, do not re-audit closed items):

- `.planning/handoffs/business-logic-review-2026-07-08.md` — flow verdicts, END status
- `.planning/reviews/business-logic-review-2026-07-08.md` — pack themes T1–T7
