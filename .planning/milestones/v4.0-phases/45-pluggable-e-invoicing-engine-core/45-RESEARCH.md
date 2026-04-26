# Phase 45: Pluggable E-Invoicing Engine Core — Research

**Researched:** 2026-04-11
**Confidence:** HIGH (all claims verified against codebase)

## Executive Summary

Phase 45 refactors the existing KSeF integration into a pluggable e-invoicing engine as a new `packages/einvoice` package. The existing KSeF codebase is well-structured (~850 LOC across 6 files + tests) and the refactoring path is clear: extract KSeF code, introduce a country profile interface layer, and re-export from the new package. The main risk is regression in the sync orchestrator due to import path changes and the tight coupling between the XML parser and KSeF-specific FA(3) schema.

## 1. Current KSeF Implementation Analysis

### File Inventory [VERIFIED: codebase grep]

| File | LOC | Role | Destination |
|------|-----|------|-------------|
| `packages/integrations/src/services/ksef-xml-parser.ts` | ~218 | FA(3) XML parsing + invoice model mapping | `packages/einvoice/src/profiles/ksef/parser.ts` |
| `packages/integrations/src/services/ksef-api-client.ts` | ~448 | KSeF REST API client (auth, query, download) | `packages/einvoice/src/profiles/ksef/api-client.ts` |
| `packages/integrations/src/adapters/ksef-adapter.ts` | ~116 | Health status via IntegrationConnection | `packages/einvoice/src/profiles/ksef/adapter.ts` |
| `packages/api/src/services/ksef-sync-orchestrator.ts` | ~350 | Full sync cycle: decrypt → auth → query → parse → dedupe → match → notify | Stays in `packages/api` (infrastructure concerns) |
| `packages/api/src/services/ksef-duplicate-detection.ts` | ~? | Cross-source duplicate detection | Stays in `packages/api` |
| `packages/api/src/routers/ksef.ts` | ~270 | tRPC router: connect, disconnect, sync, status, history | Stays in `packages/api` (delegates to engine) |
| `packages/validators/src/ksef.ts` | ~119 | Zod schemas: connection config, parsed invoice, line items | Move to `packages/einvoice/src/profiles/ksef/schemas.ts` |

### Key Dependencies [VERIFIED: imports in source files]

- `fast-xml-parser` — used by ksef-xml-parser for FA(3) parsing, will be reused for UBL 2.1
- `node:crypto` — RSA-OAEP (auth), AES-256-GCM (invoice decryption) in ksef-api-client
- `@contractor-ops/db` — Prisma client, used by ksef-adapter and sync-orchestrator (stays in API layer)
- `@contractor-ops/validators` — Zod schemas for KSeF types
- `@contractor-ops/integrations` — encryptCredentials/decryptCredentials, KsefApiClient, parseFa3Xml, mapKsefToInvoiceFields

### Coupling Points [VERIFIED: codebase analysis]

1. **ksef-sync-orchestrator** imports from `@contractor-ops/integrations` (KsefApiClient, parseFa3Xml, mapKsefToInvoiceFields, decryptCredentials). After refactor, it must import from `@contractor-ops/einvoice`.
2. **ksef router** imports KsefApiClient and encryptCredentials from `@contractor-ops/integrations`. Post-refactor: engine types from `@contractor-ops/einvoice`, credential utils stay in integrations.
3. **fast-xml-parser** config is KSeF-specific (`isArray: (name) => name === "FaWiersz"`). Each profile will need its own parser config.

### Helper Functions Worth Generalizing [VERIFIED: ksef-xml-parser.ts]

- `toMinorUnits(value: unknown): number` — converts float to integer minor units. Currently hardcoded to PLN (×100). Generalizable: use ISO 4217 exponent lookup (Phase 46 concern, but interface should accommodate).
- `dig(obj, ...keys): unknown` — safe deep property access. Generic utility, move to shared utils.

## 2. UBL 2.1 Core Invoice Model

### Recommended Canonical Type (~15-20 fields per D-06) [ASSUMED: based on UBL 2.1 spec knowledge]

