---
phase: 50
slug: arabic-localization-rtl-layout
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-12
---

# Phase 50 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Locale parameter | User-controlled locale in URL path segment | String — validated against fixed allow-list |
| Translation strings | Static JSON file loaded at build time | Public UI text — no secrets |
| User-generated content | Contractor names, invoice numbers displayed via Bdi | String — HTML-escaped by React JSX |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-50-01 | Spoofing | routing.ts | mitigate | Locale validated against fixed `["en", "pl", "ar"]` array — no arbitrary locale injection | closed |
| T-50-02 | Tampering | request.ts | mitigate | Message files loaded from static imports; locale validated before import; path traversal impossible with next-intl validation | closed |
| T-50-03 | Information Disclosure | layout.tsx | accept | dir/lang attributes expose locale preference — low-value, publicly visible by design | closed |
| T-50-04 | Tampering | ar.json | accept | Static file loaded at build time — cannot be modified at runtime; XSS prevented by React JSX escaping | closed |
| T-50-05 | Information Disclosure | ar.json | accept | Translation strings are public-facing UI text — no secrets | closed |
| T-50-06 | Injection (XSS) | bdi.tsx | mitigate | Bdi component renders children via JSX `{children}`, not `dangerouslySetInnerHTML`; React escaping prevents XSS | closed |
| T-50-07 | Spoofing (visual) | Bdi wrapping | accept | Bidi text visual spoofing mitigated by structured table cell display; low risk in business context | closed |
| T-50-08 | Information Disclosure | useRtlChartConfig | accept | Hook reads locale from next-intl context — locale already public in URL path | closed |
| T-50-09 | Denial of Service | CSS rendering | accept | Logical properties are standard CSS — no performance impact; universal browser support | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-50-01 | T-50-03 | Locale visible in URL by design — no sensitive data | Phase threat model | 2026-04-12 |
| AR-50-02 | T-50-04 | Static build-time JSON, React escaping handles XSS | Phase threat model | 2026-04-12 |
| AR-50-03 | T-50-05 | Public UI text contains no secrets | Phase threat model | 2026-04-12 |
| AR-50-04 | T-50-07 | Visual spoofing low risk in structured business UI | Phase threat model | 2026-04-12 |
| AR-50-05 | T-50-08 | Locale already public in URL path | Phase threat model | 2026-04-12 |
| AR-50-06 | T-50-09 | Standard CSS properties, no DoS vector | Phase threat model | 2026-04-12 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-12 | 9 | 9 | 0 | gsd-secure-phase orchestrator |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-12
