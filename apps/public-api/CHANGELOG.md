# Contractor Ops Public API — Changelog

All notable changes to the public REST API are documented here. The API follows
semantic versioning at the major-version path prefix (`/v1`); breaking changes
ship only on a major bump and are announced via RFC 8594 `Deprecation`/`Sunset`
headers (see [Deprecations](/v1/docs/deprecations)).

## v1

### Added
- Read + write REST endpoints for contractors, contracts, invoices, payments,
  payment runs, documents, workflows, workflow tasks, compliance documents,
  classifications, and audit logs.
- Outbound webhooks: 16 signed event types (`X-CO-Signature`, HMAC-SHA256).
- Official SDKs: `@contractor-ops/sdk` (npm) and `contractor-ops-sdk` (PyPI).
- Downloadable Postman + Insomnia collections, generated from the OpenAPI spec.
- Free sandbox tier: `co_test_` API keys resolve to an isolated sandbox
  organization (100 requests/day) that never touches production data.

### Notes
- Write endpoints and the sandbox are enabled per organization; a disabled
  surface returns `404` so it stays invisible until granted.
