---
title: IRS IRIS (Information Returns Intake System) — 1099-NEC e-file
type: integration
tags: [us, tax, irs, iris, 1099-nec, e-file, xsd, flag-dark]
source_commit: 18d6df46b
verify_with:
  - packages/iris/src/generator.ts
  - packages/iris/src/validator.ts
  - packages/iris/src/schema-bundle/
  - packages/api/src/services/iris-ack-parser.ts
  - packages/api/src/services/tax-filing-transmitter.ts
  - packages/feature-flags/src/flags-core.ts
---

# IRS IRIS

Files US 1099-NEC information returns through the IRS Information Returns Intake
System. Ships **dark**: the surface gates on `module.us-expansion`; automated A2A
transmit gates on `module.iris-efile`.

## Default path — ManualDownload (no TCC)

The shipped GA path needs no IRS Transmitter Control Code. Staff generate the
batch, `buildIrisXml` produces the IRIS XML (fast-xml-parser `XMLBuilder` —
Transmission Manifest with the schema `VersionNum`/`VersionDt`, a 1099-NEC payee
B-record with box-1/box-4 amounts, the masked last-4 recipient TIN, and the CFSF
state code), `xsdValidate` checks it against the bundled IRS XSDs, and staff
download the validated XML to upload to IRIS. The returned acknowledgement file is
uploaded back and parsed by `iris-ack-parser.ts`.

## Dark path — IrisA2A

`tax-filing-transmitter.ts` returns `IrisA2A` only when `module.iris-efile` is
enabled. The build+validate pipeline is real; the SOAP/MTOM transport send is a
documented seam that is not wired until IRS TCC/A2A enrollment lands (it never
sends while dark). `Vendor` is a never-selected stub.

## XSD bundle (human-action checkpoint)

`packages/iris/src/schema-bundle/` holds a checksum-pinned copy of the IRS IRIS
XSDs. They are an **IRS Secure Object Repository (SOR) login-only download** — not
on npm. Until the `.xsd` files are placed and checksum-pinned, `xsdValidate`
returns a non-throwing `BUNDLE_UNAVAILABLE` report (validity unproven; nothing
files) and the `packages/iris` XSD-validation-passes tests **skip and auto-flip**
GREEN the moment the bundle lands. `xsdValidate` is XXE/SSRF-safe: `nonet:true`,
default `noent:false`, lazy bundle dir, no network fetch.

## Acknowledgement statuses

One parser (`iris-ack-parser.ts`) consumes BOTH the manual-uploaded ack file and
the dark A2A poll result, mapping all six IRIS statuses — Accepted, Rejected,
Processing, Partially Accepted, Accepted with Errors, Not Found — to the
`IrisAckStatus` enum, plus the Error Information Group + `OriginalReceiptId`. The
uploaded ack XML is XXE-safe (DOCTYPE rejected; no entity expansion; no network).

## Enablement

IRS account + SOR access → download the tax-year IRIS Schema & Business Rules
package → drop the `.xsd` files in the schema bundle → pin checksums → (for A2A)
IRS TCC approval → set A2A creds → flip `module.iris-efile`. See
`.planning/EXTERNAL-ENABLEMENT.md`. Adviser sign-off is separate from technical
enablement.

## Related

- [[domains/us-tax-year-end-filing]] · [[integrations/irs-eservices-tin-matching]] · [[patterns/feature-flags]]
