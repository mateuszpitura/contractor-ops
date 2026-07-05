import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { VERSION_POLICY } from './version-headers.js';

// The developer-portal content builders. Every page is server-rendered HTML
// sourced from the SAME artifacts the API generates (the webhook event union,
// the Speakeasy SDK targets, the shipped verifier snippets, the RFC-8594 version
// policy) so the docs cannot drift from the real surface.

// The 98-11 Speakeasy SDK publish targets.
const SDK_TARGETS = [
  {
    language: 'TypeScript',
    registry: 'npm',
    pkg: '@contractor-ops/sdk',
    install: 'npm install @contractor-ops/sdk',
  },
  {
    language: 'Python',
    registry: 'PyPI',
    pkg: 'contractor-ops-sdk',
    install: 'pip install contractor-ops-sdk',
  },
];

const VERIFIERS: Array<{ label: string; file: string; lang: string }> = [
  { label: 'TypeScript', file: 'verify.ts', lang: 'ts' },
  { label: 'Python', file: 'verify.py', lang: 'py' },
  { label: 'Go', file: 'verify.go', lang: 'go' },
  { label: 'PHP', file: 'verify.php', lang: 'php' },
];

function repoFile(relPath: string): string {
  try {
    return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8');
  } catch {
    return '';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — Contractor Ops API</title>
<style>
  body { font: 15px/1.6 system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.2rem; margin-top: 2rem; }
  code, pre { font-family: ui-monospace, SFMono-Regular, monospace; }
  pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  nav a { margin-right: 1rem; }
</style>
</head>
<body>
<nav>
  <a href="/v1/docs">Reference</a>
  <a href="/v1/docs/webhooks">Webhooks</a>
  <a href="/v1/docs/sdks">SDKs</a>
  <a href="/v1/docs/recipes">Recipes</a>
  <a href="/v1/docs/changelog">Changelog</a>
  <a href="/v1/docs/deprecations">Deprecations</a>
</nav>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`;
}

export function renderWebhooksPage(): string {
  const rows = WEBHOOK_EVENT_TYPES.map(
    ev => `<tr><td><code>${escapeHtml(ev)}</code></td></tr>`,
  ).join('\n');
  return page(
    'Webhook event catalog',
    `<p>Contractor Ops delivers ${WEBHOOK_EVENT_TYPES.length} outbound event types. Every delivery is
     signed with an <code>X-CO-Signature</code> header — an HMAC-SHA256 of the raw request body keyed by your
     endpoint's signing secret. Verify it before trusting a payload (see the
     <a href="/v1/docs/recipes">recipes</a>).</p>
     <table><thead><tr><th>Event type</th></tr></thead><tbody>
     ${rows}
     </tbody></table>`,
  );
}

export function renderSdksPage(): string {
  const rows = SDK_TARGETS.map(
    t =>
      `<tr><td>${escapeHtml(t.language)}</td><td>${escapeHtml(t.registry)}</td>
       <td><code>${escapeHtml(t.pkg)}</code></td><td><code>${escapeHtml(t.install)}</code></td></tr>`,
  ).join('\n');
  return page(
    'SDK install guides',
    `<p>Official SDKs are generated from the OpenAPI spec and published per language.</p>
     <table><thead><tr><th>Language</th><th>Registry</th><th>Package</th><th>Install</th></tr></thead>
     <tbody>${rows}</tbody></table>
     <p>Authenticate every request with your API key as a Bearer token:
     <code>Authorization: Bearer co_live_…</code> (or <code>co_test_…</code> for the sandbox).</p>`,
  );
}

export function renderRecipesPage(): string {
  const snippets = VERIFIERS.map(v => {
    const src = repoFile(`../../docs/webhooks/verifiers/${v.file}`);
    return `<h2>${escapeHtml(v.label)} signature verifier</h2>
      <pre><code>${escapeHtml(src)}</code></pre>`;
  }).join('\n');
  return page(
    'Sample recipes',
    `<p>Connect Contractor Ops to Zapier, n8n, and Make from the marketplace listings, or verify a webhook
     signature yourself with one of the snippets below (each checks the <code>X-CO-Signature</code>
     HMAC-SHA256 header).</p>
     ${snippets}`,
  );
}

export function renderChangelogPage(): string {
  const md = repoFile('../../CHANGELOG.md');
  return page('Changelog', `<pre>${escapeHtml(md)}</pre>`);
}

export function renderDeprecationsPage(): string {
  const rows = Object.entries(VERSION_POLICY)
    .map(([version, policy]) => {
      const deprecation = policy.deprecation ? policy.deprecation.toUTCString() : '—';
      const sunset = policy.sunset ? policy.sunset.toUTCString() : '—';
      return `<tr><td><code>${escapeHtml(version)}</code></td><td>${escapeHtml(deprecation)}</td>
        <td>${escapeHtml(sunset)}</td>
        <td>${policy.policyUrl ? `<a href="${escapeHtml(policy.policyUrl)}">policy</a>` : '—'}</td></tr>`;
    })
    .join('\n');
  return page(
    'Deprecation notices',
    `<p>Lifecycle changes follow <a href="https://www.rfc-editor.org/rfc/rfc8594">RFC 8594</a>: a deprecated
     or sunsetting version emits <code>Deprecation</code> + <code>Sunset</code> response headers. The current
     <code>v1</code> is stable — nothing is scheduled for sunset.</p>
     <table><thead><tr><th>Version</th><th>Deprecation</th><th>Sunset</th><th>Policy</th></tr></thead>
     <tbody>${rows}</tbody></table>`,
  );
}
