# IRS IRIS XSD Schema Bundle

This directory holds the **IRS IRIS (Information Returns Intake System) XSD schema
package** that the IRIS XML generator builds against and the validator checks
submissions against. The schemas are the structural contract for the 1099-NEC
payload and the Transmission Manifest the IRS accepts.

## Why these files are not in npm

The IRS IRIS XSD package is **not published to npm and is not otherwise available
in-tree**. It is downloaded from the **IRS Secure Object Repository (SOR)** /
the "IRIS Schemas and Business Rules" page on irs.gov, which requires an IRS
account login. The download is therefore a **human-only step** — see
[`source.txt`](./source.txt) for the exact package to fetch and how to place it.

## Supply-chain pinning (mandatory)

Because these XSDs are an externally-downloaded build input, every `.xsd` here
has its SHA-256 pinned in [`checksums.txt`](./checksums.txt). A swapped or
tampered schema would silently change what counts as a valid IRIS submission, so
CI runs the guard and fails the build on any mismatch, any pinned-but-missing
file, or any unlisted `.xsd`:

```bash
pnpm --filter @contractor-ops/iris verify:schema-checksums
```

After the human places the freshly-downloaded XSDs, pin them once with:

```bash
pnpm --filter @contractor-ops/iris exec tsx scripts/verify-iris-schema-checksums.ts --write
```

## Self-contained — no network at validation time

The downstream validator parses these XSDs with `libxmljs2` using `{ nonet: true }`,
so no external `<xs:import schemaLocation="http://...">` can ever be fetched
(SSRF mitigation), and the default `noent: false` prevents external-entity
expansion (XXE). The bundle MUST be self-contained: every schema this package
imports has to live inside this directory.

## Layout

```
schema-bundle/
├── README.md        # this file
├── source.txt       # provenance: exact IRS package, tax year, posted date, package SHA-256
├── checksums.txt    # SHA-256 of every bundled .xsd (written by the guard's --write mode)
└── *.xsd            # IRS IRIS schemas (1099-NEC payload XSD + Transmission Manifest XSD), placed at the human-action checkpoint
```

## Status

The package skeleton, the checksum guard, and this provenance note are in place.
The actual `.xsd` files are populated at the human-action checkpoint (IRS SOR
login). `checksums.txt` is empty until they land.
