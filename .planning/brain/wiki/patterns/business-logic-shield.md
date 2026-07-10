---
title: Business logic shield
type: pattern
tags: [patterns, business-logic, quality, agent-workflow]
updated: 2026-07-10
source_commit: e0d533fa5
verify_with:
  - .claude/skills/business-logic-shield/SKILL.md
  - .claude/hooks/shield-workflow-lib.js
  - .cursor/rules/35-business-logic-shield.mdc
  - .planning/handoffs/business-logic-review-2026-07-08.md
---

# Business logic shield

Preventive agent skill + hooks that encode the **2026-07-08 business-logic review** systemic patterns (S1–S10 composition, T1–T11 integrity). Stops the dominant failure mode: **correct pieces that never compose** (unwired code, mock-masked seams, missing sibling guards, audit outside tx).

## When mandatory

Before any feature, fix, or multi-layer change touching:

- Domain rules (approvals, payments, compliance, classification, workforce, portal/public-api)
- Money / tax / filing / bank export
- State machines and cron/outbox/webhook producers
- Router ↔ service ↔ engine ↔ UI seams

**Skip:** typos, formatting-only, lockfiles, test assertion-only with zero behavior change.

## Skill location

| Asset | Path |
|-------|------|
| Main workflow | `.claude/skills/business-logic-shield/SKILL.md` |
| Pattern classes S1–S10, T1–T11 | `.claude/skills/business-logic-shield/patterns.md` |
| Critical seams registry | `.claude/skills/business-logic-shield/seams-registry.md` |
| Verify commands | `.claude/skills/business-logic-shield/verify-commands.md` |
| Cursor rule | `.cursor/rules/35-business-logic-shield.mdc` |

## Activation (Claude Code / Codex hooks)

Opt-in prefixes (same model as `[[patterns/ui-skills-routing]]`):

| Prefix | Behavior |
|--------|----------|
| **`[shield]`** | Blocks **logic-path** `Write`/`Edit` until skill read + Shield Scope file written |
| **`[shield-strict]`** | Same + blocks `Grep`/`Glob` until skill read |
| **`/shield-workflow-off`** | Disable for next session turn |

### Hook-enforced order

1. **Read** `business-logic-shield` skill (Skill tool or Read `SKILL.md`)
2. **Write** `.claude/hooks/.state/shield-scope.json`:

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

Required keys: `flow` (string ≥3 chars), `surfaces`, `patternsAtRisk` (string or non-empty array). Optional: `seams`, `reference`, `testsToRun` (vitest paths — **mandatory to run** before Shield Verdict per T11).

3. Implement + run verify commands + **T11 touched-module vitest**
4. End with **Shield Verdict** (patterns PASS, seams tested, verify run)

### Guarded paths

Hooks apply to edits under:

- `packages/api/`, `apps/api/`, `apps/cron-worker/`, `apps/public-api/`
- `packages/einvoice/`, `packages/classification/`, `packages/compliance-policy/`, `packages/payroll/`, `packages/validators/`
- `packages/db/scripts/`
- `apps/web-vite/**/hooks/use-*.ts(x)` and domain hooks when API contract changes

Hook implementation: `.claude/hooks/shield-workflow-{lib,prompt,track,guard}.js` (mirrored under `.codex/hooks/`).

## Pattern classes (summary)

| Id | One-line rule |
|----|----------------|
| S1 | Production caller exists for every new handler/job |
| S2 | Unmocked round-trip test at each changed seam |
| S3 | Single authoritative money/tax column |
| S4 | Portal/public-api/cron get same guards as staff |
| S5 | One writer per status transition |
| S6 | Regional `ctx.db` — no EU-pinned drains |
| S7 | Notification template + dispatch for new types |
| S8 | Grep same file for stale field/`!` after query fix |
| S9 | Backfill or ops path for existing org rows |
| S10 | Copy regional/sibling pattern within same handler |
| T1 | `writeAuditLog({ tx })` inside mutation tx |
| T2 | Guarded `updateMany` + `count === 1` |
| T3 | `::bigint` sums; explicit gross vs net basis |
| T4 | Filing generate in one `$transaction` |
| T5 | `requirePermission` on sensitive reads/writes |
| T6 | Feature-flag assert on every gated procedure |
| T7 | Server-derived ids; no client `storageKey` / raw import rows |
| T8 | `orderBy` + deterministic collision probe |
| T9 | NULL → skip/fail-closed, not wrong math |
| T10 | Boolean legacy → blank+warn, not guessed enum |
| T11 | `vitest run` on every touched `*.test.ts` before done |

### Adversarial round 2 lessons (2026-07-10 ~01:45 batch)

Worth shielding — now in skill:

| Finding | Pattern | Shield action |
|---------|---------|---------------|
| Fixer never ran touched suites (16 red) | **T11** | Mandatory colocated vitest in Phase 3 |
| ZATCA enqueue EU-pinned, sibling fans out | **S10** + S6 | Read full handler; copy fan-out |
| IP seed no-op for existing orgs | **S9** | Backfill plan in scope |
| TZ fix + stale `field!` same file | **S8** | Grep file after query fix |
| NULL taxId → 100% share | **T9** | Fail-closed on nullable keys |
| DATEV collision order-dependent | **T8** | `orderBy` + collision test |
| `true → 'ev'` kirchensteuer | **T10** | No boolean→enum guess |
| KSeF P_11A gross vs VAT | **S2/T3** | Round-trip seam test |
| Shipment guard drops FAILED→RETURNED | FSM hard stop | Test real courier transitions |
| Import mock missing `$executeRawUnsafe` | T11 mock sync | Update mock with tx API |

**Not hook-automatable** (skill/verify only): org vs worker country for holidays, PublicHoliday.region, SAVEPOINT RELEASE, ZATCA letter-category edge cases — document as review caveats in handoff, not PreToolUse gates.

Full detection cues: skill `patterns.md`. Handoff round 2: `.planning/handoffs/business-logic-review-2026-07-08.md` § Adversarial verification ~01:45 batch.

## Relationship to other review skills

| Skill | Role |
|-------|------|
| **business-logic-shield** | Preventive — before/during implementation |
| `gsd-code-review` | Phase artifact after implementation |
| `cavecrew-reviewer` | Diff severity pass |

Run shield **first** on domain work; reviewer second if user asks.

## Agent mistakes

- Fixing callee without production caller (unreachable branch)
- Backend fix without web-vite hook / portal sibling update
- Mocking both sides of router↔engine test
- Regenerating golden files before fixing algorithm
- Marking done without `errors-i18n-parity` when adding error codes
- Shipping fix without `vitest run` on touched test files (T11)
- Fixing query in one line, leaving stale `field!` elsewhere in file (S8)
- Seed fix without backfill for existing orgs (S9)
- Guessing legal enum from boolean (`true → 'ev'`) (T10)

## Related

- [[agent-delegation]]
- [[tenant-and-audit]]
- [[trpc-procedure-stack]]
- [[multi-region-db]]
- [[patterns/ui-skills-routing]] — parallel opt-in hook model for UI
