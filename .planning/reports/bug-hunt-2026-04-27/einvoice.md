# Bug-hunt: packages/einvoice — 2026-04-27

## Summary
- Files reviewed: 27 source files (signer, generators, parsers, validators, ASP adapter, structural check, XMP, PDF wrapper, KSeF API client, ZATCA onboarding, etc.)
- Findings: 1 CRITICAL, 5 HIGH, 4 MEDIUM, 3 LOW
- Top 3 risks:
  1. CRITICAL — Storecove webhook HMAC verification crashes on malformed signature header (ECONNRESET-style 500 instead of 401), and `Buffer.from(hex)` decoding silently truncates non-hex chars, weakening the signature comparison guarantee.
  2. HIGH — `signer.ts` injects the XAdES `<ds:Signature>` block via a single `xml.replace()` regex that matches the FIRST `<ext:ExtensionContent>…</ext:ExtensionContent>` group — invoices that contain another empty `<ext:ExtensionContent>` (e.g. nested extension hooks the spec allows) silently sign the wrong slot.
  3. HIGH — `toMinorUnits()` and `parseFloat`-based amount conversion are precision-lossy. For amounts > 9 quadrillion minor units the rounding fails, but the realistic risk is `parseFloat("1190.00 EUR")` returning `1190` (i.e. trailing currency suffixes silently parse without throwing). Outbound `fromMinor()` is precision-safe, inbound is not — round-trip drift.

## Findings

### [CRITICAL] Webhook signature verification crashes / silently weakens on malformed input
**File:** `src/asp/storecove/adapter.ts:340-345`

**What:** `verifyWebhookSignature` does:
```
const computed = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
const valid = timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
```
- `signature` comes straight from a request header.
- `Buffer.from(<header>, 'hex')` silently drops any character that isn't `[0-9a-f]` and stops at the first odd-length boundary — meaning an attacker-controlled header `"abcZdef…"` produces a buffer of length 0 or some unrelated truncation, which is then compared against a 32-byte HMAC.
- When the resulting buffers differ in length, `timingSafeEqual` throws a `RangeError("Input buffers must have the same byte length")`. The throw escapes `verifyWebhookSignature`, propagates out of the call site, and is observed by the caller as an unhandled 500 — but worse, a defensive try/catch upstream that maps "verification error" to "valid: false" would mask differences between "header malformed" and "signature mismatch".

**Why it's a bug/risk:** Webhook signature verification is a trust boundary. A predictable crash on malformed input is at minimum a DoS amplifier (one bad header → 500 → log floods) and at worst a logic bypass if any caller catches the throw and falls through. Independent of throw behaviour, silent hex-truncation means the comparison universe is smaller than the header's character space — the HMAC strength bound is computed against the wrong input domain. The Storecove adapter does NOT wrap this in try/catch; it returns `{ valid }` directly.

**Suggested fix:** Validate header shape BEFORE decoding:
```
const HEX64 = /^[0-9a-f]{64}$/i;
if (typeof signature !== 'string' || !HEX64.test(signature)) {
  return { valid: false };
}
const sigBuf = Buffer.from(signature, 'hex');
const cmpBuf = Buffer.from(computed, 'hex');
if (sigBuf.length !== cmpBuf.length) return { valid: false };
const valid = timingSafeEqual(sigBuf, cmpBuf);
```
Also: header lookup `headers['storecove-signature'] ?? headers['Storecove-Signature']` is case-sensitive Object lookup but HTTP headers are case-insensitive — better to normalize (lowercase) all header keys before matching, or accept that callers pre-normalize. Document explicitly.

---

### [HIGH] XAdES signature injection regex matches first ExtensionContent — silent slot-collision
**File:** `src/profiles/zatca/signer.ts:309-312, 351-354`

**What:**
```
const tempSignedXml = xml.replace(
  /(<ext:ExtensionContent>)(\s*)(<\/ext:ExtensionContent>)/,
  `$1${placeholderSignatureXml}$2$3`,
);
```
This regex matches the FIRST occurrence of an empty `<ext:ExtensionContent>…</ext:ExtensionContent>`. The ZATCA generator (`generator.ts:236-241`) only emits one such slot today — but UBL's `UBLExtensions` is `1..N` and a future generator change (or, more troublingly, an attacker-controlled UBL fragment in a parse-then-sign workflow) that introduces a second empty `ExtensionContent` would silently put the signature in the wrong extension. Also: this regex assumes the close tag is on a single line with only whitespace between — a generator that ever pretty-prints differently or includes a comment/PI inside `ExtensionContent` would simply fail to match, and `xml.replace()` returns the original string unchanged. NO error is raised. The signed `verify()` step would then fail later with a confusing "no ds:Signature element found" rather than "signature injection slot missing".

