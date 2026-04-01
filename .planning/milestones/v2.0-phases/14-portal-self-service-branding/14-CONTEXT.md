# Phase 14: Portal Self-Service & Branding - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Contractors can manage their own profile (contact info, financial details with org approval) and notification preferences through the portal. The portal reflects the hiring org's brand with logo, accent color, and custom domain. No new portal pages beyond settings — existing portal views from Phase 13 are unchanged.

</domain>

<decisions>
## Implementation Decisions

### Profile edit & approval flow
- **D-01:** Financial fields only require org approval — bank details and tax ID changes go through approval. Contact info (phone, email, address) takes effect immediately
- **D-02:** Simple single-approver flow — any org admin/manager with contractor management permission can approve. No multi-level approval chains for profile changes
- **D-03:** Inline diff review on admin side — admin sees pending change request with old → new diff in the existing approval queue alongside invoice approvals. Approve/reject with optional comment
- **D-04:** Banner + current values while pending — contractor sees current (approved) values displayed normally with a banner showing "Changes pending approval" and what was submitted. Both old and requested values visible
- **D-05:** New `ContractorChangeRequest` model — stores requested field changes as JSON diff, status (pending/approved/rejected), reviewer, comment. Links to contractor and organization

### Notification preferences
- **D-06:** 5 notification categories — invoice status updates, payment confirmations, contract changes/renewals, document uploads, portal security alerts. Each toggleable on/off
- **D-07:** Email channel only — no in-app notification center, no Slack for contractors. Simple email toggle per category
- **D-08:** New `ContractorNotificationPreference` model — separate from internal `UserNotificationPreference`. Linked to contractor + organization, stores per-category email boolean

### Org branding & white-label
- **D-09:** Logo + accent color — org logo displayed in portal top bar, primary accent color applied to buttons and links. Organization.settingsJson stores brand color hex value
- **D-10:** Custom subdomain support — {slug}.portal.app.com as default, plus full custom domain support (e.g., portal.clientcorp.com) via CNAME + Vercel custom domains API for SSL provisioning
- **D-11:** Admin configures branding in existing org settings — new "Portal Branding" section in org settings page. Logo upload + color picker. No separate branding page
- **D-12:** Portal layout reads branding at render time — server component fetches org branding from DB, applies accent color via CSS custom properties, renders org logo in top bar

### Profile page layout
- **D-13:** Single page with sections at /portal/settings — three collapsible sections: Personal Information, Financial Details, Notification Preferences. No tabs or sidebar needed for 3 sections
- **D-14:** Inline edit mode — click "Edit" on a section → fields become editable in-place → Save/Cancel buttons appear. Financial section shows "requires approval" notice before save
- **D-15:** Read-only fields: contract terms + org assignment — contractors see but cannot edit: org name, contract details, rates, start/end dates. Everything else (contact, financial, notifications) is self-editable

### Claude's Discretion
- Form field validation rules and error messages for profile editing
- Exact notification category labels and descriptions
- Color picker component choice and implementation
- Pending change request card design in admin approval queue
- Animation/transition for inline edit mode toggle
- Empty state for notification preferences (first visit)
- Branding preview in admin settings

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with portal self-service requirements, branding specs
- `db-schema.md` — Database schema including Contractor, ContractorBillingProfile models

### Portal foundation (Phase 13)
- `.planning/phases/13-contractor-portal-auth-core-views/13-CONTEXT.md` — Portal layout decisions, portalProcedure middleware, session model, design system choices
- `packages/api/src/middleware/portal-auth.ts` — portalProcedure middleware for auth + org scoping
- `packages/api/src/routers/portal.ts` — Existing 15-endpoint portal tRPC router to extend
- `apps/web/src/app/[locale]/(portal)/layout.tsx` — Portal layout with top bar (receives branding)
- `apps/web/src/components/portal/portal-top-bar.tsx` — Top bar component (displays org logo + branding)

### Contractor data model
- `packages/db/prisma/schema/contractor.prisma` — Contractor model with billingProfiles, contacts, taxId
- `packages/db/prisma/schema/portal.prisma` — PortalSession and PortalMagicToken models

### Notification system
- `packages/db/prisma/schema/notification.prisma` — UserNotificationPreference model (internal users — reference for contractor equivalent)
- `packages/api/src/services/notification-service.ts` — Notification dispatch service
- `packages/api/src/routers/notification.ts` — Notification router (reference for preference CRUD pattern)

### Organization & branding
- `packages/db/prisma/schema/organization.prisma` — Organization model with logo, settingsJson fields

### Admin settings (integration point)
- `apps/web/src/app/[locale]/(dashboard)/settings/` — Existing org settings pages (add Portal Branding section)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContractorBillingProfile` model: Already has `bankAccountEncrypted`, `bankAccountMasked`, `taxId` — edit form reads/writes these fields
- `Organization.logo` + `Organization.settingsJson`: Logo field exists, settingsJson can store accent color without schema migration
- `UserNotificationPreference` model: Reference architecture for contractor notification preferences (same pattern, different table)
- `packages/api/src/services/notification-service.ts`: Can be extended to check contractor preferences before sending portal emails
- `packages/api/src/services/r2.ts`: R2 storage for logo uploads
- shadcn/ui color picker or external color picker component for admin branding config

### Established Patterns
- `portalProcedure` middleware: All new portal endpoints use this for auth + org scoping
- tRPC router pattern: Extend `portal.ts` router with profile/settings/branding endpoints
- React Hook Form + Zod: For profile edit forms with validation
- `useTranslations()` from next-intl: All new UI strings need Polish + English
- CSS custom properties: Can inject `--brand-accent` at portal layout level for org-specific theming

### Integration Points
- Portal top bar: Receives org logo and accent color from layout server component
- Admin approval queue: Profile change requests appear alongside invoice approvals
- Notification dispatch: Check `ContractorNotificationPreference` before sending contractor emails
- Org settings page: Add "Portal Branding" section with logo upload and color picker
- Vercel custom domains API: For custom subdomain/domain provisioning and SSL

</code_context>

<specifics>
## Specific Ideas

- Custom domain support is a premium feature — orgs can CNAME their own domain (e.g., portal.clientcorp.com) with automatic SSL via Vercel
- Financial field edits (bank, tax ID) route through approval; contact info changes are immediate
- Single settings page with 3 sections — contractors have too few settings for tabs/sidebar to be justified
- Inline edit mode rather than modal/drawer — keeps contractor in context, fields toggle between view and edit in-place

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-portal-self-service-branding*
*Context gathered: 2026-03-23*
