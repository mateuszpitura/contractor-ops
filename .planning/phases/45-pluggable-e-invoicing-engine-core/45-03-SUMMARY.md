---
phase: 45-pluggable-e-invoicing-engine-core
plan: 03
subsystem: einvoice
tags: [pipeline, capability-hooks, signable, qrcodeable]

requires:
  - phase: 45-01
    provides: core types, profile interface
  - phase: 45-02
    provides: KsefProfile for integration testing
provides:
  - runPipeline function: generate → validate → sign → QR orchestration
  - PipelineResult type with signedXml and qrData fields
  - PipelineOptions for controlling pipeline behavior
affects: [phase-48-zatca, phase-49-peppol]

tech-stack:
  added: []
  patterns: [pipeline-pattern, capability-detection]

key-files:
  created:
    - packages/einvoice/src/engine/pipeline.ts
    - packages/einvoice/src/__tests__/pipeline.test.ts
  modified: []

key-decisions:
  - "Pipeline stops at validation if invalid — no signing of bad XML"
  - "Missing certificate with Signable profile produces warning, not error"
  - "QR generation receives EInvoice (not XML) for TLV encoding flexibility"

patterns-established:
  - "Pipeline: generate → validate → sign (if capable) → QR (if capable)"
  - "Capability detection: check profile.sign/profile.qrCode !== undefined"
---

# Plan 45-03 Summary: Capability Pipeline

## What was built
Engine pipeline that orchestrates the generate → validate → sign → QR code sequence with profile capability detection. Profiles with Signable get signing, profiles with QRCodeable get QR generation. KSeF (no capabilities) correctly skips both steps.

## Tests
- 8 pipeline tests covering all capability combinations
- Validation failure stops pipeline before sign/QR
- KsefProfile integration test confirms generate+validate only

## Self-Check: PASSED
- [x] Pipeline skips sign when profile.sign is undefined
- [x] Pipeline skips QR when profile.qrCode is undefined
- [x] Validation failure prevents sign/QR execution
- [x] All tests pass
