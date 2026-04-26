# `[FLAG-SIGNOFF]` — boot-fail remediation

Phase 70 D-10 — feature-flag namespace signoff gate.

## Symptom

```
[FLAG-SIGNOFF] flag 'compliance-portal-self-service' missing registry entry — refusing to boot. Add a PENDING entry to packages/feature-flags/src/signoff-registry-flags.json (see docs/lint-remediation/flag-signoff.md) or set FLAG_SIGNOFF_BYPASS=local for LOCAL-ONLY dev.
```

The Next.js / standalone process exits before serving any request.

## Root cause (PITFALLS P30)

A flag whose key starts with `compliance-`, `idp-deprovisioning`, `gulf-`,
or `offboarding-ip-` was added to `FLAGS` in
`packages/feature-flags/src/registry.ts`, but the parallel signoff registry
at `packages/feature-flags/src/signoff-registry-flags.json` has no entry
for it.

These four namespaces ship legal-sensitive surfaces (compliance documents,
IdP deprovisioning, Gulf-region scope, offboarding IP). Shipping any of
them without a recorded sign-off is a regulator-grade incident class.

## Fix path 1 — add a PENDING entry (most common)

Open `packages/feature-flags/src/signoff-registry-flags.json` and add:

```json
{
  "compliance-portal-self-service": {
    "status": "PENDING",
    "notes": "Awaiting Internal Counsel review of the self-service portal copy"
  }
}
```

Re-run boot. Gate is satisfied.

Before the flag can ship to production (Phase 80 production gate), flip
`status` to `APPROVED` and add the four required fields:

```json
{
  "compliance-portal-self-service": {
    "status": "APPROVED",
    "approvedBy": "jane@contractor-ops.local",
    "approvedAt": "2026-05-01T00:00:00.000Z",
    "approverRole": "LEGAL_LEAD",
    "legalTicketRef": "LEGAL-1234"
  }
}
```

The Zod schema in `signoff-registry-flags-schema.ts` enforces the
APPROVED-requires-all-four-fields refine at module-load time — partial
APPROVED entries fail the boot with a parse error.

## Fix path 2 — bypass for LOCAL-ONLY dev

If you're a developer running `pnpm dev` against a fresh checkout that has
gated flags but no signoff entries (e.g., a teammate's branch in flight):

```sh
export FLAG_SIGNOFF_BYPASS=local
pnpm dev
```

Boot proceeds with a `[FLAG-SIGNOFF] WARN` line per missing entry. **This
bypass MUST NOT ship to production** — Phase 80 will add a production-side
gate that asserts `FLAG_SIGNOFF_BYPASS=` (empty) at deploy time.

## Fix path 3 — the flag isn't actually gated

If you accidentally chose a key starting with one of the gated prefixes
for a non-legal-sensitive flag (e.g., `compliance-internal-debugging`),
rename the flag key to something outside the gated namespaces. The
gate's prefix list is in
`packages/feature-flags/src/signoff-registry-flags.ts`
(`GATED_FLAG_NAMESPACE_PREFIXES`).

## Why two registries?

Phase 64 introduced a separate signoff registry at
`packages/validators/src/legal/signoff-registry.ts` for **disclaimer text
sign-off**. Phase 70 adds this registry at
`packages/feature-flags/src/signoff-registry-flags.ts` for **feature-flag
sign-off**. They are independent:

| | Phase 64 disclaimer registry | Phase 70 flag registry |
|---|---|---|
| File | `packages/validators/src/legal/signoff-registry.{ts,json}` | `packages/feature-flags/src/signoff-registry-flags.{ts,json}` |
| Approver roles | `UK_TAX_ADVISER`, `STEUERBERATER`, `INTERNAL_COUNSEL`, `INTERNAL_PRODUCT` | `LEGAL_LEAD`, `COMPLIANCE_OFFICER`, `PRIVACY_COUNSEL`, `EXTERNAL_COUNSEL` |
| Gate timing | Production deploy (CI legal-gate-production) | App boot (registry import) |
| Stderr prefix | `[signoff-registry]` | `[FLAG-SIGNOFF]` |

Don't mix them up. Each phase that needs a legal-review gate clones the
4-file pattern (schema, json, runtime, tests) with its own role enum
and stderr prefix.
