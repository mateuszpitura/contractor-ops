# Phase 23: OCR Adapter Registry Fix - Research

**Researched:** 2026-03-30
**Domain:** Adapter registry wiring / gap closure
**Confidence:** HIGH

## Summary

Phase 20-01 (commit `90fa950`) rewrote `register-all.ts` to add four new adapters (Notion, Confluence, Google Calendar, Outlook Calendar) and dropped the `ClaudeOcrAdapter` import and registration call that Phase 16-01 had originally added. This breaks OCR-01 at runtime: `getAdapter("claude")` returns `undefined`, so the entire OCR extraction pipeline fails.

During research, a **second bug** was discovered: `ClaudeOcrAdapter` implements `OcrAdapter` which defines `providerName` but not `slug`. The adapter registry (`registry.ts`) keys on `adapter.slug.toLowerCase()`. The original Phase 16 registration used `as unknown as IntegrationProviderAdapter` to cast the type, but at runtime `adapter.slug` is `undefined` on `ClaudeOcrAdapter` -- meaning `adapter.slug.toLowerCase()` would throw a TypeError even when the registration line existed. The test suite masked this because the mock adapter includes both `slug` and `providerName` properties. The fix requires adding a `slug` property to `ClaudeOcrAdapter` in addition to re-adding the registration.

**Primary recommendation:** Add `readonly slug = "claude"` to `ClaudeOcrAdapter`, then re-add import and registration call to `register-all.ts`. Update the existing adapter test to verify the `slug` property exists.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OCR-01 | System auto-extracts fields (NIP, invoice number, date, amount, line items) from uploaded PDF | Fix requires two changes: (1) add `slug` property to `ClaudeOcrAdapter` so registry keying works, (2) re-add import + `registerAdapter()` call in `register-all.ts`. Existing adapter code, OCR service, and UI are all intact. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use strong typing and avoid unsafe shortcuts
- Write clean, readable, maintainable code
- Apply clean architecture principles with clear boundaries
- Keep contracts between frontend, backend, and database explicit and type-safe
- Deliver production-grade code

## Architecture Patterns

### Current Registry Architecture

```
packages/integrations/src/
  registry.ts                    # Map<string, IntegrationProviderAdapter> keyed by slug
  adapters/
    register-all.ts              # Imports all adapters, calls registerAdapter()
    claude-ocr-adapter.ts        # Implements OcrAdapter (NOT IntegrationProviderAdapter)
    slack-adapter.ts             # Implements IntegrationProviderAdapter
    ...11 other adapters
  services/
    ocr-service.ts               # getOcrAdapter() resolves from registry by provider.toLowerCase()
  types/
    provider.ts                  # IntegrationProviderAdapter { slug, displayName, ... }
    ocr.ts                       # OcrAdapter { providerName, supportedDocumentTypes, extractInvoice }
```

### The Type Mismatch Problem

The `IntegrationProviderAdapter` interface requires:
- `readonly slug: string` (used as registry key)
- `readonly displayName: string`
- `readonly supportsOAuth: boolean`
- `readonly supportsWebhooks: boolean`
- Plus OAuth/webhook methods

The `OcrAdapter` interface requires:
- `readonly providerName: string`
- `readonly supportedDocumentTypes: string[]`
- `extractInvoice(request): Promise<OcrExtractionResult>`

These are completely different interfaces. `ClaudeOcrAdapter` implements `OcrAdapter` but not `IntegrationProviderAdapter`. The registry only accepts `IntegrationProviderAdapter`. The original code used `as unknown as IntegrationProviderAdapter` to force the cast, but this hides the fact that at runtime, the `slug` property is missing.

### The Fix (Two Parts)

**Part 1: Add `slug` property to `ClaudeOcrAdapter`**

```typescript
// packages/integrations/src/adapters/claude-ocr-adapter.ts
export class ClaudeOcrAdapter implements OcrAdapter {
  readonly providerName = "claude";
  readonly slug = "claude";  // ADD THIS LINE — registry keys on slug
  readonly supportedDocumentTypes = ["application/pdf"];
  // ...rest unchanged
}
```

**Part 2: Re-add registration in `register-all.ts`**

```typescript
// packages/integrations/src/adapters/register-all.ts
import { ClaudeOcrAdapter } from "./claude-ocr-adapter.js";

// Inside registerAllAdapters():
registerAdapter(
  new ClaudeOcrAdapter() as unknown as IntegrationProviderAdapter,
);
```

The `as unknown as IntegrationProviderAdapter` cast remains necessary because `ClaudeOcrAdapter` does not implement the full `IntegrationProviderAdapter` interface (no OAuth methods, etc.). This is the established pattern from Phase 16.

### Why the Test Didn't Catch This

The `ocr-service.test.ts` mock adapter at line 31 defines:
```typescript
const mockOcrAdapter: OcrAdapter & { slug: string } = {
  providerName: "claude",
  slug: "claude",  // Mock has slug, real adapter doesn't
  // ...
};
```

