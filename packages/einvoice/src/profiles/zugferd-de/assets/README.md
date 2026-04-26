# ZUGFeRD PDF/A-3 Asset Bundle

Phase 62 · Plan 02 bundles the binary assets required for deterministic PDF/A-3
generation (Plan 03): an sRGB ICC output-intent profile and the two Noto Sans
font weights used by the visual invoice template.

All asset bytes are pinned by SHA-256 in `checksums.txt`. CI re-verifies the
digests before build so an upstream binary swap cannot silently change PDF
fingerprints.

## Assets

| File | Purpose | Source | License | Download date | SHA-256 (abbrev) |
| ---- | ------- | ------ | ------- | ------------- | ---------------- |
| `sRGB2014.icc` | sRGB ICC v2 output-intent profile referenced by the PDF/A-3 catalog `/OutputIntents` entry. ZUGFeRD spec requires a PDF/A-3 conformance-B OutputIntent; any sRGB-IEC61966-2.1 profile satisfies the invariant. | [ArtifexSoftware/ghostpdl `iccprofiles/default_rgb.icc`](https://github.com/ArtifexSoftware/ghostpdl/blob/master/iccprofiles/default_rgb.icc) — upstream Ghostscript sRGB profile bundle. | Apache-2.0 (Ghostscript iccprofiles) — free-to-use; ICC profile payload itself is free-to-redistribute per ICC licence. | 2026-04-14 | `eddaf344…` |
| `NotoSans-Regular.ttf` | Default text face for invoice body. Required for PDF/A-3 full font-embedding conformance — we set it as the React-PDF template default so every glyph renders from a vendored font rather than a system-fallback. | [googlefonts/noto-fonts — `hinted/ttf/NotoSans/NotoSans-Regular.ttf`](https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf) | SIL OFL 1.1 — permissive redistribution + vendoring allowed. | 2026-04-14 | `b85c38ec…` |
| `NotoSans-Bold.ttf` | Bold weight used for headers + invoice totals. Embedded alongside Regular so the template can switch weights without falling back to a system face. | [googlefonts/noto-fonts — `hinted/ttf/NotoSans/NotoSans-Bold.ttf`](https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf) | SIL OFL 1.1 — permissive redistribution + vendoring allowed. | 2026-04-14 | `c976e4b1…` |

## Verification

Re-verify the bundle digests at any time via:

```bash
node -e "const c=require('crypto'),f=require('fs');const lines=f.readFileSync('checksums.txt','utf8').trim().split('\n');for(const l of lines){const [hash,name]=l.trim().split(/\s+/);const actual=c.createHash('sha256').update(f.readFileSync(name)).digest('hex');if(hash!==actual){console.error('MISMATCH',name);process.exit(1)}}console.log('ok')"
```

Plan 03 adds a CI job that runs this check automatically before building the
ZUGFeRD generator.

## Replacement / Re-download

If an upstream binary needs to be refreshed:

1. Replace the file in this directory.
2. Re-compute its SHA-256 and update the matching line in `checksums.txt`.
3. Update the Download date column above.
4. Re-run the verify command — must pass before commit.
5. Run a full ZUGFeRD generator fixture round-trip (Plan 03 CI) to confirm
   the new binary does not shift veraPDF conformance output.
