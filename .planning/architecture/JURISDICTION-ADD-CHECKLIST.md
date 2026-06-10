# Jurisdiction Add Checklist

Use when adding a new market (e.g. `IE`, `NL`) or extending an existing jurisdiction with new compliance docs. **Start at the registry** — everything else derives from it.

## 1. Compliance policy (rules engine)

| Step | File / action |
|------|----------------|
| Add doc entry | `packages/compliance-policy/src/doc-registry.ts` — `{ id, jurisdiction, severity, i18nKey }` |
| Add policy rules | `packages/compliance-policy/src/policies/<jurisdiction>.ts` (new file or extend) — `policyRuleId` must match registry `id` |
| Register policies | `packages/compliance-policy/src/registry.ts` — import + include in `REGISTRY` |
| Expiry / TZ (if doc has expiry) | `packages/compliance-policy/src/expiry.ts` — jurisdiction timezone helper if new region |

**Verify:** `pnpm --filter @contractor-ops/compliance-policy test`

## 2. Validators / legal (locked phrases + display maps)

| Step | File / action |
|------|----------------|
| Locked doc display names | `packages/validators/src/legal/compliance-<cc>.ts` — `LOCKED_COMPL_NAMES_<CC>` keyed by policy `id` |
| Statutory phrases (if any) | `packages/validators/src/legal/<cc>.ts` — `LOCKED_<CC>_PHRASES` |
| IP clauses (if contracts) | `packages/validators/src/legal/ip-clauses-<cc>.ts` + register in `ip-clauses-index.ts` |
| Disclaimers / banners | `packages/validators/src/legal/disclaimers.ts` — advisory copy only |
| Export barrel | `packages/validators/src/legal/index.ts` + `packages/validators/src/index.ts` |
| Signoff registry | `packages/validators/src/legal/signoff-registry.json` — `PENDING` entry per locked phrase / doc name (`legal-signoff.*`) |

**Verify:** `pnpm test --filter @contractor-ops/validators` + legal signoff parity guards

## 3. API gate + services

| Step | File / action |
|------|----------------|
| Payment block | `packages/api/src/services/compliance-payment-gate.ts` — uses `@contractor-ops/compliance-policy`; no per-country fork unless new gate type |
| Reminder scan | `packages/api/src/services/compliance-reminder-scan.ts` — doc expiry from policy registry |
| Approval operators | `packages/api/src/services/approval-engine/operators/` — if jurisdiction-specific approval rules |
| Classification (if applicable) | `packages/api/src/routers/compliance/classification-*.ts` + `packages/classification/` rule packs |
| Country fields | `packages/validators/src/country-fields.ts` — `<cc>CountryFieldsSchema` + `countryFieldsSchemaMap` |
| Gov / registry clients | `packages/gov-api/` or `packages/integrations/` adapter — VIES, HMRC, USPS, etc. |

**Verify:** `pnpm typecheck --filter=@contractor-ops/api`

## 4. i18n (web-vite staff + portal)

| Step | File / action |
|------|----------------|
| Compliance doc labels | `apps/web-vite/messages/{en,pl,de,ar,en-US}.json` — `Compliance.documents.<JURISDICTION>.<i18nKey>` |
| Country / tax copy | Same message files — `Contractors.countryFields.<CC>.*`, `Settings.compliance.*` |
| RTL (if Arabic market) | `apps/web-vite/src/i18n/messages.ts` — locale already supports `ar`; add keys in `ar.json` |
| Parity guard | `pnpm check:i18n-parity` (or project i18n parity script) — all locales must have new keys |

## 5. UI (web-vite)

| Step | File / action |
|------|----------------|
| Country compliance section | `apps/web-vite/src/components/contractors/country-compliance-section.tsx` — dispatch `case '<CC>'` |
| Jurisdiction fields component | `apps/web-vite/src/components/contractors/<cc>-compliance-fields.tsx` (mirror `uk-compliance-fields.tsx`, `us-compliance-fields.tsx`) |
| Compliance dashboard | `apps/web-vite/src/components/compliance/` — KPI / doc widgets if new severity rules |
| Status badges | `packages/ui/src/status/` — add mapper entry if new entity statuses |
| Settings surfaces | `apps/web-vite/src/components/settings/` — jurisdiction-specific integration toggles |

**Rule:** Container + hook only — no tRPC in presentational components (`apps/web-vite/ARCHITECTURE.md`).

## 6. Feature flags

| Step | File / action |
|------|----------------|
| Declare flag | `packages/feature-flags/src/flags-core.ts` — `FLAGS` entry with `jurisdiction: 'EU' \| 'ME' \| 'US' \| 'ANY'` |
| Signoff (if gated namespace) | `packages/feature-flags/src/signoff-registry-flags.json` — `PENDING` entry |
| Cohort (v7 only) | Add to `V7_FLAG_KEYS` in `flags-core.ts` if part of v7.0 cohort |
| Server gate | `packages/api/src/middleware/feature-flag.ts` — `requireFeatureFlag('…')` on new procedures |
| Client gate | `apps/web-vite` — `useFlag` / `<Feature>` in container; flag-off = remove route subtree |

See [FEATURE-FLAG-ADD-CHECKLIST.md](./FEATURE-FLAG-ADD-CHECKLIST.md).

## 7. Signoff JSON (legal review workflow)

| Registry | Path | When |
|----------|------|------|
| Legal phrases / doc names | `packages/validators/src/legal/signoff-registry.json` | Every `LOCKED_*` phrase and `LOCKED_COMPL_NAMES_*` key |
| Feature flags | `packages/feature-flags/src/signoff-registry-flags.json` | Gated flag namespaces (`module.*`, `integration.*`, `payroll.*`, etc.) |

Flip `PENDING` → `APPROVED` only via dedicated PR with `legalTicketRef`. Boot gate: `assertFlagSignoffsOrExit()` in `apps/api`, `apps/public-api`, `apps/cron-worker`.

## 8. Landing + CMS (marketing legal only)

| Step | File / action |
|------|----------------|
| CMS legal doc | `apps/cms` — `legal-documents` collection entry via Payload admin or `apps/cms/src/lib/legal-content.ts` backfill pattern |
| Landing copy | `apps/landing/messages/` — market-specific pricing/legal links only |

Do **not** put statutory compliance phrases in CMS — see [LEGAL-CONTENT-BOUNDARY.md](./LEGAL-CONTENT-BOUNDARY.md).

## 9. Smoke verification

```bash
pnpm typecheck --filter=@contractor-ops/compliance-policy --filter=@contractor-ops/validators --filter=@contractor-ops/api
pnpm test --filter=@contractor-ops/compliance-policy --filter=@contractor-ops/validators
```

Manual: create contractor in new jurisdiction → upload compliance doc → confirm payment gate + reminder + i18n labels.

## File count expectation

| Before Wave E target | After registry-first |
|---------------------|----------------------|
| 8–12 files per new doc | 4–5 (registry + generated map + API hook + UI dispatch) |
