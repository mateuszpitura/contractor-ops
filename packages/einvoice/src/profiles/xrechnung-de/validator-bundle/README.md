# KoSIT XRechnung Validator Bundle

**Source:** [itplr-kosit/validator-configuration-xrechnung](https://github.com/itplr-kosit/validator-configuration-xrechnung) — `release-2026-01-31`

**License:** [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) — KoSIT publishes the validator configuration + schematron rule-sets for XRechnung 3.0.2 (CIUS on EN 16931).

## Purpose

This directory holds the pre-compiled KoSIT XSLT artifacts used by `validator.ts` (Plan 03) to run the three-layer XRechnung validation pipeline locally via `saxon-js`:

1. **Layer 1 — XSD schema** — UN/CEFACT Cross Industry Invoice D16B structural validation via `libxmljs2`
2. **Layer 2 — EN 16931 Schematron** — European semantic model rules via `saxon-js` applying `EN16931-CII-validation.sef.json`
3. **Layer 3 — XRechnung CIUS Schematron** — German CIUS-specific rules via `saxon-js` applying `XRechnung-CII-validation.sef.json`

No JVM. No child process. No remote HTTP calls. Pure JS XSLT evaluation.

## Directory Layout (after Plan 03 populates artifacts)

```
validator-bundle/
├── .gitkeep
├── README.md                              # this file
├── source.txt                             # pinned release tag + SHA-256 of release zip
├── checksums.txt                          # SHA-256 of each .sef.json (written by recompile script)
├── src-xslt/                              # extracted KoSIT XSLT sources (input to recompile)
│   ├── EN16931-CII-validation.xsl
│   └── XRechnung-CII-validation.xsl
├── EN16931-CII-validation.sef.json        # saxon-js exported SEF (Plan 03 populates)
├── XRechnung-CII-validation.sef.json      # saxon-js exported SEF (Plan 03 populates)
└── CII-D16B-schema/                       # OASIS/UN-CEFACT CII D16B XSDs (Plan 03 populates)
    ├── CrossIndustryInvoice_100pD16B.xsd
    └── …
```

Typical SEF JSON size is <5MB each, well under version-control limits.

## Re-Compile Instructions

1. Download the pinned KoSIT release zip referenced in `source.txt`:

   ```bash
   curl -L \
     https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/release-2026-01-31/validator-configuration-xrechnung_3.0.x_2026-01-31.zip \
     -o /tmp/kosit.zip
   shasum -a 256 /tmp/kosit.zip  # must match the sha256: line in source.txt
   ```

2. Extract XSLT sources and CII D16B schema into `src-xslt/` and `CII-D16B-schema/`.

3. Run the recompile script to produce `.sef.json` outputs:

   ```bash
   pnpm tsx scripts/recompile-kosit-schematron.ts
   ```

   The script shells `xslt3` (devDep of `@contractor-ops/einvoice`) and writes SHA-256 of each output to `checksums.txt`.

4. CI **must** re-verify via `sha256sum -c checksums.txt` — it **must not** re-fetch the upstream release.

## Status

Plan 61-01 (this plan) pins the release tag and scaffolds this directory. The actual `.sef.json` artifacts, `src-xslt/` sources, and `CII-D16B-schema/` XSDs are populated by Plan 61-03 (KoSIT three-layer validator implementation).

Plan 61-01 only confirms the supply-chain pinning invariant is in place.
