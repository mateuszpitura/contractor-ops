# Phase 70 Patterns Map

> Analog files in the codebase that the planner/executor MUST mirror. Every new file in Phase 70 has at least one near-twin already shipped in v1.0–v5.0.

---

## D-01..D-04 — CI Guard Scripts

### NEW: `packages/lint-guards/` (new package)

**Closest analog:** `packages/validators/`

```
packages/validators/
├── package.json                    # ESM, ts-build, vitest
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── legal/de.ts                 # exports `as const` typed constants
│   └── __tests__/locked-phrases-guard.test.ts   # vitest CI guard pattern
```

**Pattern excerpt** (`packages/validators/src/__tests__/locked-phrases-guard.test.ts` style — failing CI guard with structured assertion):
```ts
// Read fixtures, assert structural property, fail with named offender
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('locked phrases guard', () => {
  it('every LOCKED_DE_PHRASES entry appears in messages/de.json', () => {
    const missing: string[] = [];
    for (const phrase of LOCKED_DE_PHRASES) {
      if (!serializedJson.includes(phrase.phrase)) missing.push(phrase.id);
    }
    expect(missing).toEqual([]);
  });
});
```

**Apply to Phase 70:** Each new lint script (`lint-schema.mjs`, `lint-logs.mjs`, `i18n-parity.mjs`) ships paired vitest tests in `packages/lint-guards/src/__tests__/`. Test parses fixture files (clean + dirty) via the script's exported `runGuard()` function, asserts structured offence list. CLI entry imports same `runGuard` and emits to stdout + exits 1 on offence.

---

### NEW: `scripts/lint-schema.mjs`, `scripts/lint-logs.mjs`, `scripts/i18n-parity.mjs`

**Closest analog:** `scripts/check-no-process-env.mjs` (already wired to husky pre-push)

```js
// scripts/check-no-process-env.mjs — existing pattern: walk source tree, structured fail, exit 1
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
// ...
if (offences.length > 0) {
  console.error('Disallowed `process.env.*` access detected:');
  for (const o of offences) console.error(`  ${o.file}:${o.line}  ${o.snippet}`);
  process.exit(1);
}
```

**Apply to Phase 70:** All three new scripts adopt this exact stdout shape (uniform with D-03). Each script is a thin entrypoint that delegates to `@contractor-ops/lint-guards` exports.

---

### NEW: Allowlist constants (D-02)

**Closest analog:** `packages/feature-flags/src/registry.ts` (deep-frozen `as const satisfies` typed registry)

```ts
export const FLAGS = deepFreeze({ ... } as const satisfies Record<string, FlagDefinition>);
export type FlagKey = keyof typeof FLAGS;
```

**Apply to Phase 70:**
```ts
// packages/lint-guards/src/schema-guard/global-lookup-allowlist.ts
export const GLOBAL_LOOKUP_MODELS_ALLOWLIST = [
  'Country', 'Currency', 'IsicCode', 'IndustryCode', 'ExchangeRate',
  'TaxJurisdiction', 'BankCode',
] as const satisfies readonly string[];

// packages/logger/src/log-body-include-prefixes.ts
export const LOG_BODY_INCLUDE_PREFIXES: readonly string[] = [
  // (intentionally empty at Phase 70 — every entry needs a `// reason: ...` comment)
] as const;
```

---

## D-05..D-08 — Logger Default Redaction

### MODIFY: `packages/logger/src/index.ts`

**Closest analog (and target):** itself, `packages/logger/src/index.ts`. The current `baseOptions.redact.paths` is the structural target — D-05 extends it.

**Pattern excerpt** (current shape we extend, lines 23–27):
```ts
redact: {
  paths: [...PII_MASK_PATHS],
  censor: '[REDACTED]',
},
```

**Apply to Phase 70:** Append `'*.body'` to `PII_MASK_PATHS` (or to a new `BODY_REDACT_PATHS` const folded into the spread); add `withBodyLogging` factory mirroring the existing `createTrpcLogger`/`createCronLogger` factories at lines 130–148:

```ts
// Existing factory shape we mirror:
export function createTrpcLogger(meta: { ... }): Logger {
  return logger.child({ service: 'trpc', ...meta });
}

