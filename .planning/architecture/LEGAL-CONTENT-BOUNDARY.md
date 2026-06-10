# Legal Content Boundary

Three surfaces carry legal copy. **Never duplicate statutory phrases across layers** — each layer has a fixed responsibility.

## Summary

| Layer | Owns | Must not own |
|-------|------|--------------|
| **CMS** (`apps/cms`) | Editable marketing + policy pages served to landing | Locked compliance doc names, tax disclaimers with legal force, classification verdict text |
| **web-vite** (`apps/web-vite`) | App UX copy, privacy notice rendering, CMS-fetched terms | Authoritative statutory phrases (import from validators) |
| **validators** (`packages/validators/src/legal/`) | Locked phrases, disclaimers, IP clauses, compliance doc display names | Long-form privacy policy prose, blog content |

## CMS — Payload (`apps/cms`)

**Collections:** `legal-documents` (`privacy`, `terms`, `sub-processors`, `breach-notification`)

| Path | Role |
|------|------|
| `apps/cms/src/collections/LegalDocuments.ts` | Schema + locale fields |
| `apps/cms/src/lib/legal-content.ts` | One-time backfill / seed summaries |
| `apps/landing` | Fetches CMS legal docs for public site |

**Use for:** Terms of service updates, privacy policy sections editable without deploy, sub-processor list, breach notification template.

**Do not use for:** Scheinselbständigkeit labels, IR35 SDS statutory sentences, `LOCKED_COMPL_NAMES_*` doc titles, W-9 field certifications.

## web-vite — staff app + portal

| Path | Role |
|------|------|
| `apps/web-vite/messages/*.json` | UI labels, help text, non-statutory explanations |
| `apps/web-vite/src/components/legal/*` | Privacy notice layout, CMS Lexical renderer, terms containers |
| `packages/validators/src/privacy-notices/` | Structured privacy notice sections (jurisdiction-resolved) |
| `apps/web-vite/src/components/contractors/*-compliance-fields.tsx` | Field labels; statutory hints via i18n keys |

**Use for:** Button copy, form labels, empty states, navigation, privacy notice **structure** + CMS body injection.

**Import locked text from validators:**

```typescript
import { LOCKED_DE_PHRASES, DISCLAIMER_SCHEIN_BODY } from '@contractor-ops/validators';
```

Never hardcode strings that exist in `LOCKED_*` maps.

## validators — compliance authority

| Module | Content type |
|--------|--------------|
| `legal/compliance-{de,uk,pl,us,uae,ksa}.ts` | `LOCKED_COMPL_NAMES_*` — doc display names (4 locales) |
| `legal/{de,en,gb,ae,sa}.ts` | Jurisdiction statutory phrase libraries |
| `legal/disclaimers.ts` | `LOCKED_DISCLAIMERS`, advisory banners, acknowledgement strings |
| `legal/ip-clauses-*.ts` | Contract IP assignment phrase IDs |
| `legal/signoff-registry.json` | `PENDING` / `APPROVED` gate for every locked key |

**Source of truth chain for compliance docs:**

```
packages/compliance-policy/src/doc-registry.ts   (id, jurisdiction, i18nKey)
        ↓
packages/validators/src/legal/compliance-*.ts    (display names per locale)
        ↓
apps/web-vite/messages/*.json                    (Compliance.documents.* UI chrome only)
```

Registry `i18nKey` is the leaf key under `Compliance.documents.{jurisdiction}` in web-vite messages — **not** the locked phrase text itself.

## Decision tree

```
Is it a statutory / legally-reviewed fixed phrase?
  YES → validators/legal + signoff-registry.json
  NO → Is it a long-form policy page editable by ops?
    YES → CMS legal-documents
    NO → web-vite messages/*.json
```

## Anti-patterns

- Copying `LOCKED_COMPL_NAMES_DE['de.a1@v1'].de` into `messages/de.json` — drifts on legal update
- Storing W-8BEN certification text in CMS — belongs in validators when Phase 85 ships
- Using CMS for classification PDF boilerplate — use `packages/api/src/pdf-templates/` + validators phrases
- Adding Arabic statutory text only in `en.json` — `i18n:parity` requires `ar` keys (interim mirror documented in compliance-*.ts)

## Related

- [JURISDICTION-ADD-CHECKLIST.md](./JURISDICTION-ADD-CHECKLIST.md) — step 2 + 7
- `packages/compliance-policy/src/doc-registry.ts` — doc identity SSOT (Wave E E1)
