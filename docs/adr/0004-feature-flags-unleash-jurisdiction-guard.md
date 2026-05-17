# 4. Feature flags via self-hosted Unleash + jurisdiction guard

Date: 2026-05-17
Status: Accepted

## Context

Feature flagging needs to satisfy three constraints that ruled out the
obvious SaaS choices (LaunchDarkly, Statsig, Split):

1. **Data residency.** Flag-evaluation requests carry user/tenant
   identifiers and contextual attributes. For ME tenants those payloads
   must not leave the regulated region. SaaS feature-flag vendors
   typically pin their evaluation endpoints to US or EU regions.
2. **Cost predictability.** SaaS flag pricing scales per monthly-active
   user / per-evaluation. For a B2B platform with very high evaluation
   counts per session this is significant and unbounded.
3. **Jurisdiction short-circuit.** Many flags ("show DRV signing flow",
   "enable HMRC IR35 banner", "expose KSeF e-invoice export") are
   binary functions of `org.countryCode`. Round-tripping the SDK for a
   deterministic answer is wasteful and obscures intent in code review.

## Decision

We run **self-hosted Unleash OSS**, one deployment per region
(`unleash-eu`, `unleash-me`), as private services on Render's internal
network. The application talks to them via the official Unleash Node
SDK over the private hostname (no public exposure; admin UI is gated by
the `cloudflared` Zero Trust tunnel).

On top of the SDK we ship `packages/feature-flags`, a tiny **typed
registry** that wraps every flag in a thin function. The registry
encodes:
- The flag key.
- A typed default for safe-by-default behaviour when Unleash is
  unreachable.
- An optional **jurisdiction short-circuit** — a synchronous predicate
  on `org.countryCode` evaluated **before** the SDK call. If the
  short-circuit returns a deterministic answer, we never hit Unleash.

## Consequences

**Good**
- ME flag evaluations stay in-region (`unleash-me`).
- Zero per-evaluation cost — only Render instance cost.
- Compile-time typed flag keys; rename refactors are mechanical.
- Jurisdiction-bound flags read like normal code (`if
  (showKsefExport(org)) {...}`) instead of obscuring intent behind a
  flag-eval call.
- Falling back to the typed default on Unleash outage means flag
  infrastructure is not a single point of failure for the request path.

**Bad**
- Two more services to operate (`unleash-eu`, `unleash-me`) plus the
  cloudflared tunnel for admin access. Operational runbook in
  `docs/DEPLOYMENT-RENDER.md`.
- Bootstrap requires `INIT_ADMIN_API_TOKENS` set per region — a manual
  step on first-time setup.
- Flag changes do not replicate cross-region — every change must be
  applied twice (acceptable for low-frequency editorial actions; not
  acceptable for experiments — those should be region-local by design).
- The registry layer is bespoke. Anyone touching it needs to read the
  package README first; it is not the raw Unleash SDK.
