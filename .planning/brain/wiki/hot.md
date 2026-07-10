---
title: Hot context
updated: 2026-07-10
---

# Hot

Go-prod deep-audit fixes landed (working tree, uncommitted): export idempotent-replay safe re-select + SEPA audit field-names — [[domains/payments-and-bank-files]]; `contractor.list` omits `ssnEncrypted`; WhtCertificate reads gated `payment:read` — [[domains/tax-and-wht]]; KSeF `credentialsRef` omitted — [[integrations/ksef]]; e-sign `connectionId` org-scoped — [[integrations/docusign-esign]]; generic 5xx bodies (public-api + Fastify sentry plugin) — [[domains/public-api-surface]], [[integrations/sentry]]. ClamAV scans FULL object — [[domains/documents-and-ocr]]. Token-refresh no longer fights hourly sync — [[domains/hris-sync]]. CSRF exempts `/webhooks-outbound/`+`/contract-health/`+`/idp-deprovisioning/` — [[domains/outbound-webhooks]]. Portal strict limiter + per-email magic-link + per-subject OCR/e-sign caps — [[domains/employee-portal]]. 120s tx on import commit + leave finalize; econ-dep scan O(A) — [[domains/onboarding-and-import]], [[domains/leave-and-time]], [[domains/classification-ir35]]. Peppol reconcile NOT EXISTS + ACTIVE precondition — [[integrations/peppol]]. `job-health` outbox FAILED-backlog gauge + 3 job-meta entries — [[structure/cron-jobs]]. Tracker: `.planning/reviews/go-prod-deep-audit-2026-07-10.md` (GO verdict).

Prior: `peppol-reconcile` cron; ZATCA `Z`/`E` percent — [[integrations/zatca]]; KSeF FA(3) round-trip — [[integrations/ksef]]. **Business logic shield** `[shield]` — [[patterns/business-logic-shield]].
