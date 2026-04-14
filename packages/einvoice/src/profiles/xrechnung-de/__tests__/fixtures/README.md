# XRechnung validator test fixtures

Hand-crafted CII D16B / XRechnung 3.0.2 instances used by
`__tests__/validator.test.ts` (Plan 61-03 KoSIT three-layer validator) to
exercise each validation layer deterministically.

## Provenance

The KoSIT `v2026-01-31` release ships `.xsl` artefacts and a `scenarios.xml`
configuration but does **not** ship positive/negative sample XML documents
(inspected via `unzip -l`). The four fixtures below are therefore hand-crafted
to satisfy or fail specific schematron rules sourced from
`validator-bundle/src-xslt/XRechnung-CII-validation.xsl`, not lifted verbatim
from an upstream test-suite.

Each fixture has been round-tripped through the real KoSIT pipeline
(libxmljs2 XSD + saxon-js EN 16931 SEF + saxon-js XRechnung CIUS SEF) and
confirmed to produce the expected per-layer outcome **before** being committed.

| Filename | Layer 1 (XSD) | Layer 2 (EN 16931) | Layer 3 (XRechnung CIUS) | Exercises |
| --- | --- | --- | --- | --- |
| `kosit-positive-minimal.xml`     | PASS | PASS | PASS                           | Smoke-test: minimal valid CII with BT-10 Leitweg-ID, BT-81 payment means code `58`, IBAN, contact, VAT reg. |
| `kosit-positive-leitweg.xml`     | PASS | PASS | PASS                           | Same shape as minimal; distinct invoice id. Exercises Leitweg-ID presence end-to-end. |
| `kosit-negative-missing-bt10.xml` | PASS | PASS | FAIL (BR-DE-15, fatal)         | Omits `<ram:BuyerReference>` → BR-DE-15 ("Buyer reference BT-10 must be provided"). Plan's "BR-DE-*" acceptance criterion. |
| `kosit-negative-bad-currency.xml` | PASS | FAIL (BR-CL-01, fatal on type code) | FAIL (BR-DE-17, warning) | Mutates `<ram:TypeCode>` to `100` (non-whitelisted) and `InvoiceCurrencyCode` to `GBP`. Fires BR-DE-17 (warning — invoice type code must be in whitelist). See deviation note. |

## BR-DE-17 deviation note

Plan 61-03 described `kosit-negative-bad-currency.xml` as "currency='GBP' on a
DE B2G invoice → fails layer-3 BR-DE-17". In the real KoSIT XRechnung 3.0.2
schematron, BR-DE-17 is **not** a currency rule — it checks that
`rsm:ExchangedDocument/ram:TypeCode` is one of the UNTDID-1001 whitelisted codes
(326 / 380 / 384 / 389 / 381 / 875 / 876 / 877) and emits at `flag="warning"`
(not `fatal`). There is no BR-DE-* rule that fails specifically on
`InvoiceCurrencyCode != 'EUR'` — currency-code validity is covered by generic
code-list rules at the EN 16931 layer (BR-CL-01).

To satisfy the plan's intent (layer-3 BR-DE-17 fires), the fixture mutates both
currency **and** `ram:TypeCode`. Layer 2 fires BR-CL-01 (fatal, code-list
rejection) and Layer 3 fires BR-DE-17 (warning). The test asserts presence of
BR-DE-17 in layer 3's `warnings` array. This deviation is tracked in
`61-03-SUMMARY.md` as a Rule-1 plan-spec clarification (not a code defect).

## Customization-ID deviation

Plan 61-01 constants pinned `XRECHNUNG_CUSTOMIZATION_ID` to
`urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0`
(historical URN prefix). The **v2026-01-31** KoSIT rule set uses the new
`xeinkauf.de` authority namespace:
`urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0`.

All four fixtures emit the correct `xeinkauf.de` URN in
`ram:GuidelineSpecifiedDocumentContextParameter/ram:ID` so layer 3 matches the
BR-DE-21 whitelist. Updating the Plan-02 constant to the
`xeinkauf.de` form is tracked as a Rule-1 auto-fix in `61-03-SUMMARY.md`.

## Regeneration

```bash
# 1. Edit fixture XMLs in place
# 2. Verify each still produces the documented per-layer outcome
pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/__tests__/validator.test.ts
# 3. Commit alongside the validator-bundle checksums
```

If the KoSIT release pin changes (`validator-bundle/source.txt`), re-run the
fixture suite; any new rule failures must be rectified in the fixture XMLs
**before** merging.
