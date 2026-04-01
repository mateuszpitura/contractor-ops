# Phase 14: Portal Self-Service & Branding - Research

**Researched:** 2026-03-23
**Domain:** Portal self-service profile editing, notification preferences, org branding/white-label
**Confidence:** HIGH

## Summary

Phase 14 extends the existing Phase 13 portal with three features: (1) contractor self-service profile editing with an approval workflow for financial fields, (2) contractor notification email preferences, and (3) org-level branding (logo + accent color + custom domain). All three features build directly on established codebase patterns -- the portal router, portalProcedure middleware, existing Organization model fields, and the notification preference architecture from the admin side.

The primary technical challenges are: designing the `ContractorChangeRequest` model and approval flow for financial field edits, integrating contractor notification preferences into the existing email dispatch pipeline, and implementing CSS custom property injection for dynamic org branding. Custom domain support via Vercel's API is the only net-new infrastructure concern.

**Primary recommendation:** Implement in three streams -- (1) data models + API endpoints first (ContractorChangeRequest, ContractorNotificationPreference, branding endpoints), (2) portal settings page UI, (3) admin-side integration (branding config in settings, change request cards in approval queue). Branding CSS injection in the portal layout is a surgical change that should land early.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Financial fields only require org approval -- bank details and tax ID changes go through approval. Contact info (phone, email, address) takes effect immediately
- **D-02:** Simple single-approver flow -- any org admin/manager with contractor management permission can approve. No multi-level approval chains for profile changes
- **D-03:** Inline diff review on admin side -- admin sees pending change request with old-to-new diff in the existing approval queue alongside invoice approvals. Approve/reject with optional comment
- **D-04:** Banner + current values while pending -- contractor sees current (approved) values displayed normally with a banner showing "Changes pending approval" and what was submitted. Both old and requested values visible
- **D-05:** New `ContractorChangeRequest` model -- stores requested field changes as JSON diff, status (pending/approved/rejected), reviewer, comment. Links to contractor and organization
- **D-06:** 5 notification categories -- invoice status updates, payment confirmations, contract changes/renewals, document uploads, portal security alerts. Each toggleable on/off
- **D-07:** Email channel only -- no in-app notification center, no Slack for contractors. Simple email toggle per category
- **D-08:** New `ContractorNotificationPreference` model -- separate from internal `UserNotificationPreference`. Linked to contractor + organization, stores per-category email boolean
- **D-09:** Logo + accent color -- org logo displayed in portal top bar, primary accent color applied to buttons and links. Organization.settingsJson stores brand color hex value
- **D-10:** Custom subdomain support -- {slug}.portal.app.com as default, plus full custom domain support (e.g., portal.clientcorp.com) via CNAME + Vercel custom domains API for SSL provisioning
- **D-11:** Admin configures branding in existing org settings -- new "Portal Branding" section in org settings page. Logo upload + color picker. No separate branding page
- **D-12:** Portal layout reads branding at render time -- server component fetches org branding from DB, applies accent color via CSS custom properties, renders org logo in top bar
- **D-13:** Single page with sections at /portal/settings -- three collapsible sections: Personal Information, Financial Details, Notification Preferences. No tabs or sidebar needed for 3 sections
- **D-14:** Inline edit mode -- click "Edit" on a section, fields become editable in-place, Save/Cancel buttons appear. Financial section shows "requires approval" notice before save
- **D-15:** Read-only fields: contract terms + org assignment -- contractors see but cannot edit: org name, contract details, rates, start/end dates. Everything else (contact, financial, notifications) is self-editable

