---
phase: 48-zatca-fatoorah-integration
status: issues_found
depth: standard
files_reviewed: 37
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
reviewed: 2026-04-12
---

# Code Review: Phase 48

## Summary

Phase 48 implements ZATCA Fatoorah e-invoicing integration covering device onboarding (5-step wizard), invoice hash chain management, async submission via QStash, XAdES-BES signing, TLV QR code generation, and full UI. The architecture is sound with good separation of concerns, proper secret management via Infisical, and advisory lock-based chain integrity. However, there are critical issues: a missing OTP parameter in the compliance CSID flow, placeholder XML in the submission pipeline, and an Infisical initialization that silently proceeds with empty credentials. Several warnings around race conditions, error handling gaps, and logic issues are also noted.

## Findings

### CR-001: requestComplianceCsid API signature mismatch -- missing OTP parameter
- **Severity:** critical
- **File:** packages/einvoice/src/profiles/zatca/api-client.ts:134
- **Description:** `ZatcaApiClient.requestComplianceCsid(csrBase64, otp)` requires two parameters (CSR + OTP), but the onboarding service at `packages/api/src/services/zatca-onboarding.ts:290` calls it with only one argument: `apiClient.requestComplianceCsid(csrBase64)`. The OTP is a one-time password issued by ZATCA during onboarding and is required by the API. This call will fail at runtime with an `undefined` OTP header, and the ZATCA API will reject it.
- **Fix:** Add an `otp` parameter to the `requestComplianceCsid` service function and router mutation. The user must provide the OTP from ZATCA's portal. Update the UI step 3 to include an OTP input field. Alternatively, if using the `loadZatcaApiClient` interface (the `ZatcaApiClientLike` type), note that its `requestComplianceCsid` signature also only accepts one parameter, masking the issue.

### CR-002: Submission pipeline uses placeholder XML instead of real invoice generation
- **Severity:** critical
- **File:** packages/api/src/services/zatca-submission.ts:122
- **Description:** The submission orchestrator generates `const invoiceXml = '<Invoice>${invoiceId}</Invoice>'` as a placeholder. This means every invoice submitted to ZATCA will be invalid XML that cannot pass validation. The comment says "will be replaced when the full EInvoice pipeline is wired" but the pipeline is otherwise wired end-to-end, including the QStash queue, chain management, and API client. If `queueZatcaSubmission` is called (e.g., via the `resubmit` mutation), it will submit garbage to ZATCA and get rejected, consuming the ICV sequence number.
- **Fix:** Wire the actual `generateZatcaXml` + `ZatcaXAdESSigner.sign` + `ZatcaTLVQRCode.generateQR` pipeline into the submission function, building a proper EInvoice from the Prisma invoice record.

### CR-003: Infisical secret store created with empty credentials when env vars are missing
- **Severity:** critical
- **File:** packages/integrations/src/services/infisical-client.ts:253-259
- **Description:** `createZatcaSecretStore` falls back to empty strings for `clientId`, `clientSecret`, and `projectId` when env vars are not set (`process.env.INFISICAL_CLIENT_ID ?? ""`). The `InfisicalSecretStore` constructor accepts these without validation. The first `get`/`set` call will attempt to authenticate with empty credentials, fail, throw a `SecretStoreError`, and bubble up as an opaque 500 error to the user. In production, this could silently fail if the env vars are accidentally removed, causing onboarding to break without a clear diagnostic.
- **Fix:** Validate that required Infisical config values are non-empty in `createZatcaSecretStore`. Throw a descriptive error immediately (e.g., "INFISICAL_CLIENT_ID is not configured") rather than deferring failure to the first SDK call.

### WR-001: Compliance test invoices all use the same PIH (INITIAL_PIH) instead of chaining
- **Severity:** warning
- **File:** packages/einvoice/src/profiles/zatca/onboarding.ts:250
- **Description:** All 6 compliance test invoices use `pih: INITIAL_PIH` (SHA-256 of "0"). Per ZATCA spec, each invoice's PIH should reference the hash of the previous invoice in the chain. For compliance checks this may be acceptable if ZATCA's sandbox doesn't enforce chaining, but it contradicts the documented chain behavior and could cause failures if the sandbox is strict.
- **Fix:** Compute the hash of each generated invoice XML and use it as the PIH for the next test invoice in sequence.