The mock explicitly adds `slug` which the real adapter lacks. The adapter unit test (`claude-ocr-adapter.test.ts`) tests extraction behavior but never tests registry integration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Adapter registry | Custom lookup | Existing `registry.ts` | Already built and used by 11 adapters |
| OCR extraction | Custom pipeline | Existing `ocr-service.ts` | Already built in Phase 16 |

## Common Pitfalls

### Pitfall 1: Missing slug property (the actual bug)
**What goes wrong:** `ClaudeOcrAdapter` has `providerName` but not `slug`. Registry keys on `slug`. At runtime `adapter.slug` is `undefined`, causing TypeError.
**Why it happens:** `OcrAdapter` and `IntegrationProviderAdapter` are different interfaces. The `as unknown as` cast hides the missing property at compile time.
**How to avoid:** Add `readonly slug = "claude"` to the adapter class. Add a test that verifies `slug` exists on the real adapter instance.
**Warning signs:** Registry throws TypeError on startup, or adapter stored under key "undefined".

### Pitfall 2: Registration order
**What goes wrong:** If ClaudeOcrAdapter import fails (e.g., missing dependency), subsequent registrations also fail because the error propagates.
**Why it happens:** All registrations happen sequentially in one function.
**How to avoid:** Place the ClaudeOcrAdapter registration alongside other adapters (order doesn't matter for correctness, but convention is alphabetical or by addition date).

### Pitfall 3: Forgetting the idempotency guard
**What goes wrong:** `registerAllAdapters()` has a `registered` boolean guard. If testing, `clearAdapters()` clears the map but doesn't reset `registered`, meaning re-registration fails.
**How to avoid:** Tests already use `clearAdapters()` + direct `registerAdapter()` calls. Don't modify the guard.

## Code Examples

### Exact fix for claude-ocr-adapter.ts (line 219)

```typescript
export class ClaudeOcrAdapter implements OcrAdapter {
  readonly providerName = "claude";
  readonly slug = "claude";
  readonly supportedDocumentTypes = ["application/pdf"];
  // ...rest unchanged
```

### Exact fix for register-all.ts

Add import after line 12:
```typescript
import { ClaudeOcrAdapter } from "./claude-ocr-adapter.js";
```

Add registration after line 39 (after OutlookCalendarAdapter):
```typescript
registerAdapter(
  new ClaudeOcrAdapter() as unknown as IntegrationProviderAdapter,
);
```

### Test verification for slug property

```typescript
// In claude-ocr-adapter.test.ts
it("has slug property matching providerName for registry compatibility", () => {
  const adapter = new ClaudeOcrAdapter({ apiKey: "test-key" });
  expect(adapter.slug).toBe("claude");
  expect(adapter.slug).toBe(adapter.providerName);
});
```

### Test verification for registration round-trip

```typescript
// In ocr-service.test.ts or a new integration test
it("resolves ClaudeOcrAdapter from registry after registerAllAdapters", () => {
  clearAdapters();
  registerAllAdapters();
  const adapter = getOcrAdapter("CLAUDE");
  expect(adapter).toBeDefined();
  expect(adapter.providerName).toBe("claude");
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (workspace config) |
| Config file | `packages/integrations/vitest.config.ts` |
| Quick run command | `npx vitest run packages/integrations/src/adapters/__tests__/claude-ocr-adapter.test.ts packages/integrations/src/services/__tests__/ocr-service.test.ts --reporter=verbose` |
| Full suite command | `npx vitest run --project integrations` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OCR-01 | ClaudeOcrAdapter has `slug` property | unit | `npx vitest run packages/integrations/src/adapters/__tests__/claude-ocr-adapter.test.ts` | Exists (add 1 test) |
| OCR-01 | getAdapter("claude") resolves after registerAllAdapters() | integration | `npx vitest run packages/integrations/src/services/__tests__/ocr-service.test.ts` | Exists (add 1 test) |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/integrations/src/adapters/__tests__/claude-ocr-adapter.test.ts packages/integrations/src/services/__tests__/ocr-service.test.ts`
- **Per wave merge:** `npx vitest run --project integrations`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. Only new test cases (not files) are needed.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `register-all.ts` (current, line-by-line)
- Direct codebase inspection of `claude-ocr-adapter.ts` (current)
- Direct codebase inspection of `registry.ts` (current)
- Direct codebase inspection of `ocr-service.ts` (current)
- Git history: `git show 2ebd852:packages/integrations/src/adapters/register-all.ts` (Phase 16 original)
- Git history: `git show 90fa950` (Phase 20 rewrite that dropped the registration)
- Milestone audit: `.planning/v2.0-MILESTONE-AUDIT.md`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, pure code fix
- Architecture: HIGH - direct inspection of all relevant files
- Pitfalls: HIGH - discovered additional bug (missing `slug`) through code analysis

**Research date:** 2026-03-30
**Valid until:** Indefinite (gap closure, no external dependencies)
