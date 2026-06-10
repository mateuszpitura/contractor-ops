# Locale Strategy — Consolidation Plan

Today **three apps maintain separate locale configs** (6 effective surfaces). Goal: shared constants where semantics align; keep intentional divergence documented.

## Current state

| App | Config file | Locales | Default | Notes |
|-----|-------------|---------|---------|-------|
| **web-vite** | `apps/web-vite/src/i18n/messages.ts` | `en`, `pl`, `ar`, `de`, `en-US` (5) | `pl` | Staff SPA + portal; `fallbackLng: ['en-US','en','pl']` |
| **landing** | `apps/landing/src/i18n/config.ts` | `en`, `en-GB`, `pl`, `de`, `ar`, `ar-SA` (6) | `en` | Market pricing (`@/lib/market`); `hreflang` + currency per locale |
| **cms** | `apps/cms/src/i18n/config.ts` | `en`, `pl`, `de`, `ar` (4) | `en` | Payload localization; no `en-US` / `en-GB` yet |

**Message files:**

- web-vite: `apps/web-vite/messages/{locale}.json`
- landing: `apps/landing/messages/{locale}.json` (or co-located per Next.js i18n)
- cms: field-level locale in Payload collections

## Why not one shared locale list

| Concern | web-vite | landing | cms |
|---------|----------|---------|-----|
| `en-US` vs `en` vs `en-GB` | US product copy (Phase 84) | UK market + INTL `en` | Not needed for CMS authors yet |
| `ar` vs `ar-SA` | Single `ar` (RTL) | Split UAE vs KSA markets | Single `ar` |
| Default locale | `pl` (founder market) | `en` (INTL) | `en` (authoring) |
| RTL | `localeMeta[].dir` | `localeConfigs[].dir` | `RTL_LOCALES` set |

**Conclusion:** Unify **primitives** (locale codes, direction, Intl BCP-47 tags); do **not** force identical locale arrays across apps.

## Target architecture (Wave F)

```
packages/ui/src/marketing/          # already started (format-post-date, index)
  locale-codes.ts                   # shared LocaleCode union + isRtl()
  locale-meta.ts                    # nativeName, englishName, dir (no pricing)

apps/*/src/i18n/config.ts           # app-specific: default, supported subset, market extras
```

### Phase 1 — Extract shared primitives (low risk)

1. Add `packages/ui/src/marketing/locale-codes.ts`:
   - `ALL_PRODUCT_LOCALES` — superset union
   - `direction(locale)`, `isRtl(locale)`
2. Re-export from `packages/ui/src/marketing/index.ts`
3. web-vite `messages.ts` imports `direction` helper only (no default change)

### Phase 2 — Align keys where copy is identical

| Domain | Strategy |
|--------|----------|
| Product UI (web-vite) | Full parity across `en`, `pl`, `de`, `ar`, `en-US` — `pnpm check:i18n-parity` |
| `en-US` | Thin override file; fallback to `en` (Phase 84 D-04) |
| Landing marketing | Independent keys; link to CMS for legal |
| CMS | Author in `en`; translate `pl`, `de`, `ar` in Payload |
| Locked legal phrases | `packages/validators/src/legal/*` — **not** message JSON |

### Phase 3 — CI guards

| Guard | Scope |
|-------|-------|
| `check:i18n-parity` | web-vite key symmetry across staff locales |
| Landing parity (May audit #44) | Add when landing message count stabilizes |
| RTL smoke | `ar` routes render `dir=rtl` in web-vite shell |

## Per-app rules

### web-vite

- All user-facing strings in `messages/*.json` — no hardcoded copy in components
- Use `useTranslations`, `tKey` (`apps/web-vite/src/i18n/typed-keys.ts`)
- Portal routes share same locale config as staff
- Date/currency: `useFormatter` + `Intl` with active locale

### landing

- Locale ↔ market mapping stays in `apps/landing/src/lib/market.ts`
- Pricing currency per `localeConfigs[locale].currency`
- Do not import web-vite message files (bundle boundary)

### cms

- Payload `localization: true` on marketing collections (Posts, Legal)
- Lexical renderer shared via `packages/ui/src/marketing/` (Wave F F1)
- CMS locales ⊆ product locales; extra product locales fall back to `en` CMS content

## Migration checklist (incremental)

- [ ] Extract `locale-codes.ts` to `packages/ui/src/marketing/`
- [ ] Document divergent locale arrays in each app's `i18n/config` header comment
- [ ] Add `en-US` to CMS only when US legal pages need separate authoring
- [ ] Run parity after every phase that adds i18n keys (v7 Phases 85–96)

## References

- Phase 84: `en-US` registration — `.planning/milestones/v7.0-phases/84-theme-a-us-contractor-profile-fields-en-us-locale/`
- Phase 50: Arabic RTL — `.planning/milestones/v4.0-phases/50-arabic-localization-rtl-layout/`
- Wave F plan: shared marketing-ui + this doc
