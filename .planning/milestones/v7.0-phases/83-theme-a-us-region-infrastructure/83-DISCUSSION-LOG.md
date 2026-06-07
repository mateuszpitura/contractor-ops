# Phase 83: Theme A — US Region Infrastructure - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 83-theme-a-us-region-infrastructure
**Areas discussed:** US region assignment trigger, US R2 bucket shape, Retention policy + periods, Hard-delete protection

---

## US region assignment trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Creation-time, immutable | dataRegion set at org creation, immutable; US = new US-billing orgs; add-on orthogonal (no data move). | ✓ |
| Derived from us-cross-border add-on | Buying the add-on sets/flips region — couples residency to a SKU + implies cross-DB move. | |
| Admin-switchable post-creation | Allows EU→US later — needs full cross-regional data move + dual-write. | |

**User's choice:** Creation-time, immutable (recommended).
**Notes:** EU-org-serving-US-contractor residency nuance deferred to legal adviser. Cross-region read replicas stay off by default (US-INFRA-01).

---

## US R2 bucket shape

| Option | Description | Selected |
|--------|-------------|----------|
| One US regional bucket | Extend REGION_BUCKET_MAP with R2_BUCKET_NAME_US (optional env, lazy-throw); all US-org files incl. tax archives. | ✓ |
| Dedicated tax-archive bucket | Separate bucket for tax forms — extra isolation, extra routing for marginal benefit while LOCAL-ONLY. | |

**User's choice:** One US regional bucket (recommended).
**Notes:** Mirrors EU/ME exactly; reuses the DATABASE_URL_US optional/lazy pattern from Phase 82.

---

## Retention policy + periods

| Option | Description | Selected |
|--------|-------------|----------|
| Light reusable policy map | Typed record-type→years map + resolver; 1099-NEC=4yr, backup-withholding=7yr; reusable so AKTA-02 extends it. | ✓ |
| US-tax-specific constants only | Hardcode 4/7yr against tax models; AKTA-02 rebuilds retention later. | |

**User's choice:** Light reusable policy map (recommended).
**Notes:** Keep it light (map + resolver), graduate to DB table only on a real edit need.

---

## Hard-delete protection

| Option | Description | Selected |
|--------|-------------|----------|
| Centralized guard at delete chokepoints | Retention-aware soft-delete.ts + policy-aware data-purge cron + gdpr.ts soft-delete-with-exemption. | ✓ |
| Service-layer assertion only | Helper callers must invoke — misses leak hard-deletes; doesn't protect cron/GDPR paths. | |

**User's choice:** Centralized guard (recommended).
**Notes:** The cron-purge and GDPR-erasure paths are the real risk; guarding the chokepoints is the only robust guarantee. Build now; Phase 86 tax models opt in.

---

## Claude's Discretion

- dataRegion representation (Prisma enum migration vs string) — per current schema.
- Retention-policy storage (const map vs DB table) — start const.
- Create-org region selection UI placement (en-US not required — Phase 84).

## Deferred Ideas

- EU/ME-org-serving-US-contractor tax-data residency — legal adviser.
- Admin region switch / cross-regional-DB move — out of scope (immutable region).
- US read replica active path — off by default.
- Retention policy as editable DB table — graduate only on need.
