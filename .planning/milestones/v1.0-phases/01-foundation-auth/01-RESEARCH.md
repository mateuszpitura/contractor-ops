# Phase 1: Foundation & Auth - Research

**Researched:** 2026-03-18
**Domain:** Monorepo scaffolding, multi-tenant auth/RBAC, i18n, app shell
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation for the entire Contractor Ops platform: a Turborepo monorepo with Next.js 16, Prisma 7 (important: NOT v6 as originally planned -- v7 shipped with major breaking changes), Better Auth with organization plugin for multi-tenant RBAC, tRPC v11 for type-safe API, next-intl for Polish/English i18n, and a shadcn/ui-based app shell with collapsible sidebar. This is a greenfield project with zero existing code.

Key discoveries during research: Prisma is now at v7.5.0 with significant architectural changes (ESM-only, no more `node_modules` generation, `$use()` middleware removed, driver adapters required for Neon). Next.js is at 16.1.7 (not 15.x). Better Auth is at 1.5.5 with a mature organization plugin supporting custom roles and dynamic RBAC. tRPC is at 11.13.4. These version bumps from the original STACK.md research affect setup patterns.

**Primary recommendation:** Build the foundation as 4 sequential plans: (1) monorepo scaffold + database schema + CI, (2) Better Auth + RBAC + tenant isolation, (3) app shell + user management UI, (4) i18n framework. Use Prisma 7 with `@prisma/adapter-neon` driver adapter, integer grosze for currency storage, and single-team assignment per user for simplicity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Collapsible sidebar: full icons + labels, collapses to icon-only. Linear-style.
- Org switcher as dropdown at the top of the sidebar (above navigation items)
- Action-rich top bar: breadcrumb + global search trigger + quick action buttons (Add contractor, Upload invoice, etc.) + notifications bell + user avatar
- All 10 navigation items visible from day 1 (Dashboard, Contractors, Contracts, Workflows, Invoices, Approvals, Payments, Reports, Integrations, Settings) -- no progressive reveal
- Blue / Indigo accent color palette
- Light + dark mode from day 1, with system preference detection and manual toggle in settings
- User-configurable information density (comfortable vs compact) for tables and data-heavy views
- Stripe Dashboard as the aesthetic reference -- professional, data-dense, great tables and forms
- Desktop-first, responsive down to tablet (1024px)
- Multiple auth methods: email/password, magic link, and social OAuth (Google + Microsoft)
- Org creation happens during sign-up flow -- user enters org name in the same form, lands directly in their org
- Invite acceptance: click link -> create account (or use social) -> auto-join org with assigned role. No separate "accept invite" step.
- Strict 24-hour sessions. Re-authentication required for sensitive actions (payment runs, role changes, settings changes)
- Email verification required after sign-up
- 8 predefined roles only (no custom roles in v1): admin, finance admin, ops manager, team manager, legal/compliance viewer, IT admin, external accountant, readonly
- Unauthorized navigation items and actions are completely hidden (not disabled/grayed)
- User management screen: simple table with name, email, role, status, last login. Invite button at top. Role change via dropdown in table row.
- Permissions enforced at both tRPC procedure level and UI level
- Full database schema created in Phase 1 (all tables from db-schema.md) -- later phases use existing tables without migration churn
- Invoice line items with per-line VAT rate support (handles mixed-rate Polish invoices: 23%, 8%, 5%, 0%, ZW, NP)
- Soft delete via Prisma middleware (global auto-filter of deleted_at records, delete operations converted to soft-delete) -- NOTE: Must use Client Extensions since $use() middleware removed in Prisma 7
- Multi-tenant scoping via Prisma Client Extension with organization_id on every query

### Claude's Discretion
- Currency storage approach (integer grosze vs Prisma Decimal) -- research pitfalls analysis recommends integer, but Claude should pick based on implementation tradeoffs
- Team assignment model for team managers (single-team vs multi-team per user) -- pick based on data model simplicity
- Exact sidebar collapse animation and breakpoints
- Loading states and skeleton patterns
- Error page designs (404, 500, unauthorized)
- Exact quick action buttons in top bar

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORG-01 | User can create a new organization with name, country, default currency, and timezone | Better Auth organization plugin provides `organization.create()` API; extend with custom fields via metadata or custom table |
| ORG-02 | Admin can configure organization settings (branding, fiscal year, notification defaults) | Organization settings stored in dedicated settings table; tRPC router for CRUD with admin role check |
| ORG-03 | Admin can invite users by email with a specific role assignment | Better Auth organization plugin provides `organization.inviteMember()` with role parameter and `sendInvitationEmail` callback |
| ORG-04 | Invited user can accept invitation and create their account | Better Auth provides `organization.acceptInvitation()` API; combine with sign-up flow for seamless onboarding |
| ORG-05 | Admin can deactivate a user, immediately revoking their access | Better Auth admin plugin for user management + session invalidation on deactivation |
| ORG-06 | System enforces RBAC with 8 roles | Better Auth custom roles via `createAccessControl()` + organization plugin's role system; enforce at tRPC middleware level |
| ORG-07 | All data access is scoped to the user's organization with no cross-tenant leakage | Prisma Client Extension with AsyncLocalStorage for automatic `organization_id` injection; defense-in-depth with integration tests |
| I18N-01 | All UI strings are externalized and available in Polish and English | next-intl 4.8.3 with `[locale]` routing, `getTranslations` for server components, `useTranslations` for client components |
| I18N-02 | Dates, numbers, and currency are formatted according to user locale | next-intl `useFormatter` with `format.number()` for PLN currency, `format.dateTime()` for Polish date formats |
</phase_requirements>

