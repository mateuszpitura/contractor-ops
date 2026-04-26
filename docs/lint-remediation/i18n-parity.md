# `pnpm i18n:parity` — remediation guide

Phase 70 D-03 — message-key parity guard. Walks
`apps/web/messages/{en,de,pl,ar}.json`, flattens nested keys, and asserts
every key in `en.json` exists in each peer locale. Pre-existing drift is
tolerated via `.i18n-parity-baseline.json` (committed); only NEW drift fails.

## <a name="missing-translation-key"></a>FAIL: key X missing from `<locale>.json`

The CI guard `pnpm i18n:parity` failed because `apps/web/messages/en.json`
contains a key not present in one or more peer locales, and the missing
site is not in the committed audit baseline.

### Symptom

```
[i18n:parity] FAIL: 3 missing translation key(s) across 2 locale(s)

  locale de: missing 2 key(s)
    - Payments.lateInterest.newColumnHeader
    - Payments.lateInterest.newButtonLabel

  locale ar: missing 1 key(s)
    - Payments.lateInterest.newButtonLabel

  remediation: docs/lint-remediation/i18n-parity.md#missing-translation-key
```

### Root cause (PITFALLS P29)

`next-intl` resolves keys at runtime per the user's locale. A missing key
falls through to the developer's default — UI shows English copy in a DE/PL/AR
context. Phase 67 audit found 32 missing DE keys; Phase 69 repaired them.
Phase 70 ships this guard so that regression becomes mechanically impossible
on every PR going forward.

### Fix

Add the missing keys to each peer file with proper translations:

```json
// apps/web/messages/de.json
{
  "Payments": {
    "lateInterest": {
      "newColumnHeader": "Neue Spaltenüberschrift",
      "newButtonLabel": "Neue Schaltflächenbeschriftung"
    }
  }
}
```

When adding new EN keys, add the DE/PL/AR translations in the **same
commit**. The `pnpm i18n:parity` guard will block CI until parity is
restored — drift is mechanically impossible to merge.

### Translation conventions

- DE: formal "Sie" register (no "Du" / "Dir") — locked-phrases-guard enforces this independently
- PL: formal "Państwo" register
- AR: standard Modern Standard Arabic, RTL-safe; ICU placeholders preserved verbatim
- ICU placeholder names (`{name}`, `{date}`, `{count}`) MUST be preserved exactly from the EN string

## <a name="removing-a-key-deliberately"></a>Removing a key deliberately

If you intend to remove a key entirely, delete it from ALL FOUR locales in
the same commit. The guard does not flag DE/PL/AR-only keys (parity is
one-directional from EN), but mass-deletion still requires removing all
peers to keep the catalogues clean.

## Updating the baseline (rare)

`.i18n-parity-baseline.json` records every `(locale, missingKey)` pair that
was missing at the time of `pnpm i18n:parity --update-baseline`. The guard
tolerates these sites so Phase 70 can ship D-04 without a 398-key cleanup
PR. NEW drift always fails.

To regenerate after intentionally back-filling baseline keys (e.g. as part
of a polish phase that closes the pl/ar parity gap):

```bash
pnpm i18n:parity --update-baseline
git diff .i18n-parity-baseline.json   # review carefully — fewer entries is good
git add .i18n-parity-baseline.json
```

The baseline is committed. CI never writes it. Only the manual
`--update-baseline` invocation rewrites the file.

## Historical context

- **Phase 67:** Audit revealed 32 missing DE keys silently rendering English copy in the DE locale.
- **Phase 69:** Repaired all 32 keys — DE drift returned to zero.
- **Phase 70 (this phase):** Guard added; PL and AR pre-existing drift recorded in the baseline (398 sites). A future polish phase may close the PL/AR gap; this guard is the regression net.
