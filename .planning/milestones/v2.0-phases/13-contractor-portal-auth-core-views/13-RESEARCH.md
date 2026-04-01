# Phase 13: Contractor Portal Auth & Core Views - Research

**Researched:** 2026-03-23
**Domain:** Custom portal authentication, org-scoped contractor sessions, read/write views for contracts/invoices/documents/payments
**Confidence:** HIGH

## Summary

This phase builds a contractor-facing portal within the existing Next.js app using a `(portal)` route group alongside `(auth)` and `(dashboard)`. The critical architectural decision is that contractors are NOT internal users -- they get a separate `PortalSession` Prisma model, not Better Auth's `Session` table. This means we build custom magic-link token generation, verification, and cookie-based session management outside of Better Auth, while reusing the existing `sendMagicLink` email infrastructure pattern.

The portal reads from existing data models (Contract, Invoice, Document, PaymentRunItem) with org-scoped queries via the established `tenantStore` AsyncLocalStorage pattern, but through a new `portalProcedure` tRPC middleware that authenticates via `PortalSession` instead of `User`/`Session`. Invoice submission is the only write operation and must enter the existing intake pipeline (RECEIVED status, auto-matching, approval flow) with a new `PORTAL` InvoiceSource enum value.

**Primary recommendation:** Build PortalSession as a custom Prisma model with its own middleware stack. Do NOT attempt to extend Better Auth's User/Session tables -- the decision to keep contractors out of the internal user table (D-13) is correct and avoids permission contamination between admin and portal surfaces.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Minimal top bar navigation -- org logo + name on left, nav links center (Overview, Contracts, Invoices, Documents, Payments), profile/logout on right. No sidebar
- **D-02:** Overview dashboard as landing page -- summary cards showing active contracts count, pending invoices, recent payments, upcoming deadlines. Quick actions: Submit invoice, View contracts
- **D-03:** Responsive down to mobile (375px+) -- top bar collapses to hamburger menu on small screens
- **D-04:** Same design system as admin, lighter feel -- reuse shadcn/ui components, same colors/typography, simpler layouts
- **D-05:** Portal lives in `(portal)` route group alongside `(auth)` and `(dashboard)`
- **D-06:** Upload PDF + minimal metadata -- invoice number, issue date, due date, net amount, gross amount
- **D-07:** Single invoice at a time -- one PDF + metadata per submission
- **D-08:** Contractor picks which contract the invoice is for -- dropdown of active contracts, auto-select if only 1
- **D-09:** Success page with summary after submission
- **D-10:** Three-layer status visibility -- badges on list + timeline on detail + filtered activity log
- **D-11:** Activity log filters out internal events
- **D-12:** Payment details show date + amount only
- **D-13:** PortalSession model separate from internal User/Session
- **D-14:** Magic link with 7-day session duration
- **D-15:** Org picker after login for multi-org contractors
- **D-16:** Dual access trigger: org invites + contractor self-request
- **D-17:** Better Auth magicLink plugin already configured -- reuse existing plugin, extend with portal-specific session handling

