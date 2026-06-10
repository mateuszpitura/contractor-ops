/**
 * Single registry for compliance document identity across policy, validators, API, and UI.
 * Register via `registerComplianceDoc` (register-on-import pattern).
 */

export type ComplianceDocSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export type ComplianceDocRegistryEntry = {
  /** Stable policy id, e.g. de.a1@v1 */
  id: string;
  jurisdiction: 'DE' | 'UK' | 'PL' | 'US' | 'AE' | 'SA';
  severity: ComplianceDocSeverity;
  /** i18n leaf key under Compliance.documents.{jurisdiction}.{key} */
  i18nKey: string;
};

const complianceDocs = new Map<string, ComplianceDocRegistryEntry>();

export function registerComplianceDoc(entry: ComplianceDocRegistryEntry): void {
  if (complianceDocs.has(entry.id)) {
    throw new Error(`Compliance doc already registered: ${entry.id}`);
  }
  complianceDocs.set(entry.id, entry);
}

export function clearComplianceDocs(): void {
  complianceDocs.clear();
}

export function getComplianceDoc(id: string): ComplianceDocRegistryEntry | undefined {
  return complianceDocs.get(id);
}

export function getComplianceDocRegistry(): readonly ComplianceDocRegistryEntry[] {
  return Array.from(complianceDocs.values());
}

export function complianceDocsForJurisdiction(
  jurisdiction: ComplianceDocRegistryEntry['jurisdiction'],
): ComplianceDocRegistryEntry[] {
  return getComplianceDocRegistry().filter(d => d.jurisdiction === jurisdiction);
}

const BASELINE_DOCS: ComplianceDocRegistryEntry[] = [
  { id: 'de.a1@v1', jurisdiction: 'DE', severity: 'BLOCKING', i18nKey: 'a1' },
  { id: 'de.aufenthaltstitel@v1', jurisdiction: 'DE', severity: 'BLOCKING', i18nKey: 'aufenthaltstitel' },
  { id: 'de.eight_b_estg@v1', jurisdiction: 'DE', severity: 'BLOCKING', i18nKey: 'eightBEstg' },
  { id: 'uk.ir35@v1', jurisdiction: 'UK', severity: 'BLOCKING', i18nKey: 'ir35' },
  { id: 'pl.zus@v1', jurisdiction: 'PL', severity: 'BLOCKING', i18nKey: 'zus' },
  { id: 'ae.trade_license@v1', jurisdiction: 'AE', severity: 'BLOCKING', i18nKey: 'tradeLicense' },
  { id: 'sa.iqama@v1', jurisdiction: 'SA', severity: 'BLOCKING', i18nKey: 'iqama' },
];

for (const doc of BASELINE_DOCS) {
  registerComplianceDoc(doc);
}

/** Frozen snapshot of registered docs (re-read via `getComplianceDocRegistry()` after dynamic register). */
export const COMPLIANCE_DOC_REGISTRY: readonly ComplianceDocRegistryEntry[] =
  getComplianceDocRegistry();
