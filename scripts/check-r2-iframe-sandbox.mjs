#!/usr/bin/env node
/**
 * CI gate — every `<iframe>` in apps/web-vite/src must be registered with an
 * explicit sandbox profile so the SPA CSP `frame-src` wildcard
 * (`https://*.r2.cloudflarestorage.com`) cannot be exploited via a future
 * R2-fed iframe that ships a wide sandbox.
 *
 * Mitigation context: see docs/security/csp-r2-wildcard.md and
 * .planning/risk-register.md → RISK-SECURITY-002.
 *
 * Two failure modes:
 *   1. Unregistered iframe — anyone adding a new `<iframe>` must extend the
 *      ALLOWLIST below and document the category + expected sandbox shape.
 *      The review of that PR is the security audit.
 *   2. Sandbox drift — the registered iframe's actual `sandbox=` attribute
 *      no longer matches the registered expectation.
 *
 * Categories:
 *   - R2_FILE_PREVIEW  → must be `allow-downloads` only.
 *   - EMBEDDED_SIGNING → DocuSign / Autenti / similar e-signature widget.
 *   - THIRD_PARTY_MAP  → external map/picker widget on third-party domain.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;

/**
 * Each entry pins one `<iframe>` call-site. New iframes added to the SPA must
 * register here OR the script fails. The PR adding the iframe is the
 * security review.
 *
 * @typedef {object} Allowlisted
 * @property {string} file POSIX-style path relative to apps/web-vite/src.
 * @property {'R2_FILE_PREVIEW' | 'EMBEDDED_SIGNING' | 'THIRD_PARTY_MAP'} category
 * @property {string} sandbox Expected `sandbox=` value (space-separated tokens).
 * @property {string} rationale One-line note for the security reviewer.
 */

/** @type {Allowlisted[]} */
const ALLOWLIST = [
  {
    file: 'components/invoices/intake/intake-detail-pdf-pane.tsx',
    category: 'R2_FILE_PREVIEW',
    sandbox: 'allow-downloads',
    rationale:
      'R2-fed invoice PDF preview. CSP frame-src wildcards *.r2.cloudflarestorage.com; sandbox MUST be allow-downloads-only so a malicious payload cannot escape via allow-scripts + allow-same-origin.',
  },
  {
    file: 'components/portal/embedded-signing-modal.tsx',
    category: 'EMBEDDED_SIGNING',
    sandbox:
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
    rationale:
      'DocuSign / Autenti embedded signing on the portal. src is a vendor signingUrl (not R2); wide sandbox required by the vendor SPA.',
  },
  {
    file: 'components/contracts/contract-detail/embedded-signing-modal.tsx',
    category: 'EMBEDDED_SIGNING',
    sandbox:
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
    rationale:
      'DocuSign / Autenti embedded signing on the dashboard. Sandbox kept in sync with the portal signing modal so a hardening change applies uniformly.',
  },
  {
    file: 'components/equipment/paczkomat-picker.tsx',
    category: 'THIRD_PARTY_MAP',
    sandbox: 'allow-scripts allow-same-origin allow-popups',
    rationale:
      'InPost paczkomat picker map widget. src is the InPost vendor URL (not R2); narrow sandbox excludes allow-forms / allow-downloads which the widget does not need.',
  },
];

const R2_HOST_PATTERNS = [/r2\.cloudflarestorage\.com/i, /\.amazonaws\.com/i, /minio\b/i];

/** @param {string} dir */
function walk(dir) {
  /** @type {Array<{ rel: string; line: number; block: string }>} */
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(path));
      continue;
    }
    if (!/\.(tsx|jsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith('.test.tsx') || entry.name.endsWith('.spec.tsx')) {
      continue;
    }
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    const text = readFileSync(path, 'utf8');
    // Find each `<iframe` opening tag and capture up to the first `/>`.
    const re = /<iframe\b([\s\S]*?)\/>/g;
    let m = re.exec(text);
    while (m !== null) {
      const block = m[0];
      // Line number = number of newlines before match start + 1.
      const line = text.slice(0, m.index).split('\n').length;
      found.push({ rel, line, block });
      m = re.exec(text);
    }
    // Also detect non-self-closing iframes (rare, but possible).
    const reOpen = /<iframe\b([\s\S]*?)>(?!\s*<\/iframe>\s*$)/g;
    let m2 = reOpen.exec(text);
    while (m2 !== null) {
      // Only flag if this didn't already match the self-closing regex.
      const blockStart = m2.index;
      const matchEnd = m2.index + m2[0].length;
      m2 = reOpen.exec(text);
      const already = found.some(
        f => f.rel === rel && text.slice(0, blockStart).split('\n').length === f.line,
      );
      if (already) continue;
      // Take up to the closing `</iframe>` for the block snapshot.
      const closeIdx = text.indexOf('</iframe>', blockStart);
      const block = text.slice(blockStart, closeIdx > 0 ? closeIdx + '</iframe>'.length : matchEnd);
      const line = text.slice(0, blockStart).split('\n').length;
      found.push({ rel, line, block });
    }
  }
  return found;
}