// New factory follows the same shape:
export function withBodyLogging(parent: Logger, includePrefixes: readonly string[]): Logger {
  // Returns a child whose redact override is computed from includePrefixes
  // ...
}
```

---

### NEW: `packages/lint-guards/src/logs-guard/scan-body-logs.ts` (ts-morph audit)

**Closest analog:** any file in `packages/validators/src/codegen/` (we know the project already uses ts-morph there — research confirmed)

**Apply to Phase 70:** Single `Project` per CLI invocation; iterate source files matching `apps/**/*.ts` + `packages/**/*.ts` (excluding `**/__tests__/**`, `**/node_modules/**`, `**/dist/**`); for each `CallExpression` whose receiver resolves to a `Logger` import from `@contractor-ops/logger`, examine the first argument (object literal) for a `body` property. Record `file:line` plus inferred procedure prefix (best-effort: parent function name, default `unknown`).

---

## D-09..D-12 — Flag Sign-off Registry

### NEW: `packages/feature-flags/src/signoff-registry-flags-{schema,ts,json}.ts`

**Closest analog:** `packages/validators/src/legal/signoff-registry-{schema,ts,json}.ts` (Phase 64 D-12) — verbatim shape, different fields.

**Pattern excerpt** (`signoff-registry-schema.ts`, lines 9–22 — the exact shape we clone):
```ts
const signoffEntryObjectSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED']),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  approverRole: z.enum(['UK_TAX_ADVISER', 'STEUERBERATER', 'INTERNAL_COUNSEL', 'INTERNAL_PRODUCT']).optional(),
  approverEmailHash: z.string().optional(),
  upstreamRef: z.string().optional(),
  notes: z.string().optional(),
});

export const SignoffEntrySchema = signoffEntryObjectSchema.refine(
  entry => {
    if (entry.status === 'APPROVED') {
      return !!(entry.approvedBy && entry.approvedAt && entry.approverRole);
    }
    return true;
  },
  { message: 'APPROVED entries require approvedBy, approvedAt, and approverRole fields' },
);
```

**Apply to Phase 70 (new schema):**
```ts
// packages/feature-flags/src/signoff-registry-flags-schema.ts
const flagSignoffEntryObjectSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED']),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  approverRole: z.enum(['LEGAL_LEAD', 'COMPLIANCE_OFFICER', 'PRIVACY_COUNSEL', 'EXTERNAL_COUNSEL']).optional(),
  approverEmailHash: z.string().optional(),
  legalTicketRef: z.string().regex(/^(LEGAL-\d+|https?:\/\/.+)$/).optional(),
  notes: z.string().optional(),
});

export const FlagSignoffEntrySchema = flagSignoffEntryObjectSchema.refine(
  entry => entry.status !== 'APPROVED' ||
    !!(entry.approvedBy && entry.approvedAt && entry.approverRole && entry.legalTicketRef),
  { message: 'APPROVED entries require approvedBy, approvedAt, approverRole, AND legalTicketRef' },
);
```

**Pattern excerpt** (`signoff-registry.ts`, lines 17–30 — boot-time validation we clone):
```ts
let Registry: SignoffRegistry;
try {
  Registry = SignoffRegistrySchema.parse(rawRegistry);
} catch (err) {
  process.stderr.write(`[signoff-registry] signoff-registry.json failed Zod validation — startup aborted: ${String(err)}\n`);
  throw err;
}
```

**Apply to Phase 70:** New runtime module uses identical pattern with prefix `[FLAG-SIGNOFF]`:
```ts
// packages/feature-flags/src/signoff-registry-flags.ts
let FlagRegistry: FlagSignoffRegistry;
try {
  FlagRegistry = FlagSignoffRegistrySchema.parse(rawRegistry);
} catch (err) {
  process.stderr.write(`[FLAG-SIGNOFF] signoff-registry-flags.json failed Zod validation — startup aborted: ${String(err)}\n`);
  throw err;
}
```

---

### MODIFY: `packages/feature-flags/src/registry.ts` (D-10 boot gate)

**Closest analog (and target):** itself — the file already deep-freezes the registry at module load. Add gate immediately AFTER the freeze, BEFORE the `export` lines.

**Pattern excerpt** (current lines 39–143 already imports + freezes):
```ts
export const FLAGS = deepFreeze({ ... } as const satisfies Record<string, FlagDefinition>);
export type FlagKey = keyof typeof FLAGS;
export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];
```

**Apply to Phase 70:** Insert after `FLAG_KEYS` declaration:
```ts
import { GATED_FLAG_NAMESPACE_PREFIXES, getFlagSignoff, isGatedFlag } from './signoff-registry-flags.js';

// D-10 boot-time gate
const BYPASS = process.env.FLAG_SIGNOFF_BYPASS === 'local';
for (const key of FLAG_KEYS) {
  if (!isGatedFlag(key)) continue;
  const entry = getFlagSignoff(key);
  if (!entry) {
    const msg = `[FLAG-SIGNOFF] flag '${key}' missing registry entry — refusing to boot. Add a PENDING entry to packages/feature-flags/src/signoff-registry-flags.json or set FLAG_SIGNOFF_BYPASS=local for LOCAL-ONLY dev.`;
    if (BYPASS) {
      process.stderr.write(`[FLAG-SIGNOFF] ${msg} (bypassed via FLAG_SIGNOFF_BYPASS=local)\n`);
    } else {
      process.stderr.write(`${msg}\n`);
      process.exit(1);
    }
  }
}
```

---

## D-13..D-14 — `IntegrationConnection.scopeCapabilities`

### MODIFY: `packages/db/prisma/schema/integration.prisma`

**Closest analog (and target):** itself — the field `configJson Json?` already lives at line 8 of the model. D-13 adds a sibling.

**Pattern excerpt** (current model excerpt):
```prisma
model IntegrationConnection {
  ...
  configJson        Json?
  credentialsRef    String
  ...
}
```

**Apply to Phase 70:** Add right after `configJson`:
```prisma
  configJson         Json?
  scopeCapabilities  Json?    // Phase 70 D-13 — typed via packages/db/src/types/scope-capabilities.ts
```

---

### NEW: `packages/db/scripts/backfill-scope-capabilities.ts`

**Closest analog:** `packages/db/scripts/push-all-regions.ts` — same file shape, same `dotenv` + `pino` pattern, same env-iteration scaffold.

**Pattern excerpt** (`push-all-regions.ts` lines 1–40):
```ts
#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
config({ path: resolve(ROOT_DIR, '.env') });
const REGION_ENV_VARS = ['DATABASE_URL_EU', 'DATABASE_URL_ME'] as const;

interface RegionResult {
  region: string;
  status: 'ok' | 'skipped' | 'failed';
  error?: string;
}

function pushRegion(envVar: string): RegionResult { ... }
```

**Apply to Phase 70:** Backfill script iterates the same `REGION_ENV_VARS`, uses Prisma client to `updateMany` where `provider = 'GOOGLE_WORKSPACE' AND scopeCapabilities IS NULL`, sets a static map. Idempotent. Same logger + result shape.

---

## D-15 — `getIdpAuditLogger()`

### MODIFY: `packages/logger/src/index.ts`

**Closest analog (and target):** the file's existing factory pattern at lines 130–148.

**Pattern excerpt:**
```ts
export function createTrpcLogger(meta: {
  procedure: string;
  type: string;
  userId?: string;
  organizationId?: string;
  requestId?: string;
}): Logger {
  return logger.child({ service: 'trpc', ...meta });
}
```

**Apply to Phase 70:**
```ts
export const IDP_AUDIT_ALLOWED_FIELDS = [
  'externalUserId', 'actionResult', 'provider', 'connectionId', 'scopeDelta',
  'organizationId', 'userId', 'auditEvent', 'timestamp',
] as const;

export type IdpAuditEvent = {
  [K in (typeof IDP_AUDIT_ALLOWED_FIELDS)[number]]?: unknown;
} & { auditEvent: string };

export function getIdpAuditLogger(): Logger {
  // Returns a child logger that inherits PII redact paths but does NOT redact
  // body — IdP audit lines are structured fields, never raw bodies.
  // Bindings: service: 'idp-audit'
  return logger.child({ service: 'idp-audit' });
}
```

---

## D-16 — Reconnect Banner

### NEW: `apps/web/src/components/integrations/google-workspace-reconnect-banner.tsx`

**Closest analogs:**

1. `apps/web/src/components/equipment/return-approval-banner.tsx` — banner pattern (already in repo, see git status)
2. `apps/web/src/components/integrations/google-workspace-provider-section.tsx` — host component (banner is rendered inside)

**Apply to Phase 70:** Banner is a small `<Card>` with copy + a "Reconnect" `<Button>` linking to the existing OAuth start route (`/api/oauth/google_workspace/start` or wherever the existing entry point lives — Phase 70 does NOT add a new entry point, just consumes the existing one). Localized via `useTranslations('Integrations.GoogleWorkspaceReconnect')` with keys added to all four `apps/web/messages/*.json` files (parity-tested by `i18n:parity` from Plan 04 — eat-our-own-dogfood validation).

---

## CI / Husky Wiring (D-01)

### MODIFY: `.github/workflows/ci.yml`

**Closest analog (and target):** the existing `Lint, Typecheck & Test` job. Add three steps before the `Test` step.

**Apply to Phase 70:**
```yaml
- name: Lint Prisma schema for tenant scoping
  run: pnpm lint:schema

- name: Lint logger call sites for body-redaction drift
  run: pnpm lint:logs

- name: Verify i18n message-key parity
  run: pnpm i18n:parity
```

### MODIFY: `.husky/pre-push`

**Closest analog (and target):** the existing single-line pipeline.

**Apply to Phase 70:** Append three commands, kept as a single `&&` chain so failure short-circuits:
```sh
#!/usr/bin/env sh
pnpm run format:check && pnpm run lint && pnpm run check:no-process-env \
  && pnpm run lint:schema && pnpm run lint:logs && pnpm run i18n:parity
```

---

## NEW: Top-level scripts in `package.json`

**Closest analog (and target):** existing `check:no-process-env` script at line 14.

**Apply to Phase 70:**
```json
"scripts": {
  ...
  "check:no-process-env": "node scripts/check-no-process-env.mjs",
  "lint:schema": "node scripts/lint-schema.mjs",
  "lint:logs": "node scripts/lint-logs.mjs",
  "i18n:parity": "node scripts/i18n-parity.mjs",
  ...
}
```

---

## NEW: `docs/lint-remediation/`

**Closest analog:** none in repo — this is the first time per-guard remediation docs exist. Modeled after Prisma migration error guidance pattern (one .md per failure mode, anchors per offence type).

**Apply to Phase 70:** Three new files:
- `docs/lint-remediation/lint-schema.md` — anchors: `#missing-organization-id`, `#allowlisting-a-global-lookup-model`
- `docs/lint-remediation/lint-logs.md` — anchors: `#unredacted-body-log`, `#opting-into-body-logging`, `#per-field-allow-with-reason`
- `docs/lint-remediation/i18n-parity.md` — anchors: `#missing-translation-key`, `#removing-a-key-deliberately`

Each file is short (~30 lines): symptom (what the structured-diff line says), root cause, fix command, link to typed-constant edit.

---

## PATTERN MAPPING COMPLETE