```typescript
interface EInvoice {
  // Document identity
  id: string;                    // Invoice number
  issueDate: string;             // ISO 8601 date
  dueDate?: string;
  invoiceTypeCode: string;       // 380 = commercial invoice, 381 = credit note
  currencyCode: string;          // ISO 4217
  
  // Parties
  supplier: EInvoiceParty;
  customer: EInvoiceParty;
  
  // Lines
  lines: EInvoiceLine[];
  
  // Totals
  taxExclusiveAmount: number;    // Minor units
  taxInclusiveAmount: number;    // Minor units
  payableAmount: number;         // Minor units
  
  // Tax
  taxBreakdown: EInvoiceTaxSubtotal[];
  
  // Payment
  paymentMeans?: EInvoicePaymentMeans;
  
  // Profile-specific extensions
  extensions?: Record<string, unknown>;
  
  // Metadata
  profileId: string;             // e.g., "ksef", "zatca", "peppol-ae"
  externalReference?: string;    // KSeF reference number, ZATCA UUID, etc.
}
```

### Mapping from Current KSeF Types [VERIFIED: ksefParsedInvoiceSchema]

| KSeF Field | EInvoice Field | Notes |
|------------|---------------|-------|
| invoiceNumber | id | Direct |
| issueDate | issueDate | Direct |
| invoiceType | invoiceTypeCode | Map "VAT" → "380" |
| currency | currencyCode | Direct |
| seller | supplier | Rename + extend |
| buyer | customer | Rename + extend |
| lines | lines | Restructure |
| totals.netMinor | taxExclusiveAmount | Direct |
| totals.grossMinor | taxInclusiveAmount | Direct |
| totals.grossMinor | payableAmount | Default = gross |
| payment | paymentMeans | Restructure |
| ksefReferenceNumber | externalReference | Profile-specific |

## 3. Country Profile Interface Design

### Recommended Interface [ASSUMED: based on Strategy pattern analysis]

```typescript
interface EInvoiceProfile {
  readonly profileId: string;           // "ksef", "zatca", "peppol-ae"
  readonly country: string;             // ISO 3166-1 alpha-2
  readonly displayName: string;         // "KSeF (Poland)"
  
  // Core operations
  generate(invoice: EInvoice): Promise<string>;        // → XML string
  parse(xml: string, metadata?: Record<string, unknown>): Promise<EInvoice>;
  validate(xml: string): Promise<ValidationResult>;
  
  // Capability hooks (optional — profiles implement what they need)
  sign?: Signable;
  qrCode?: QRCodeable;
  
  // Compliance
  getComplianceStatus(organizationId: string): Promise<ComplianceStatus>;
}

interface Signable {
  sign(xml: string, certificate: CertificateInfo): Promise<string>;
  verify(xml: string): Promise<SignatureVerificationResult>;
}

interface QRCodeable {
  generateQR(invoice: EInvoice): Promise<Buffer>;
  parseQR(data: Buffer): Promise<Partial<EInvoice>>;
}
```

### Registration Mechanism [VERIFIED: codebase pattern from register-all.ts]

The existing `packages/integrations/src/adapters/register-all.ts` uses a static registry pattern. Recommended: similar approach for e-invoicing profiles.

```typescript
// packages/einvoice/src/registry.ts
const profiles = new Map<string, EInvoiceProfile>();

export function registerProfile(profile: EInvoiceProfile): void {
  profiles.set(profile.profileId, profile);
}

export function getProfile(profileId: string): EInvoiceProfile {
  const profile = profiles.get(profileId);
  if (!profile) throw new Error(`Unknown e-invoicing profile: ${profileId}`);
  return profile;
}

export function listProfiles(): EInvoiceProfile[] {
  return Array.from(profiles.values());
}
```

## 4. Package Structure

### Recommended `packages/einvoice` Layout [ASSUMED: based on clean architecture]

