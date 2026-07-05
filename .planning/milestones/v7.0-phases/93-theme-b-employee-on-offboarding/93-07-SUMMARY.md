# Plan 93-07 Summary — Government-integration stub seams

**Wave:** 2 · **Status:** complete

## What shipped

Five typed, network-free gov stub modules (mirror `elstam-stub`), each returning
`{ source: 'STUB', available: false, note }` with PII masked to last-2:

| Module | Function | Interaction |
|--------|----------|-------------|
| `i9-everify-stub.ts` | `submitI9EVerify({ ssnLast4, caseId? })` | US I-9 + E-Verify (no live SSA/DHS) |
| `zus-zwua-stub.ts` | `submitZusZwua({ pesel, terminationDate })` | PL ZUS ZWUA deregistration (no live PUE ZUS) |
| `abmeldung-sv-stub.ts` | `submitAbmeldungSv({ svNumber, terminationDate })` | DE Abmeldung SV (no live DEÜV) |
| `hmrc-rti-stub.ts` | `submitHmrcRti({ niNumber, payrollId, eventType })` | UK HMRC RTI FPS (no live RTI) |
| `pit-filing-stub.ts` | `submitPitFiling({ pesel, formType })` | PL PIT-2/PIT-11 filing (no live e-Deklaracje) |

Shared `gov-stub-types.ts` holds `GovStubResult` + a `maskLast2` helper. Each gov
interaction is a documented seam backed by a MANUAL workflow task (Plan 05 seed
content); Steuer-ID lookup reuses the existing `lookupElstam` — not re-stubbed.

## Verification

- `pnpm -F @contractor-ops/api test gov-stubs` → **GREEN** (5/5: STUB/unavailable shape, last-2 PII mask, no fetch call).
- Network-free proof: no `fetch(`/`undici`/`axios`/`node:http(s)` import in any stub (grep-verified).
- `pnpm typecheck --filter=@contractor-ops/api` + `pnpm lint:logs` → green (no `console.*`; 2438 files clean).
