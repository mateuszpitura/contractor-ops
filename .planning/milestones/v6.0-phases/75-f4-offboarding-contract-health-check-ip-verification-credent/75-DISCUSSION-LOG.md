# Phase 75: F4 Offboarding — Contract Health Check + IP Verification + Credential Vault — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 75-CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-27
**Phase:** 75-f4-offboarding-contract-health-check-ip-verification-credent
**Mode:** discuss (default mode, no flags)
**Areas discussed:** Health-check engine, Verdict + ContractorComplianceItem + e-sign hand-off, CredentialReference schema + secret-rejection + rotation flow, Per-jurisdiction phrase library + Werkvertrag locked-phrase

---

## Area selection

User selected ALL FOUR proposed areas via multiSelect — full coverage of the five ROADMAP success criteria.

| Option | Selected? |
|--------|-----------|
| Health-check engine — trigger, idempotency, model version | ✓ |
| Verdict shape + ContractorComplianceItem creation + e-sign hand-off | ✓ |
| CredentialReference — schema + secret-rejection + rotation flow | ✓ |
| Per-jurisdiction phrase library + regex matching + Werkvertrag locked-phrase | ✓ |

---

## Area 1 — Health-check engine

### Q1: Trigger shape

| Option | Selected |
|--------|----------|
| QStash background job on Contract upload | ✓ |
| Synchronous in-mutation Claude call | — |
| Cron sweep over unchecked contracts | — |

→ **D-01.** QStash fire-and-forget; existing infrastructure; honours 60s SLA.

### Q2: Idempotency

| Option | Selected |
|--------|----------|
| Versioned history + dedup on (contractId, contentHash, modelVer) | ✓ |
| Single-row overwrite on Contract | — |
| AuditLog-only history | — |

→ **D-02 / D-03.** New `ContractHealthCheckRun` table with partial-unique-index dedup. `Contract.complianceFlagsJson` denormalises latest run.

### Q3: Model version pinning

| Option | Selected |
|--------|----------|
| Typed-const + admin-triggered bulk re-run on bump | ✓ |
| Per-org overridable env var | — |
| Auto-bump on Anthropic deprecation | — |

→ **D-04.** `CONTRACT_HEALTH_MODEL_VER` typed const; bulk-re-run admin script + Settings UI button.

### Q4: Manual re-run UX

| Option | Selected |
|--------|----------|
| Per-contract button + bulk action on contracts list | ✓ |
| Per-contract button only | — |
| Bulk action only | — |

→ **D-05.** Two surfaces, one shared mutation `contract.rerunHealthCheck`. Mirrors Phase 71 D-13 pattern.

---

## Area 2 — Verdict shape + ContractorComplianceItem + e-sign hand-off

### Q1: `Contract.complianceFlagsJson` schema

| Option | Selected |
|--------|----------|
| Tristate verdict + cited clauses + per-rule confidence + raw model output | ✓ |
| Verdict + cited clauses only | — |
| Verdict-only digest | — |

→ **D-06.** Full structured shape `version: 1`. Replay-ready.

### Q2: `LIKELY_MISSING` → ContractorComplianceItem creation

| Option | Selected |
|--------|----------|
| Severity = WARNING + new per-jurisdiction `*.ip_assignment@v1` policyRules | ✓ |
| Severity = INFO (record-only) | — |
| Severity = BLOCKING (drives payment-block) | — |

→ **D-07.** ROADMAP "STANDARD" → Phase 71 enum WARNING. Six new policyRuleIds. documentType `IP_RATIFICATION`.

### Q3: IP_VERIFICATION hard-block + e-sign hand-off

| Option | Selected |
|--------|----------|
| Workflow-engine task hard-block + e-sign webhook auto-completes + Phase 74 override | ✓ |
| Manual admin marks task complete after off-platform signing | — |
| DocuSign-only (skip Autenti for DE) | — |

→ **D-08.** Reuses Phase 74 D-09..D-12 override verbatim. Webhook drives single-tx Document creation + task completion + ContractorComplianceItem SATISFIED via Phase 71 D-12 carry-forward.

### Q4: Drill-into-cited-clause UX

| Option | Selected |
|--------|----------|
| Contract detail panel + audit log row deep-link | ✓ |
| Audit log row only | — |
| Contract detail panel only | — |

→ **D-09.** Shared `<HealthCheckPanel>` component renders both surfaces.

---

## Area 3 — CredentialReference schema + secret-rejection + rotation flow

### Q1: Schema

| Option | Selected |
|--------|----------|
| Standalone table linked to OffboardingRecord + structured fields | ✓ |
| JSON column on OffboardingRecord | — |
| Extend Document model | — |

→ **D-10.** New `CredentialReference` table + `VaultProvider` / `AccessType` / `CredentialStatus` enums.

### Q2: Secret-paste rejection

| Option | Selected |
|--------|----------|
| Validators package + Zod refinement on every field | ✓ |
| API-layer-only regex check | — |
| Allowlist-only vault URL | — |