## Standard Stack

### Core (Phase 1 specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.7 | Full-stack framework | App Router, Server Components, Vercel-native. v16 is current stable. |
| React | 19.x | UI library | Server Components, Suspense, transitions for data-dense SaaS UI |
| TypeScript | 5.7+ | Type safety | End-to-end type safety with tRPC |
| Prisma | 7.5.0 | ORM | v7 is current: ESM-only, TypeScript engine (no Rust), 90% smaller bundle, Client Extensions for tenant scoping. **Breaking change from v6.** |
| @prisma/adapter-neon | latest | Neon driver adapter | Required in Prisma 7 for Neon serverless connections |
| @neondatabase/serverless | latest | Neon WebSocket driver | Required by Prisma Neon adapter for serverless environments |
| PostgreSQL (Neon) | 17 | Primary database | Serverless Postgres with connection pooling |
| tRPC | 11.13.4 | API layer | Type-safe API with fetch adapter for App Router. Uses `createTRPCOptionsProxy` for server-side prefetching. |
| @tanstack/react-query | 5.90.21 | Server state | Cache, invalidation, optimistic updates. Required by tRPC v11. |
| Better Auth | 1.5.5 | Authentication | Organization plugin for multi-tenant RBAC, custom roles, invitations, session management |
| next-intl | 4.8.3 | i18n framework | App Router + Server Components native. Handles translations, date/number/currency formatting. |
| Tailwind CSS | 4.2.1 | Styling | CSS-first config in v4. Pairs with shadcn/ui. |
| shadcn/ui | latest (CLI) | Component library | Copy-paste components on Radix UI. Sidebar, DropdownMenu, Command, Table, Form, Dialog all available. |
| Zod | 4.3.6 | Schema validation | Single source of truth for tRPC input, form validation, env variables. **NOTE: Zod 4.x is a major upgrade from 3.x.** |
| React Hook Form | 7.71.2 | Form management | Uncontrolled forms, native Zod resolver |
| Zustand | 5.0.12 | Client state | Sidebar collapsed state, theme preference, density setting. Minimal use. |
| date-fns | 4.1.0 | Date manipulation | Tree-shakeable, functional, immutable. Polish locale support. |
| nuqs | 2.8.9 | URL state | Type-safe search params for data tables |
| superjson | latest | Serialization | Required by tRPC for Date/BigInt serialization |
| Biome | 2.4.7 | Linter + Formatter | Replaces ESLint + Prettier. Single config, 10-100x faster. |
| Turborepo | latest | Monorepo orchestration | Caching, parallel builds, dependency graph |
| pnpm | 9.x | Package manager | Fast, disk-efficient, workspace support |
| Vitest | 4.1.0 | Unit/integration tests | Vite-native, fast, TypeScript out of box |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Integer grosze for money | Prisma Decimal + decimal.js | Decimal approach is more "correct" but adds complexity. Integer eliminates floating-point entirely -- simpler, faster, zero risk of rounding errors. **Recommendation: Use integer grosze.** |
| Single-team per user | Multi-team per user (junction table) | Multi-team adds a join table and more complex queries. For v1 with 8 predefined roles, single-team is sufficient. Team managers manage one team. **Recommendation: Single-team via `team_id` on user/member.** |
| Prisma 7 | Prisma 6.x | Prisma 7 is current stable with better performance and smaller bundles. No reason to use v6. |

**Installation (Phase 1 packages only):**
```bash
# Core framework
pnpm add next@latest react@latest react-dom@latest typescript@latest

# API layer
pnpm add @trpc/server@latest @trpc/client@latest @trpc/tanstack-react-query@latest @tanstack/react-query@latest superjson

# Database
pnpm add prisma@latest @prisma/client@latest @prisma/adapter-neon@latest @neondatabase/serverless@latest ws

# Auth
pnpm add better-auth@latest

# i18n
pnpm add next-intl@latest

# State & Forms
pnpm add zustand@latest nuqs@latest react-hook-form@latest @hookform/resolvers@latest zod@latest

# Styling (shadcn/ui installed via CLI)
pnpm add tailwindcss@latest

# Date utilities
pnpm add date-fns@latest

# Dev dependencies
pnpm add -D @biomejs/biome@latest vitest@latest
pnpm add -D @types/react@latest @types/node@latest @types/ws@latest
```

