---
title: IRS e-Services TIN Matching
type: integration
tags: [us, tax, irs, tin-match, ssrf, backup-withholding, flag-dark]
source_commit: 18d6df46b
verify_with:
  - packages/integrations/src/adapters/tin-match/tin-match-client.ts
  - packages/integrations/src/adapters/tin-match/mock-tin-match-client.ts
  - packages/integrations/src/adapters/tin-match/eservices-tin-match-client.ts
  - packages/api/src/services/tin-match.service.ts
---

# IRS e-Services TIN Matching

Matches a recipient's name + TIN against IRS records so a mismatch can trigger
backup withholding before year-end 1099-NEC filing.

## Adapter seam

`TinMatchClient` (`packages/integrations/src/adapters/tin-match/`) models the IRS
numerical response indicator (0 = match). The default is a deterministic
`MockTinMatchClient` (format-gated via `isValidEin`/`isValidSsn`). The live
`EServicesTinMatchClient` is **dark**: it pins its base URL to a compile-time
literal by credential environment (SSRF-safe) and **refuses to transmit** until
per-org PAF enrollment + e-Services registration clears its gate — it never
fabricates an indicator.

## Service

`tin-match.service.ts` applies a 24h process-local cache (keyed on
org+recipient+name+**TIN-last4** — a full TIN never enters a key, log, or audit
row) + bounded transient retry. On a mismatch it sets the backup-withholding flag
+ raises an admin escalation + writes an audit row, and **returns** — it never
throws and never blocks. `matchRecipientTin` (W-9 intake) + `revalidateBatchTins`
(year-end loop, completes every recipient even when one mismatches).

## Enablement

Per-org PAF (Application for TIN Matching) enrollment in IRS e-Services, then set
the live credentials to clear the client gate. Operational prerequisite only —
the mock default runs the whole loop without it.

## Related

- [[domains/us-tax-year-end-filing]] · [[integrations/irs-iris]]
