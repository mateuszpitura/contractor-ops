# Deferred Items — Phase 20

## Pre-existing API Build Errors

The `@contractor-ops/api` package has pre-existing TypeScript errors in `src/services/time-entry.ts` (PrismaClient transaction type mismatch) and `src/services/doc-link-service.ts` (DocSearchResult import, CredentialBlob casting). These prevent `tsc` from emitting updated type declarations. As a result, `trpc.docs.*` and `trpc.calendar.*` are not available in the web app's type system until the API package is rebuilt.

All new UI components (`doc-link-chip.tsx`, `doc-links-section.tsx`, `attach-doc-dialog.tsx`, `provider-icons.tsx`) correctly reference the router procedures but will show TS errors until the API build is fixed.

## Pre-existing Web App Errors

- `src/components/settings/ksef-setup-dialog.tsx` — `throwOnError` type mismatch
- `src/components/time/external-sync-button.tsx` — `asChild` prop not recognized
- `src/components/time/single-entry-form.tsx` — `asChild` prop, Select onChange type
- `src/components/time/time-source-badge.tsx` — `asChild` prop
- `src/components/time/timesheet-header.tsx` — `asChild` prop