## Architecture Patterns

### Recommended Project Structure (Phase 1)
```
contractor-ops/
├── apps/
│   └── web/                          # Next.js 16 application
│       ├── src/
│       │   ├── app/
│       │   │   ├── [locale]/         # next-intl locale routing
│       │   │   │   ├── (auth)/       # Login, register, invite accept (no sidebar)
│       │   │   │   │   ├── login/
│       │   │   │   │   ├── register/
│       │   │   │   │   └── invite/[token]/
│       │   │   │   └── (dashboard)/  # Authenticated app shell (with sidebar)
│       │   │   │       ├── layout.tsx # Sidebar + topbar layout
│       │   │   │       ├── page.tsx   # Dashboard (placeholder in Phase 1)
│       │   │   │       └── settings/
│       │   │   │           ├── page.tsx
│       │   │   │           └── users/
│       │   │   ├── api/
│       │   │   │   ├── trpc/[trpc]/route.ts
│       │   │   │   └── auth/[...all]/route.ts  # Better Auth handler
│       │   │   └── layout.tsx        # Root layout with providers
│       │   ├── components/
│       │   │   ├── layout/           # Sidebar, TopBar, OrgSwitcher
│       │   │   ├── auth/             # LoginForm, RegisterForm, InviteAccept
│       │   │   └── settings/         # UserManagement, OrgSettings
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   ├── auth-client.ts    # Better Auth client
│       │   │   └── utils.ts
│       │   ├── trpc/                 # tRPC client setup
│       │   │   ├── client.tsx
│       │   │   ├── init.ts
│       │   │   ├── query-client.ts
│       │   │   ├── server.tsx
│       │   │   └── utils.ts
│       │   └── i18n/
│       │       └── request.ts        # next-intl request config
│       ├── messages/
│       │   ├── en.json
│       │   └── pl.json
│       └── next.config.ts
│
├── packages/
│   ├── db/                           # Prisma schema + client
│   │   ├── prisma/
│   │   │   ├── schema/               # Split schema files (Prisma 7 supports multi-file)
│   │   │   │   ├── schema.prisma     # Datasource + generator
│   │   │   │   ├── auth.prisma       # User, Session, Account tables (Better Auth)
│   │   │   │   ├── organization.prisma # Org, Member, Invitation tables
│   │   │   │   ├── contractor.prisma
│   │   │   │   ├── contract.prisma
│   │   │   │   ├── invoice.prisma
│   │   │   │   ├── workflow.prisma
│   │   │   │   ├── approval.prisma
│   │   │   │   ├── payment.prisma
│   │   │   │   └── audit.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── prisma.config.ts          # NEW in Prisma 7: config file
│   │   ├── src/
│   │   │   ├── client.ts            # Prisma client with Neon adapter
│   │   │   ├── tenant.ts            # Tenant-scoped client extension
│   │   │   ├── soft-delete.ts       # Soft-delete client extension
│   │   │   └── index.ts             # Re-exports
│   │   └── package.json
│   │
│   ├── api/                          # tRPC routers
│   │   ├── src/
│   │   │   ├── root.ts
│   │   │   ├── context.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── tenant.ts
│   │   │   │   └── rbac.ts
│   │   │   └── routers/
│   │   │       ├── organization.ts
│   │   │       ├── user.ts
│   │   │       └── settings.ts
│   │   └── package.json
│   │
│   ├── auth/                         # Better Auth configuration
│   │   ├── src/
│   │   │   ├── config.ts            # Server auth config with plugins
│   │   │   ├── client.ts            # Client auth helpers
│   │   │   ├── permissions.ts       # RBAC permission definitions
│   │   │   └── roles.ts             # 8 role definitions with access control
│   │   └── package.json
│   │
│   ├── validators/                   # Shared Zod schemas
│   │   ├── src/
│   │   │   ├── organization.ts
│   │   │   ├── user.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui/                           # shadcn/ui components
│       ├── src/components/
│       └── package.json
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── biome.json
└── .env.example
```

### Pattern 1: Prisma 7 Client with Neon Adapter

**What:** Prisma 7 requires explicit driver adapter setup for Neon. No more auto-detection.
**When to use:** All database access.

```typescript
// packages/db/prisma.config.ts (NEW in Prisma 7)
import path from "node:path";
import type { PrismaConfig } from "prisma";

export default {
  earlyAccess: true,
  schema: path.join("prisma", "schema"),
} satisfies PrismaConfig;

// packages/db/src/client.ts
import { PrismaClient } from "../generated/prisma/client"; // Prisma 7: output outside node_modules
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL!;

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
```

### Pattern 2: Tenant Isolation via Client Extension