### Claude's Discretion
- Form field validation rules and error messages for profile editing
- Exact notification category labels and descriptions
- Color picker component choice and implementation
- Pending change request card design in admin approval queue
- Animation/transition for inline edit mode toggle
- Empty state for notification preferences (first visit)
- Branding preview in admin settings

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORT-06 | Contractor can edit own profile (bank details, tax info, contact) with org approval | ContractorChangeRequest model for financial approval flow; direct update for contact info; portalProcedure endpoints; inline edit UI pattern |
| PORT-07 | Contractor can configure notification email preferences | ContractorNotificationPreference model; 5 categories with email boolean; optimistic toggle UI; integration with existing notification dispatch |
| PORT-08 | Portal displays org branding (logo, colors, custom subdomain/path) | Organization.settingsJson stores brandColor; CSS custom property injection in portal layout; admin branding section in settings; Vercel custom domains API for custom subdomains |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @trpc/server | existing | Portal API endpoints | Already used for all portal + admin routes |
| prisma | existing | Database models + queries | Already used throughout, raw prisma client for portal |
| react-hook-form | existing | Profile edit forms | Already used in admin forms (OrgSettingsForm pattern) |
| zod | existing | Input validation schemas | Already used for all tRPC inputs and form validation |
| next-intl | existing | i18n for Polish + English | Already used in all portal and admin components |
| sonner | existing | Toast notifications | Already used for all success/error feedback |
| @tanstack/react-query | existing | Server state + optimistic updates | Already used for all tRPC queries and mutations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Collapsible | existing | Expandable settings sections | Portal settings page 3-section layout |
| shadcn/ui Switch | existing | Notification preference toggles | 5 toggles for email notification categories |
| shadcn/ui Popover | existing | Color picker popover | Admin branding color picker |
| @aws-sdk/client-s3 | existing | Logo upload via R2 presigned URLs | Admin branding logo upload |
| lucide-react | existing | Icons for notification categories | Receipt, Banknote, FileText, FolderOpen, Shield |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom color picker (8 swatches + hex) | react-colorful full picker | Custom is simpler, matches D-09 (only accent color), avoids new dependency |
| settingsJson for brandColor | Dedicated DB column | settingsJson already used for other org settings, avoids migration for a single field |
| Separate approval table | Reuse ApprovalFlow model | ContractorChangeRequest is simpler than the invoice approval chain; different lifecycle, different reviewers |

**Installation:**
No new packages needed. All dependencies already in the monorepo.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/prisma/schema/
  portal.prisma                       # Add ContractorChangeRequest + ContractorNotificationPreference
packages/api/src/routers/
  portal.ts                           # Extend with profile, preferences, branding endpoints
packages/api/src/services/
  portal-change-request.ts            # Change request business logic (create, approve, reject, apply)
  notification-service.ts             # Extend to check contractor preferences
apps/web/src/app/[locale]/(portal)/
  settings/page.tsx                   # Portal settings page
apps/web/src/components/portal/
  portal-settings-page.tsx            # Settings page with 3 collapsible sections
  profile-section.tsx                 # Reusable collapsible section with view/edit toggle
  pending-change-banner.tsx           # Warning banner for pending financial changes
  notification-preferences-section.tsx # 5 toggle rows with optimistic update
apps/web/src/components/settings/
  admin-branding-section.tsx          # Admin Portal Branding card
  brand-color-picker.tsx              # 8 swatches + hex input Popover
  brand-preview-strip.tsx             # Live preview of selected brand color
  change-request-diff-card.tsx        # Admin approval queue card for profile changes
apps/web/src/app/[locale]/(portal)/
  layout.tsx                          # Update: fetch brandColor, inject CSS custom property
```

### Pattern 1: ContractorChangeRequest Model
**What:** New Prisma model storing JSON diff of requested financial field changes with approval lifecycle
**When to use:** When contractor submits edits to bank details or tax ID
**Example:**
```prisma
// Source: Designed to match existing approval patterns in codebase
model ContractorChangeRequest {
  id             String                      @id @default(cuid())
  organizationId String
  contractorId   String
  status         ContractorChangeRequestStatus @default(PENDING)
  requestedChanges Json                      // { bankAccountNumber: "...", bankName: "...", ... }
  previousValues   Json                      // { bankAccountNumber: "...", bankName: "...", ... }
  reviewedById   String?
  reviewedAt     DateTime?
  reviewComment  String?
  createdAt      DateTime                    @default(now())
  updatedAt      DateTime                    @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  contractor     Contractor   @relation(fields: [contractorId], references: [id])
  reviewedBy     User?        @relation(fields: [reviewedById], references: [id])

  @@index([organizationId])
  @@index([organizationId, contractorId, status])
  @@index([organizationId, status])
}

enum ContractorChangeRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### Pattern 2: ContractorNotificationPreference Model
**What:** Per-contractor, per-category email preference booleans
**When to use:** For the 5 notification categories (mirrors UserNotificationPreference pattern)
**Example:**
```prisma
// Source: Mirrors existing UserNotificationPreference model
model ContractorNotificationPreference {
  id               String   @id @default(cuid())
  contractorId     String
  organizationId   String
  category         String   // INVOICE_UPDATES, PAYMENT_CONFIRMATIONS, etc.
  emailEnabled     Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  contractor     Contractor   @relation(fields: [contractorId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([contractorId, category])
  @@index([organizationId])
}
```

