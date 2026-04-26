# Phase 25: Portal E-Sign Auth Fix - Research

**Researched:** 2026-03-30
**Domain:** tRPC auth middleware, portal signing flow
**Confidence:** HIGH

## Summary

Phase 25 fixes the broken portal contractor signing flow. The `EmbeddedSigningModal` component calls `trpc.esign.getSigningUrl` which is protected by `tenantProcedure` (admin auth). Portal contractors authenticate via `portal_session` httpOnly cookie and use `portalProcedure` middleware -- they have no admin session, so the call returns UNAUTHORIZED.

The fix is surgical: add a `getPortalSigningUrl` procedure using `portalProcedure` to the esign router, with an authorization check that the requesting contractor's email matches a recipient on the envelope. Then update `EmbeddedSigningModal` to accept a `usePortalAuth` prop that switches the tRPC call to the portal-scoped procedure.

**Primary recommendation:** Add one new `portalProcedure` endpoint to `esign.ts` and a single prop to `EmbeddedSigningModal` -- no architectural changes needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIGN-02 | Signer can sign documents within Contractor Ops (embedded/redirect flow) | Portal signing URL endpoint via portalProcedure + EmbeddedSigningModal portal mode |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation lookup
- Strong typing, no unsafe shortcuts
- Schema validation for all external inputs (Zod)
- Security: least-privilege access, authorization checks, no internal detail exposure
- RLS and database-level protections where relevant
- Clean architecture, SOLID, separation of concerns
- Production-grade code, not demo-grade shortcuts
- Proper error handling, no silent failures

## Architecture Patterns

### Current E-Sign Router Structure

The `esignRouter` in `packages/api/src/routers/esign.ts` already mixes auth strategies:
- **7 procedures** use `tenantProcedure` (admin auth)
- **1 procedure** uses `portalProcedure`: `listPendingForContractor`

This means `portalProcedure` is already imported and used in this file. Adding another portal procedure follows the established pattern exactly.

### Portal Auth Middleware Context

`portalProcedure` (from `packages/api/src/middleware/portal-auth.ts`) provides:
- `ctx.portalSession` -- full session object
- `ctx.contractorId` -- contractor's ID
- `ctx.organizationId` -- org scope (used for tenant-scoped queries)
- `ctx.contractor` -- contractor record (includes `email`)
- `ctx.portalSubdomain` -- supplementary metadata

Key: `ctx.contractor.email` is available to match against `SigningRecipient.email`.

### Signing URL Generation Flow

```
EmbeddedSigningModal
  -> trpc.esign.getSigningUrl (tenantProcedure -- BREAKS for portal)
    -> esign-orchestrator.getSigningUrl(params)
      -> prisma.signingEnvelope.findFirst (org-scoped)
      -> getProviderSigningUrl (DocuSign/Autenti SDK call)
      -> return { embedded: true, url, expiresAt }
```

The orchestrator function `getSigningUrl` takes `{ organizationId, envelopeId, recipientEmail, returnUrl }` -- it does NOT require `userId` or admin context. This means the portal procedure can call the same orchestrator function directly, just adding an authorization gate.

### Pattern: Portal Authorization Gate

The new procedure must verify the requesting contractor is actually a recipient of the envelope. This is a critical security check to prevent contractor A from generating a signing URL for contractor B's envelope.

```typescript
// Authorization: verify contractor is a recipient
getPortalSigningUrl: portalProcedure
  .input(getSigningUrlInput)
  .query(async ({ ctx, input }) => {
    // 1. Check envelope exists in this org
    const envelope = await prisma.signingEnvelope.findFirst({
      where: { id: input.envelopeId, organizationId: ctx.organizationId },
      include: { recipients: { select: { email: true } } },
    });

    if (!envelope) throw UNAUTHORIZED;

    // 2. Verify contractor's email is a recipient
    const isRecipient = envelope.recipients.some(
      r => r.email.toLowerCase() === ctx.contractor.email.toLowerCase()
    );
    if (!isRecipient) throw UNAUTHORIZED;

    // 3. Delegate to existing orchestrator
    return getSigningUrl({
      organizationId: ctx.organizationId,
      envelopeId: input.envelopeId,
      recipientEmail: input.recipientEmail,
      returnUrl: input.returnUrl,
    });
  })
```