### Claude's Discretion
- Overview dashboard card layout and exact metrics displayed
- Invoice form field validation rules and error messaging
- Status timeline step indicator component design
- Activity log entry formatting and timestamp display
- Hamburger menu animation and mobile nav behavior
- Empty states for all portal sections
- Loading skeleton patterns for portal pages
- Public login page layout and copy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORT-01 | Contractor can log in via magic link with org-scoped access | Custom PortalSession model + magic link token gen + org picker flow; see Architecture Patterns section |
| PORT-02 | Contractor can view own active contracts and terms (read-only) | portalProcedure middleware + Contract/ContractRatePeriod queries scoped to contractor's records |
| PORT-03 | Contractor can submit invoices via portal that enter org's intake pipeline | Invoice create with source=PORTAL, document upload via R2 presigned URLs, enter matching pipeline |
| PORT-04 | Contractor can track invoice and payment status through approval and payment | Three-layer status (badges + timeline + activity log) reading Invoice status/matchStatus/approvalStatus/paymentStatus + PaymentRunItem |
| PORT-05 | Contractor can view and download own documents (contracts, NDAs, tax forms) | DocumentLink queries by entityType=CONTRACTOR + entityId, presigned download URLs from R2 |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (existing) | App framework, route groups | Already in use; `(portal)` route group pattern |
| Prisma | 7.x (existing) | ORM for PortalSession + all data models | Existing schema infrastructure |
| tRPC | 11.x (existing) | Type-safe API layer | Existing router pattern; new `portal` sub-router |
| Better Auth | ^1.5.0 (existing) | Magic link email sending only | Reuse `sendMagicLink` callback; NOT for portal sessions |
| React Hook Form + Zod | existing | Invoice submission form | Established pattern in codebase |
| TanStack Query | existing | Server state for portal views | Established pattern via tRPC integration |
| shadcn/ui | existing | UI components | D-04: same design system as admin |
| next-intl | existing | i18n (Polish + English) | Established `useTranslations()` pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 + s3-request-presigner | existing | R2 presigned URLs for invoice upload + document download | Invoice submission (upload) and document viewing (download) |
| nuqs | existing | URL-synced state for invoice list filters | Invoice/contract list pages |
| crypto (Node built-in) | N/A | Token generation, session token hashing | Portal magic link tokens, session tokens |
| sonner | existing | Toast notifications | Form feedback, submission confirmations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom PortalSession | Better Auth User with role flag | Would violate D-13; risks permission leaks between admin/portal |
| Custom magic link handling | Better Auth magicLink flow directly | Better Auth creates User records on magic link signup; contractors must NOT be in User table |
| Separate Next.js app | Route group in same app | Route group shares auth, DB, tRPC, UI packages (D-05); separate app adds deployment complexity |

## Architecture Patterns

### Recommended Project Structure
```
packages/db/prisma/schema/
  portal.prisma                    # PortalSession, PortalMagicToken models

packages/api/src/
  middleware/
    portal-auth.ts                 # portalAuthMiddleware + portalProcedure
  routers/
    portal.ts                      # Portal-specific tRPC router (or sub-routers)
  services/
    portal-session.ts              # Session creation, validation, token generation

apps/web/src/app/[locale]/(portal)/
  layout.tsx                       # Portal layout (top bar, no sidebar)
  page.tsx                         # Overview dashboard (D-02)
  login/page.tsx                   # Public login page (email entry)
  login/verify/page.tsx            # Magic link verification + org picker
  contracts/page.tsx               # Contract list
  contracts/[id]/page.tsx          # Contract detail
  invoices/page.tsx                # Invoice list with status badges
  invoices/[id]/page.tsx           # Invoice detail with timeline + activity log
  invoices/submit/page.tsx         # Invoice submission form
  invoices/submit/success/page.tsx # Submission success page (D-09)
  documents/page.tsx               # Document list
  payments/page.tsx                # Payment history

apps/web/src/components/portal/
  portal-top-bar.tsx               # Top bar navigation (D-01)
  portal-mobile-menu.tsx           # Hamburger menu for mobile (D-03)
  status-timeline.tsx              # Horizontal step timeline (D-10)
  activity-log.tsx                 # Filtered activity log (D-11)
  invoice-submit-form.tsx          # Invoice upload + metadata form
  contract-card.tsx                # Contract summary card
  dashboard-cards.tsx              # Overview summary cards
```

### Pattern 1: Custom PortalSession Authentication
**What:** A complete custom auth flow parallel to Better Auth, using Prisma models and HTTP-only cookies
**When to use:** When the portal user (contractor) must NOT exist in the internal User table

**Database models:**
```prisma
// portal.prisma
model PortalSession {
  id               String    @id @default(cuid())
  token            String    @unique
  contractorId     String
  organizationId   String
  email            String
  expiresAt        DateTime
  ipAddress        String?
  userAgent        String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  contractor       Contractor   @relation(fields: [contractorId], references: [id])
  organization     Organization @relation(fields: [organizationId], references: [id])

  @@index([token])
  @@index([email])
  @@index([contractorId, organizationId])
  @@index([expiresAt])
}

model PortalMagicToken {
  id          String   @id @default(cuid())
  email       String
  token       String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([token])
  @@index([email])
}
```