→ **D-11.** New `secret-shape-detector.ts` module. Pattern set covers AWS / GitHub / JWT / hex≥32 / Slack / Stripe / Google API / private-key blocks. Belt-and-braces (client + server validation).

### Q3: Rotation-task UX

| Option | Selected |
|--------|----------|
| Dedicated Credentials tab in offboarding workflow | ✓ |
| Inline list on overview page | — |
| Modal-only | — |

→ **D-12 (UX part).** New tab in workflow. Per-row Mark rotated / Edit / Remove.

### Q4: Workflow-completion gate on credentials

| Option | Selected |
|--------|----------|
| Soft-warning, not hard-block | ✓ |
| Hard-block until all ROTATED or NOT_APPLICABLE | — |
| No gate at all | — |

→ **D-12 (gate part).** Soft-warning with confirmation modal listing pending rows. Hard-block reserved for IP_VERIFICATION (legal). AuditLog `workflow.completed_with_pending_credentials`.

---

## Area 4 — Per-jurisdiction phrase library + Werkvertrag locked-phrase

### Q1: Verdict path (regex vs LLM)

| Option | Selected |
|--------|----------|
| LLM-first, regex used for grounding/sanity-check | ✓ |
| Regex-first, LLM only on regex-miss | — |
| LLM-only, no regex layer | — |

→ **D-13.** Always call Claude; regex grounds cited text. Two divergence rules raise MANUAL_REVIEW_REQUIRED.

### Q2: Phrase library location

| Option | Selected |
|--------|----------|
| New module `legal/ip-clauses-{jurisdiction}.ts` parallel to Phase 73 modules | ✓ |
| Extend existing `legal/compliance-{jurisdiction}.ts` modules | — |
| Single flat `legal/ip-clauses.ts` map | — |

→ **D-14.** Six new files + per-jurisdiction legal review boundaries.

### Q3: Werkvertrag Schöpferprinzip distinction

| Option | Selected |
|--------|----------|
| Jurisdiction-aware verdict + cross-jurisdiction-mismatch flag | ✓ |
| Treat all jurisdictions equally | — |
| Hard-fail DE contracts without explicit §31 UrhG language | — |

→ **D-15.** Contract.jurisdiction drives evaluation. UK boilerplate in DE contract → MANUAL_REVIEW_REQUIRED with `crossJurisdictionMismatch` flag. §7 + §31 UrhG marker comments in `ip-clauses-de.ts`.

### Q4: Signoff posture for new IP-clause entries

| Option | Selected |
|--------|----------|
| All PENDING + UI verdict carries "unverified-phrasing" flag | ✓ |
| PENDING but no UI flag | — |
| Hard-fail LIKELY_PRESENT depending on PENDING phrase | — |

→ **D-16.** Phase 70 D-09 PENDING posture. UI footer flag + subscript marker (Phase 73 D-16 visual convention). `pendingPhrasesCited[]` in resultsJson for forensics.

---

## Wrap-up question

| Option | Selected |
|--------|----------|
| Write CONTEXT.md now | ✓ |
| Add one more clarification | — |

→ Proceeded to write CONTEXT.md.

---

## Claude's discretion (deferred to Researcher / Planner)

- Exact `contract-health-tools.ts` Anthropic SDK tool_use schema — Researcher validates via Context7 (ROADMAP NEEDS RESEARCH flag).
- PDF char-coord capture for cited-clause "View in document" — best-effort.
- Exact wording of IP-ratification e-sign templates per jurisdiction — DRAFT only; production wording via signoff PRs.
- Whether `Document.rejectionReason` is reusable for IP-ratification rejection.
- Exact admin reconcile-queue surface for FAILED runs.
- Exact font/icon for PENDING subscript flag.
- Rate-limiting strategy for bulk re-run admin script.
- Whether the soft-warning credential gate gets dedicated AuditLog action value (recommend yes).

## Deferred ideas (for future phases or backlog)

See `<deferred>` section of 75-CONTEXT.md — 25 ideas captured, including the explicit ROADMAP-vs-Phase-71 severity name drift (`STANDARD` ↔ `WARNING`).

## Background events during the discussion

- **Phase 72 executor BLOCKED** mid-discussion (commit `c4e181b8`): worktree collision on `apps/web/src/app/api/cron/reminders/route.ts` due to 279 uncommitted files (pre-existing refactor extracting `detectDrvClearanceExpiries` into a sibling module). Phase 72 is still planned; STATE.md captures three unblock paths (commit / stash / discard). User resolution required before re-running execute. None of this affects Phase 75 decisions.
- **Phase 73 planner completed** mid-discussion: 8 plans across 4 waves, all 17 Phase 73 decisions covered, schema migration plan 73-02 is `autonomous: false` (multi-region apply required post-merge). Phase 75 inherits the locked-phrase registry pattern Phase 73 D-14..D-17 established + Phase 73 D-16 PENDING-flag UI convention; Phase 75 D-14 / D-16 mirror verbatim.

---

*Mode: discuss (default)*
*Discussion completed: 2026-04-27*