**What:** Every query automatically scoped to current organization. Uses AsyncLocalStorage.
**When to use:** All tenant-scoped data access.

```typescript
// packages/db/src/tenant.ts
import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "../generated/prisma/client";

interface TenantContext {
  organizationId: string;
}

export const tenantStore = new AsyncLocalStorage<TenantContext>();

export function withTenantScope<T extends PrismaClient>(prisma: T) {
  return prisma.$extends({
    query: {
      $allOperations({ operation, model, args, query }) {
        const ctx = tenantStore.getStore();
        if (!ctx) throw new Error("Tenant context not initialized");

        // Skip tables that are not tenant-scoped (user, session, etc.)
        const globalModels = ["User", "Session", "Account", "Verification"];
        if (model && globalModels.includes(model)) return query(args);

        if (["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"].includes(operation)) {
          args.where = { ...args.where, organizationId: ctx.organizationId };
        }
        if (operation === "create") {
          args.data = { ...args.data, organizationId: ctx.organizationId };
        }
        if (["update", "updateMany", "delete", "deleteMany"].includes(operation)) {
          args.where = { ...args.where, organizationId: ctx.organizationId };
        }
        return query(args);
      },
    },
  });
}
```

### Pattern 3: Soft Delete via Client Extension (replaces removed $use middleware)

**What:** Prisma 7 removed `$use()`. Soft delete must use Client Extensions.
**When to use:** All models with `deletedAt` field.

```typescript
// packages/db/src/soft-delete.ts
export function withSoftDelete<T extends PrismaClient>(prisma: T) {
  return prisma.$extends({
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          // Convert delete to soft-delete (update deletedAt)
          return (prisma as any)[model].update({
            ...args,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ model, args, query }) {
          return (prisma as any)[model].updateMany({
            ...args,
            data: { deletedAt: new Date() },
          });
        },
        async findMany({ model, args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ model, args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ model, args, query }) {
          // findUnique cannot filter by deletedAt in where (unique constraint)
          // Use findFirst instead
          return query(args);
        },
        async count({ model, args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
      },
    },
  });
}
```

### Pattern 4: Better Auth with Custom 8-Role RBAC

**What:** Map the 8 predefined roles to Better Auth's access control system.
**When to use:** All authentication and authorization.

```typescript
// packages/auth/src/permissions.ts
import { createAccessControl } from "better-auth/plugins/access";

// Define all resource-action pairs for the application
const statement = {
  organization: ["update", "delete"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "cancel"],
  contractor: ["create", "read", "update", "delete", "bulk"],
  contract: ["create", "read", "update", "delete"],
  invoice: ["create", "read", "update", "delete", "approve"],
  workflow: ["create", "read", "update", "delete", "execute"],
  payment: ["create", "read", "export"],
  report: ["read", "export"],
  settings: ["read", "update"],
  integration: ["read", "update"],
} as const;

export const ac = createAccessControl(statement);

// 8 predefined roles
export const roles = {
  admin: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "read", "update", "delete"],
    invitation: ["create", "cancel"],
    contractor: ["create", "read", "update", "delete", "bulk"],
    contract: ["create", "read", "update", "delete"],
    invoice: ["create", "read", "update", "delete", "approve"],
    workflow: ["create", "read", "update", "delete", "execute"],
    payment: ["create", "read", "export"],
    report: ["read", "export"],
    settings: ["read", "update"],
    integration: ["read", "update"],
  }),
  finance_admin: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["create", "read", "update", "delete", "approve"],
    payment: ["create", "read", "export"],
    report: ["read", "export"],
    settings: ["read"],
  }),
  ops_manager: ac.newRole({
    contractor: ["create", "read", "update", "delete", "bulk"],
    contract: ["create", "read", "update", "delete"],
    invoice: ["create", "read", "update"],
    workflow: ["create", "read", "update", "delete", "execute"],
    report: ["read", "export"],
    settings: ["read"],
  }),
  team_manager: ac.newRole({
    contractor: ["read", "update"],
    contract: ["read"],
    invoice: ["read", "approve"],
    workflow: ["read", "execute"],
    report: ["read"],
  }),
  legal_compliance_viewer: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["read"],
    report: ["read"],
  }),
  it_admin: ac.newRole({
    member: ["create", "read", "update"],
    invitation: ["create", "cancel"],
    settings: ["read", "update"],
    integration: ["read", "update"],
  }),
  external_accountant: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["read"],
    payment: ["read"],
    report: ["read", "export"],
  }),
  readonly: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["read"],
    workflow: ["read"],
    report: ["read"],
  }),
};

// packages/auth/src/config.ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { magicLink } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { ac, roles } from "./permissions";

export const auth = betterAuth({
  database: {
    // Prisma adapter configuration
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
    updateAge: 60 * 60,      // Update session every hour
  },
  plugins: [
    organization({
      ac,
      roles: {
        admin: roles.admin,
        finance_admin: roles.finance_admin,
        ops_manager: roles.ops_manager,
        team_manager: roles.team_manager,
        legal_compliance_viewer: roles.legal_compliance_viewer,
        it_admin: roles.it_admin,
        external_accountant: roles.external_accountant,
        readonly: roles.readonly,
      },
      async sendInvitationEmail(data) {
        // Send invite email via Resend (or console.log in dev)
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Send magic link email via Resend
      },
    }),
    admin(),
    nextCookies(), // Must be last plugin
  ],
});
```