**Session flow:**
```typescript
// packages/api/src/services/portal-session.ts
import { randomBytes, createHash } from "node:crypto";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Create session after magic link verification + org selection
export async function createPortalSession(opts: {
  contractorId: string;
  organizationId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const rawToken = generateSessionToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days (D-14)

  await prisma.portalSession.create({
    data: {
      token: hashedToken,
      contractorId: opts.contractorId,
      organizationId: opts.organizationId,
      email: opts.email,
      expiresAt,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  });

  return { rawToken, expiresAt };
}
```

### Pattern 2: Portal tRPC Middleware
**What:** A `portalProcedure` analogous to `tenantProcedure` but authenticating via PortalSession cookie
**When to use:** All portal API routes

```typescript
// packages/api/src/middleware/portal-auth.ts
import { TRPCError } from "@trpc/server";
import { tenantStore } from "@contractor-ops/db";
import { t, publicProcedure } from "../init.js";
import { hashToken } from "../services/portal-session.js";

const portalAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const cookieHeader = ctx.headers.get("cookie") ?? "";
  const token = parsePortalCookie(cookieHeader); // Extract portal_session cookie

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const session = await prisma.portalSession.findUnique({
    where: { token: hashToken(token) },
    include: { contractor: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Run inside tenantStore for automatic org scoping
  return tenantStore.run({ organizationId: session.organizationId }, () =>
    next({
      ctx: {
        ...ctx,
        portalSession: session,
        contractorId: session.contractorId,
        organizationId: session.organizationId,
      },
    }),
  );
});

export const portalProcedure = publicProcedure.use(portalAuthMiddleware);
```

### Pattern 3: Magic Link Flow for Portal
**What:** Custom magic link generation and verification that finds Contractor records by email
**When to use:** Portal login

**Flow:**
1. Contractor enters email on portal login page
2. Server looks up Contractor records matching that email across all orgs
3. If found: generate PortalMagicToken, send email with link (reuse Resend/dev-log pattern)
4. If not found: show same "check your email" message (prevent email enumeration)
5. Contractor clicks link -> verify token -> if multi-org: show org picker -> create PortalSession
6. Set HTTP-only `portal_session` cookie, redirect to portal overview

### Pattern 4: Invoice Submission Pipeline Integration
**What:** Portal invoice submissions enter the same pipeline as admin uploads
**When to use:** PORT-03

```typescript
// In portal router
submitInvoice: portalProcedure
  .input(portalInvoiceSubmitSchema)
  .mutation(async ({ ctx, input }) => {
    // Verify contract belongs to this contractor
    const contract = await prisma.contract.findFirst({
      where: {
        id: input.contractId,
        contractorId: ctx.contractorId,
        status: "ACTIVE",
      },
    });

    if (!contract) throw new TRPCError({ code: "NOT_FOUND" });

    // Create invoice with PORTAL source
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: ctx.contractorId,
        contractId: input.contractId,
        invoiceNumber: input.invoiceNumber,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        subtotalGrosze: input.netAmountGrosze,
        totalGrosze: input.grossAmountGrosze,
        amountToPayGrosze: input.grossAmountGrosze,
        currency: contract.currency,
        source: "PORTAL",          // New enum value
        status: "RECEIVED",
        matchStatus: "UNMATCHED",
        submittedByEmail: ctx.portalSession.email,
      },
    });

    // Link uploaded document
    // Trigger auto-match pipeline (existing runAutoMatch)
    // Send notification to finance team

    return invoice;
  });
```

### Pattern 5: Contractor-Scoped Data Access
**What:** All portal queries filter by `contractorId` in addition to org scoping
**When to use:** Every portal read operation

```typescript
// Portal queries always double-scope: org (via tenantStore) + contractor
listContracts: portalProcedure.query(async ({ ctx }) => {
  return prisma.contract.findMany({
    where: {
      contractorId: ctx.contractorId,
      status: { in: ["ACTIVE", "EXPIRING"] },
    },
    orderBy: { startDate: "desc" },
  });
});
```

