---
phase: 62-zugferd-e-invoicing
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - .github/workflows/verapdf.yml
  - apps/web/e2e/functional/intake-upload-flow.spec.ts
  - apps/web/e2e/functional/zugferd-download-flow.spec.ts
  - apps/web/src/app/[locale]/(dashboard)/invoices/intake/__tests__/page.test.tsx
  - apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/__tests__/intake-detail-client.test.tsx
  - apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/__tests__/page.test.tsx
  - apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/intake-detail-client.tsx
  - apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/page.tsx
  - apps/web/src/app/[locale]/(dashboard)/invoices/intake/page.tsx
  - apps/web/src/components/invoices/einvoice-tab/__tests__/download-zugferd-pdf-button.test.tsx
  - apps/web/src/components/invoices/einvoice-tab/download-zugferd-pdf-button.tsx
  - apps/web/src/components/invoices/intake/__tests__/intake-detail-actions-bar.test.tsx
  - apps/web/src/components/invoices/intake/__tests__/intake-filter-chips.test.tsx
  - apps/web/src/components/invoices/intake/__tests__/intake-status-pill.test.tsx
  - apps/web/src/components/invoices/intake/__tests__/intake-upload-dialog.test.tsx
  - apps/web/src/components/invoices/intake/import-split-button.tsx
  - apps/web/src/components/invoices/intake/intake-detail-actions-bar.tsx
  - apps/web/src/components/invoices/intake/intake-detail-fields-pane.tsx
  - apps/web/src/components/invoices/intake/intake-detail-match-pane.tsx
  - apps/web/src/components/invoices/intake/intake-detail-pdf-pane.tsx
  - apps/web/src/components/invoices/intake/intake-detail-validation-pane.tsx
  - apps/web/src/components/invoices/intake/intake-filter-chips.tsx
  - apps/web/src/components/invoices/intake/intake-list.tsx
  - apps/web/src/components/invoices/intake/intake-profile-level-badge.tsx
  - apps/web/src/components/invoices/intake/intake-status-pill.tsx
  - apps/web/src/components/invoices/intake/intake-upload-dialog.tsx
  - apps/web/src/components/invoices/intake/intake-validation-status-pill.tsx
  - apps/web/src/lib/server-flag.ts
  - packages/api/src/root.ts
  - packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts
  - packages/api/src/routers/__tests__/invoice-intake.test.ts
  - packages/api/src/routers/einvoice.ts
  - packages/api/src/routers/invoice-intake.ts
  - packages/api/src/services/__tests__/fixtures/intake-fixtures.ts
  - packages/api/src/services/__tests__/invoice-intake-matcher.test.ts
  - packages/api/src/services/__tests__/invoice-intake-service.test.ts
  - packages/api/src/services/invoice-intake-matcher.ts
  - packages/api/src/services/invoice-intake-service.ts
  - packages/db/prisma/schema/migrations/20260414120000_invoice_intake_request/migration.sql
  - packages/einvoice/scripts/generate-zugferd-fixtures.ts
  - packages/einvoice/src/profiles/zugferd-de/constants.ts
  - packages/einvoice/src/profiles/zugferd-de/generator.ts
  - packages/einvoice/src/profiles/zugferd-de/index.ts
  - packages/einvoice/src/profiles/zugferd-de/invoice-template.tsx
  - packages/einvoice/src/profiles/zugferd-de/parser.ts
  - packages/einvoice/src/profiles/zugferd-de/pdf-wrapper.ts
  - packages/einvoice/src/profiles/zugferd-de/profile.ts
  - packages/einvoice/src/profiles/zugferd-de/schemas.ts
  - packages/einvoice/src/profiles/zugferd-de/validator.ts
  - packages/einvoice/src/profiles/zugferd-de/xmp-template.ts
  - packages/einvoice/src/profiles/zugferd-de/zugferd-structural-check.ts
findings:
  critical: 2
  warning: 8
  info: 6
  total: 16
status: issues_found
---

# Phase 62: Code Review Report

**Reviewed:** 2026-04-15
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

