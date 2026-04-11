# Phase 52: Multi-Region Infrastructure - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add multi-region infrastructure: per-organization database region routing with separate Neon projects, regional R2 file storage buckets, and a shared government API integration framework with cert auth, retry, rate limiting, sandbox/prod modes, and audit logging.

</domain>

<decisions>
## Implementation Decisions

### Database Region Routing
- **D-01:** Separate Neon projects per region — EU project (existing) + Frankfurt project (ME fallback, per STATE.md). Each org assigned to a region at setup. Schema migrations run against all projects.
- **D-02:** Extend existing AsyncLocalStorage multi-tenant pattern — on each request, look up org's region → select the matching pre-initialized Prisma client from a pool. tRPC middleware sets the correct regional client in context. Consistent with existing tenant isolation.

### File Storage Regionalization
- **D-03:** Separate R2 bucket per region — EU bucket (existing) + ME bucket. Org's region determines which bucket receives uploads. Storage service resolves the correct bucket from org context. True data residency isolation.

### Government API Framework
- **D-04:** Shared abstract base class/interface covering: cert auth loading (from Infisical/Doppler), HTTP retry with exponential backoff, rate limiting per API, sandbox/prod URL switching, request/response audit logging. Profiles (ZATCA, Peppol, future markets) implement specifics by extending the base. Pattern already emerging from Phase 48/49 implementations.

### Claude's Discretion
- Neon project provisioning and connection string management
- Migration orchestration across multiple Neon projects
- R2 bucket naming and configuration
- Region assignment during org setup (UI integration with Phase 51 onboarding)
- Government API base class method signatures and error handling contracts
- Rate limiter implementation (Redis/Upstash-based or in-memory)
- Audit log format for government API requests/responses

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing infrastructure
- Neon serverless PostgreSQL configuration
- Cloudflare R2 storage configuration
- AsyncLocalStorage multi-tenant middleware

### Prior phase context
- `.planning/phases/48-zatca-fatoorah-integration/48-CONTEXT.md` — D-02: Infisical/Doppler for certs, D-05: QStash async submission
- `.planning/phases/49-peppol-pint-ae-integration/49-CONTEXT.md` — D-02: Same secret store, D-01: Abstract ASP adapter
- `.planning/phases/51-pdpl-compliance/51-CONTEXT.md` — D-04: Onboarding wizard integration

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- AsyncLocalStorage multi-tenant pattern — extend for region routing
- Prisma client initialization — template for regional clients
- R2 storage service — extend with bucket selection
- Upstash Redis — potential for rate limiting
- QStash — reusable for async government API operations

### Established Patterns
- Multi-tenant query scoping via Prisma extension
- AES-256-GCM credential encryption (being supplemented by Infisical/Doppler)
- IntegrationSyncLog for audit trails
- Fire-and-forget async processing

### Integration Points
- tRPC middleware — region-aware Prisma client selection
- File upload service — regional R2 bucket routing
- ZATCA profile (Phase 48) — uses government API framework
- Peppol profile (Phase 49) — uses government API framework
- Org setup wizard — region selection step

</code_context>

<specifics>
## Specific Ideas

- STATE.md: "Neon has no ME region — Frankfurt (aws-eu-central-1) is acceptable fallback"
- Government API framework should be in `packages/einvoice` or a new `packages/gov-api` — Claude's discretion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 52-multi-region-infrastructure*
*Context gathered: 2026-04-11*
