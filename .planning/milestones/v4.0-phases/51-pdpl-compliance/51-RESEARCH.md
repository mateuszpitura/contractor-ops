# Phase 51: PDPL Compliance — Research

**Researched:** 2026-04-11
**Phase Goal:** Organizations onboarding in UAE or Saudi Arabia see jurisdiction-appropriate privacy controls that satisfy PDPL requirements

## Domain Research

### UAE Personal Data Protection Law (Federal Decree-Law No. 45/2021)
- Requires **explicit, informed consent** for each specific processing purpose
- Data subjects have right to access, correct, delete, and restrict processing of personal data
- Cross-border transfers allowed only with adequate protection (approved jurisdictions, SCCs, or binding corporate rules)
- Data controllers must maintain records of processing activities
- Privacy notices must be clear, accessible, and in a language the data subject understands (Arabic required for UAE)

### Saudi Personal Data Protection Law (PDPL — Royal Decree M/19, 2021, amended 2023)
- Similar purpose-specific consent requirements; consent must be freely given, specific, informed, and unambiguous
- Data subjects have rights to access, correct, delete, restrict, and data portability
- Cross-border transfers require adequate protection in receiving jurisdiction OR appropriate safeguards (SCCs, BCRs)
- Data controllers must appoint a DPO and maintain processing records
- Privacy notices must disclose: identity of controller, purposes, legal basis, categories of data, transfer destinations, retention periods

### Key Differences Between UAE and Saudi PDPL
| Aspect | UAE | Saudi Arabia |
|--------|-----|--------------|
| DPO requirement | Not mandatory for all orgs | Mandatory for certain categories |
| Consent withdrawal | Right to withdraw at any time | Right to withdraw at any time |
| Cross-border transfers | Adequate country list or SCCs | Adequate country list or SCCs + SDAIA approval for certain categories |
| Language requirements | Arabic + English typical | Arabic required for privacy notices |
| Penalties | Up to AED 5M | Up to SAR 5M |

### Data Processing Purposes (Taxonomy)
For a contractor management platform, the relevant processing purposes are:
1. **Contractor data processing** — storing contractor profiles, contact info, tax IDs (always required)
2. **Invoice & payment processing** — processing invoices, generating payments (always required)
3. **Analytics & reporting** — generating dashboards, KPI reports, spend analytics (optional)
4. **Cross-border data transfer** — transferring data outside jurisdiction (conditional on hosting region)
5. **Integration data sharing** — sharing data with third-party integrations (Slack, Jira, etc.) (optional)
6. **Communication & notifications** — sending emails, Slack messages, reminders (always required)

## Technical Research

### Existing Codebase Patterns

#### Organization Model (`packages/db/prisma/schema/organization.prisma`)
- `countryCode: String? @db.Char(2)` — drives jurisdiction detection (AE = UAE, SA = Saudi)
- `settingsJson: Json?` — could store org-level privacy preferences but consent should be separate
- Organization has `auditLogs AuditLog[]` relation — immutable audit pattern already established

#### AuditLog Pattern (`packages/db/prisma/schema/audit.prisma`)
- Immutable: no `updatedAt`, only `createdAt`
- Indexed on `(organizationId, resourceType, resourceId, createdAt)` — good pattern for ConsentRecord
- Uses `ActorType` enum: USER, SYSTEM, INTEGRATION, API_KEY, CONTRACTOR

#### Onboarding Checklist (`apps/web/src/components/onboarding/onboarding-checklist.tsx`)
- Step-based checklist with `ONBOARDING_STEPS` array
- Each step has: id, icon, optional flag, i18n stepKey, ctaHref
- Steps are rendered as a progress card on the dashboard
- **Note:** This is a post-setup checklist, not the org creation wizard. The "Privacy & Compliance" blocking step needs to be in the org setup flow (when country is selected), not in this checklist.

#### Settings Page (`apps/web/src/app/[locale]/(dashboard)/settings/page.tsx`)
- Tab-based: general, approvals, notifications, integrations, e-invoicing, audit, billing
- Uses nuqs for URL-synced tab state (`?tab=`)
- Adding a "Privacy & Consent" tab follows the established pattern

