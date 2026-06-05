# Demo strategy — what prospects actually see

> Grounded in a codebase recon (2026-06-03): the seed/demo infrastructure is mature. A "golden demo tenant" is ~30 min to stand up, not a build. Integration sandbox modes already exist. One critical conflict surfaced — see "Pre-demo gates".

## Principle: not per-lead. Layered.

A per-lead seeded environment for cold prospects is the wrong default — it costs 20–40 min of manual seeding per lead, and on cold outreach you don't have the prospect's data anyway. Personalized environments are a deliberate high-touch *close* move for hot SQLs, not a top-of-funnel default.

## The 5 tiers

| Tier | What | Audience | When | Effort (infra exists) |
|------|------|----------|------|------------------------|
| 0 | **Loom video** — async recording of the golden tenant | cold-email recipients | wave 1 | already planned (ASSET-01) |
| 1 | **One golden demo tenant** — `pnpm seed:qa --profile=showcase` → `qa-default-org`; founder screen-shares live | booked 15-min calls | wave 1 | ~30 min (seed exists) |
| 1b | **2–3 segment-flavoured seeds** — PL software-house / DE Mittelstand / Gulf Saudization data variants | matched to prospect segment on the call | wave 1.5 | medium (extend seed-dev) |
| 2 | **Shared self-serve sandbox** — demo creds, "poke around yourself" | warm prospects who want to explore | wave 1.5 / M2 | watermark 2–4h + auto-reset 2–3h + read-mostly guardrails |
| 3 | **Personalized per-lead demo** — tenant seeded with prospect's company name + logo + contractor count | hot SQLs only (top 5–10) | as a close move | 20–40 min/lead, manual |
| 4 | **Self-serve trial provisioning** — real product-led signup | inbound | M3+ | product decision |

**Wave-1 answer: Tier 0 (Loom) + Tier 1 (one golden tenant).** That is the whole demo stack for launch. Everything else is later.

## What exists in the repo (recon findings)

| Capability | Status | Path |
|------------|--------|------|
| Master seeder w/ profiles (empty/solo/small/medium/huge/showcase/qa) | READY | `packages/db/scripts/seed-dev.ts` |
| QA orgs (`qa-default-org` showcase, `qa-empty-org`, `qa-stress-org`) | READY | `--profile=qa` |
| Deterministic demo credentials → `.env` | READY | `packages/db/scripts/seed-qa-fixtures.ts` |
| Command | READY | `pnpm seed:qa` or `pnpm db:seed:dev --profile=showcase --confirm` |
| Tenant isolation (RLS + multi-region) | READY | `packages/db/src/tenant.ts`, `packages/api/src/middleware/tenant.ts` |
| KSeF / ZATCA / Peppol / HMRC sandbox toggle (per-connection) | READY | `packages/einvoice/src/profiles/*`, `packages/api/src/gov-api-clients.ts` |
| Data wipe routine (`wipeAllTenantData()`, dependency-safe) | READY | `seed-dev.ts` (behind `--confirm`) |
| "DEMO DATA" UI watermark / badge | MISSING | ~2–4h: conditional on `metadata.profile` |
| Auto-reset timer (re-seed nightly) | MISSING | ~2–3h cron in `apps/cron-worker` (only needed for Tier 2 sandbox) |

## Pre-demo gates (MUST clear before Loom + first call)

### Gate 1 — Classification UI contradicts the de-risked positioning ⚠️ (highest priority)

The product currently outputs **binding verdicts**, which directly conflicts with the positioning locked in `positioning-and-liability.md` ("we don't issue verdicts; the adviser/client decides"):

- IR35: `verdict: 'outside' | 'inside' | 'indeterminate'` (`packages/classification/src/types/outcome.ts`)
- Scheinselbst.: `verdict: 'green' | 'amber' | 'red'` + `totalScore: 0..100`
- Assessment list renders verdict badges; there is a `drv-defense-bundle.tsx` PDF.

If a prospect sees a hard "inside IR35" or "red" verdict, the sales narrative (copy says "decision-support, your adviser decides") and the product (shows a verdict) are incoherent — and demoing a verdict is itself a representation that re-exposes the liability we designed away.

**Resolution:**
- **Path A (wave 1, fast):** do NOT show verdict screens. Demo e-invoicing (sandbox) + ops platform + the **DRV defense-bundle PDF** (which is the ideal de-risked artifact — an evidence/audit document, not a naked verdict). Narrate any classification surface as "risk indicators + evidence pack for your adviser."
- **Path B (before scaling classification):** add a visible "not a determination — review with your adviser" disclaimer in the UI + reframe the label from a verdict to risk-indicators. Disclaimer infra partially exists (admin "pending disclaimers" panel).

Recommendation: **Path A now, Path B before classification is sold as a feature.**

### Gate 2 — Integrations must be in SANDBOX in the demo tenant

KSeF (test), ZATCA (sandbox), Peppol (sandbox), HMRC (sandbox) all have a per-connection environment toggle. The golden tenant's connections must be set to sandbox/test — otherwise a live KSeF demo files real test invoices into the production KSeF system. Zero extra build; just set the toggle when seeding the demo org.

### Gate 3 — "DEMO DATA" watermark

Add a badge/watermark when `metadata.profile` indicates a demo org (~2–4h). Reasons: (a) prospects/screenshots never mistake fake data for a real customer's, (b) a fake company name never implies a real classification verdict about a real entity, (c) protects against a screenshot leaking as if it were production.

### Gate 4 — No real PII in seed

`showcase` seed uses Faker → synthetic data. Confirm no real contractor/company names slipped into any custom seed template before recording the Loom.

## Demo narrative (wave 1 — what to actually walk through)

Lead with the lowest-liability, highest-urgency surfaces (matches the lever hierarchy):

1. **E-invoicing flow (sandbox)** — contract → invoice → KSeF/XRechnung/ZATCA submit → accepted. Deterministic "it just goes through." This is the hook.
2. **Contractor ops** — onboarding, contract repository, payments, approvals, timesheets. The sticky platform.
3. **Evidence/audit layer** — the DRV defense-bundle PDF / reasonable-care audit trail. "Be audit-ready; your adviser decides." (NOT the verdict screen.)
4. **Per-geo flavour** — for SA prospects, the Saudization dashboard (arithmetic, safe). For PL, the KSeF readiness. For DE, the E-Rechnung flow.

Keep it under 10 minutes of the 15-min call; leave 5 for their questions.

## Operational runbook (wave 1)

1. `pnpm seed:qa --profile=showcase` → golden tenant ready. Re-run before a demo-heavy day for a clean state.
2. Set the demo org's KSeF/ZATCA/Peppol connections to sandbox/test.
3. Record one Loom per language walking the demo narrative above (ASSET-01/02/03).
4. On each booked call, screen-share the golden tenant; pick the geo-flavour matching the prospect.
5. For a hot SQL who's clearly buying, offer a Tier-3 personalized demo as the next step (seed their company name + contractor count).

## Asset / task list (added to asset_specs.csv)

- ASSET-23 — Golden demo tenant stood up + sandbox connections set
- ASSET-24 — "DEMO DATA" watermark (Gate 3)
- ASSET-25 — Classification-UI positioning reconciliation (Gate 1) — product task, blocks showing classification in demo
- ASSET-26 — (wave 1.5) 2–3 segment-flavoured demo seeds
- ASSET-27 — (wave 1.5/M2) shared self-serve sandbox: watermark + auto-reset cron + read-mostly guardrails