```
packages/einvoice/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                      # Public API barrel
│   ├── types/
│   │   ├── invoice.ts                # EInvoice, EInvoiceLine, EInvoiceParty
│   │   ├── profile.ts                # EInvoiceProfile, Signable, QRCodeable
│   │   ├── compliance.ts             # ComplianceStatus, ComplianceState
│   │   └── validation.ts             # ValidationResult, ValidationError
│   ├── engine/
│   │   ├── engine.ts                 # EInvoiceEngine orchestrator
│   │   ├── pipeline.ts               # generate → validate → sign → QR pipeline
│   │   └── xml-utils.ts              # Shared XML utilities (dig, namespace helpers)
│   ├── registry.ts                   # Profile registry (Map-based)
│   ├── schemas/
│   │   └── invoice.ts                # Zod schemas for EInvoice types
│   └── profiles/
│       └── ksef/
│           ├── index.ts              # KsefProfile class implementing EInvoiceProfile
│           ├── parser.ts             # FA(3) XML parser (moved from integrations)
│           ├── generator.ts          # FA(3) XML generator (new — for outbound)
│           ├── api-client.ts         # KSeF REST API client (moved from integrations)
│           ├── adapter.ts            # KSeF health adapter (moved from integrations)
│           ├── schemas.ts            # KSeF Zod schemas (moved from validators)
│           └── __tests__/
│               ├── parser.test.ts    # Migrated from integrations
│               └── api-client.test.ts # Migrated from integrations
```

## 5. Migration Strategy

### Step-by-Step Approach [ASSUMED: based on Strangler Fig pattern]

1. **Create package shell** — `packages/einvoice` with tsconfig, tsup, package.json. Register in Turborepo workspace.
2. **Define core types** — EInvoice, EInvoiceProfile, Signable, QRCodeable interfaces. Zod schemas for runtime validation.
3. **Build engine core** — Registry, pipeline orchestrator, shared XML utilities.
4. **Move KSeF code** — Copy files from `packages/integrations` to `packages/einvoice/profiles/ksef/`. Refactor parser to output EInvoice (add a conversion layer, keep original FA(3) parsing intact).
5. **Create KsefProfile** — Implement EInvoiceProfile interface wrapping existing parser/generator.
6. **Update imports** — Change `packages/api` to import from `@contractor-ops/einvoice` instead of `@contractor-ops/integrations` for KSeF-specific code.
7. **Re-export from integrations** — Temporarily re-export from `packages/integrations` for backward compatibility during transition. Remove in a follow-up cleanup.
8. **Run tests** — All existing KSeF tests must pass with new import paths.

### Risk: Sync Orchestrator Disruption [VERIFIED: ksef-sync-orchestrator.ts analysis]

The sync orchestrator imports 4 items from `@contractor-ops/integrations`:
- `KsefApiClient` → move to `@contractor-ops/einvoice`
- `parseFa3Xml` → move to `@contractor-ops/einvoice`
- `mapKsefToInvoiceFields` → move to `@contractor-ops/einvoice`
- `decryptCredentials` → stays in `@contractor-ops/integrations` (generic credential utility)

**Mitigation:** Keep re-exports in `packages/integrations/src/index.ts` during transition. The sync orchestrator can switch to direct einvoice imports atomically.

## 6. Compliance Status Design

### Recommended State Machine [ASSUMED: based on KSeF, ZATCA, and Peppol lifecycle analysis]

```typescript
type ComplianceState =
  | "not_connected"      // No profile configured for this org
  | "onboarding"         // Setup in progress (e.g., ZATCA CSID exchange)
  | "sandbox"            // Connected to test environment
  | "active"             // Connected and syncing successfully
  | "degraded"           // Connected but recent errors (still operational)
  | "suspended"          // Manually paused or credential expired
  | "error";             // Failed — requires intervention

interface ComplianceStatus {
  profileId: string;
  state: ComplianceState;
  country: string;
  displayName: string;
  lastSyncAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
  healthScore: number;          // 0-100 based on recent sync success rate
  capabilities: {
    canGenerate: boolean;
    canParse: boolean;
    canSign: boolean;
    canQRCode: boolean;
  };
}
```

### UI Integration Points [VERIFIED: existing dashboard patterns in codebase]

1. **Dashboard widget** — Compact card showing compliance status per profile. Color-coded: green (active), yellow (degraded/sandbox), red (error/suspended), gray (not connected).
2. **Settings detail page** — Full compliance view per profile with sync history, error log, capability matrix.
3. **Reuse existing patterns** — `IntegrationConnection` model already tracks status, lastSyncAt, lastErrorAt. ComplianceStatus is a view computed from these fields + profile-specific logic.