/** @param {string} block */
function extractAttr(block, name) {
  // Tolerates `attr="…"`, `attr={'…'}`, `attr={"…"}`.
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|\\{\\s*['"]([^'"]*)['"]\\s*\\}|\\{([^}]*)\\})`,
  );
  const m = re.exec(block);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

/** @param {string|null} a @param {string|null} b */
function sameTokens(a, b) {
  if (!(a && b)) return false;
  const ta = a.split(/\s+/).filter(Boolean).sort();
  const tb = b.split(/\s+/).filter(Boolean).sort();
  return ta.length === tb.length && ta.every((t, i) => t === tb[i]);
}

const found = walk(ROOT);
/** @type {Array<{ rel: string; line: number; reason: string }>} */
const errors = [];

for (const entry of found) {
  const expected = ALLOWLIST.find(a => a.file === entry.rel);
  const sandbox = extractAttr(entry.block, 'sandbox');
  const src = extractAttr(entry.block, 'src');

  if (!expected) {
    errors.push({
      rel: entry.rel,
      line: entry.line,
      reason:
        `Unregistered <iframe>. New iframes in the SPA must extend ALLOWLIST in scripts/check-r2-iframe-sandbox.mjs ` +
        `with an explicit category + sandbox shape + rationale. ` +
        `The review of that PR is the security audit (CSP frame-src wildcards R2).`,
    });
    continue;
  }

  if (!sandbox) {
    errors.push({
      rel: entry.rel,
      line: entry.line,
      reason: `Missing sandbox= attribute. Expected: '${expected.sandbox}' (category: ${expected.category}).`,
    });
    continue;
  }

  if (!sameTokens(sandbox, expected.sandbox)) {
    errors.push({
      rel: entry.rel,
      line: entry.line,
      reason:
        `Sandbox drift. Expected '${expected.sandbox}' (category: ${expected.category}); ` +
        `actual '${sandbox}'. Update ALLOWLIST + re-check security review.`,
    });
  }

  // Defence-in-depth: if the `src` is a string literal pointing at an R2/S3/
  // MinIO host, force `allow-downloads` regardless of allowlist category.
  if (src) {
    const looksLikeR2 = R2_HOST_PATTERNS.some(p => p.test(src));
    if (looksLikeR2 && expected.category !== 'R2_FILE_PREVIEW') {
      errors.push({
        rel: entry.rel,
        line: entry.line,
        reason:
          `src= literal matches R2/S3/MinIO host pattern but allowlist category is ` +
          `${expected.category}. Re-category as R2_FILE_PREVIEW and narrow sandbox to 'allow-downloads'.`,
      });
    }
  }
}

// Check that every allowlist entry was matched (catches deletions or renames).
const seen = new Set(found.map(f => f.rel));
for (const entry of ALLOWLIST) {
  if (!seen.has(entry.file)) {
    errors.push({
      rel: entry.file,
      line: 0,
      reason:
        `Allowlist entry references a file that no longer contains an <iframe>. ` +
        `Remove the stale entry from ALLOWLIST or restore the iframe.`,
    });
  }
}

if (errors.length > 0) {
  console.error(`check:r2-iframe-sandbox — ${errors.length} violation(s):`);
  for (const e of errors) {
    console.error(`  ${e.rel}:${e.line}  ${e.reason}`);
  }
  console.error('\nSee docs/security/csp-r2-wildcard.md for the rationale.');
  process.exit(1);
}

console.log(
  `check:r2-iframe-sandbox — OK (${found.length} iframe(s) reviewed; ${ALLOWLIST.length} registered)`,
);
