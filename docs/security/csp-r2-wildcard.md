# SPA CSP `frame-src` — R2 wildcard documented acceptance

> Status: **accepted with mitigations**.
> Risk register: [`.planning/risk-register.md`](../../.planning/risk-register.md) → `RISK-SECURITY-002`.
> Audit row: [`goals/post-migration-parity-audit/audit-report.md`](../../goals/post-migration-parity-audit/audit-report.md) → `GAP-SECURITY-002`.
> Review cadence: quarterly (next: T+90d from acceptance commit).

## Decision

The SPA CSP `frame-src` directive in `render.yaml` keeps the broad
`https://*.r2.cloudflarestorage.com` wildcard. Narrowing the wildcard to
per-region bucket subdomains is blocked on ops confirming three prod env
values (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME_EU`, `R2_BUCKET_NAME_ME`,
`R2_FORCE_PATH_STYLE`) — see audit-report.md `GAP-SECURITY-002` escalation
options (a) / (b). Acceptance applies until ops makes that call.

The acceptance is paired with two CI guardrails so the wildcard cannot be
silently exploited by a future iframe call-site:

1. **`pnpm check:r2-iframe-sandbox`** — every `<iframe>` in `apps/web-vite/src`
   must register against an allowlist with category + expected sandbox shape
   + rationale. New iframes added by any future PR force an explicit security
   review. Implemented in
   [`scripts/check-r2-iframe-sandbox.mjs`](../../scripts/check-r2-iframe-sandbox.mjs).
   Wired into `pnpm lint:ci` (and therefore CI) at the repo root.
2. **`frame-ancestors 'none'`** — already present on the SPA CSP; prevents
   R2-hosted documents from framing the SPA back, removing the reverse
   click-jacking vector.

## Why the wildcard is acceptable today

The only R2-fed iframe in the SPA is
[`apps/web-vite/src/components/invoices/intake/intake-detail-pdf-pane.tsx:86`](../../apps/web-vite/src/components/invoices/intake/intake-detail-pdf-pane.tsx)
and it ships `sandbox="allow-downloads"` only — no `allow-scripts`, no
`allow-same-origin`, no `allow-forms`. That sandbox shape prevents the
canonical CSP-sandbox-bypass vector (a malicious payload at the R2 URL
removing the sandbox attribute on the parent iframe via DOM access) because
the iframe has no scripting capability and no same-origin access.

The other three SPA iframes do not load R2 content:

- `components/portal/embedded-signing-modal.tsx` — DocuSign / Autenti
  embedded signing URL on the portal (vendor host).
- `components/contracts/contract-detail/embedded-signing-modal.tsx` —
  DocuSign / Autenti embedded signing on the dashboard (vendor host).
- `components/equipment/paczkomat-picker.tsx` — InPost paczkomat picker map
  (vendor host).

Each carries a wider sandbox required by the vendor SPA, but its `src` is a
vendor URL gated by separate `frame-src` entries (DocuSign / Autenti /
InPost hosts) — not the R2 wildcard. The `check:r2-iframe-sandbox` script
additionally cross-references the `src=` literal against R2 / S3 / MinIO
host patterns; if a future iframe accidentally loads from R2 with a
non-`R2_FILE_PREVIEW` category, the script fails.

## Multi-provider reality

The wildcard reflects three realities:

1. **Production R2** — `{accountId}.r2.cloudflarestorage.com` virtual-hosted
   addressing OR `{accountId}.r2.cloudflarestorage.com/{bucket}/...`
   path-style addressing. Determined by `R2_FORCE_PATH_STYLE` env (ops
   owner).
2. **Regional buckets** — `R2_BUCKET_NAME_EU` and `R2_BUCKET_NAME_ME` under
   one `R2_ACCOUNT_ID`. Both regions resolve to subdomains under the same
   parent zone.
3. **Local dev / preview** — MinIO running on a developer machine, an
   arbitrary host (`localhost`, `*.internal`, etc.). The wildcard does not
   cover MinIO, but local dev already requires `frame-src` adjustments via
   the per-developer `render.yaml` override path — out of scope for the
   production CSP review.

A narrower CSP (option (a) in the audit) would replace the wildcard with
two explicit hosts:
`https://{EU_BUCKET}.{ACCOUNT_ID}.r2.cloudflarestorage.com https://{ME_BUCKET}.{ACCOUNT_ID}.r2.cloudflarestorage.com`.
That edit is one line in two files (`render.yaml:684` + `apps/web-vite/index.html:28`)
once ops confirms the three env values.

## How the guardrail interacts with the audit row

| Step | Owner | Status |
|------|-------|--------|
| 1. Document acceptance + mitigations | restoration agent | **done** (this file) |
| 2. Stand up `check:r2-iframe-sandbox` CI guardrail | restoration agent | **done** ([scripts/check-r2-iframe-sandbox.mjs](../../scripts/check-r2-iframe-sandbox.mjs); wired into `pnpm lint:ci`) |
| 3. Risk register entry | restoration agent | **done** (`RISK-SECURITY-002`) |
| 4. Ops confirms `R2_ACCOUNT_ID` + bucket names + path-style flag | ops owner | **pending** (T+7d per audit escalation) |
| 5. Narrow `frame-src` to per-region hosts | infra owner | **pending** (1-line edit after step 4) |
| 6. Quarterly review of the acceptance | security reviewer | **scheduled** |

Once step 5 lands, the wildcard is gone and this document moves to
"superseded" status with a pointer to the narrowing commit. The
`check:r2-iframe-sandbox` guardrail stays in place permanently — it is
useful regardless of how narrow the CSP host list becomes.

## Threat model — what's mitigated, what's residual

| Vector | Mitigation | Residual risk |
|--------|------------|---------------|
| Attacker uploads malicious HTML to a public R2 bucket, lures a user to an iframe that loads it. | The only R2-fed iframe ships `sandbox="allow-downloads"`. The malicious HTML cannot execute JS, cannot access cookies / localStorage, cannot escape the sandbox via DOM access. | Effectively zero against the current iframe set. |
| Future PR adds a new iframe pointing at R2 with a wider sandbox. | `check:r2-iframe-sandbox` CI gate forces registration + flags `R2_FILE_PREVIEW` category mismatch. | Requires the gate to run on every PR — currently wired via `pnpm lint:ci` which runs in CI. Bypassable only by skipping CI (`--no-verify` push to a protected branch). |
| Attacker uses R2 wildcard as a click-jacking surface (framing the SPA from R2-hosted HTML). | `frame-ancestors 'none'` on the SPA CSP prevents framing entirely. | None — `frame-ancestors` is browser-enforced and cannot be bypassed by the embedding document. |
| Attacker uses R2 wildcard to load a third-party R2 bucket they control (not the prod tenant's bucket). | Sandbox + `frame-ancestors 'none'` apply uniformly regardless of which R2 account hosts the content. | The wildcard still loads arbitrary R2 content into a sandboxed iframe — visually present but functionally inert. Narrowing per step 5 above eliminates this entirely. |

## References

- `apps/web-vite/src/components/invoices/intake/intake-detail-pdf-pane.tsx` — the only R2-fed iframe today (sandbox `allow-downloads`).
- `render.yaml:684` — SPA `frame-src` directive carrying the wildcard.
- `apps/web-vite/index.html:28` — `<meta http-equiv="Content-Security-Policy">` mirror (cannot deliver report-uri; HTTP header is authoritative).
- `scripts/check-r2-iframe-sandbox.mjs` — CI guardrail script + allowlist.
- `goals/post-migration-parity-audit/audit-report.md` — `GAP-SECURITY-002` escalation block (options a / b / c).