## 7. XML Generation Architecture

### Pipeline Design [ASSUMED: based on UBL 2.1 document structure]

```
EInvoice → Profile.generate() → Raw XML
         → Profile.validate() → ValidationResult
         → Profile.sign?.sign() → Signed XML (if profile supports signing)
         → Profile.qrCode?.generateQR() → QR data (if profile supports QR)
```

The engine orchestrates this pipeline. Profiles provide the country-specific implementations. For KSeF in Phase 45, `generate()` produces FA(3) XML, `parse()` reads FA(3) XML, `validate()` checks FA(3) schema conformance. `sign` and `qrCode` are null for KSeF (KSeF handles signing server-side).

### fast-xml-parser Usage [VERIFIED: existing ksef-xml-parser.ts]

Current parser config is KSeF-specific (`isArray: (name) => name === "FaWiersz"`). Each profile needs its own XMLParser instance with profile-specific options. Recommendation: profiles own their parser config; the engine provides no shared parser (profiles may use different XML libraries if needed — e.g., xmlbuilder2 for ZATCA in Phase 48).

## 8. Validation Architecture

### Nyquist Validation Dimensions

| Dimension | Phase 45 Coverage | Approach |
|-----------|------------------|----------|
| D1: Types | EInvoice, EInvoiceProfile, ComplianceStatus types compile | `tsc --noEmit` |
| D2: Schema | Zod schemas for EInvoice validate round-trip | Unit tests |
| D3: Integration | KSeF profile parse/generate round-trip | Integration test |
| D4: Regression | All existing KSeF tests pass unchanged | Test migration |
| D5: Build | `packages/einvoice` builds and is importable | Turborepo build |
| D6: Runtime | Engine pipeline processes a sample invoice end-to-end | E2E test |
| D7: Security | Certificate/credential handling uses existing encryption | Code review |
| D8: Validation | Nyquist matrix populated | VALIDATION.md |

### Test Strategy

1. **Migrate existing tests** — Move all 5 test files to `packages/einvoice/profiles/ksef/__tests__/`. Update imports only, keep assertions identical. This is the zero-regression proof.
2. **Add profile conformance tests** — New test suite that validates KsefProfile implements EInvoiceProfile correctly (generate/parse/validate contract).
3. **Add engine integration test** — End-to-end pipeline test: create EInvoice → KsefProfile.generate() → XML → KsefProfile.parse() → EInvoice → assert round-trip fidelity.
4. **Registry test** — Register profile, retrieve it, list all profiles.

## 9. Pitfalls & Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Import path breakage in API layer | HIGH | Re-export from integrations during transition |
| KSeF FA(3) parser tightly coupled to PLN | MEDIUM | Keep toMinorUnits as-is for now; generalize in Phase 46 with Money utility |
| Over-abstracting the engine | MEDIUM | Start with minimal interface; extend when ZATCA/Peppol profiles land |
| Turborepo dependency graph changes | LOW | Add `@contractor-ops/einvoice` to packages/api/package.json |
| Test file migration breaks CI | MEDIUM | Run tests after each file move, not at the end |
| Prisma schema unchanged | INFO | No schema changes needed — reuses IntegrationConnection model |

## 10. Dependencies on Future Phases

- **Phase 46** (Multi-Currency): Will need to generalize `toMinorUnits()` to use ISO 4217 exponent lookup instead of hardcoded ×100.
- **Phase 48** (ZATCA): Will add `ZatcaProfile` implementing `EInvoiceProfile` + `Signable` + `QRCodeable`. Needs XAdES signing, TLV QR encoding.
- **Phase 49** (Peppol): Will add `PeppolProfile` implementing `EInvoiceProfile` + `QRCodeable`. Needs PINT-AE UBL generation.

The interface designed here must accommodate all three without modification — that's the pluggable architecture test.

---

## RESEARCH COMPLETE

*Phase: 45-pluggable-e-invoicing-engine-core*
*Researched: 2026-04-11*
