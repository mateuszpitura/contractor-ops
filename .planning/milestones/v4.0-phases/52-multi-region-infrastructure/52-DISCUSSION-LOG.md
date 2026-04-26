# Phase 52: Multi-Region Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 52-Multi-Region Infrastructure
**Areas discussed:** Database region routing, File storage regionalization, Government API framework

---

## Database Region Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Separate Neon projects per region | EU + Frankfurt. True data residency isolation. | ✓ |
| Single Neon with read replicas | One primary, replicas. Doesn't satisfy data residency. | |
| You decide | Claude picks | |

**User's choice:** Separate Neon projects per region

| Option | Description | Selected |
|--------|-------------|----------|
| AsyncLocalStorage with regional clients | Extend existing tenant pattern. Pool of clients per region. | ✓ |
| Connection string swap per request | Dynamic client creation. Pooling issues. | |
| You decide | Claude picks | |

**User's choice:** AsyncLocalStorage with regional clients

---

## File Storage Regionalization

| Option | Description | Selected |
|--------|-------------|----------|
| Separate R2 bucket per region | EU + ME bucket. True data residency. | ✓ |
| Single bucket with region prefix | One bucket, prefixed paths. Data in one location. | |
| You decide | Claude picks | |

**User's choice:** Separate R2 bucket per region

---

## Government API Framework

| Option | Description | Selected |
|--------|-------------|----------|
| Shared base with profile hooks | Abstract base: cert auth, retry, rate limit, sandbox/prod, audit. Profiles extend. | ✓ |
| Minimal shared utilities | Utility functions only. Each profile builds own client. | |
| You decide | Claude picks | |

**User's choice:** Shared base with profile hooks

---

## Claude's Discretion

- Neon project provisioning, migration orchestration
- R2 bucket naming, region assignment UI
- Government API base class design, rate limiter impl

## Deferred Ideas

None — discussion stayed within phase scope.
