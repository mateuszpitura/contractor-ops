/**
 * Legal document generation service — DPA and SCC PDF generation.
 *
 * Template-based PDF generation with org-specific data merged in.
 * DPA templates are jurisdiction-specific (UAE vs Saudi). SCC is generated
 * when cross-border transfer is detected (org jurisdiction differs from data
 * hosting region).
 */

import { prisma } from '@contractor-ops/db';
import { getServerEnv } from '@contractor-ops/validators';
import { getCurrentConsent } from './consent-record';

// ---------------------------------------------------------------------------
// Cross-border transfer detection
// ---------------------------------------------------------------------------

const COUNTRY_TO_REGION: Record<string, string> = {
  // GCC
  AE: 'GCC',
  SA: 'GCC',
  BH: 'GCC',
  KW: 'GCC',
  OM: 'GCC',
  QA: 'GCC',
  // EU
  PL: 'EU',
  DE: 'EU',
  FR: 'EU',
  IT: 'EU',
  ES: 'EU',
  NL: 'EU',
  BE: 'EU',
  AT: 'EU',
  IE: 'EU',
  PT: 'EU',
  GR: 'EU',
  FI: 'EU',
  SE: 'EU',
  DK: 'EU',
  CZ: 'EU',
  RO: 'EU',
  BG: 'EU',
  HR: 'EU',
  SK: 'EU',
  HU: 'EU',
  LT: 'EU',
  LV: 'EU',
  EE: 'EU',
  SI: 'EU',
  CY: 'EU',
  LU: 'EU',
  MT: 'EU',
};

export interface CrossBorderResult {
  isCrossBorder: boolean;
  orgRegion: string;
  hostingRegion: string;
}

export function detectCrossBorderTransfer(orgCountryCode: string): CrossBorderResult {
  const hostingRegion = getServerEnv().DATA_HOSTING_REGION;
  const orgRegion = COUNTRY_TO_REGION[orgCountryCode] ?? 'OTHER';
  return {
    isCrossBorder: orgRegion !== hostingRegion,
    orgRegion,
    hostingRegion,
  };
}

// ---------------------------------------------------------------------------
// DPA generation
// ---------------------------------------------------------------------------

export interface LegalDocumentResult {
  content: string;
  filename: string;
  jurisdiction: string;
  contentType: string;
}

/**
 * Generate a Data Processing Agreement for an organization.
 * Returns HTML content (can be rendered to PDF by client or server-side renderer).
 */
export async function generateDPA(organizationId: string): Promise<LegalDocumentResult | null> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      name: true,
      countryCode: true,
    },
  });

  if (!org.countryCode || (org.countryCode !== 'AE' && org.countryCode !== 'SA')) {
    return null;
  }

  // Get accepted consent purposes for this org's admin
  const consentState = await getOrgConsentSummary(organizationId);

  const date = new Date().toISOString().split('T')[0];
  const jurisdiction = org.countryCode;

  const legalRef =
    jurisdiction === 'AE'
      ? 'UAE Federal Decree-Law No. 45/2021 on the Protection of Personal Data'
      : 'Kingdom of Saudi Arabia Personal Data Protection Law (Royal Decree M/19)';

  const governingLaw =
    jurisdiction === 'AE'
      ? 'the laws of the United Arab Emirates'
      : 'the laws of the Kingdom of Saudi Arabia';

  const content = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Data Processing Agreement</title>
