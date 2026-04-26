# `pnpm lint:logs` — remediation guide

Phase 70 D-03 D-07 — logger body-redaction guard. Fails the PR when a Pino
logger call site emits a `body` field outside the approved allow-list, and
the site is not in the committed `.lint-logs-baseline.json`.

## <a name="unredacted-body-log"></a>FAIL: log.info({ body: ... }) detected

The CI guard `pnpm lint:logs` failed because a logger call was found that
emits a `body` field, the procedure prefix is not in the allow-list, and
the site is not in the committed audit baseline.

### Symptom

```
[lint:logs] FAIL: 1 unredacted-body log site(s) detected

  offending:   apps/api/src/routes/contractors.ts:42  (procedure: contractor.create)
  snippet:     log.info({ body: req.body }, 'received')
  expected:    omit `body` from log payload OR add procedure prefix to LOG_BODY_INCLUDE_PREFIXES with a // reason: comment
  remediation: docs/lint-remediation/lint-logs.md#unredacted-body-log
```

### Root cause (PITFALLS P28)

Pino emits log fields verbatim by default. A `body` field on a tRPC mutation
or webhook payload almost always contains regulator-grade PII (UTR, USt-IdNr,
SV-Nr, contractor names + addresses). Default-redact flips the default from
"leaky" to "safe": every `body` field is `[REDACTED]` unless the call site
explicitly opts in via `withBodyLogging`.

### Fix (option A — preferred)

Drop the `body` field from the log payload. Log identifiers, sizes, and
shapes — not contents:

```ts
// before:
log.info({ body: req.body }, 'received');

// after:
log.info({ contractorId: req.body.contractorId, action: 'create' }, 'received');
```

### Fix (option B — opt in via `withBodyLogging`)

If the body genuinely needs to be logged for debugging this procedure:

```ts
import {
  createTrpcLogger,
  withBodyLogging,
  LOG_BODY_INCLUDE_PREFIXES,
} from '@contractor-ops/logger';

const log = withBodyLogging(
  createTrpcLogger({ procedure: 'contractor.create', type: 'mutation' }),
  LOG_BODY_INCLUDE_PREFIXES,
);
log.info({ body: req.body }, 'received');
```

Then add the prefix to the include-list — see [`#opting-into-body-logging`](#opting-into-body-logging).

## <a name="opting-into-body-logging"></a>Opting into body logging

Open `packages/logger/src/log-body-include-prefixes.ts`. Add an entry with
a one-line `reason:` comment:

```ts
export const LOG_BODY_INCLUDE_PREFIXES: readonly string[] = [
  'contractor.create',  // reason: <one sentence — what you debug, why redacted form is insufficient, expected sunset>
] as const;
```

Code review on this constant change is the human gate. Wildcards (`*`) are
runtime-skipped by `withBodyLogging` and rejected by the lint guard. Each
entry must declare a clear, time-bounded reason.

## <a name="per-field-allow-with-reason"></a>Per-field allow with reason

For routers where ONE body sub-field needs plaintext (e.g.,
`body.contractorId`) but everything else stays redacted, use the
`procedure:fieldA,fieldB` suffix:

```ts
'contractor.create:contractorId',  // reason: cross-reference for ops team incident triage
```

Phase 70 ships the suffix syntax as a compile-time contract; a future phase
will add the runtime serializer that filters non-listed body sub-fields.
For Phase 70 the suffix is treated as a full opt-in (the body redact path
is dropped entirely). Plan accordingly: prefer Option A wherever possible.

## Updating the baseline (rare)

`.lint-logs-baseline.json` records every body-log site that existed at the
moment of `pnpm lint:logs --update-baseline`. The guard tolerates these
sites so you can ship Phase 70 D-05 without a giant cleanup PR. NEW
violations always fail.

To regenerate after intentionally removing all baseline sites:

```bash
pnpm lint:logs --update-baseline
git diff .lint-logs-baseline.json   # review carefully
git add .lint-logs-baseline.json
```

The baseline is committed; CI never writes it. Only the manual
`--update-baseline` invocation rewrites the file (T-70-03-03).
