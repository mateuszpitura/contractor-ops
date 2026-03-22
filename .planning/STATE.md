---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 09-03-PLAN.md
last_updated: "2026-03-22T14:03:32.751Z"
progress:
  total_phases: 10
  completed_phases: 8
  total_plans: 44
  completed_plans: 43
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.
**Current focus:** Phase 09 — dashboard-reports

## Current Position

Phase: 09 (dashboard-reports) — EXECUTING
Plan: 6 of 6

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: 10min
- Total execution time: 1.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-auth | 4/4 | 35min | 9min |
| 02-contractor-registry | 2/3 | 37min | 18min |
| 03-contracts-documents | 6/6 | 43min | 7min |

**Recent Trend:**

- Last 5 plans: 4min, 10min, 12min, 14min, 9min
- Trend: stable

*Updated after each plan completion*
| Phase 03-02 P02 | 6min | 2 tasks | 10 files |
| Phase 03-03 PP03 | 6min | 2 tasks | 10 files |
| Phase 03-04 P04 | 10min | 2 tasks | 8 files |
| Phase 03-05 PP05 | 7min | 2 tasks | 13 files |
| Phase 03-06 P06 | 9min | 2 tasks | 11 files |
| Phase 04-01 P01 | 7min | 2 tasks | 4 files |
| Phase 04 P03 | 8min | 2 tasks | 13 files |
| Phase 04 P02 | 12min | 2 tasks | 10 files |
| Phase 04 P04 | 6min | 2 tasks | 6 files |
| Phase 04 P05 | 8min | 2 tasks | 9 files |
| Phase 05 P01 | 4min | 2 tasks | 5 files |
| Phase 05 P03 | 7min | 2 tasks | 12 files |
| Phase 05 P02 | 7min | 1 tasks | 4 files |
| Phase 05 P04 | 7min | 2 tasks | 7 files |
| Phase 05 P05 | 6min | 2 tasks | 8 files |
| Phase 06 P01 | 5min | 2 tasks | 5 files |
| Phase 06 P04 | 10min | 2 tasks | 6 files |
| Phase 06 P02 | 6min | 2 tasks | 4 files |
| Phase 06 P03 | 6min | 2 tasks | 8 files |
| Phase 06 P05 | 10min | 3 tasks | 7 files |
| Phase 06 P06 | 1min | 1 tasks | 2 files |
| Phase 07 P01 | 4min | 2 tasks | 9 files |
| Phase 07 P02 | 8min | 2 tasks | 16 files |
| Phase 07 P03 | 4min | 2 tasks | 8 files |
| Phase 07 P04 | 8min | 2 tasks | 8 files |
| Phase 07 P05 | 7min | 2 tasks | 7 files |
| Phase 08-payments P00 | 2min | 1 tasks | 5 files |
| Phase 08-payments P01 | 8min | 2 tasks | 8 files |
| Phase 08-payments P03 | 6min | 2 tasks | 7 files |
| Phase 08-payments PP02 | 14min | 2 tasks | 14 files |
| Phase 09 P00 | 1min | 1 tasks | 4 files |
| Phase 09-dashboard-reports P01 | 7min | 2 tasks | 5 files |
| Phase 09-dashboard-reports P04 | 5min | 2 tasks | 6 files |
| Phase 09-dashboard-reports P02 | 6min | 2 tasks | 6 files |
| Phase 09-dashboard-reports PP03 | 8min | 2 tasks | 14 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 10-phase fine-granularity roadmap derived from 89 requirements across 16 categories
- [Roadmap]: Workflow engine (Phase 4) and invoice pipeline (Phase 5) separated due to complexity and independent dependency chains
- [Roadmap]: Notifications and Slack integration as standalone Phase 7 — cross-cutting concern that depends on approval workflow being complete
- [01-01]: Integer grosze for all monetary fields (Int type) — eliminates floating-point precision risk
- [01-01]: Prisma 7 multi-file schema with --schema flag (prisma.config.ts deferred due to Node 24 parse issue)
- [01-01]: Soft-delete scoped to 5 core models: Organization, Contractor, Contract, Invoice, Document
- [01-02]: Prisma adapter for Better Auth database layer — consistent with Prisma 7 schema
- [01-02]: Organization metadata for extended settings (legalName, fiscalYear, billing, language) in Better Auth org metadata field
- [01-02]: Sensitive action re-auth guard: 5-minute session age threshold for role changes, deactivation, settings
- [01-03]: Simple shadcn Table for user management (not TanStack DataTable) — sufficient for v1 team sizes
- [01-03]: Role badge colors via Tailwind utility classes with dark mode variants for all 8 roles
- [01-04]: Polish (pl) as default locale with next-intl 4.8.3, middleware for locale routing
- [01-04]: Translation structure: 9 namespaces (Auth, Navigation, TopBar, Dashboard, Settings, Users, Errors, Validation, Common)
- [02-01]: billingModel/rateValueGrosze stored in Contractor.customFieldsJson (billing profile schema lacks billingModel column)
- [02-01]: plain() JSON serialize/deserialize pattern to strip Prisma types from tRPC router returns (TS2742 fix)
- [02-01]: PostgreSQL 'simple' text search config for tsvector (supports Polish names, NIP numbers, mixed-language data)
- [02-02]: NuqsAdapter added to root providers for URL state management (nuqs used for table filter/sort/pagination state)
- [02-02]: Suspense boundary for nuqs pages — useSearchParams requires Suspense during SSG prerendering
- [02-02]: Local wizard Zod schema mirroring validators package to avoid web->validators cross-package dependency
- [02-02]: GUS autofill via direct fetch to tRPC endpoint (gusLookup is query procedure, not mutation)
- [02-03]: Added notes field to contractorUpdateSchema for right-rail quick notes editing
- [02-03]: URL query param (?tab=overview) for profile tab state to support deep-linking
- [02-03]: base-ui render prop pattern (not Radix asChild) for all trigger components
- [03-01]: contractUpdateSchema uses plain .partial() without .refine() to preserve tRPC type inference -- date validation in procedure
- [03-01]: Org-level expiry reminder defaults stored in Organization.settingsJson under contractExpiryReminderDaysBefore key
- [03-01]: Per-contract reminder overrides stored in Contract.metadataJson under reminderDaysBefore key
- [Phase 03-02]: Document permission as separate resource in auth AC (not nested under contract)
- [Phase 03-02]: Virus scanning is fire-and-forget async; ClamAV unavailability marks FAILED (never skips)
- [Phase 03-03]: Mirrored contractor table pattern exactly for contract list page consistency
- [Phase 03-04]: Local wizard Zod schema mirroring contractCreateSchema to avoid web->validators cross-package dependency
- [Phase 03-04]: Contractor billing pre-fill reads billingModel/rateValueGrosze from customFieldsJson, currency from Contractor model
- [Phase 03-04]: Document upload fires immediately on file selection via presigned URL XHR flow (not deferred to form submit)
- [Phase 03-05]: Browser-native <object> tag for PDF preview instead of react-pdf to avoid bundle size
- [Phase 03-05]: Document download via direct fetch to tRPC query endpoint (getDownloadUrl is query, not mutation)
- [Phase 03-06]: Mini TanStack Table in contractor Contracts tab with simple prev/next pagination (not full nuqs URL state)
- [Phase 03-06]: DropZone always visible in Documents tab empty state for immediate upload convenience
- [Phase 03-06]: Compliance tab upload button scrolls to DropZone section rather than opening separate dialog
- [Phase 03-06]: ExpiryReminderDefaults as standalone Card component in Settings general tab
- [04-01]: Inline addDays/addHours helpers in api package instead of adding date-fns dependency
- [04-01]: configJson uses undefined fallback for Prisma nullable JSON (Prisma type-only export prevents Prisma.JsonNull usage)
- [04-01]: Condition-skipped tasks excluded from both progress numerator and denominator
- [Phase 04]: Mirrored contract-table pattern exactly for workflow-runs-table consistency
- [Phase 04]: Tab state synced to URL via nuqs parseAsString for deep-linking
- [Phase 04]: Templates tab conditionally rendered using usePermissions().can('workflow', ['create'])
- [Phase 04]: Template picker accepts both single contractorId and bulk contractorIds with Promise.all
- [Phase 04-02]: Flat i18n key namespace in Workflows for template builder dynamic key interpolation
- [Phase 04-02]: dnd-kit/sortable v10 with pointer sensor 8px activation constraint for drag handle separation
- [Phase 04-04]: Popover pattern for Skip/Reassign actions to keep task list compact while providing inline editing
- [Phase 04-05]: Start onboarding/offboarding as explicit header buttons (not just dropdown lifecycle actions) for workflow entry point visibility
- [Phase 04-05]: Starter templates use ROLE_BASED assignees with domain-appropriate roles (OPS_MANAGER, LEGAL_VIEWER, IT_ADMIN, FINANCE_ADMIN, TEAM_MANAGER)
- [Phase 04-05]: Seed-if-empty pattern: seedStarterTemplates is no-op when templates exist, called on Templates tab mount
- [Phase 05]: Used Organization.settingsJson for invoiceDeviationThresholdPercent
- [Phase 05]: Contractor lookup uses taxId field matching Prisma model (plan referenced nip)
- [Phase 05]: Invoice match score: 50pts NIP + 30pts contract + 20pts amount; 80+ MATCHED, 50-79 PARTIAL, <50 UNMATCHED
- [Phase 05]: Mirrored contract-table pattern exactly for invoice-table consistency
- [Phase 05]: Status chip bar filters by matchStatus URL param, not invoice status
- [Phase 05]: Upload area uses inline useDropzone for custom per-file progress and invoice.create integration
- [Phase 05]: Resend webhooks.verify with svix headers object (not two-arg form) for signature verification
- [Phase 05]: Server-side PutObjectCommand for R2 upload in webhook (not presigned URL) since server context
- [Phase 05]: @contractor-ops/db added as web dependency for direct Prisma access in webhook routes
- [Phase 05-04]: base-ui render prop pattern for PopoverTrigger and DropdownMenuTrigger (not Radix asChild)
- [Phase 05-04]: CurrencyInput sub-component for grosze/PLN display conversion with controlled input state
- [Phase 05]: Contractor invoices tab follows prop-injection pattern (invoicesContent) consistent with other tabs
- [Phase 05]: Settings router extended with getInvoiceSettings/updateInvoiceSettings for settingsJson deviation threshold
- [Phase 05]: Org slug exposed in settings.get for invoice email address generation
- [Phase 06]: JSON.parse(JSON.stringify()) for Prisma InputJsonValue type constraint on stepsJson
- [Phase 06]: Member.role string field lookup for role-based approver resolution
- [Phase 06]: approverRole validator includes all 8 UserRole enum values for full flexibility
- [Phase 06]: Extended getAuditTrail API to return flow summary with step data for chain tracker rendering
- [Phase 06]: Mini chain tracker uses estimated step count from stepOrder (not full flow steps fetch) for side panel speed
- [Phase 06]: labelKey pattern for static config objects with i18n keys resolved at render time
- [Phase 06]: TranslateFn prop pattern for passing t() to deeply nested sub-components
- [Phase 06]: useEffect-based selection forwarding for TanStack Table row selection to parent callback
- [Phase 07-01]: getOrCreatePreferences defaults all channels enabled for new users; channelInApp always true
- [Phase 07-01]: 60s deduplication window for notification dispatch (same user+type+entityId)
- [Phase 07-01]: HMAC-signed OAuth state parameter for Slack CSRF protection
- [Phase 07-02]: Subpath exports for api package services to enable direct imports from web API routes
- [Phase 07-02]: JSX support in api tsconfig for React Email template compilation
- [Phase 07-02]: ApprovalDecision records created on Slack approve/reject for audit trail consistency
- [Phase 07-03]: Entity URL routing via inline getEntityUrl helper mapping EntityType enum to app routes
- [Phase 07-04]: nuqs parseAsString for tab state URL sync to support OAuth callback deep linking
- [Phase 07-04]: Tooltip render prop pattern (not asChild) for disabled switches per base-ui convention
- [Phase 07]: Resend added to api package for email delivery; lazily initialized
- [Phase 07]: All notification dispatch calls fire-and-forget (.catch) to never block mutations
- [Phase 07]: Structured Notifications i18n namespace with backward-compatible flat keys for Plan 03-04
- [Phase 08-00]: Vitest globals enabled for describe/it/expect without imports in test files
- [Phase 08-00]: Test include pattern src/**/__tests__/**/*.test.ts for colocated test directories
- [Phase 08-payments]: bankAccountMasked field used for IBAN in exports (ContractorBillingProfile stores masked, not raw IBAN)
- [Phase 08-payments]: VALID_TRANSITIONS state machine for payment run lifecycle (DRAFT->LOCKED->EXPORTED->COMPLETED/FAILED/CANCELLED)
- [Phase 08-payments]: Pure function export generators (CSV/Elixir/SEPA) in payment-export.ts service, bank statement matching in bank-statement.ts
- [Phase 08-03]: Adapted i18n to project single-file locale structure (en.json/pl.json) instead of separate file approach
- [Phase 08-03]: Transfer title settings uses settingsJson merge via settings.update mutation
- [Phase 08-02]: Inline form state approach for per-item actions (paid/failed/remove) instead of Popover-in-Dropdown composition
- [Phase 08-02]: base64 Blob download via URL.createObjectURL for export file delivery in confirmation step
- [Phase 09-01]: WorkflowTaskRun status TODO/IN_PROGRESS for open tasks KPI (not PENDING)
- [Phase 09-01]: Compliance gaps computed in-memory for consistency with contractor router health logic
- [Phase 09-04]: Expandable rows via Record<string,boolean> state toggle; native date inputs for date filters; admin-only audit tab via settings:read permission
- [Phase 09-02]: Inline RangeToggle for chart range instead of missing shadcn ToggleGroup primitive
- [Phase 09-03]: Button group for date presets instead of ToggleGroup (component not available)

### Pending Todos

None yet.

### Blockers/Concerns

- Research flags Phase 4 (Workflow Engine) and Phase 6 (Approval Workflow) as needing deeper technical design before implementation
- ~~Integer-grosze vs Decimal decision must be made during Phase 1 database schema design~~ RESOLVED: Integer grosze chosen
- Prisma 7 prisma.config.ts fails to parse on Node 24.11.0 — using --schema flag workaround. Monitor for Prisma fix.

## Session Continuity

Last session: 2026-03-22T14:03:31.240Z
Stopped at: Completed 09-03-PLAN.md
Resume file: None