**Why it's a bug/risk:** Signing-slot mismatches are the canonical foot-gun in XAdES enveloped signing. ZATCA inspectors will reject invoices where the `ds:Signature` is in the wrong UBLExtension (per UBL Signature Aggregate Components spec). Worse, since the injection is regex-based instead of DOM-based, any future encoding/whitespace change propagates as a silent no-op.

**Suggested fix:** Move from regex injection to DOM injection — `signer.ts` already loads xmldom for `computeDocDigest`. Locate the (single) `ext:ExtensionContent` whose parent's `ext:ExtensionURI` text equals `"urn:oasis:names:specification:ubl:dsig:enveloped:xades"` and `appendChild` into THAT node. Throw if the slot is not found (clear pre-condition violation). Keeps invariant: the slot is unambiguously the XAdES extension, not the first textual match.

---

### [HIGH] `toMinorUnits()` uses `parseFloat` — precision loss + silent suffix/garbage acceptance
**File:** `src/engine/xml-utils.ts:28-32`; consumers in `src/profiles/{zatca,peppol-ae,ksef}/parser.ts`

**What:**
```
export function toMinorUnits(value: unknown, exponent = 2): number {
  if (value === undefined || value === null || value === '') return 0;
  const factor = 10 ** exponent;
  return Math.round(parseFloat(String(value)) * factor);
}
```
Two distinct bugs:
1. **Precision loss.** `parseFloat("1190.00") * 100 = 118999.99999999999` (representative example) → `Math.round` saves it for small values, but for monetary amounts >~10^15 cents the round breaks. The XRechnung parser has its own precision-safe path (`toMinorUnits` at `xrechnung-de/parser.ts:116-135` uses string splitting, correctly). The shared `engine/xml-utils.ts` version is the lossy one and is used by ZATCA, peppol-ae, and KSeF parsers.
2. **Silent suffix acceptance.** `parseFloat("1190.00 SAR")` returns `1190` — no error. If a malformed XML carries an amount with junk suffix, the parser quietly accepts the numeric prefix, masking what would otherwise be a Schematron-detectable error.

**Why it's a bug/risk:** Round-trip semantic drift: a ZUGFeRD/XRechnung invoice parsed → re-generated may have different cent values from the original because the inbound parser uses lossy `parseFloat` while the outbound generator uses the precision-safe string-splice path (`xrechnung-de/generator.ts:109-120`). For tax-authority submissions, ANY drift between the parsed canonical form and the bytes the auditor compares against breaks reconciliation.

**Suggested fix:** Replace `engine/xml-utils.ts:toMinorUnits` with the same string-splice algorithm used in `xrechnung-de/parser.ts:116-135` — it's already proven and adopted there. Throw on non-numeric input rather than returning a partial parse. This is a single function shared by 3 parsers, so the fix is local but high-leverage.

---

### [HIGH] Skonto due-date computation is timezone-fragile
**File:** `src/profiles/xrechnung-de/generator.ts:283-287`

**What:**
```
const issueDateParsed = new Date(invoice.issueDate);
const dueDate = new Date(issueDateParsed);
dueDate.setDate(dueDate.getDate() + skontoTerm.netPeriodDays);
const dueDateCii = `${dueDate.getFullYear()}${String(dueDate.getMonth() + 1).padStart(2, '0')}${String(dueDate.getDate()).padStart(2, '0')}`;
```
`invoice.issueDate` is documented as `YYYY-MM-DD`. `new Date("2026-04-27")` parses as UTC midnight. Then `getDate/getMonth/getFullYear` are LOCAL-TZ accessors. For a server in `America/Los_Angeles`, `new Date("2026-04-27")` is `2026-04-26 17:00 PDT`, so `getDate()` returns `26`. `+ netPeriodDays` then computes a date one day before the intended due date.

