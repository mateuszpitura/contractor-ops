# Phase 48: ZATCA Fatoorah Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 48-ZATCA Fatoorah Integration
**Areas discussed:** Device onboarding flow, Cryptographic pipeline, Submission & status tracking, Sandbox & testing

---

## Device Onboarding Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step wizard in settings | Multi-step: tax details → CSR → CSID → compliance → production cert | ✓ |
| Single-page setup form | All fields on one page, background processing | |
| You decide | Claude picks | |

**User's choice:** Step-by-step wizard in settings

| Option | Description | Selected |
|--------|-------------|----------|
| Encrypted in DB (existing pattern) | AES-256-GCM per-provider, consistent with KSeF | |
| External secret store | Dedicated SaaS secret manager | ✓ |
| You decide | Claude picks | |

**User's choice:** External secret store

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel Environment Variables | Per-org cert as env var. Limited at scale. | |
| Infisical / Doppler | SaaS secret manager with per-org scoping | ✓ |
| AWS Secrets Manager | Enterprise-grade. Overkill for current scale. | |
| You decide | Claude picks | |

**User's choice:** Infisical / Doppler
**Notes:** Purpose-built for per-tenant secrets. Deviation from KSeF DB pattern — research should evaluate both.

---

## Cryptographic Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential queue per org | Per-org mutex/FIFO. Guarantees correct chain ordering. | ✓ |
| Optimistic locking with retry | Try current hash, retry on conflict. Faster but complex. | |
| You decide | Claude picks | |

**User's choice:** Sequential queue per org
**Notes:** ZATCA spec requires sequential ordering — no shortcuts.

---

## Submission & Status Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Async via QStash queue | Fire-and-forget. Status tracked per invoice. | ✓ |
| Synchronous on invoice creation | Block until ZATCA responds. Immediate but slow. | |
| You decide | Claude picks | |

**User's choice:** Async via QStash queue

---

## Sandbox & Testing

| Option | Description | Selected |
|--------|-------------|----------|
| Environment flag per connection | sandbox/production flag per ZATCA connection. Same code, different config. | ✓ |
| Separate deployment environments | Different Vercel environments. More infra. | |
| You decide | Claude picks | |

**User's choice:** Environment flag per connection
**Notes:** Matches KSeF environment enum pattern.

---

## Claude's Discretion

- CSR generation details, XAdES algorithms, TLV encoding
- Hash chain storage model
- ZATCA API error handling/retry
- Infisical vs Doppler selection
- Compliance onboarding check flow

## Deferred Ideas

None — discussion stayed within phase scope.