### Pattern 3: CSS Custom Property Injection for Branding
**What:** Portal layout server component reads org brandColor from settingsJson, injects as CSS custom property
**When to use:** Every portal page render
**Example:**
```tsx
// Source: Portal layout pattern from layout.tsx
// In apps/web/src/app/[locale]/(portal)/layout.tsx
const org = await prisma.organization.findUnique({
  where: { id: session.organizationId },
  select: { name: true, logo: true, settingsJson: true },
});

const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
const brandColor = (settings.brandColor as string) ?? null;

// In the JSX:
<div
  className="min-h-screen bg-background"
  style={brandColor ? { '--brand-accent': brandColor } as React.CSSProperties : undefined}
>
```

### Pattern 4: Inline Edit Mode Toggle
**What:** Section component with view/edit states, using React Hook Form only in edit mode
**When to use:** Personal Information and Financial Details sections
**Example:**
```tsx
// ProfileSection component pattern
function ProfileSection({ title, fields, requiresApproval, onSave }) {
  const [editing, setEditing] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: currentValues });

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger>
        {title}
        {!editing && <Button variant="ghost" onClick={() => setEditing(true)}>Edit Section</Button>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {editing ? (
          <form onSubmit={form.handleSubmit(onSave)}>
            {/* Input fields */}
            {requiresApproval && <InfoBanner>Changes require approval</InfoBanner>}
            <Button type="submit">Save Changes</Button>
            <Button variant="outline" onClick={() => { form.reset(); setEditing(false); }}>
              Discard Changes
            </Button>
          </form>
        ) : (
          <dl>{/* View mode: label + value pairs */}</dl>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Pattern 5: Optimistic Toggle for Notification Preferences
**What:** Switch toggle that immediately updates UI, rolls back on error
**When to use:** Notification preference toggles (save-on-toggle, no form submit)
**Example:**
```tsx
// Source: TanStack Query optimistic update pattern
const updatePref = useMutation(
  trpc.portal.updateNotificationPreference.mutationOptions({
    onMutate: async (newPref) => {
      await queryClient.cancelQueries({ queryKey: trpc.portal.getNotificationPreferences.queryKey() });
      const prev = queryClient.getQueryData(trpc.portal.getNotificationPreferences.queryKey());
      queryClient.setQueryData(trpc.portal.getNotificationPreferences.queryKey(), (old) =>
        old?.map((p) => p.category === newPref.category ? { ...p, emailEnabled: newPref.emailEnabled } : p)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(trpc.portal.getNotificationPreferences.queryKey(), context.prev);
      toast.error("Failed to update preference. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.portal.getNotificationPreferences.queryKey() });
    },
  })
);
```

### Anti-Patterns to Avoid
- **Reusing ApprovalFlow for profile changes:** The existing invoice approval chain (ApprovalChainConfig -> ApprovalFlow -> ApprovalStep -> ApprovalDecision) is designed for multi-step, multi-approver workflows. Profile changes need a simple single-approver flow. Using the existing system would add unnecessary complexity.
- **Storing brand color in a dedicated column:** The settingsJson pattern is already established for org-level configuration (expiry reminders, matching thresholds, transfer titles). Adding a new column for a single string value is unnecessary.
- **Building a full notification preference page for contractors:** Contractors only have 5 email toggles. A dedicated page or complex UI is overkill. Inline toggles in a section on the settings page is sufficient.
- **Exposing bankAccountEncrypted to the portal:** The portal must only show masked bank account values. The encrypted value should never leave the server.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color picker | Full HSL/RGB picker component | 8 preset swatches + hex input in Popover | Simpler, matches design spec, no new dependencies |
| Approval workflow engine | Generic approval state machine | Simple PENDING/APPROVED/REJECTED status field on ContractorChangeRequest | Profile changes are single-approver, not multi-step |
| CSS theming system | Dynamic theme generation | Single CSS custom property `--brand-accent` injected via style prop | Only accent color changes, not full theme |
| Logo upload | Custom upload component | Existing R2 presigned URL pattern from portal invoice upload | Same S3-compatible flow, already proven |
| Custom domain SSL | Manual certificate management | Vercel custom domains API (automatic SSL provisioning) | Vercel handles ACME/Let's Encrypt automatically |

**Key insight:** This phase adds no truly novel infrastructure. Every feature maps to an existing pattern in the codebase -- the novelty is in combining them for the contractor portal context.

## Common Pitfalls

### Pitfall 1: Exposing Encrypted Financial Data
**What goes wrong:** Bank account encrypted values leak to the portal frontend
**Why it happens:** ContractorBillingProfile has both `bankAccountMasked` and `bankAccountEncrypted` fields. A careless select clause could expose the encrypted value.
**How to avoid:** Portal profile read endpoint must explicitly `select` only `bankAccountMasked`, never `bankAccountEncrypted`. Use a select whitelist, not exclude list.
**Warning signs:** Any portal query that includes `*` or does not specify `select` on ContractorBillingProfile.

### Pitfall 2: Race Condition on Concurrent Change Requests
**What goes wrong:** Contractor submits two financial change requests before the first is reviewed, or submits a change while one is already pending.
**Why it happens:** No guard against multiple pending requests for the same contractor.
**How to avoid:** Check for existing PENDING ContractorChangeRequest before creating a new one. Reject with "You already have a pending change request" message. Allow re-submission only after previous request is approved or rejected.
**Warning signs:** Multiple PENDING rows for the same contractorId.

### Pitfall 3: Stale previousValues After Approval
**What goes wrong:** Admin approves a change request, but the `requestedChanges` are applied to the wrong base values because another change was approved in between.
**Why it happens:** `previousValues` snapshot was taken at request creation time, but the underlying data changed before approval.
**How to avoid:** On approval, re-read current values and apply the diff. Log if `previousValues` don't match current state (informational warning, not a blocker -- the requested new values are still what the contractor wanted).
**Warning signs:** Admin sees a diff where "Current Value" doesn't match what's actually in the database.

### Pitfall 4: Brand Color Accessibility
**What goes wrong:** Org admin sets a brand color that has insufficient contrast against white backgrounds.
**Why it happens:** No contrast validation on the color picker.
**How to avoid:** Show a warning in the admin branding section if the selected color has a WCAG AA contrast ratio below 4.5:1 against white. Don't block saving, but warn. Use relative luminance calculation.
**Warning signs:** Light yellow or light green brand colors making buttons/links invisible.

### Pitfall 5: Custom Domain DNS Verification Timing
**What goes wrong:** Admin adds a custom domain but DNS hasn't propagated. SSL provisioning fails silently.
**Why it happens:** CNAME propagation takes minutes to hours. Vercel API returns success for domain addition but SSL verification happens asynchronously.
**How to avoid:** Show a "DNS Verification Pending" status with instructions. Poll Vercel API for domain verification status. Don't show "custom domain active" until SSL is provisioned.
**Warning signs:** Custom domain returns SSL errors or Vercel 404s.

### Pitfall 6: Notification Preference Defaults on First Login
**What goes wrong:** Contractor logs in for the first time and notification preferences don't exist yet, causing errors.
**Why it happens:** No ContractorNotificationPreference rows until contractor visits settings or receives first notification.
**How to avoid:** Follow the existing `getOrCreatePreferences` pattern from notification-service.ts. When reading preferences, create defaults (all enabled) for missing categories. Security alerts always enabled, switch disabled.
**Warning signs:** Empty preferences array returned to frontend.

## Code Examples

### Portal Profile Read Endpoint
```typescript
// Source: Extending existing portal.ts router pattern
getProfile: portalProcedure.query(async ({ ctx }) => {
  const contractor = await prisma.contractor.findUnique({
    where: { id: ctx.contractorId },
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postalCode: true,
      countryCode: true,
      taxId: true,
      billingProfiles: {
        where: { isDefault: true },
        select: {
          id: true,
          bankAccountMasked: true, // NEVER bankAccountEncrypted
          bankName: true,
          swiftBic: true,
          taxId: true,
        },
        take: 1,
      },
    },
  });

  // Check for pending change request
  const pendingRequest = await prisma.contractorChangeRequest.findFirst({
    where: {
      contractorId: ctx.contractorId,
      organizationId: ctx.organizationId,
      status: "PENDING",
    },
    select: {
      id: true,
      requestedChanges: true,
      createdAt: true,
    },
  });

  return plain({ ...contractor, pendingChangeRequest: pendingRequest });
}),
```

### Admin Branding Save Endpoint
```typescript
// Source: Following existing settingsJson update pattern from settings.ts
updateBranding: tenantProcedure
  .use(requirePermission({ settings: ["update"] }))
  .input(z.object({
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    logoUrl: z.string().url().optional().nullable(),
  }))
  .mutation(async ({ ctx, input }) => {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { settingsJson: true },
    });

    const currentSettings = (org?.settingsJson as Record<string, unknown>) ?? {};
    const newSettings = {
      ...currentSettings,
      ...(input.brandColor !== undefined && { brandColor: input.brandColor }),
    };

    await prisma.organization.update({
      where: { id: ctx.organizationId },
      data: {
        settingsJson: newSettings,
        ...(input.logoUrl !== undefined && { logo: input.logoUrl }),
      },
    });

    return { success: true };
  }),