### EmbeddedSigningModal Update Pattern

The modal currently uses:
```typescript
const signingUrlQuery = useQuery(
  trpc.esign.getSigningUrl.queryOptions(...)
);
```

The fix adds a `usePortalAuth` prop that switches the tRPC procedure:
```typescript
type EmbeddedSigningModalProps = {
  // ... existing props
  usePortalAuth?: boolean;  // NEW
};

// Inside component:
const queryOptions = usePortalAuth
  ? trpc.esign.getPortalSigningUrl.queryOptions(queryInput, { enabled })
  : trpc.esign.getSigningUrl.queryOptions(queryInput, { enabled });

const signingUrlQuery = useQuery(queryOptions);
```

### PortalPendingSignatures Integration

`portal-pending-signatures.tsx` already renders `EmbeddedSigningModal`. The only change needed is passing `usePortalAuth={true}`:

```typescript
<EmbeddedSigningModal
  // ... existing props
  usePortalAuth  // NEW
/>
```

### Anti-Patterns to Avoid

- **Shared procedure with runtime auth detection:** Do NOT create a single procedure that detects whether it's portal or admin context. Keep `tenantProcedure` and `portalProcedure` separate -- the middleware enforces different auth contracts.
- **Skipping recipient verification:** The portal signing URL MUST verify the contractor is a recipient. Without this, any authenticated portal contractor could generate signing URLs for any envelope in their org.
- **Case-sensitive email comparison:** Email comparison must be case-insensitive (`.toLowerCase()` on both sides).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portal auth | Custom cookie parsing | Existing `portalProcedure` middleware | Already validates session, provides contractor context |
| Signing URL generation | Custom DocuSign/Autenti API calls | Existing `getSigningUrl` orchestrator | Handles provider abstraction, envelope lookup, URL generation |
| Org scoping | Manual WHERE clause | `tenantStore.run()` via portalProcedure | portalProcedure already wraps in tenantStore.run() |

## Common Pitfalls

### Pitfall 1: Email Case Mismatch
**What goes wrong:** Contractor email stored as `john@example.com` but signing recipient created as `John@Example.com` -- comparison fails, contractor can't sign.
**Why it happens:** DocuSign/Autenti may normalize emails differently than the contractor record.
**How to avoid:** Always compare emails with `.toLowerCase()` on both sides.
**Warning signs:** Contractor sees pending signatures but "Sign Now" returns error.

### Pitfall 2: Missing recipientEmail in Portal Context
**What goes wrong:** `EmbeddedSigningModal` receives `recipientEmail` from `PortalPendingSignatures` -- this is the contractor's email from the signing recipient record, not from the portal session.
**Why it happens:** The `recipientEmail` param in `getSigningUrl` must match the email used when the envelope was created with the provider.
**How to avoid:** Keep using `item.recipientEmail` from the `listPendingForContractor` query (which comes from `SigningRecipient.email`), not `ctx.contractor.email`.
**Warning signs:** URL generation fails at the DocuSign API level with "recipient not found".

### Pitfall 3: Forgetting Return Type Consistency
**What goes wrong:** `getPortalSigningUrl` returns a different shape than `getSigningUrl`, breaking the modal's type assertions.
**Why it happens:** Copy-paste error or different error handling.
**How to avoid:** Both procedures call the same `getSigningUrl` orchestrator function -- the return type is inherently the same.

### Pitfall 4: tRPC Query Options Type Mismatch
**What goes wrong:** `useQuery` with conditional `queryOptions` fails TypeScript because the two procedures might have slightly different inferred types.
**Why it happens:** Even with same input/output, tRPC infers separate types per procedure.
**How to avoid:** Both procedures use the same `getSigningUrlInput` schema and return the same `getSigningUrl` orchestrator result. The `as any` cast already exists on line 67 of the modal. Ensure the conditional expression is well-typed or use a shared result type.