Phase 62 lands a substantial, well-architected ZUGFeRD inbound + outbound e-invoicing pipeline. The foundations are strong: tenant scoping is consistent (every DB query filters by `organizationId`; cross-org access resolves to `NOT_FOUND`, not `FORBIDDEN`), Zod validates all tRPC boundaries, content-addressed SHA-256 dedup is race-safe (P2002 retry), the ZUGFeRD generator is deterministic (byte-stable fixture digests gate veraPDF CI), and the intake state machine has explicit guards against replay-after-conversion and acknowledge-before-warning threats. The React client boundary is cleanly separated (server components call `notFound()` on flag-off, client boundary handles state).

However, two issues cross into Critical territory:

1. A **multi-tenant authorization gap** in `intake-detail-validation-pane.tsx`: the pane bypasses tRPC's typed client and fetches the HTTP batch endpoint by hand, without auth/CSRF headers, for a procedure that returns a signed R2 URL to a per-tenant validation report. This works only by accident (session cookies ride along); it defeats the tRPC observability + retry/typing story and is a regression of the cross-org-isolation posture the rest of the phase carefully maintains.
2. The **XML preview iframe** renders a signed R2 URL under `sandbox="allow-scripts allow-same-origin"` — since R2 pre-signed URLs live on a different origin from the app, `allow-same-origin` grants the iframe access to its *R2* origin (not the app origin), but combining `allow-scripts` with `allow-same-origin` is explicitly listed in the HTML spec as a pattern that *can* let content escape the sandbox if the signed URL is ever served from an origin adjacent to the app (e.g. a `*.contractor-ops.com` R2 subdomain). Untrusted XML shouldn't execute scripts under any sandbox configuration.

A handful of Warnings cover race-condition smells (match-pane `useEffect` over a new array reference on every render), dead code (a placeholder "Confirm match" button with an empty handler in the actions bar), and typing leaks that widen the router surface (repeated `as never`/`as unknown as {...}` casts that bypass Prisma's typed delegate signatures). None of these block merge, but several should be tightened before this code is wired into production traffic.

Every reviewed file avoids `console.*`, every service throws typed POJO errors that the router translates to `TRPCError`, and the DB migration is forward-compatible with the existing EInvoiceLifecycle pattern. Phase 62 is a high-quality ship with a small set of targeted fixes needed.

## Critical Issues

### CR-01: Validation-report download bypasses tRPC client, constructs batch URL by hand

**File:** `apps/web/src/components/invoices/intake/intake-detail-validation-pane.tsx:55`
**Issue:** The `openReport` callback manually constructs a tRPC batch URL and parses the response with hand-rolled type assertions:

```tsx
const response = await fetch(`/api/trpc/invoiceIntake.downloadValidationReport?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: { intakeId } } }))}`);
const json = (await response.json()) as Array<{ result?: { data?: { json?: { url?: string } } } }>;
const url = json?.[0]?.result?.data?.json?.url;
```