### Anti-Patterns to Avoid
- **Reusing Better Auth User table for contractors:** Violates D-13, creates permission leakage risk, and makes it impossible to have contractors that don't have admin access
- **Sharing session cookies between admin and portal:** Use a separate cookie name (`portal_session` vs Better Auth's cookie) to prevent cross-context auth
- **Exposing internal status details to contractors:** D-11 explicitly requires filtering; never return raw approval chain details, reviewer names, or batch IDs
- **Direct DB writes without pipeline:** Portal invoice submissions MUST go through the same pipeline (matching, approval) as admin uploads; never skip steps

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session token generation | Custom random string | `crypto.randomBytes(32).toString("base64url")` | Cryptographically secure, standard length |
| Token storage | Plain text tokens in DB | SHA-256 hash before storage | If DB is compromised, raw tokens are not exposed |
| File upload | Custom multipart handling | Presigned URLs via existing R2 service | Already built, handles large files, bypasses server memory |
| Form validation | Manual if/else | Zod schemas + React Hook Form | Established pattern, type-safe, handles edge cases |
| Email sending | Custom SMTP | Existing Resend pattern from auth config | Already configured with dev-mode console fallback |
| Invoice matching | Custom portal matching | Existing `runAutoMatch` service | Portal invoices must enter the same pipeline |
| Responsive navigation | Custom responsive logic | shadcn/ui Sheet component for mobile menu | Accessible, animated, well-tested |

**Key insight:** The portal is primarily a read-only view of existing data with one write path (invoice submission). Almost all the backend data access already exists -- the work is building the auth layer and the UI, not reimplementing business logic.

## Common Pitfalls

### Pitfall 1: Cookie Collision Between Admin and Portal
**What goes wrong:** Admin session cookie and portal session cookie use the same name, causing cross-auth issues
**Why it happens:** Default cookie naming doesn't account for two parallel auth systems
**How to avoid:** Use distinct cookie names: Better Auth uses its default (`better-auth.session_token`), portal uses `portal_session`. Set both with `httpOnly`, `secure`, `sameSite: lax`, and appropriate `path` attribute
**Warning signs:** Logging into admin breaks portal session or vice versa

### Pitfall 2: Email Enumeration on Portal Login
**What goes wrong:** Different responses for "email found" vs "email not found" allow attackers to discover which emails have contractor records
**Why it happens:** Eager error handling that tells users their email isn't registered
**How to avoid:** Always show "If an account exists, we've sent a magic link" regardless of whether a Contractor record was found. Same response timing for both paths
**Warning signs:** Portal login page shows "email not found" messages

### Pitfall 3: Leaking Internal Data to Contractors
**What goes wrong:** Portal views expose internal reviewer names, approval chain details, batch IDs, or cost center information
**Why it happens:** Reusing admin API responses without filtering fields
**How to avoid:** Create dedicated portal response DTOs that explicitly select only contractor-visible fields. Use Zod `.pick()` or manual `select` in Prisma queries. Never spread full objects into responses
**Warning signs:** Portal API returns fields like `internalOwnerUserId`, `costCenterId`, approval step details

### Pitfall 4: Missing Org Scoping on Portal Queries
**What goes wrong:** Contractor sees data from other organizations
**Why it happens:** Portal middleware sets org context but some queries bypass tenantStore
**How to avoid:** portalProcedure always runs inside `tenantStore.run()`. Additionally, always include `contractorId` filter -- contractors should only see THEIR records within the org
**Warning signs:** Multi-org contractor sees another org's data

### Pitfall 5: Portal Session Not Excluded from Tenant Scope
**What goes wrong:** PortalSession and PortalMagicToken queries fail because tenantStore tries to add organizationId
**Why it happens:** PortalMagicToken is not org-scoped (email can match multiple orgs), and session lookup happens before org context is set
**How to avoid:** Add `PortalSession` and `PortalMagicToken` to the `globalModels` set in `packages/db/src/tenant.ts`, or use raw prisma (not tenant-scoped) for these lookups
**Warning signs:** "Tenant context not initialized" errors during magic link verification

### Pitfall 6: InvoiceSource Enum Migration
**What goes wrong:** Adding `PORTAL` to `InvoiceSource` enum requires a Prisma migration that can fail if not done carefully
**Why it happens:** PostgreSQL enum alterations need `ALTER TYPE ... ADD VALUE`
**How to avoid:** Create a proper Prisma migration for the new enum value. Test migration on a copy of production data before deploying
**Warning signs:** Migration errors, deployment failures

## Code Examples

### Portal Login Page (email entry)
```typescript
// apps/web/src/app/[locale]/(portal)/login/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const schema = z.object({ email: z.string().email() });

export default function PortalLoginPage() {
  const [sent, setSent] = useState(false);
  const form = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    await fetch("/api/portal/magic-link", {
      method: "POST",
      body: JSON.stringify({ email: values.email }),
    });
    setSent(true); // Always show sent, regardless of email existence
  };

  if (sent) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground mt-2">
            If an account exists, we've sent a sign-in link.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className="text-2xl font-semibold">Contractor Portal</h1>
        <p className="text-muted-foreground">Sign in with your email</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input type="email" placeholder="you@company.com" {...form.register("email")} />
          <Button type="submit" className="w-full">Send magic link</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Portal Top Bar Navigation
```typescript
// apps/web/src/components/portal/portal-top-bar.tsx
"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { label: "Overview", href: "/portal" },
  { label: "Contracts", href: "/portal/contracts" },
  { label: "Invoices", href: "/portal/invoices" },
  { label: "Documents", href: "/portal/documents" },
  { label: "Payments", href: "/portal/payments" },
] as const;