### Pattern 5: tRPC v11 with Auth + Tenant + RBAC Middleware Chain

**What:** Layered middleware: auth guard -> tenant scope -> RBAC check.
**When to use:** All protected tRPC procedures.

```typescript
// packages/api/src/middleware/auth.ts
import { TRPCError } from "@trpc/server";
import { auth } from "@contractor-ops/auth";

export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: ctx.headers });
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session, user: session.user },
  });
});

// packages/api/src/middleware/tenant.ts
import { tenantStore } from "@contractor-ops/db";

export const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  const orgId = ctx.session.activeOrganizationId;
  if (!orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active organization" });
  }
  return tenantStore.run({ organizationId: orgId }, () =>
    next({ ctx: { ...ctx, organizationId: orgId } })
  );
});

// packages/api/src/middleware/rbac.ts
import type { Permission } from "@contractor-ops/auth";

export function requirePermission(permission: Permission) {
  return t.middleware(async ({ ctx, next }) => {
    const hasPermission = await auth.api.hasPermission({
      headers: ctx.headers,
      body: { permissions: permission },
    });
    if (!hasPermission) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
}

// Composable procedure builders
export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(authMiddleware);
export const tenantProcedure = authedProcedure.use(tenantMiddleware);
export const adminProcedure = tenantProcedure.use(requirePermission({ organization: ["update"] }));
```

### Pattern 6: next-intl Setup for Polish + English

**What:** Locale-based routing with `[locale]` segment, server/client translation access, and locale-aware formatting.
**When to use:** All UI text, dates, numbers, currency.

```typescript
// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "pl"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pl";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Warsaw",
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" },
      },
      number: {
        currency: { style: "currency", currency: "PLN" },
      },
    },
  };
});

// Usage in Server Component
import { getTranslations, getFormatter } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const format = await getFormatter();

  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{format.number(123456, "currency")}</p>  {/* 1 234,56 zl in pl */}
      <p>{format.dateTime(new Date(), "short")}</p> {/* 18 mar 2026 in pl */}
    </div>
  );
}

// Usage in Client Component
"use client";
import { useTranslations, useFormatter } from "next-intl";

export function InvoiceAmount({ amountGrosze }: { amountGrosze: number }) {
  const format = useFormatter();
  return <span>{format.number(amountGrosze / 100, { style: "currency", currency: "PLN" })}</span>;
}
```

### Anti-Patterns to Avoid

- **Fat tRPC procedures:** All business logic must live in service functions, not router handlers. Routers validate input, call service, return result.
- **Tenant ID from client:** NEVER derive `organization_id` from request params. Always from the authenticated session's `activeOrganizationId`.
- **Direct Prisma import:** Never import the base Prisma client in application code. Always use the tenant-scoped + soft-delete extended client.
- **Client-side auth checks for security:** Client-side permission checks are for UI display only. All security-critical checks happen in tRPC middleware.
- **Prisma $use() middleware:** Removed in v7. Always use Client Extensions.
- **Float for money:** Never use `Float` type in Prisma schema for monetary values. Use `Int` (grosze) or `Decimal`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication flows | Custom JWT/session management | Better Auth + plugins | Email/password, magic link, OAuth, session management, email verification all handled |
| Multi-tenant RBAC | Custom role/permission tables | Better Auth organization plugin + `createAccessControl` | Built-in role definitions, permission checking, invitation workflow |
| i18n framework | Custom translation loading | next-intl | Server Component native, ICU format, locale-aware formatting |
| Sidebar component | Custom sidebar with collapse | shadcn/ui Sidebar component | Built-in collapsible, mobile sheet fallback, keyboard shortcut, cookie-persisted state |
| Form validation | Custom validation logic | Zod schemas shared between tRPC + React Hook Form | Single source of truth, compile-time type inference |
| Dark mode | Custom theme system | Tailwind CSS dark mode + `next-themes` | System preference detection, manual toggle, zero-flash |
| Data tables | Custom table component | TanStack Table + shadcn/ui DataTable | Sorting, filtering, pagination, column visibility, row selection |

**Key insight:** Phase 1 is about assembling well-tested building blocks, not building custom solutions. Every custom solution here is a maintenance burden for a solo developer.

## Common Pitfalls