```

### Change Request Approval Logic
```typescript
// Source: New service following existing approval patterns
export async function approveChangeRequest(
  requestId: string,
  reviewerId: string,
  organizationId: string,
) {
  const request = await prisma.contractorChangeRequest.findFirst({
    where: { id: requestId, organizationId, status: "PENDING" },
    include: { contractor: { include: { billingProfiles: { where: { isDefault: true } } } } },
  });

  if (!request) throw new TRPCError({ code: "NOT_FOUND" });

  const changes = request.requestedChanges as Record<string, unknown>;
  const billingProfile = request.contractor.billingProfiles[0];

  // Apply changes in a transaction
  await prisma.$transaction([
    // Update billing profile with requested changes
    ...(billingProfile ? [
      prisma.contractorBillingProfile.update({
        where: { id: billingProfile.id },
        data: {
          ...(changes.bankName !== undefined && { bankName: changes.bankName as string }),
          ...(changes.swiftBic !== undefined && { swiftBic: changes.swiftBic as string }),
          ...(changes.taxId !== undefined && { taxId: changes.taxId as string }),
          // bankAccountEncrypted + bankAccountMasked handled specially
        },
      }),
    ] : []),
    // Mark request as approved
    prisma.contractorChangeRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date() },
    }),
  ]);
}
```

### Portal Layout with Brand Color Injection
```tsx
// Source: Updating existing layout.tsx
const org = await prisma.organization.findUnique({
  where: { id: session.organizationId },
  select: { name: true, logo: true, settingsJson: true },
});

