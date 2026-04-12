---
phase: 48-zatca-fatoorah-integration
plan: 02
subsystem: einvoice
tags: [zatca, xades, xml-crypto, ecdsa, sha256, digital-signatures, x509, saudi-arabia]

# Dependency graph
requires:
  - phase: 45-pluggable-e-invoicing-engine-core
    provides: Signable interface, CertificateInfo type, EInvoiceProfile capability hooks
  - phase: 48-zatca-fatoorah-integration
    plan: 01
    provides: ZatcaProfile class, UBL 2.1 generator with UBLExtensions/ExtensionContent placeholder
provides:
  - ZatcaXAdESSigner class implementing Signable interface
  - ECDSA-SHA256 custom algorithm for xml-crypto
  - XAdES-BES enveloped digital signature generation and verification
  - 2-pass signing pipeline ensuring canonical form consistency
affects: [48-04-device-onboarding, 48-05-submission-pipeline]

# Tech tracking
tech-stack:
  added: [xml-crypto ^6.0.0]
  patterns: [2-pass XAdES signing with placeholder injection for canonical digest consistency, custom ECDSA-SHA256 algorithm registration for xml-crypto, @xmldom/xmldom resolution through xml-crypto dependency chain]

key-files:
  created:
    - packages/einvoice/src/profiles/zatca/signer.ts
    - packages/einvoice/src/profiles/zatca/__tests__/signer.test.ts
  modified:
    - packages/einvoice/package.json

key-decisions:
  - "2-pass signing: inject placeholder signature into document, compute SignedProperties digest from full DOM context, then rebuild signature with correct digest values -- ensures exact canonical form match between sign and verify"
  - "Custom EcdsaSha256Algorithm class with ieee-p1363 DSA encoding registered on xml-crypto's SignatureAlgorithms -- xml-crypto only ships RSA and HMAC"
  - "Access @xmldom/xmldom via require.resolve through xml-crypto's dependency chain -- avoids adding it as a direct dependency"
  - "SignedProperties reference includes explicit exc-c14n Transform to prevent xml-crypto's verifier from defaulting to regular C14N"
  - "Issuer DN formatted with commas (newlines replaced) for XML compatibility"

patterns-established:
  - "XAdES-BES enveloped signatures: manual SignedInfo construction with xml-crypto for canonicalization and verification only"
  - "Document digest preservation: signature injected after opening tag preserving trailing whitespace so enveloped-signature transform produces identical canonical form"
  - "Certificate handling: supports both PEM and base64-encoded DER for certificates and private keys (PKCS8 and SEC1 formats)"

requirements-completed: [ZATCA-02]

# Metrics
duration: 34min
completed: 2026-04-11
---

# Phase 48 Plan 02: XAdES-BES Signing Summary

**XAdES-BES enveloped digital signatures with ECDSA-SHA256 for ZATCA invoices using xml-crypto and 2-pass canonical digest computation**

## Performance

- **Duration:** 34 min
- **Started:** 2026-04-11T12:49:02Z
- **Completed:** 2026-04-11T13:23:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ZatcaXAdESSigner class implementing Signable interface with sign() and verify() methods
- XAdES-BES enveloped signatures embedded inside UBLExtensions/ExtensionContent per ZATCA spec
- SignedProperties containing signing time, certificate SHA-256 digest, issuer DN, and serial number
- Sign/verify roundtrip validated with tamper detection confirmed
- Private key security enforced (never appears in signed XML output)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install xml-crypto dependency** - `78dde3c` (chore)
2. **Task 2: ZatcaXAdESSigner implementation (TDD)** - `5068c04` (test: RED) + `0fe0cd7` (feat: GREEN)

_TDD task has RED (test) + GREEN (feat) commits._

## Files Created/Modified
- `packages/einvoice/package.json` - Added xml-crypto ^6.0.0 dependency
- `packages/einvoice/src/profiles/zatca/signer.ts` - ZatcaXAdESSigner with XAdES-BES signing and verification
- `packages/einvoice/src/profiles/zatca/__tests__/signer.test.ts` - 8 tests covering signature structure, algorithms, roundtrip, tampering, key safety

## Decisions Made
- Used 2-pass signing approach: inject placeholder signature, compute SignedProperties digest from full document DOM context, then re-sign with correct values. This was necessary because exclusive C14N produces different canonical forms depending on document context (namespace inheritance, ancestor declarations).
- Registered custom EcdsaSha256Algorithm on xml-crypto's SignatureAlgorithms since xml-crypto v6 only ships RSA and HMAC algorithms. Uses ieee-p1363 DSA encoding per ZATCA spec.
- Added explicit exc-c14n Transform element to the SignedProperties reference in SignedInfo. Without it, xml-crypto's verifier defaults to regular C14N (per XML DSig spec section 4.3.3.2), causing digest mismatch.
- Resolved @xmldom/xmldom through xml-crypto's dependency chain using require.resolve() with paths option, avoiding a direct dependency since pnpm strict mode doesn't hoist transitive deps.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- xml-crypto `computeSignature` adds `Id` attributes to referenced elements and overwrites `ref.uri`, making it unsuitable for XAdES where SignedProperties requires specific Id and URI values. Resolved by building the signature XML manually and using xml-crypto only for canonicalization utilities and verification.
- xml-crypto postinstall build failure in Turborepo due to validators package missing einvoice types. Resolved by installing with `--ignore-scripts` and adding xml-crypto to package.json manually.
- SignedProperties digest mismatch between signing and verification caused by xml-crypto's verifier defaulting to regular C14N when no Transforms element present on a Reference. Fixed by adding explicit exc-c14n Transform to the SignedProperties reference.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all signing operations produce complete XAdES-BES signatures.

## Next Phase Readiness
- ZatcaXAdESSigner is ready to be wired into ZatcaProfile's `sign` capability (done by the profile registration code)
- Signing pipeline is ready for Plan 05 (submission pipeline) to use in the invoice signing flow
- Verification can be used to validate signed invoices returned from ZATCA clearance API

## Self-Check: PASSED

All files exist, all commits verified, all content checks passed.

---
*Phase: 48-zatca-fatoorah-integration*
*Completed: 2026-04-11*