## Code Examples

### New Portal Signing URL Procedure

```typescript
// In packages/api/src/routers/esign.ts
// Source: Follows existing listPendingForContractor pattern in same file

getPortalSigningUrl: portalProcedure
  .input(getSigningUrlInput)
  .query(async ({ ctx, input }) => {
    // Verify contractor is a recipient of this envelope
    const envelope = await prisma.signingEnvelope.findFirst({
      where: {
        id: input.envelopeId,
        organizationId: ctx.organizationId,
      },
      include: {
        recipients: { select: { email: true } },
      },
    });

    if (!envelope) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Envelope not found" });
    }

    const contractorEmail = ctx.contractor?.email?.toLowerCase();
    const isRecipient = envelope.recipients.some(
      (r) => r.email.toLowerCase() === contractorEmail,
    );

    if (!isRecipient) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not a recipient of this envelope",
      });
    }

    // Delegate to existing orchestrator (same as admin getSigningUrl)
    return getSigningUrl({
      organizationId: ctx.organizationId,
      envelopeId: input.envelopeId,
      recipientEmail: input.recipientEmail,
      returnUrl: input.returnUrl,
    });
  }),
```

### EmbeddedSigningModal with Portal Auth Prop

```typescript
// In apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx

type EmbeddedSigningModalProps = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
  provider: "DOCUSIGN" | "AUTENTI";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  usePortalAuth?: boolean; // NEW: switches to portal-scoped procedure
};

// Inside component, replace the query:
const queryInput = { envelopeId, recipientEmail, returnUrl };
const queryEnabled = { enabled: open && !!envelopeId && !!returnUrl };

const signingUrlQuery = useQuery(
  usePortalAuth
    ? trpc.esign.getPortalSigningUrl.queryOptions(queryInput, queryEnabled)
    : trpc.esign.getSigningUrl.queryOptions(queryInput, queryEnabled),
);
```

## Affected Files

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/api/src/routers/esign.ts` | Add procedure | New `getPortalSigningUrl: portalProcedure` |
| `apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx` | Modify | Add `usePortalAuth` prop, conditional query |
| `apps/web/src/components/portal/portal-pending-signatures.tsx` | Modify | Pass `usePortalAuth` to EmbeddedSigningModal |
| `packages/api/src/routers/__tests__/esign.test.ts` | Modify | Add test stub for portal signing URL |

**Total: 4 files, ~40 lines of changes.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `packages/api/vitest.config.ts` (or workspace root) |
| Quick run command | `npx vitest run packages/api/src/routers/__tests__/esign.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIGN-02 | Portal contractor can get signing URL via portalProcedure | unit | `npx vitest run packages/api/src/routers/__tests__/esign.test.ts` | Partial (file exists, needs new test) |
| SIGN-02 | Non-recipient contractor is rejected (FORBIDDEN) | unit | `npx vitest run packages/api/src/routers/__tests__/esign.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/api/src/routers/__tests__/esign.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/routers/__tests__/esign.test.ts` -- add `getPortalSigningUrl` test stubs (recipient verified, non-recipient rejected)

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `packages/api/src/routers/esign.ts` -- all 8 procedures analyzed
- Direct code inspection of `packages/api/src/middleware/portal-auth.ts` -- full portalProcedure middleware chain
- Direct code inspection of `packages/api/src/services/esign-orchestrator.ts` -- getSigningUrl function signature and logic
- Direct code inspection of `apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx` -- tRPC query usage
- Direct code inspection of `apps/web/src/components/portal/portal-pending-signatures.tsx` -- EmbeddedSigningModal integration
- `apps/web/next.config.ts` -- CSP frame-src already includes DocuSign domains

### Secondary (MEDIUM confidence)
- v2.0 Milestone Audit (`.planning/v2.0-MILESTONE-AUDIT.md`) -- gap analysis and recommended fix

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing code patterns
- Architecture: HIGH -- direct code inspection of all involved files
- Pitfalls: HIGH -- well-understood auth boundary, single integration point

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- internal codebase patterns)
