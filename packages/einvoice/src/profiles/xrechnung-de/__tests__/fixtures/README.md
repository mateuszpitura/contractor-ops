# XRechnung validator test fixtures

Plan 03 (KoSIT three-layer validator) populates this directory with positive
and negative CII samples derived from
`validator-configuration-xrechnung release-2026-01-31/test-suite/`.

| Filename | Expected layer-1 (XSD) | Expected layer-2 (EN 16931) | Expected layer-3 (XRechnung CIUS) |
| --- | --- | --- | --- |
| `kosit-positive-minimal.xml`     | PASS | PASS | PASS |
| `kosit-positive-leitweg.xml`     | PASS | PASS | PASS |
| `kosit-negative-missing-bt10.xml` | PASS | PASS | FAIL (BR-DE-*) |
| `kosit-negative-bad-currency.xml` | PASS | FAIL (BR-DE-17) | FAIL |
| `kosit-negative-malformed-xsd.xml` | FAIL | — (short-circuits) | — |

## Extraction instructions (for Plan 03 executor)

```bash
# Assuming /tmp/kosit.zip is already downloaded per
# packages/einvoice/src/profiles/xrechnung-de/validator-bundle/README.md
unzip -j /tmp/kosit.zip "test-suite/**/*.xml" -d /tmp/samples/
# Then copy the ones listed above into this directory:
cp /tmp/samples/<relevant>.xml packages/einvoice/src/profiles/xrechnung-de/__tests__/fixtures/
```

Commit the fixture XMLs alongside their expected-result assertions in the
corresponding `validator.test.ts` describe blocks.