<style>
  body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-family: Arial, sans-serif; font-size: 24px; text-align: center; margin-bottom: 4px; }
  h2 { font-family: Arial, sans-serif; font-size: 16px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .subtitle { text-align: center; font-size: 12px; color: #666; margin-bottom: 32px; }
  .parties { margin: 16px 0; }
  .section { margin: 12px 0; }
  .footer { margin-top: 48px; font-size: 11px; color: #888; text-align: center; }
  ul { margin: 8px 0; padding-left: 24px; }
</style>
</head>
<body>
<h1>Data Processing Agreement</h1>
<p class="subtitle">In accordance with ${legalRef}</p>

<h2>1. Parties</h2>
<div class="parties">
  <p><strong>Data Controller:</strong> ${escapeHtml(org.name)} (${jurisdiction === 'AE' ? 'UAE' : 'Saudi Arabia'})</p>
  <p><strong>Data Processor:</strong> Contractor Ops Platform</p>
  <p><strong>Effective Date:</strong> ${date}</p>
</div>

<h2>2. Scope of Processing</h2>
<div class="section">
  <p>This agreement governs the processing of personal data by the Data Processor on behalf of the Data Controller for the following purposes:</p>
  <ul>
    ${consentState.map(p => `<li>${formatPurpose(p)}</li>`).join('\n    ')}
  </ul>
</div>

<h2>3. Data Subject Categories</h2>
<div class="section">
  <p>The personal data processed relates to the following categories of data subjects:</p>
  <ul>
    <li>Contractors engaged by the Data Controller</li>
    <li>Employees of the Data Controller who use the platform</li>
    <li>Third-party contacts associated with contractor records</li>
  </ul>
</div>

<h2>4. Data Categories</h2>
<div class="section">
  <ul>
    <li>Identity information (name, email, contact details, national identifiers)</li>
    <li>Financial information (bank details, tax identifiers, invoices, payment records)</li>
    <li>Professional information (contracts, work history, qualifications, licenses)</li>
    <li>Usage data (platform interactions, audit logs, timestamps)</li>
  </ul>
</div>

<h2>5. Security Measures</h2>
<div class="section">
  <p>The Data Processor implements the following technical and organizational measures:</p>
  <ul>
    <li>Encryption of data at rest (AES-256) and in transit (TLS 1.3)</li>
    <li>Role-based access control with least-privilege principle</li>
    <li>Audit logging of all data access and modifications</li>
    <li>Regular security assessments and vulnerability scanning</li>
    <li>Incident response procedures with 72-hour breach notification</li>
  </ul>
</div>

<h2>6. Data Subject Rights</h2>
<div class="section">
  <p>The Data Processor shall assist the Data Controller in fulfilling data subject requests including: access, rectification, erasure, restriction, portability, and objection to processing.</p>
</div>

<h2>7. Cross-Border Transfers</h2>
<div class="section">
  <p>Any transfer of personal data outside the jurisdiction of the Data Controller shall be subject to appropriate safeguards, including Standard Contractual Clauses where required.</p>
</div>

<h2>8. Term and Termination</h2>
<div class="section">
  <p>This agreement remains in effect for the duration of the service agreement. Upon termination, the Data Processor shall delete or return all personal data within 30 days.</p>
</div>

<h2>9. Governing Law</h2>
<div class="section">
  <p>This agreement shall be governed by and construed in accordance with ${governingLaw}.</p>
</div>

<div class="footer">
  <p>Generated on ${date} | ${legalRef}</p>
</div>
</body>
</html>`.trim();

  return {
    content,
    filename: `DPA-${sanitizeFilename(org.name)}-${jurisdiction}-${date}.html`,
    jurisdiction,
    contentType: 'text/html',
  };
}

// ---------------------------------------------------------------------------
// SCC generation
// ---------------------------------------------------------------------------

/**
 * Generate Standard Contractual Clauses for cross-border transfers.
 * Returns null if no cross-border transfer is detected.
 */
export async function generateSCC(organizationId: string): Promise<LegalDocumentResult | null> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true, countryCode: true },
  });

  if (!org.countryCode) return null;

  const crossBorder = detectCrossBorderTransfer(org.countryCode);
  if (!crossBorder.isCrossBorder) return null;

  const date = new Date().toISOString().split('T')[0];

  const content = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Standard Contractual Clauses</title>
<style>
  body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-family: Arial, sans-serif; font-size: 24px; text-align: center; margin-bottom: 4px; }
  h2 { font-family: Arial, sans-serif; font-size: 16px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .subtitle { text-align: center; font-size: 12px; color: #666; margin-bottom: 32px; }
  .section { margin: 12px 0; }
  .footer { margin-top: 48px; font-size: 11px; color: #888; text-align: center; }
  ul { margin: 8px 0; padding-left: 24px; }
</style>
</head>
<body>
<h1>Standard Contractual Clauses</h1>
<p class="subtitle">For International Data Transfers (${crossBorder.orgRegion} to ${crossBorder.hostingRegion})</p>

<h2>1. Data Exporter</h2>
<div class="section">
  <p><strong>Name:</strong> ${escapeHtml(org.name)}</p>
  <p><strong>Jurisdiction:</strong> ${org.countryCode === 'AE' ? 'United Arab Emirates' : org.countryCode === 'SA' ? 'Kingdom of Saudi Arabia' : org.countryCode}</p>
  <p><strong>Region:</strong> ${crossBorder.orgRegion}</p>
</div>

<h2>2. Data Importer</h2>
<div class="section">
  <p><strong>Name:</strong> Contractor Ops Platform (Hosting Provider)</p>
  <p><strong>Hosting Region:</strong> ${crossBorder.hostingRegion}</p>
</div>

<h2>3. Transfer Scope</h2>
<div class="section">
  <p>The following categories of personal data are transferred:</p>
  <ul>
    <li>Contractor personal identifiable information (PII)</li>
    <li>Invoice and financial data</li>
    <li>Payment records and bank account details</li>
    <li>Contract and employment documentation</li>
    <li>Platform usage and audit data</li>
  </ul>
</div>

<h2>4. Technical and Organizational Measures</h2>
<div class="section">
  <ul>
    <li>Encryption at rest using AES-256</li>
    <li>Encryption in transit using TLS 1.3</li>
    <li>Role-based access control with audit logging</li>
    <li>Data minimization — only necessary data transferred</li>
    <li>Regular security audits and penetration testing</li>
    <li>Incident response with 72-hour breach notification</li>
  </ul>
</div>

<h2>5. Rights of Data Subjects</h2>
<div class="section">
  <p>Data subjects retain all rights under the applicable data protection law of the Data Exporter's jurisdiction, including the right to access, rectification, erasure, restriction, portability, and objection.</p>
</div>

<h2>6. Liability and Indemnification</h2>
<div class="section">
  <p>Each party shall be liable for damages caused by its breach of these clauses. The Data Importer agrees to indemnify the Data Exporter for any damages arising from the Data Importer's failure to comply with these clauses.</p>
</div>

<h2>7. Governing Law</h2>
<div class="section">
  <p>These clauses shall be governed by the law of the Data Exporter's jurisdiction (${org.countryCode === 'AE' ? 'United Arab Emirates' : org.countryCode === 'SA' ? 'Kingdom of Saudi Arabia' : org.countryCode}).</p>
</div>

<div class="footer">
  <p>Generated on ${date} | Transfer: ${crossBorder.orgRegion} → ${crossBorder.hostingRegion}</p>
</div>
</body>
</html>`.trim();

  return {
    content,
    filename: `SCC-${sanitizeFilename(org.name)}-${crossBorder.orgRegion}-to-${crossBorder.hostingRegion}-${date}.html`,
    jurisdiction: org.countryCode,
    contentType: 'text/html',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
}

function formatPurpose(purpose: string): string {
  const labels: Record<string, string> = {
    CONTRACTOR_DATA_PROCESSING: 'Contractor data processing and management',
    INVOICE_PAYMENT_PROCESSING: 'Invoice processing and payment execution',
    ANALYTICS_REPORTING: 'Analytics, reporting, and business intelligence',
    CROSS_BORDER_TRANSFER: 'Cross-border data transfer',
    INTEGRATION_DATA_SHARING: 'Third-party integration data sharing',
    COMMUNICATION_NOTIFICATIONS: 'Communications, notifications, and reminders',
  };
  return labels[purpose] ?? purpose;
}

async function getOrgConsentSummary(organizationId: string): Promise<string[]> {
  // Get consent from org members — use first admin as representative
  const member = await prisma.member.findFirst({
    where: { organizationId, role: 'owner' },
    select: { userId: true },
  });

  if (!member) return ['CONTRACTOR_DATA_PROCESSING', 'INVOICE_PAYMENT_PROCESSING'];

  const consentMap = await getCurrentConsent(organizationId, member.userId);
  const grantedPurposes: string[] = [];
  for (const [purpose, state] of consentMap) {
    if (state.granted) {
      grantedPurposes.push(purpose);
    }
  }

  return grantedPurposes.length > 0
    ? grantedPurposes
    : ['CONTRACTOR_DATA_PROCESSING', 'INVOICE_PAYMENT_PROCESSING'];
}