### WR-002: loadZatcaApiClient uses dynamic import but ZatcaApiClient is statically exported
- **Severity:** warning
- **File:** packages/api/src/services/zatca-onboarding.ts:80-101
- **Description:** `loadZatcaApiClient` uses a dynamic `import()` of `@contractor-ops/einvoice` and accesses `ZatcaApiClient` via string lookup with a separate `ZatcaApiClientLike` interface. However, `ZatcaApiClient` is already exported from the einvoice package and imported statically in `zatca-submission.ts:18`. The dynamic import adds complexity and introduces a divergent interface (`ZatcaApiClientLike.requestComplianceCsid` takes 1 param while the real class takes 2 -- see CR-001). The onboarding service also doesn't pass required `baseUrl` to the constructor, only `environment`, which the real `ZatcaApiClient` constructor does not accept.
- **Fix:** Import `ZatcaApiClient` statically. Resolve the `baseUrl` from the environment string within the service, then construct the client with the proper `ZatcaApiClientConfig`. Remove the `ZatcaApiClientLike` interface.

### WR-003: Resubmission creates a duplicate chain entry instead of updating the existing one
- **Severity:** warning
- **File:** packages/api/src/services/zatca-submission.ts:109-143 and packages/api/src/routers/zatca.ts:173-191
- **Description:** When `resubmit` is called for a REJECTED invoice, `queueZatcaSubmission` -> `submitToZatca` acquires a new chain entry with a new ICV. But `invoiceId` has a `@unique` constraint in `ZatcaInvoiceChain`, so `recordChainEntry` will throw a unique constraint violation since the original chain entry for that invoiceId already exists. The resubmit flow will fail with a Prisma error.
- **Fix:** For resubmission, either delete the old chain entry before creating a new one, or update the existing chain entry's status back to PENDING and reuse its ICV. The latter preserves chain integrity.

### WR-004: Environment toggle is client-side only and not persisted to the server
- **Severity:** warning
- **File:** apps/web/src/app/[locale]/(dashboard)/settings/integrations/zatca/page.tsx:36-38
- **Description:** The `environment` state is a local React `useState` initialized from the connection state. Changing it via the `EnvironmentToggle` does not call any tRPC mutation to persist the change. Refreshing the page resets it. The submission service reads environment from `connection.configJson.environment`, which won't reflect the toggle.
- **Fix:** Add a tRPC mutation to update the ZATCA connection's environment in `configJson`. Call it from the `EnvironmentToggle` `onChange` handler.

### WR-005: Hash chain advisory lock uses `$executeRawUnsafe` but parameter is safely bound
- **Severity:** warning
- **File:** packages/api/src/services/zatca-hash-chain.ts:71
- **Description:** `$executeRawUnsafe` is used with a parameterized query (`$1`), which is correct and safe against SQL injection. However, the Prisma API for parameterized raw queries is `$executeRaw` (with tagged template) or `$queryRawUnsafe` with explicit params. While `$executeRawUnsafe` with positional params works in some Prisma versions, `$executeRaw` with `Prisma.sql` tagged template is the documented safe API and avoids the "unsafe" label in code audits.
- **Fix:** Replace with `prisma.$executeRaw(Prisma.sql\`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))\`)` for clarity and future-proofing.

### WR-006: submitToZatca casts Prisma transaction client with `as any`
- **Severity:** warning
- **File:** packages/api/src/services/zatca-submission.ts:111
- **Description:** `acquireChainLock(tx as any, ...)` and subsequent calls use `as any` to pass the Prisma transaction client to functions expecting `PrismaLike`. This works but defeats type safety. If the `PrismaLike` interface diverges from the actual Prisma client, errors won't be caught at compile time.
- **Fix:** Import the Prisma transaction client type and use it in the `PrismaLike` interface, or use a proper generic constraint.