### Pitfall 1: Prisma 7 Migration Surprises
**What goes wrong:** Developer follows Prisma 6 tutorials/patterns and hits ESM errors, missing client files, or broken middleware.
**Why it happens:** Prisma 7 has 5 major breaking changes: ESM-only, mandatory output path, no `$use()`, driver adapters required, new config file.
**How to avoid:** Set `"type": "module"` in all package.json files. Use `prisma.config.ts`. Set explicit `output` in generator. Use `@prisma/adapter-neon` for Neon. Replace all `$use()` with Client Extensions.
**Warning signs:** "Cannot use import statement outside a module", "Cannot find module '@prisma/client'", `$use is not a function`.

### Pitfall 2: Better Auth Organization Plugin Session State
**What goes wrong:** User authenticates but `activeOrganizationId` is null. Tenant middleware throws. All API calls fail.
**Why it happens:** Better Auth requires explicit `organization.setActive()` after login. If user belongs to multiple orgs, there's no auto-selection.
**How to avoid:** After sign-up (which creates the org), immediately call `setActive()`. After login, if user has exactly one org, auto-set it active. If multiple orgs, show org picker. Store active org in session.
**Warning signs:** "No active organization" errors after login, tenant context missing.

### Pitfall 3: Cross-Tenant Data Leakage on New Models
**What goes wrong:** New Prisma model added in later phases doesn't have `organizationId` field, or tenant extension doesn't cover it.
**Why it happens:** Tenant scoping extension uses a model allowlist/blocklist. New models must be explicitly included.
**How to avoid:** Default to tenant-scoped. Only explicitly exclude global models (User, Session, Account, Verification). Write integration tests that verify isolation for every model.
**Warning signs:** Query returns data from other organizations. Test with 2 test orgs verifies no cross-contamination.

### Pitfall 4: next-intl Hydration Mismatch with Dates/Numbers
**What goes wrong:** Server renders Polish format (1 234,56), client hydrates with browser's locale (1,234.56). React throws hydration error.
**Why it happens:** Server and client use different locale settings. Server uses `i18n/request.ts` config, client may default to browser locale.
**How to avoid:** Always pass `locale` and `timeZone` through `NextIntlClientProvider`. Use `setRequestLocale()` in layouts/pages. Never use raw `Intl.NumberFormat` -- always use next-intl's formatters.
**Warning signs:** Hydration errors involving numbers or dates. Content shift after first render.