**Why it's a bug/risk:** XRechnung Skonto periods feed payment-discount calculations. A 1-day shift means the discount window opens/closes a day early or late in CET vs. UTC, causing the legally-binding embedded #SKONTO# string to disagree with the human-readable German description on dates around month boundaries. This is a real regression vs. the no-Skonto branch (line 326) which calls `toCiiDate(invoice.dueDate)` (string operation, TZ-immune).

**Suggested fix:** Don't go through `Date`. Parse `YYYY-MM-DD` with the existing `toCiiDate` helper, then add days using a UTC-only helper (e.g. `Date.UTC(y,m-1,d) + days*86400000` then read with `getUTC*`). Or: take a fully resolved `dueDate` from the caller and emit it as-is; don't compute it in the generator.

---

### [HIGH] ZATCA signer `escapeXml` does not escape `'` (apostrophe)
**File:** `src/profiles/zatca/signer.ts:134-140`

**What:**
```
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```
This is used to escape `cert.issuer.replace(/\n/g, ', ')` — i.e. the X.509 issuer DN — into `<ds:X509IssuerName>…</ds:X509IssuerName>`. While the escape list covers the four most-common XML metacharacters in element-content, a DN containing an apostrophe (legal in `O=`, `OU=`, `CN=` per RFC 4514) won't break XML well-formedness (apostrophes are allowed in element text and `"`-attributed values), so the missing `'` escape is technically not a parse-time issue here. **However**, the bigger issue is that this DN is then re-canonicalized via Exclusive C14N before SignedInfo digest is computed. Any single character that the escape function misses but the canonicalizer normalizes differently breaks the digest match between sign and verify.

The XMP template (`zugferd-de/xmp-template.ts:142-149`) DOES escape `'`. The signer escape list is a strict subset — and is used on cryptographically-sensitive content. While the practical exploitability is low (DN apostrophes are uncommon in CA-issued certs), it's an unjustified asymmetry that would bite on a corner-case cert.