#### tRPC Router Pattern (`packages/api/src/routers/settings.ts`)
- Uses `tenantProcedure` for org-scoped queries
- Uses `requirePermission` middleware for RBAC
- Uses `sensitiveActionProcedure` for mutations
- Uses `cached()` wrapper with `CacheKeys` and `CacheTTL` for read operations

#### React-PDF (`apps/web/package.json`)
- Already a dependency (used for OCR PDF viewer at minimum)
- Can be reused for DPA and SCC document generation

### Schema Design: ConsentRecord

```prisma
model ConsentRecord {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  purpose        ConsentPurpose
  granted        Boolean
  version        Int      @default(1)
  grantedAt      DateTime?
  revokedAt      DateTime?
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User         @relation(fields: [userId], references: [id])

  // Immutable — no updatedAt
  @@index([organizationId])
  @@index([organizationId, userId, purpose])
  @@index([organizationId, purpose, createdAt])
}

enum ConsentPurpose {
  CONTRACTOR_DATA_PROCESSING
  INVOICE_PAYMENT_PROCESSING
  ANALYTICS_REPORTING
  CROSS_BORDER_TRANSFER
  INTEGRATION_DATA_SHARING
  COMMUNICATION_NOTIFICATIONS
}
```

Key design decisions:
- **Append-only**: revocations create new records with `granted: false` and `revokedAt` timestamp
- **Version tracking**: each new record for same (org, user, purpose) increments version
- **Audit-friendly**: ipAddress and userAgent captured at consent time
- **Current state**: latest record per (org, user, purpose) ordered by createdAt DESC

### Schema Design: PrivacyNotice

```prisma
model PrivacyNotice {
  id             String   @id @default(cuid())
  organizationId String
  jurisdiction   String   @db.Char(2)  // AE, SA
  version        Int      @default(1)
  contentJson    Json     // structured notice content per jurisdiction
  effectiveFrom  DateTime
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, jurisdiction])
  @@unique([organizationId, jurisdiction, version])
}
```

### PDF Generation Architecture

For DPA and SCC documents:
1. **Template approach**: Markdown/HTML templates with Handlebars-style placeholders
2. **Data merging**: Inject org name, address, country, processing purposes, date
3. **Rendering**: React-PDF (already in project) for PDF generation
4. **Storage**: Generate on-demand (no pre-storage), cache with short TTL
5. **Templates location**: `packages/api/src/templates/legal/` — versioned in code

### Onboarding Integration

The blocking consent step should:
1. Trigger when `countryCode` is set to `AE` or `SA` during org setup
2. Display jurisdiction-specific privacy notice
3. Show per-purpose consent toggles (required vs optional)
4. Block progression until all required purposes are accepted
5. Create ConsentRecord entries on acceptance

### Cross-Border Transfer Detection

Logic: Compare `organization.countryCode` with data hosting region (from env/config).
- If org is AE and data hosted in EU → cross-border transfer detected → require SCC
- If org is SA and data hosted in EU → cross-border transfer detected → require SCC
- If org is AE and data hosted in AE → no cross-border transfer → SCC not required

This depends on Phase 52 (Multi-Region Infrastructure) for actual region routing. For Phase 51, detection is based on a static config value for the current hosting region.

## Validation Architecture

### Testable Assertions
1. ConsentRecord created for each purpose when UAE/Saudi org accepts consent
2. ConsentRecord with `granted: false` created on revocation (original unchanged)
3. Privacy notice displayed matches org jurisdiction (AE vs SA content)
4. Blocking step prevents org setup completion without required consents
5. DPA PDF contains correct org details and jurisdiction-specific clauses
6. SCC PDF generated only when cross-border transfer detected
7. Settings page shows current consent state with toggle/revoke capability
8. Consent history queryable per (org, user, purpose)

### Risk Areas
- **Privacy notice content accuracy**: Legal text must be reviewed — use placeholder content flagged for legal review
- **Consent versioning**: When privacy notice version changes, existing consents should be re-prompted
- **Cross-border detection**: Static hosting region config is temporary — Phase 52 will make it dynamic

## Dependencies

- **Phase 47** (Depends on): `countryCode` on Organization, `countryFields` JSONB pattern, React-PDF setup
- **Phase 52** (Future): Multi-region infrastructure will make cross-border detection dynamic
- **Existing**: AuditLog immutable pattern, Settings page tabs, tRPC router patterns, RBAC middleware

## RESEARCH COMPLETE