### Pitfall 5: 24-Hour Session Expiry Without Grace
**What goes wrong:** User is filling a long form. Session expires mid-form. Submit fails. Data lost.
**Why it happens:** Strict 24h session with no refresh mechanism.
**How to avoid:** Implement session refresh on activity (Better Auth's `updateAge` config refreshes session on each API call within the update window). Show session expiry warning 5 minutes before. Save form state to localStorage as backup.
**Warning signs:** Users report lost form data. Support tickets about being logged out.

### Pitfall 6: Full Schema Migration Performance
**What goes wrong:** Creating all tables in Phase 1 (14+ models, 40+ tables) results in a large initial migration that's slow to apply and hard to review.
**Why it happens:** Decision to create full schema upfront to avoid migration churn in later phases.
**How to avoid:** Split the schema into logical bounded contexts (auth, organization, contractor, contract, invoice, workflow, approval, payment, audit) using Prisma 7's multi-file schema support. Apply as a single migration but organize the schema files for readability. Seed with test data for development.
**Warning signs:** Migration takes > 30 seconds. Schema changes in later phases cause conflicts with the monolithic migration.

## Code Examples

### shadcn/ui Collapsible Sidebar with Org Switcher

```typescript
// Source: shadcn/ui Sidebar docs
// app/[locale]/(dashboard)/layout.tsx
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <OrgSwitcher /> {/* Dropdown at top of sidebar */}
        </SidebarHeader>
        <SidebarContent>
          <NavItems /> {/* All 10 nav items, filtered by RBAC */}
        </SidebarContent>
        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1">
        <TopBar /> {/* Breadcrumb + search + quick actions + notifications + avatar */}
        {children}
      </main>
    </SidebarProvider>
  );
}
```

### Currency Storage as Integer Grosze

```prisma
// In Prisma schema -- use Int for all monetary fields
model InvoiceLineItem {
  id              String   @id @default(cuid())
  invoiceId       String
  description     String
  quantity        Int      @default(1)
  unitPriceGrosze Int      // 12345 = 123.45 PLN
  vatRate         String   // "23", "8", "5", "0", "ZW", "NP"
  netAmountGrosze Int      // quantity * unitPriceGrosze
  vatAmountGrosze Int      // calculated based on vatRate
  grossAmountGrosze Int    // netAmountGrosze + vatAmountGrosze
  organizationId  String
  // ...
}

// In application code -- helper for display
export function groszeToPLN(grosze: number): number {
  return grosze / 100;
}

export function plnToGrosze(pln: number): number {
  return Math.round(pln * 100);
}
```

### tRPC v11 Server-Side Prefetch Pattern

```typescript
// Source: tRPC v11 docs
// app/[locale]/(dashboard)/settings/users/page.tsx
import { trpc, prefetch, HydrateClient } from "@/trpc/server";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  void prefetch(trpc.user.list.queryOptions());

  return (
    <HydrateClient>
      <UsersTable />
    </HydrateClient>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma 6 with Rust engine | Prisma 7 TypeScript-only engine | 2026 | 90% smaller bundle, ESM-only, driver adapters required, `$use()` removed |
| Prisma output in node_modules | Explicit output path in project | Prisma 7 | Must set `output` in generator block, update imports |
| Next.js 15 middleware | Next.js 16 proxy pattern | 2026 | Route protection uses proxy.ts instead of middleware.ts |
| tRPC v10 | tRPC v11 with `createTRPCOptionsProxy` | 2025 | New server-side prefetch pattern, fetch adapter for App Router |
| Zod 3.x | Zod 4.x | 2025-2026 | Major API changes, new schema methods |
| Auth.js / NextAuth | Better Auth (Auth.js team joined) | Sep 2025 | Better Auth is the successor, Auth.js in maintenance mode |

**Deprecated/outdated:**
- Prisma `$use()` middleware: Removed in v7. Use Client Extensions.
- Auth.js / NextAuth: Maintenance mode since Sep 2025.
- next-i18next: Not compatible with App Router.
- tRPC v10: v11 has breaking API changes for App Router.

## Open Questions

1. **Better Auth + Prisma 7 adapter compatibility**
   - What we know: Better Auth 1.5.5 supports Prisma adapter. Prisma 7 changed client generation.
   - What's unclear: Whether Better Auth's Prisma adapter works seamlessly with Prisma 7's new output path and ESM requirements.
   - Recommendation: Test early in Plan 01-01. If issues, use Better Auth's generic database adapter with raw queries.

2. **Zod 4.x compatibility with React Hook Form resolver**
   - What we know: Zod 4.x is a major upgrade. `@hookform/resolvers` may need Zod 4-specific resolver.
   - What's unclear: Whether the Zod resolver in `@hookform/resolvers` supports Zod 4.x natively.
   - Recommendation: Check `@hookform/resolvers` changelog. If incompatible, use Zod 3.x until resolver is updated, or use `zodResolver` from `@hookform/resolvers/zod`.

3. **Next.js 16 proxy vs middleware for auth protection**
   - What we know: Next.js 16 introduces a proxy pattern replacing middleware for route protection.
   - What's unclear: Exact migration path from middleware to proxy for Better Auth integration.
   - Recommendation: Use per-page server-side session checks as primary protection (recommended by Better Auth docs), with proxy/middleware as a redirect layer only.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | none -- Wave 0 creates `vitest.config.ts` at workspace root + per-package configs |
| Quick run command | `pnpm turbo test --filter=@contractor-ops/*` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORG-01 | Create organization with name, country, currency, timezone | integration | `pnpm vitest run packages/api/src/routers/__tests__/organization.test.ts -t "create org"` | Wave 0 |
| ORG-02 | Configure organization settings | integration | `pnpm vitest run packages/api/src/routers/__tests__/settings.test.ts -t "update settings"` | Wave 0 |
| ORG-03 | Invite user by email with role | integration | `pnpm vitest run packages/api/src/routers/__tests__/user.test.ts -t "invite member"` | Wave 0 |
| ORG-04 | Accept invitation and create account | integration | `pnpm vitest run packages/auth/__tests__/invitation.test.ts -t "accept invitation"` | Wave 0 |
| ORG-05 | Deactivate user revokes access | integration | `pnpm vitest run packages/api/src/routers/__tests__/user.test.ts -t "deactivate user"` | Wave 0 |
| ORG-06 | RBAC enforcement for 8 roles | unit + integration | `pnpm vitest run packages/auth/__tests__/rbac.test.ts` | Wave 0 |
| ORG-07 | Tenant isolation (no cross-tenant leakage) | integration | `pnpm vitest run packages/db/__tests__/tenant-isolation.test.ts` | Wave 0 |
| I18N-01 | All UI strings externalized in PL + EN | unit | `pnpm vitest run apps/web/__tests__/i18n-completeness.test.ts` | Wave 0 |
| I18N-02 | Locale-aware date/number/currency formatting | unit | `pnpm vitest run apps/web/__tests__/i18n-formatting.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm turbo test --filter=@contractor-ops/* -- --changed`
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` (workspace root) -- Vitest workspace config
- [ ] `packages/db/vitest.config.ts` -- DB package test config with test database
- [ ] `packages/api/vitest.config.ts` -- API package test config
- [ ] `packages/auth/vitest.config.ts` -- Auth package test config
- [ ] `apps/web/vitest.config.ts` -- Web app test config
- [ ] `packages/db/__tests__/tenant-isolation.test.ts` -- Cross-tenant isolation tests
- [ ] `packages/auth/__tests__/rbac.test.ts` -- Positive and negative permission tests for all 8 roles
- [ ] `packages/auth/__tests__/invitation.test.ts` -- Invitation accept flow tests
- [ ] `packages/api/src/routers/__tests__/organization.test.ts` -- Organization CRUD tests
- [ ] `packages/api/src/routers/__tests__/user.test.ts` -- User management tests
- [ ] `packages/api/src/routers/__tests__/settings.test.ts` -- Settings CRUD tests
- [ ] `apps/web/__tests__/i18n-completeness.test.ts` -- Verify all keys exist in both locales
- [ ] `apps/web/__tests__/i18n-formatting.test.ts` -- Verify PLN/date formatting in PL/EN
- [ ] Framework install: `pnpm add -D vitest @vitest/coverage-v8` -- in affected packages

## Discretionary Decisions (Recommendations)

### Currency Storage: Integer Grosze (RECOMMENDED)

**Decision:** Use integer grosze (smallest currency unit) for all monetary fields.

**Rationale:**
- Eliminates floating-point issues entirely -- no `0.1 + 0.2 !== 0.3` problems
- Simpler arithmetic: addition and subtraction are exact integer operations
- Smaller storage footprint: `Int` vs `Decimal(19,4)`
- Consistent with how Stripe, Wise, and most payment APIs handle amounts
- Conversion to display format is a simple divide-by-100
- Polish invoices with mixed VAT rates (23%, 8%, 5%, 0%, ZW, NP) compute correctly with integer math when rounding per line item

**Trade-off:** Slightly more verbose display code (must divide by 100 for UI). Acceptable.

### Team Assignment: Single-Team per User (RECOMMENDED)

**Decision:** Use a `teamId` field on the member/user-org record, not a junction table.

**Rationale:**
- Simpler data model: one field vs junction table with its own CRUD
- Team managers manage one team in v1 (8 predefined roles, not dynamic team hierarchies)
- Can migrate to multi-team later by adding a junction table without breaking existing data
- Reduces query complexity for team-scoped views

**Trade-off:** If a user needs to be on multiple teams, requires schema change later. Acceptable for v1 scope.

## Sources

### Primary (HIGH confidence)
- [Better Auth Organization Plugin](https://better-auth.com/docs/plugins/organization) -- Custom roles, invitations, permission checking, database schema
- [Better Auth Next.js Integration](https://better-auth.com/docs/integrations/next) -- Proxy setup, session access, route protection
- [Better Auth Magic Link Plugin](https://better-auth.com/docs/plugins/magic-link) -- Magic link configuration and flow
- [Better Auth Basic Usage](https://better-auth.com/docs/basic-usage) -- Email/password, social OAuth, session management
- [next-intl App Router Setup](https://next-intl.dev/docs/getting-started/app-router) -- Folder structure, configuration, server/client components
- [next-intl Number Formatting](https://next-intl.dev/docs/usage/numbers) -- Currency and number formatting
- [next-intl Date/Time Formatting](https://next-intl.dev/docs/usage/dates-times) -- Locale-aware date formatting
- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) -- Breaking changes, ESM, driver adapters, config file
- [Prisma 7 Release Announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) -- TypeScript engine, 90% smaller bundle
- [tRPC v11 Next.js App Router Setup](https://dev.to/matowang/trpc-11-setup-for-nextjs-app-router-2025-33fo) -- Complete setup with middleware, server prefetch
- [shadcn/ui Sidebar](https://v3.shadcn.com/docs/components/sidebar) -- Collapsible sidebar component

### Secondary (MEDIUM confidence)
- [Prisma Client Extensions for Multi-Tenancy](https://github.com/prisma/prisma/discussions/19917) -- Community patterns for tenant isolation
- [Neon connection guide for Prisma](https://neon.com/docs/guides/prisma) -- Driver adapter setup, connection pooling
- [Turborepo Next.js Guide](https://turborepo.dev/docs/guides/frameworks/nextjs) -- Monorepo structure with Next.js

### Tertiary (LOW confidence)
- Next.js 16 proxy pattern: Mentioned in Better Auth docs but limited community examples. May need adaptation.
- Zod 4.x + React Hook Form resolver compatibility: Not explicitly verified. May require fallback to Zod 3.x.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All packages verified via npm registry with current versions
- Architecture: HIGH -- Patterns verified via official docs for Prisma 7, Better Auth, tRPC v11, next-intl
- Pitfalls: HIGH -- Prisma 7 breaking changes are well-documented; Better Auth patterns from official docs
- Discretionary decisions: MEDIUM -- Integer grosze is industry standard but specific Prisma/Polish invoice interaction not fully tested

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (30 days -- stack is stable)