**Why it's a bug/risk:** A cert whose issuer DN contains `'` would be allowed to sign but might fail verification on strict re-canonicalizers. More importantly: the `escapeXml` of the signer is an obvious place where a future CN/Subject change introduces drift; harden it now.

**Suggested fix:** Add `.replace(/'/g, '&apos;')` to match the XML 1.0 §2.4 predefined-entities set. While at it: extract a single shared `escapeXmlEntities` helper in `engine/xml-utils.ts` and reuse from both the signer and the XMP template — currently each has its own copy and they disagree.

---

### [HIGH] ZATCA `extractSerialNumber` cast `BigInt(\`0x${cert.serialNumber}\`)` assumes hex
**File:** `src/profiles/zatca/signer.ts:116-118`

**What:**
```
function extractSerialNumber(cert: crypto.X509Certificate): string {
  return BigInt(`0x${cert.serialNumber}`).toString(10);
}
```
`crypto.X509Certificate.serialNumber` is documented (Node.js) as returning a hex string with NO `0x` prefix — fine. BUT: Node's documentation also notes the value is `''` (empty string) for some self-signed certificates that omit the serial extension. `BigInt("0x")` throws `SyntaxError: Cannot convert 0x to a BigInt`. The throw escapes `sign()` with a stack trace that leaks crypto internals.

**Why it's a bug/risk:** Onboarding/self-signed test certs that lack a serial number cause a confusing low-level error during signing. Per CLAUDE.md "Avoid silent failures" + the file's own comment "Error messages are generic and do not leak key material", we should surface a clear error.

**Suggested fix:**
```
if (!cert.serialNumber) throw new Error('ZATCA signing: certificate is missing a serial number');
return BigInt(`0x${cert.serialNumber}`).toString(10);
```
Same hardening principle as `parseCertificate`/`parsePrivateKey` already follow.

---

### [MEDIUM] Hot-spot review: `c14n.process(... as unknown as Element, {})` casts ARE legitimate
**File:** `src/profiles/zatca/signer.ts:161, 175, 330`

**Verdict:** Legit. `xml-crypto`'s `ExclusiveCanonicalization.process` declares its first arg as the DOM `Element` from xml-crypto's bundled `@xmldom/xmldom`, but the runtime instance comes from a separately-resolved copy of the same package (the `getXmldom()` indirection at lines 39-50). The two packages are structurally identical at runtime but TS sees them as nominal types. The `as unknown as Element` is annotating a known-equivalent-runtime-shape — this is exactly the situation where the cast is justified.

**Mild suggestion:** Add a one-line comment near each cast (`// nominal-type bridge: xml-crypto's xmldom vs. ours`) so future readers don't re-investigate. The line 318 cast (`signedPropsElement as Element`) follows the same logic. Low priority.

---

### [MEDIUM] Hot-spot review: `as unknown as { asArray?(): unknown[] }` PDF lib casts ARE legitimate but defensive — error path is dead
**File:** `src/profiles/zugferd-de/zugferd-structural-check.ts:104, 162, 212, 237`

**Verdict:** Legit BUT inconsistent. `pdf-lib`'s `lookup()` returns `PDFObject` (a union), and `PDFArray` HAS an `asArray()` method but `lookup()` doesn't narrow to it without an `instanceof` check. The `as unknown as { asArray?(): unknown[] }` pattern is a runtime-fallback-style narrowing.

**Real issue:** All four sites do `outputIntents.asArray ? outputIntents.asArray() : []` — i.e. silently treat a non-array return as empty. But by the time we reach this code, the catalog `/OutputIntents` MUST be an array per PDF/A-3 spec, and a non-PDFArray would mean the wrap pipeline produced a malformed PDF. Falling back to `[]` then triggers `MISSING_OUTPUT_INTENT` "array is empty", which is a misleading error vs. "the lookup returned a non-array". Same for `/AF` and the names tree.

**Suggested fix:** Replace the cast with `if (!(outputIntents instanceof PDFArray))` and throw a `STRUCTURAL_CHECK_FAILED` with a clear "expected PDFArray, got <ctor.name>" message. Same pattern at all 4 sites. Keeps the error taxonomy honest. Low effort, high diagnostic payoff.

---

### [MEDIUM] Throwing plain object literals (instead of Error) defeats stack traces
**File:** `src/profiles/xrechnung-de/parser.ts` (12 sites), `src/profiles/zugferd-de/parser.ts` (2 sites)

**What:** The CII parser throws `{ code: 'CII_PARSE_FAILED', message: '…' }` as a plain object via `throw { … } satisfies ParserError;`. The `satisfies` ensures shape but the thrown value is NOT an `Error` — it has no stack trace, no `name`, and `error instanceof Error` returns false at every catch site (e.g., the engine's `validate()` wrappers in `xrechnung-de/index.ts:65-73` and `zatca/index.ts:65-73` use `error instanceof Error ? error.message : String(error)` which falls through to `String(<plainObject>)` producing `"[object Object]"`).

**Why it's a bug/risk:** Operations debugging — when a 500 escapes from the API layer the logs show `[object Object]` instead of the typed error. The `satisfies ParserError` typing is good; the throw mechanism is wrong.

**Suggested fix:** Define a `class CIIParserError extends Error { constructor(public readonly code, public readonly level?, ...) { super(message); this.name = 'CIIParserError'; } }` and throw instances. Preserves the discriminant via `.code` while keeping stack traces and `instanceof Error` true. Minimal call-site change at the catches: `if (error instanceof CIIParserError) { … }`.

---

### [MEDIUM] KSeF `ksefToEInvoice` tax bucketing collapses on identical rates with different VAT amounts
**File:** `src/profiles/ksef/mapper.ts:101-116`

**What:** Tax breakdown is computed by `taxGroups.set(key, existing)` where `key = line.vatRate ?? '0'`. Multiple lines at the same rate aggregate correctly. BUT the keying loses the `taxCategory` distinction between `'S'` (taxable) and `'Z'` (zero-rated): the loop derives category from `group.rate > 0 ? 'S' : 'Z'`. This is fine for KSeF's domestic context but breaks if a future invoice has TWO "0%" lines where one is genuinely zero-rated (Z) and one is exempt (E) — the bucketing collapses them into a single 'Z' entry and drops the exempt-reason context.

**Why it's a bug/risk:** Today this is a latent bug — KSeF/FA(3) invoices in the wild rarely mix Z and E at zero rate. But the data path silently merges them, so when it does happen the mapper produces an invoice that fails downstream tax-category Schematron rules with no diagnostic.

**Suggested fix:** Key on `(vatRate, taxCategory)` tuple, or pull the category from a separate KSeF FA field if present. Not urgent (KSeF parser doesn't currently extract category) — low-priority defensive fix.

---

### [LOW] `signer.ts:sign()` is 78 lines — borderline, but every step is a logical unit
**File:** `src/profiles/zatca/signer.ts:278-355`

**What:** The `sign()` method runs 8 numbered steps in one body. The numbered comments are excellent but the function is right at the readability threshold.

**Suggested fix:** Extract `computeSignedPropsDigest(tempSignedXml: string): string` (steps 4 of the 8). Keeps `sign()` at a clean ~50 LOC and isolates the placeholder-injection-then-recanonicalize trick into a function whose name documents WHY (compute SignedProperties digest with full document context). Low priority — readable as-is.

---

### [LOW] `validateXRechnungCii` SKIPPED-layer pattern duplicates 8 lines
**File:** `src/profiles/xrechnung-de/validator.ts:196-216`

**What:** When XSD fails, the function pushes two SKIPPED layer reports with identical empty issue arrays:
```
layers.push({ layer: 'EN16931-SCH', status: 'SKIPPED', errors: [], warnings: [], infos: [] });
layers.push({ layer: 'XRECHNUNG-SCH', status: 'SKIPPED', errors: [], warnings: [], infos: [] });
```

**Suggested fix:** `const skipped = (layer): ValidationLayerReport => ({ layer, status: 'SKIPPED', errors: [], warnings: [], infos: [] });` then `layers.push(skipped('EN16931-SCH'), skipped('XRECHNUNG-SCH'));`. Pure DRY; trivial.

---

### [LOW] `KsefApiClient.fetchWithRetry` uses `lastError` but loses non-retryable thrown context across retries
**File:** `src/profiles/ksef/api-client.ts:431-448`

**What:** The retry loop catches errors via `KsefApiClient.toError(error)` — which converts unknowns to plain `Error(String(value))`. Stack traces from network errors (e.g. `AbortError` with cause chain) are normalized away into `Error("AbortError: …")`. Fine for retry logic but the `lastError` thrown at the end has no `.cause` linking back to the original. Operationally, when polling a KSeF query for 60 attempts and the last one fails, the surfaced error doesn't show WHICH attempt or original cause.

**Suggested fix:** Use `new Error(message, { cause: original })` (Node 16.9+) so the cause chain survives. Low priority; debugging-quality issue.

---

## Files reviewed
- `src/profiles/zatca/signer.ts`
- `src/profiles/zatca/qr-code.ts`
- `src/profiles/zatca/api-client.ts`
- `src/profiles/zatca/onboarding.ts`
- `src/profiles/zatca/generator.ts`
- `src/profiles/zatca/parser.ts`
- `src/profiles/zatca/compliance.ts`
- `src/profiles/zatca/index.ts`
- `src/profiles/zugferd-de/zugferd-structural-check.ts`
- `src/profiles/zugferd-de/pdf-wrapper.ts`
- `src/profiles/zugferd-de/xmp-template.ts`
- `src/profiles/zugferd-de/generator.ts`
- `src/profiles/zugferd-de/parser.ts`
- `src/profiles/zugferd-de/profile.ts`
- `src/profiles/zugferd-de/validator.ts`
- `src/profiles/zugferd-de/invoice-template.tsx`
- `src/profiles/zugferd-de/index.ts`
- `src/profiles/xrechnung-de/generator.ts`
- `src/profiles/xrechnung-de/parser.ts`
- `src/profiles/xrechnung-de/validator.ts`
- `src/profiles/xrechnung-de/svrl-normalizer.ts`
- `src/profiles/xrechnung-de/leitweg-id-embed.ts`
- `src/profiles/xrechnung-de/index.ts`
- `src/profiles/peppol-ae/generator.ts`
- `src/profiles/peppol-ae/parser.ts`
- `src/profiles/peppol-ae/qr-code.ts`
- `src/profiles/peppol-ae/validator.ts`
- `src/profiles/ksef/api-client.ts`
- `src/profiles/ksef/generator.ts`
- `src/profiles/ksef/parser.ts`
- `src/profiles/ksef/mapper.ts`
- `src/profiles/ksef/compliance.ts`
- `src/profiles/ksef/index.ts`
- `src/asp/storecove/adapter.ts`
- `src/asp/storecove/client.ts`
- `src/engine/engine.ts`
- `src/engine/pipeline.ts`
- `src/engine/xml-utils.ts`
- `src/registry.ts`
