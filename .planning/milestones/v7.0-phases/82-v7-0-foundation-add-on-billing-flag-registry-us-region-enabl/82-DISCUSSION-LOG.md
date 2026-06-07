# Phase 82: v7.0 Foundation — Add-On Billing + Flag Registry + US Region Enablement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl
**Areas discussed:** Add-on storage model, Add-on grant mechanism, US region resolution (local), IRIS TCC artifact

---

## Add-on storage model

| Option | Description | Selected |
|--------|-------------|----------|
| `addOns[]` on Subscription | Denormalized String[]/enum[] on existing Subscription; `requireAddOn` reads from the same Redis-cached `getSubscription()` as `requireTier` — zero extra query. Keys centralized in one const. | ✓ |
| Normalized `OrgAddOn` table | New table (orgId, addOn, grantedAt, status, billingRef) + own audit/metadata; adds a second fetch/cache + a join `requireTier` doesn't pay. | |

**User's choice:** `addOns[]` on Subscription (recommended).
**Notes:** ROADMAP explicitly deferred this decision to discussion. Array wins because it composes with the existing `getSubscription` read path; per-add-on metadata is low value while LOCAL-ONLY + Stripe deferred (normalized table noted as deferred-revisit).

---

## Add-on grant mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Admin + seed toggle, Stripe deferred | Entitlement via `seed-dev.ts` + owner-gated audit-logged admin mutation; real Stripe SKU/checkout/webhook-sync deferred to billing go-live. | ✓ |
| Wire real Stripe add-on SKUs now | Price IDs + checkout line items + webhook entitlement sync this phase; heavy, not exercisable locally without live Stripe; conflicts with LOCAL-ONLY. | |

**User's choice:** Admin + seed toggle, Stripe deferred (recommended).
**Notes:** Phase 82 ships the entitlement primitive only; v3.0 Stripe checkout untouched.

---

## US region resolution (local)

| Option | Description | Selected |
|--------|-------------|----------|
| Optional env, lazy-throw on use | `DATABASE_URL_US` optional; `getRegionalClient('US')` throws only on access; scripts skip-on-missing; `buildLazyBag` accepts US w/o EU coercion; lockstep test needs no live US DB. | ✓ |
| Alias US→EU dev DB locally | Point `DATABASE_URL_US` at EU dev URL to exercise US orgs locally; risks cross-region data confusion; kept as optional documented dev convenience. | |
| Required env (blocks boot) | Make `DATABASE_URL_US` mandatory; rejected — breaks local dev. | |

**User's choice:** Optional env, lazy-throw on use (recommended).
**Notes:** Matches existing `getRegionalClient` lazy-throw + `seed-dev.ts` skip-on-missing. Alias-to-EU retained as opt-in dev convenience layered on top.

---

## IRIS TCC artifact

| Option | Description | Selected |
|--------|-------------|----------|
| Planning/ops doc in .planning | `IRIS-TCC-ENROLLMENT.md` records ~45-day lead + start-date dependency, cross-linked to Phase 86; no app code; honest for LOCAL-ONLY. | ✓ |
| Tracked in-app onboarding task | Seed an admin checklist item that "starts the clock"; fake state until Phase 86 IRIS integration — product theater. | |

**User's choice:** Planning/ops doc in .planning (recommended).
**Notes:** TCC enrollment is a real IRS ops action; nothing files until Phase 86 (US-FORM-05). Reinforced the "no product theater" preference.

---

## Claude's Discretion

- Add-on key type: string-literal union `const` vs Prisma enum (must be centralized + shared by middleware/seed/admin mutation).
- Naming of the admin grant mutation + host router.
- Whether the region lockstep test lives in `packages/db` or `packages/api`.

## Deferred Ideas

- Real Stripe add-on SKU purchase flow (price IDs, checkout, webhook entitlement sync) — billing go-live.
- US read-replica (`DATABASE_URL_US_RO`) — off by default per US-INFRA-01.
- Normalized `OrgAddOn` table with per-add-on billing metadata — revisit if seat/billing metadata needed.