### WR-007: XAdES signer regex replacement may fail on formatted XML
- **Severity:** warning
- **File:** packages/einvoice/src/profiles/zatca/signer.ts:309,351
- **Description:** The signer injects the signature by replacing `(<ext:ExtensionContent>)(\s*)(<\/ext:ExtensionContent>)`. If the XML generator produces content inside `ExtensionContent` (or the regex doesn't match due to whitespace/attributes), the replacement silently produces unchanged XML. There is no check that the replacement actually occurred, leading to unsigned XML being returned without error.
- **Fix:** After the regex replacement, verify the result differs from the input. Throw an error if the signature injection point was not found.

### IR-001: Unused import in zatca-submission.ts
- **Severity:** info
- **File:** packages/api/src/services/zatca-submission.ts:17-20
- **Description:** `ZATCA_SANDBOX_URL` and `ZATCA_PRODUCTION_URL` are imported and used in the submission service. `ZatcaApiError` is imported for error classification. However, `ZatcaClearanceResponse` and `ZatcaReportingResponse` type imports are used. All imports appear used -- no issue here. However, the `ZatcaSubmissionJobPayload` type includes an `attempt?` field that is never populated or read.
- **Fix:** Remove the unused `attempt` field from `ZatcaSubmissionJobPayload` or implement retry counting.

### IR-002: Duplicate SecretStoreError class definition
- **Severity:** info
- **File:** packages/integrations/src/services/secret-store.ts:32 and packages/integrations/src/services/infisical-client.ts:43
- **Description:** `SecretStoreError` is defined in both `secret-store.ts` and `infisical-client.ts` with slightly different signatures (the infisical version includes a `path` property). Both are exported from the package index. This could cause confusion about which to catch.
- **Fix:** Keep one canonical `SecretStoreError` definition and re-export it from the other location.

### IR-003: Stepper keyboard navigation allows forward navigation beyond completed steps
- **Severity:** info
- **File:** apps/web/src/components/zatca/stepper.tsx:42-43
- **Description:** ArrowRight calls `onStepClick(next)` where `next` could be a future step. The `onStepClick` handler in `onboarding-wizard.tsx:88-94` only allows going back, so forward keyboard navigation is silently ignored. The guard `if (next < currentStep) return` on line 43 is backwards -- it prevents going forward only if `next < currentStep`, which is always false for ArrowRight.
- **Fix:** The `onStepClick` guard in the wizard already prevents forward jumps, so this is cosmetic. But the stepper's own guard logic should be `if (next > currentStep) return` to be self-consistent.

### IR-004: zatcaTrpc proxy types are loosely typed with Record<string, unknown>
- **Severity:** info
- **File:** apps/web/src/components/zatca/zatca-trpc.ts:42-72
- **Description:** The `ZatcaTrpcProxy` interface uses `Record<string, unknown>` for all mutation/query options returns. This means callers must use `as unknown as` casts for mutation inputs (seen in tax-details-form.tsx:68, csr-generation.tsx:87, etc.). While this is documented as a TypeScript depth workaround, it removes all type safety for mutation inputs.
- **Fix:** Consider typing at least the mutation input shapes in the proxy interface, e.g., `mutationOptions: () => { mutationFn: (input: { taxDetails: ZatcaTaxDetails }) => Promise<unknown> }`.

## Files Reviewed

1. `.env.example`
2. `packages/api/src/root.ts`
3. `packages/api/src/routers/zatca.ts`
4. `packages/api/src/services/zatca-hash-chain.ts`
5. `packages/api/src/services/zatca-onboarding.ts`
6. `packages/api/src/services/zatca-submission.ts`
7. `packages/db/prisma/schema/integration.prisma`
8. `packages/db/prisma/schema/invoice.prisma`
9. `packages/db/prisma/schema/organization.prisma`
10. `packages/db/prisma/schema/zatca.prisma`
11. `packages/einvoice/src/index.ts`
12. `packages/einvoice/src/profiles/zatca/api-client.ts`
13. `packages/einvoice/src/profiles/zatca/compliance.ts`
14. `packages/einvoice/src/profiles/zatca/generator.ts`
15. `packages/einvoice/src/profiles/zatca/index.ts`
16. `packages/einvoice/src/profiles/zatca/onboarding.ts`
17. `packages/einvoice/src/profiles/zatca/parser.ts`
18. `packages/einvoice/src/profiles/zatca/qr-code.ts`
19. `packages/einvoice/src/profiles/zatca/schemas.ts`
20. `packages/einvoice/src/profiles/zatca/signer.ts`
21. `packages/einvoice/src/profiles/zatca/types.ts`
22. `packages/integrations/src/index.ts`
23. `packages/integrations/src/services/infisical-client.ts`
24. `packages/integrations/src/services/secret-store.ts`
25. `packages/validators/src/zatca.ts`
26. `apps/web/src/app/[locale]/(dashboard)/settings/integrations/zatca/page.tsx`
27. `apps/web/src/components/zatca/onboarding-wizard.tsx`
28. `apps/web/src/components/zatca/tax-details-form.tsx`
29. `apps/web/src/components/zatca/stepper.tsx`
30. `apps/web/src/components/zatca/csr-generation.tsx`
31. `apps/web/src/components/zatca/compliance-csid.tsx`
32. `apps/web/src/components/zatca/compliance-checks.tsx`
33. `apps/web/src/components/zatca/production-certificate.tsx`
34. `apps/web/src/components/zatca/zatca-status-badge.tsx`
35. `apps/web/src/components/zatca/environment-toggle.tsx`
36. `apps/web/src/components/zatca/zatca-status-card.tsx`
37. `apps/web/src/components/zatca/zatca-compliance-widget.tsx`
38. `apps/web/src/components/zatca/zatca-submission-detail.tsx`
39. `apps/web/src/components/zatca/zatca-trpc.ts`