const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
const brandColor = (settings.brandColor as string) ?? null;

return (
  <div
    className="min-h-screen bg-background"
    style={brandColor ? { '--brand-accent': brandColor } as React.CSSProperties : undefined}
  >
    <PortalTopBar
      orgName={org?.name ?? "Organization"}
      orgLogo={org?.logo ?? null}
      contractorName={session.contractor?.displayName ?? "Contractor"}
      contractorEmail={session.email}
    />
    {/* ... */}
  </div>
);
```

Tailwind CSS can then reference this via `text-[var(--brand-accent)]`, `bg-[var(--brand-accent)]`, `border-[var(--brand-accent)]` with fallbacks to `--primary`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full theme system for white-label | Single CSS custom property | Current best practice | Simpler, fewer edge cases, easier to maintain |
| Multi-step approval for all changes | Simple single-approver for profile | Decision D-02 | Avoids overengineering for low-frequency operations |
| Separate notification settings page | Inline toggles in settings section | Current pattern | Contractors have too few settings for a separate page |

**Deprecated/outdated:**
- None relevant to this phase.

## Open Questions

1. **Bank account encryption on change request submission**
   - What we know: ContractorBillingProfile.bankAccountEncrypted stores encrypted values. When a contractor submits a new bank account number, the change request must store it somewhere.
   - What's unclear: Should requestedChanges JSON store the encrypted value, or should encryption happen only at approval time? The portal doesn't have the encryption key context.
   - Recommendation: Store the new bank account as encrypted in the requestedChanges JSON at submission time (server-side encryption in the portal endpoint). The masked version is stored alongside for display. On approval, copy to billingProfile.

2. **Vercel custom domains API integration scope**
   - What we know: D-10 specifies custom subdomain + full custom domain via Vercel API.
   - What's unclear: Whether to implement full custom domain provisioning in Phase 14 or start with subdomain-based routing only.
   - Recommendation: Implement subdomain routing ({slug}.portal.app.com) fully. Add custom domain CNAME + Vercel API as a separate plan/task since it requires DNS verification polling and more infrastructure.

3. **Change request notification to admin**
   - What we know: When a contractor submits a financial change request, admins should be notified.
   - What's unclear: Which notification channel and recipient selection to use.
   - Recommendation: Use existing `dispatch()` from notification-service.ts targeting users with contractor management permission in the org. Add a new notification type for change requests.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `packages/api/vitest.config.ts` (if exists), or root vitest config |
| Quick run command | `pnpm --filter @contractor-ops/api test --run` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-06a | Contact info update takes effect immediately | unit | `pnpm --filter @contractor-ops/api test -- --grep "updateContactInfo"` | Wave 0 |
| PORT-06b | Financial edit creates change request (not direct update) | unit | `pnpm --filter @contractor-ops/api test -- --grep "createChangeRequest"` | Wave 0 |
| PORT-06c | Approve change request applies values to billing profile | unit | `pnpm --filter @contractor-ops/api test -- --grep "approveChangeRequest"` | Wave 0 |
| PORT-06d | Cannot create second pending request while one exists | unit | `pnpm --filter @contractor-ops/api test -- --grep "duplicatePending"` | Wave 0 |
| PORT-07a | Get preferences returns 5 categories with defaults | unit | `pnpm --filter @contractor-ops/api test -- --grep "getNotificationPreferences"` | Wave 0 |
| PORT-07b | Toggle preference updates single category | unit | `pnpm --filter @contractor-ops/api test -- --grep "updateNotificationPreference"` | Wave 0 |
| PORT-07c | Security alerts cannot be disabled | unit | `pnpm --filter @contractor-ops/api test -- --grep "securityAlertImmutable"` | Wave 0 |
| PORT-08a | Branding save persists to settingsJson | unit | `pnpm --filter @contractor-ops/api test -- --grep "updateBranding"` | Wave 0 |
| PORT-08b | Portal layout injects CSS custom property when brandColor set | manual-only | Manual: requires browser render verification | N/A |
| PORT-08c | No CSS injection when brandColor not set | manual-only | Manual: requires browser render verification | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/api test --run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/__tests__/portal-profile.test.ts` -- covers PORT-06a through PORT-06d
- [ ] `packages/api/src/__tests__/portal-notification-prefs.test.ts` -- covers PORT-07a through PORT-07c
- [ ] `packages/api/src/__tests__/portal-branding.test.ts` -- covers PORT-08a

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/api/src/routers/portal.ts` -- existing 15-endpoint portal router, portalProcedure middleware, plain() helper
- Codebase inspection: `packages/db/prisma/schema/contractor.prisma` -- Contractor, ContractorBillingProfile with bankAccountMasked/bankAccountEncrypted
- Codebase inspection: `packages/db/prisma/schema/notification.prisma` -- UserNotificationPreference model (reference architecture)
- Codebase inspection: `packages/db/prisma/schema/organization.prisma` -- Organization.settingsJson, Organization.logo fields
- Codebase inspection: `packages/api/src/services/notification-service.ts` -- dispatch(), getOrCreatePreferences() patterns
- Codebase inspection: `packages/api/src/routers/settings.ts` -- settingsJson read/write pattern
- Codebase inspection: `apps/web/src/app/[locale]/(portal)/layout.tsx` -- portal layout with session validation and org data fetch
- Codebase inspection: `apps/web/src/components/portal/portal-top-bar.tsx` -- PortalTopBar accepting orgLogo, orgName props
- Codebase inspection: `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` -- admin settings page with tabs (General tab is integration point)
- Codebase inspection: `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` -- approval queue page (integration point for change request cards)

### Secondary (MEDIUM confidence)
- UI-SPEC: `.planning/phases/14-portal-self-service-branding/14-UI-SPEC.md` -- approved design contract for all Phase 14 components
- Phase 13 CONTEXT: `.planning/phases/13-contractor-portal-auth-core-views/13-CONTEXT.md` -- portal architecture decisions

### Tertiary (LOW confidence)
- Vercel custom domains API -- not verified against current Vercel docs. Custom domain implementation details need verification at implementation time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in the project, no new dependencies
- Architecture: HIGH -- all patterns directly extend existing codebase patterns verified by code inspection
- Pitfalls: HIGH -- derived from actual codebase structure (encrypted fields, JSON diff handling, CSS injection)
- Vercel custom domains: LOW -- not verified against current API, implementation details TBD

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- internal codebase patterns, no external API volatility except Vercel)