This works today because the session cookie rides along, but it:
- Bypasses tRPC's typed client (no type-safety, no SuperJSON transformer, no retry/auth interceptors).
- Bypasses any future CSRF token the app adds to the tRPC link (`/api/trpc/*` is a state-mutating endpoint in other procedures).
- Silently swallows errors — if the fetch returns a `TRPCError` the code walks the null chain and surfaces nothing to the user (the `finally` block turns off the spinner and that's it — no toast, no logging).
- Mis-classifies a query as a fetch (no cache, no re-use of an in-flight request).
- Hard-codes the batch wire format (`batch=1&input=...`); a future tRPC major version or link reorder breaks silently.

The rest of the codebase uses `useQuery(trpc.invoiceIntake.downloadValidationReport.queryOptions(...))` — mirror that pattern here.

**Fix:**
```tsx
const reportQuery = useQuery({
  ...trpc.invoiceIntake.downloadValidationReport.queryOptions({ intakeId }),
  enabled: false, // fire on demand, not on mount
});

const openReport = useCallback(async () => {
  const result = await reportQuery.refetch();
  if (result.data?.url) {
    window.open(result.data.url, '_blank', 'noopener,noreferrer');
  } else if (result.error) {
    toast.error(t('errorGeneric'));
  }
}, [reportQuery, t]);
```

### CR-02: iframe with `allow-scripts allow-same-origin` renders untrusted ZUGFeRD content

**File:** `apps/web/src/components/invoices/intake/intake-detail-pdf-pane.tsx:59-64`
**Issue:** The PDF preview iframe uses `sandbox="allow-scripts allow-same-origin"` to render a signed R2 URL. The HTML Living Standard explicitly calls this combination out:

> When the embedded document has the same origin as the embedding page, it is strongly discouraged from using both these [`allow-scripts` and `allow-same-origin`] keywords together, as that lets the embedded document remove the sandboxing entirely by replacing itself with the unsandboxed version.

Today R2 pre-signed URLs live on a different origin from the Next.js app, so the `allow-same-origin` branch is benign. But:
1. Uploads to this iframe are *untrusted PDFs that failed KoSIT validation*. The whole point of intake review is that some users upload garbage. Rendering an attacker-controlled PDF under a scripted sandbox is a gift-wrapped XSS on whatever origin the iframe resolves to.
2. If anyone ever routes R2 through a CloudFront/custom domain that shares an eTLD+1 with the app (a common optimization), `allow-same-origin` grants the iframe full DOM access.
3. PDFs don't need `allow-scripts` to display — browsers render PDF natively without the script flag. XML previews also don't need scripts.

**Fix:**
```tsx
<iframe
  src={url}
  title={isXml ? 'XML preview' : 'PDF preview'}
  className="h-[600px] w-full border-0 bg-muted"
  sandbox=""  // or omit entirely for the most restrictive default
  referrerPolicy="no-referrer"
/>
```

The empty `sandbox` attribute applies all restrictions (no scripts, no same-origin, no forms). For XML, the separate `XmlPreview` component already fetches + escapes via `<pre>`; the iframe path is PDF-only, and Chrome/Firefox/Safari all render PDFs fine under `sandbox=""`. Add `referrerPolicy="no-referrer"` so the signed URL's query-string isn't leaked via Referer to any resources the PDF links.

## Warnings

### WR-01: `useEffect` dependency array over a freshly-allocated array ref causes unnecessary re-runs

**File:** `apps/web/src/components/invoices/intake/intake-detail-match-pane.tsx:60-64`
**Issue:**
```tsx
const candidates = (candidatesQuery.data as MatchCandidate[] | undefined) ?? [];
// ...
useEffect(() => {
  if (candidates.length === 1 && !selectedId) {
    setSelectedId(candidates[0]?.contractorId ?? null);
  }
}, [candidates, selectedId]);
```

The `?? []` fallback allocates a brand-new empty array on every render when the query returns `undefined`, and React's dep-array compare is reference-based. During the initial loading state this fires a dozen unnecessary effect runs. It doesn't cause a bug because the body is idempotent, but it's a foot-gun that will become one the moment someone adds a mutation inside the effect.

**Fix:**
```tsx
const candidates = useMemo<MatchCandidate[]>(
  () => (candidatesQuery.data as MatchCandidate[] | undefined) ?? [],
  [candidatesQuery.data],
);
```

Or depend on the primitive instead of the array:
```tsx
useEffect(() => {
  if (candidates.length === 1 && !selectedId) {
    setSelectedId(candidates[0]?.contractorId ?? null);
  }
}, [candidates.length, candidates[0]?.contractorId, selectedId]);
```

### WR-02: Dead-code placeholder `Confirm match` button in actions bar

**File:** `apps/web/src/components/invoices/intake/intake-detail-actions-bar.tsx:186-198`
**Issue:** The actions bar exposes a "Confirm match" button whose `onClick` is an empty comment — it renders under the `showConfirmMatch` condition but does nothing when pressed:

```tsx
{showConfirmMatch && (
  <Button
    type="button"
    onClick={() => {
      // Confirm-match is fired by the match-pane which tracks the
      // selected candidate. Parents may also wire this button via
      // hasSelectedCandidate (this branch simply surfaces the CTA).
    }}
    disabled={confirmMatchMutation.isPending}
    data-testid="intake-confirm-match-placeholder">
    {t('ctaConfirmMatch')}
  </Button>
)}
```

The `data-testid="intake-confirm-match-placeholder"` suffix acknowledges this is a placeholder. Users clicking it see no feedback, no toast, no loading state. The match-pane has its own "Use this contractor" button that fires `confirmMatchMutation` directly, so this one is pure duplication that confuses users.

**Fix:** Either remove the button entirely (the match-pane already surfaces the CTA), or wire it to call `confirmMatchMutation.mutate({ intakeId, contractorId: ... })`. If the intent was "let the action bar be authoritative," the match pane needs to lift its `selectedId` state up and pass it via prop drilling or context — right now the action bar doesn't know which candidate to confirm because `selectedCandidateId` is held in `IntakeDetailClient` but never plumbed through.

### WR-03: `extractedTotalMinor` is cast via `Number(bigint)` and silently loses precision > 2^53

**File:** `apps/web/src/components/invoices/intake/intake-list.tsx:52-66`, `intake-detail-fields-pane.tsx:137-156`
**Issue:**
```tsx
const minor = typeof amountMinor === 'string' ? Number(amountMinor) : Number(amountMinor);
```

The DB column is `BIGINT` (see `migration.sql:33`). For invoices over €90,071,992,547,409.91 (~2^53/100) this loses precision. That's a "never happens in practice" bound for SaaS billing, but:
- Currencies like IDR, VND, and KRW quote in units not subunits — 2^53 IDR is ~€540,000, well below a realistic enterprise deal.
- `typeof amountMinor === 'string' ? Number(amountMinor) : Number(amountMinor)` is a copy-paste bug: both branches do the same thing (casting a bigint also goes through `Number()`, which is what the fallback does). The conditional is dead code.

**Fix:**
```tsx
function formatTotalMinor(amountMinor: unknown, currency: string | null): string | null {
  if (amountMinor === null || amountMinor === undefined) return null;
  const asBig =
    typeof amountMinor === 'bigint' ? amountMinor
    : typeof amountMinor === 'string' ? BigInt(amountMinor)
    : typeof amountMinor === 'number' ? BigInt(Math.trunc(amountMinor))
    : null;
  if (asBig === null) return null;
  // Use Intl.NumberFormat via string split to avoid precision loss on 53+ bit values.
  const safeCurrency = currency ?? 'EUR';
  const sign = asBig < 0n ? '-' : '';
  const abs = (asBig < 0n ? -asBig : asBig).toString().padStart(3, '0');
  const whole = abs.slice(0, -2);
  const frac = abs.slice(-2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
    }).format(Number(`${sign}${whole}.${frac}`)); // Number OK here — formatted string
  } catch {
    return `${sign}${whole}.${frac} ${safeCurrency}`;
  }
}
```

### WR-04: Router file uses `as unknown as {...}` casts instead of Prisma's typed delegates

**File:** `packages/api/src/routers/invoice-intake.ts:190-207`, `packages/api/src/routers/einvoice.ts:248-272`, and scattered throughout both files
**Issue:** Every Prisma call goes through a hand-rolled cast:
```ts
(ctx.db.invoice.findFirst as (args: unknown) => Promise<unknown>)({...})) as Record<string, unknown>;
```

Comments in the code explain the intent ("tRPC's server caller is untyped at the module boundary"), but the effect is that:
- Prisma's `Where`, `Include`, `Select` shapes no longer catch typos at compile time (I can pass `{ organisationId: ... }` with a British spelling and nothing complains).
- The return type is `Record<string, unknown>` so every downstream property read requires another cast.
- When Prisma upgrades or schema changes, nothing surfaces at TS-check time; breakage shows up at runtime as "undefined is not an object."

The typed `PrismaClient` from `@contractor-ops/db/generated/prisma/client` is imported successfully in `invoice-intake-service.ts` — the issue is isolated to `ctx.db` in the router.

**Fix:** Cast `ctx.db` to `PrismaClient` once at the top of each procedure, then use the typed delegates. In routes that need the extension overlay, extract a helper:
```ts
const db = ctx.db as PrismaClient;
const row = await db.invoiceIntakeRequest.findUnique({
  where: { id: input.intakeId },
  select: { id: true, organizationId: true, rawFileKey: true, extractedXmlKey: true, validationReportKey: true, sourceKind: true },
});
```
Prisma will type the return value correctly and the `as unknown as {...}` casts disappear.

### WR-05: `convertToInvoice` silently defaults `issueDate` to `now()` when parsed invoice lacks it

**File:** `packages/api/src/services/invoice-intake-service.ts:618-620`
**Issue:**
```ts
const issueDate = parsed.issueDate
  ? new Date(parsed.issueDate)
  : now();
const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : issueDate;
```

A parsed XRechnung without an `issueDate` is already a KoSIT validation failure (BT-2 is mandatory per EN 16931), so this branch "can't happen" — but if it does (e.g., a malformed EXTENDED-profile invoice the parser didn't fully validate), the Invoice row silently takes `now()` as its legal invoice date. That's incorrect: a German `Rechnung` without a `Rechnungsdatum` is not a valid invoice for VAT purposes (UStG §14 Abs. 4 Nr. 3), and auto-defaulting to conversion day could misreport VAT periods.

**Fix:** If `parsed.issueDate` is missing, refuse to convert:
```ts
if (!parsed.issueDate) {
  throw makeError(
    'INVALID_STATE_TRANSITION',
    `Intake ${input.intakeId} has no parsed issue date — cannot convert`,
  );
}
const issueDate = new Date(parsed.issueDate);
if (Number.isNaN(issueDate.getTime())) {
  throw makeError(
    'INVALID_STATE_TRANSITION',
    `Intake ${input.intakeId} parsed issue date is invalid: ${parsed.issueDate}`,
  );
}
```

### WR-06: `vatAmountMinor` fallback computes `totalMinor - subtotalMinor` even in reverse-charge cases

**File:** `packages/api/src/services/invoice-intake-service.ts:626-632`
**Issue:**
```ts
const vatAmountMinor =
  parsed.taxBreakdown && parsed.taxBreakdown.length > 0
    ? parsed.taxBreakdown.reduce((acc, row) => acc + (row.taxAmountMinor ?? 0), 0)
    : totalMinor - subtotalMinor;
```

The fallback branch `totalMinor - subtotalMinor` is only correct when there's exactly one VAT rate. For reverse-charge invoices (`taxCategory === 'AE'`), `taxAmountMinor` is always 0 and `totalMinor === subtotalMinor`, so the subtraction coincidentally gives 0 — but that's luck, not design. If the parser ever emits `taxBreakdown: []` for a mixed-rate invoice, we persist a wrong VAT total.

More importantly: if `parsed.taxBreakdown` is missing AND `parsed.taxInclusiveAmount` uses a currency with >2 decimals, `totalMinor - subtotalMinor` produces a bogus number.

**Fix:** Require a non-empty `taxBreakdown`:
```ts
if (!parsed.taxBreakdown || parsed.taxBreakdown.length === 0) {
  throw makeError(
    'INVALID_STATE_TRANSITION',
    `Intake ${input.intakeId} parsedInvoiceJson lacks taxBreakdown — cannot convert safely`,
  );
}
const vatAmountMinor = parsed.taxBreakdown.reduce(
  (acc, row) => acc + (row.taxAmountMinor ?? 0),
  0,
);
```

### WR-07: `INTAKE_MAX_FILE_BYTES` check happens AFTER base64 decode

**File:** `packages/api/src/services/invoice-intake-service.ts:250-256`
**Issue:**
```ts
const bytes = Buffer.from(input.fileBase64, 'base64');
if (bytes.length > INTAKE_MAX_FILE_BYTES) { throw makeError('FILE_TOO_LARGE', ...); }
```

The Zod pre-filter caps `fileBase64` at 7,000,000 characters (≈5.2 MiB decoded), which is correct defense-in-depth. But a malicious client can still send a 7 MB base64 string and force the server to allocate a 5.25 MiB `Buffer` before the size check triggers. For a routine server that's fine; for a rate-limit-targeted DoS vector (10 uploads/min per user per the middleware), 10 × 5.25 MiB = 52 MiB peak per user is allocated transiently before rejection.

**Fix:** Compute the decoded length first (cheap — it's a function of the base64 length):
```ts
// A base64 string of length N decodes to floor(N*3/4) - (padding chars) bytes.
const approxDecodedLen = Math.floor((input.fileBase64.length * 3) / 4);
if (approxDecodedLen > INTAKE_MAX_FILE_BYTES) {
  throw makeError('FILE_TOO_LARGE', `Upload exceeds ${INTAKE_MAX_FILE_BYTES} bytes (approx ${approxDecodedLen})`);
}
const bytes = Buffer.from(input.fileBase64, 'base64');
if (bytes.length > INTAKE_MAX_FILE_BYTES) { /* tight check retained */ }
```

### WR-08: `intake-detail-client.tsx` casts the server-component payload to `never`

**File:** `apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/page.tsx:50`
**Issue:**
```tsx
return (
  <IntakeDetailClient
    intake={intake as never}
    pageTitle={t('pageTitle')}
  />
);
```

`as never` is the strongest possible type assertion — it tells TypeScript "I know what I'm doing, shut up entirely." This disables every contract the `IntakeDetailData` interface was designed to enforce at the server/client boundary. If the router ever drops `extractedTotalMinor` (or adds a required field), nothing catches it.

**Fix:** Narrow at the boundary with a Zod schema (or at minimum `satisfies`):
```tsx
// At module scope
import { z } from 'zod';

const intakeDetailSchema = z.object({
  id: z.string(),
  sourceKind: z.enum(['UPLOAD_XML', 'UPLOAD_PDF']),
  status: z.enum(['PARSED', 'NEEDS_REVIEW', 'MATCHED', 'CONVERTED', 'REJECTED']),
  validationStatus: z.enum(['VALID', 'WARNINGS', 'INVALID']).nullable(),
  // ... rest of the client-facing fields
});

// Inside the page
const parsed = intakeDetailSchema.safeParse(intake);
if (!parsed.success) notFound(); // server-router schema drift → 404
return <IntakeDetailClient intake={parsed.data} pageTitle={t('pageTitle')} />;
```

## Info

### IN-01: Empty catch in `intake-detail-validation-pane.tsx` openReport swallows network errors

**File:** `apps/web/src/components/invoices/intake/intake-detail-validation-pane.tsx:50-64`
**Issue:** The `try { ... } finally { setReportLoading(false); }` block has no `catch`. If the fetch fails (network error, 401, 500), the spinner turns off and the user gets no feedback. Even once CR-01 is fixed, the error case needs a toast:

```tsx
try {
  const result = await reportQuery.refetch();
  if (result.data?.url) window.open(result.data.url, '_blank', 'noopener,noreferrer');
  else toast.error(t('errorGeneric'));
} catch (err) {
  toast.error(t('errorGeneric'));
} finally {
  setReportLoading(false);
}
```

### IN-02: `CORP_FORM_RE` regex does not handle lowercased abbreviations with no period

**File:** `packages/api/src/services/invoice-intake-matcher.ts:84-85`
**Issue:** The stripper regex `\b(GmbH|UG|AG|Ltd\.?|Limited|Inc\.?|KG|OHG|GbR|e\.V\.|SE)\b` misses:
- `b.v.` (Dutch Besloten Vennootschap) — common in EU invoices routed through DE tenants.
- `s.a.` (French Société Anonyme), `s.r.l.` (Italian Società a Responsabilità Limitata).
- `Co.`, `Corp.`, `LLC` (US forms that surface in B2B SaaS e-invoicing).

The matcher is used for fuzzy contractor lookup, so a Dutch supplier "Zeno B.V." won't collide with "Zeno" in the contractor list.

**Fix:** Extend the set — it's a single regex edit:
```ts
const CORP_FORM_RE =
  /\b(GmbH|UG|AG|Ltd\.?|Limited|Inc\.?|KG|OHG|GbR|e\.V\.|SE|B\.V\.|S\.A\.|S\.R\.L\.|LLC|Co\.?|Corp\.?)\b/gi;
```

### IN-03: `hashTo16Bytes` is non-crypto but claims "determinism + uniform distribution"

**File:** `packages/einvoice/src/profiles/zugferd-de/pdf-wrapper.ts:182-200`
**Issue:** FNV-1a has well-known non-uniform distribution for short string inputs (which `seed = title + producedAt.toISOString()` always is). This doesn't matter for the stated goal (deterministic /ID for byte-stable PDF output) but the comment is misleading. Anyone reading this and thinking "oh good, uniform distribution, I can use this as a non-colliding key elsewhere" will be surprised.

**Fix:** Clarify the comment:
```ts
/**
 * Produce a 32-char hex string (16 bytes) from a seed. Used ONLY for the
 * deterministic /ID — collisions are acceptable because /ID doesn't need
 * global uniqueness, only byte-stability for identical inputs.
 */
```

Or use `crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32)` — the extra dependency is zero (already imported elsewhere in the package) and it provides real uniform distribution for free.

### IN-04: `packages/einvoice/src/profiles/zugferd-de/schemas.ts` only validates filename ends in `.pdf`

**File:** `packages/einvoice/src/profiles/zugferd-de/schemas.ts:31-34`
**Issue:**
```ts
export const ZugferdPdfUploadSchema = z.object({
  base64: z.string().min(1),
  filename: z.string().regex(/\.pdf$/i).max(255),
});
```

Two gaps:
1. No `.min(1)` on filename — a filename of `".pdf"` (one character, just the extension) passes, and while downstream R2 keying uses the SHA-256 prefix, the original filename gets stored in `rawFileMime` and surfaced to users.
2. No path-traversal guard — `filename` can contain `../../../etc/passwd.pdf` and pass. Downstream keying uses the SHA prefix so the literal filename never touches R2 paths, but it does surface into the `InvoiceIntakeRequest.rawFileMime` column (via the router's `originalFilename` input) and into any diagnostic surface.

This schema is actually unused by the intake router (`invoice-intake.ts` defines `uploadInput` inline), so the issue is latent — if someone switches to this schema, the gap activates.

**Fix:**
```ts
export const ZugferdPdfUploadSchema = z.object({
  base64: z.string().min(1),
  filename: z.string().min(5).max(255).regex(/\.pdf$/i).refine(
    name => !name.includes('/') && !name.includes('\\') && !name.includes('..'),
    { message: 'Filename must not contain path separators or parent-dir references' },
  ),
});
```

### IN-05: Parser traversal of `/Names /EmbeddedFiles` tree has no depth limit

**File:** `packages/einvoice/src/profiles/zugferd-de/parser.ts:203-212`
**Issue:** The `extractFromEmbeddedFilesTree` function recursively descends into `/Kids` arrays with no maximum depth. A maliciously crafted PDF could nest `/Kids` arrays circularly (pdf-lib doesn't detect cycles during `lookupMaybe`), causing stack exhaustion.

In practice pdf-lib's object graph is a DAG by construction (indirect refs are resolved via a lookup table, not following arbitrary pointers), so actual infinite recursion would require a bug in pdf-lib itself — but the defense-in-depth pattern is cheap:

**Fix:**
```ts
function extractFromEmbeddedFilesTree(node: PDFDict, depth = 0): Uint8Array | null {
  if (depth > 16) return null; // Factur-X spec has no legitimate use for >3 levels
  // ... existing code
  // In the recursive call:
  const bytes = extractFromEmbeddedFilesTree(kid, depth + 1);
}
```

### IN-06: E2E specs have heavy flag-off skip logic that could be split into a dedicated project

**File:** `apps/web/e2e/functional/intake-upload-flow.spec.ts` (and `zugferd-download-flow.spec.ts`)
**Issue:** Every test begins with a 5–10 second `isVisible` check on the `Import e-invoice` button, followed by `test.skip(!importEnabled, ...)`. This means a flag-off CI run spends ~30–60 seconds just discovering that the feature is off, then skips. Every test repeats the same skip dance.

**Fix:** Extract a `test.describe.configure({ mode: 'serial' })` block with a single `beforeAll` that probes the flag once, or split into two Playwright projects (`intake-enabled` and `intake-disabled`) configured via `playwright.functional.config.ts` with different `testMatch` globs. The existing test structure is correct but repetitive.

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