export function PortalTopBar({ orgName, orgLogo }: { orgName: string; orgLogo?: string }) {
  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Org branding - left */}
        <div className="flex items-center gap-2 shrink-0">
          {orgLogo && <img src={orgLogo} alt="" className="h-8 w-8 rounded" />}
          <span className="font-semibold text-sm">{orgName}</span>
        </div>

        {/* Desktop nav - center */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}
              className="text-sm px-3 py-2 rounded-md hover:bg-accent transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="top" className="pt-10">
            <nav className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="text-lg py-2">
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Profile/logout - right */}
        <div className="ml-auto shrink-0">
          {/* Logout button */}
        </div>
      </div>
    </header>
  );
}
```

### Status Timeline Component
```typescript
// apps/web/src/components/portal/status-timeline.tsx
const STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "review", label: "In Review" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Payment Scheduled" },
  { key: "paid", label: "Paid" },
] as const;

// Map invoice statuses to timeline step index
function getActiveStep(invoice: {
  status: string;
  approvalStatus: string;
  paymentStatus: string;
}): number {
  if (invoice.paymentStatus === "PAID") return 4;
  if (invoice.paymentStatus === "IN_RUN") return 3;
  if (invoice.approvalStatus === "APPROVED") return 2;
  if (invoice.status === "UNDER_REVIEW" || invoice.status === "APPROVAL_PENDING") return 1;
  return 0; // RECEIVED = submitted
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Better Auth 1.x basic magic link | Better Auth 1.5+ with metadata, allowedAttempts, storeToken options | 2025-2026 | More control over token handling |
| Single session table for all users | Separate session models for different user classes | Common pattern | Prevents privilege escalation between user types |
| Server-side file uploads | Presigned URL uploads direct to R2/S3 | Established | Bypasses server memory limits, better UX |

**Deprecated/outdated:**
- None specific to this phase; all patterns are current

## Open Questions

1. **Portal cookie path scoping**
   - What we know: Using `path=/portal` would restrict the cookie to portal routes only, adding security
   - What's unclear: Whether Next.js API routes under `/api/trpc` (used by portal tRPC calls) would receive the cookie if path is restricted
   - Recommendation: Use `path=/` for the portal cookie but with a distinct name (`portal_session`). The portalProcedure middleware will only look for this specific cookie

2. **Multi-org contractor record linking**
   - What we know: D-15 says "link contractor records across orgs by email"
   - What's unclear: What if the same email is a Contractor in org A but uses a different email as a Contact in org B?
   - Recommendation: Match on `Contractor.email` field across organizations. The PortalMagicToken stores just the email; on verification, query all Contractor records matching that email to build the org picker list

3. **Activity log data source**
   - What we know: D-10 requires a "filtered activity log showing contractor-relevant events"
   - What's unclear: Whether there's an existing audit log or event system that tracks invoice status changes with timestamps
   - Recommendation: Check if the `audit.prisma` AuditLog model captures invoice status transitions. If not, derive activity from invoice timestamps (receivedAt, reviewedAt, approvedAt, paidAt) and create a computed activity list. This is simpler than building a separate event sourcing system

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/api && pnpm test` |
| Full suite command | `pnpm test` (turborepo) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-01 | Magic link sends token, verification creates PortalSession, cookie set | unit | `cd packages/api && pnpm vitest run src/services/__tests__/portal-session.test.ts -x` | -- Wave 0 |
| PORT-01 | portalProcedure rejects expired/invalid sessions | unit | `cd packages/api && pnpm vitest run src/middleware/__tests__/portal-auth.test.ts -x` | -- Wave 0 |
| PORT-01 | Multi-org contractor sees org picker with correct orgs | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal.test.ts -x` | -- Wave 0 |
| PORT-02 | Portal contract list returns only contractor's active contracts | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal.test.ts -x` | -- Wave 0 |
| PORT-03 | Invoice submission creates RECEIVED invoice with PORTAL source | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal.test.ts -x` | -- Wave 0 |
| PORT-03 | Invoice submission rejects contract not owned by contractor | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal.test.ts -x` | -- Wave 0 |
| PORT-04 | Invoice list returns statuses; detail includes timeline data | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal.test.ts -x` | -- Wave 0 |
| PORT-05 | Document list returns only contractor-linked documents | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal.test.ts -x` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/portal-session.test.ts` -- covers PORT-01 (session creation, token hashing, validation)
- [ ] `packages/api/src/middleware/__tests__/portal-auth.test.ts` -- covers PORT-01 (middleware auth/reject)
- [ ] `packages/api/src/routers/__tests__/portal.test.ts` -- covers PORT-01 through PORT-05 (router endpoints)

*(Existing vitest infrastructure in packages/api is sufficient -- no framework install needed)*

## Sources

### Primary (HIGH confidence)
- `packages/auth/src/config.ts` -- Current Better Auth setup with magicLink plugin, organization plugin, session config
- `packages/api/src/middleware/tenant.ts` -- tenantStore + tenantProcedure pattern (template for portalProcedure)
- `packages/api/src/middleware/auth.ts` -- authMiddleware pattern (template for portalAuthMiddleware)
- `packages/db/src/tenant.ts` -- AsyncLocalStorage tenant scoping with globalModels set
- `packages/db/prisma/schema/invoice.prisma` -- Invoice model, InvoiceSource enum, status enums
- `packages/db/prisma/schema/contractor.prisma` -- Contractor model with email field
- `packages/db/prisma/schema/contract.prisma` -- Contract model, Document/DocumentLink models
- `packages/api/src/routers/invoice.ts` -- Existing invoice create flow, matching pipeline integration
- `packages/api/src/services/r2.ts` -- Presigned URL generation for upload/download
- [Better Auth Magic Link docs](https://better-auth.com/docs/plugins/magic-link) -- Plugin options, sendMagicLink callback signature
- [Better Auth Session Management](https://better-auth.com/docs/concepts/session-management) -- Session config, cookie management

### Secondary (MEDIUM confidence)
- [Better Auth User & Accounts](https://better-auth.com/docs/concepts/users-accounts) -- Confirms magic link creates User records (reason to build custom for portal)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use in this exact codebase
- Architecture: HIGH -- patterns are direct extensions of existing middleware/router patterns
- Pitfalls: HIGH -- derived from reading actual codebase (tenant.ts globalModels, cookie naming, field exposure risks)
- Auth design: HIGH -- decision D-13 is clear; custom PortalSession is the only viable path given constraints

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- all patterns are established in codebase)
