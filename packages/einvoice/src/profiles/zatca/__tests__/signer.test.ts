// ---------------------------------------------------------------------------
// ZatcaXAdESSigner Tests -- XAdES-BES enveloped digital signatures
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CertificateInfo } from '../../../types/profile.js';
import { ZatcaXAdESSigner } from '../signer.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/**
 * Generate a self-signed ECDSA P-256 test certificate using openssl.
 * Returns base64-encoded DER certificate and PEM private key.
 */
function generateTestCertificate(): {
  certificateBase64: string;
  privateKeyPem: string;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zatca-test-'));
  const keyPath = path.join(tmpDir, 'key.pem');
  const certPath = path.join(tmpDir, 'cert.pem');
  const certDerPath = path.join(tmpDir, 'cert.der');

  try {
    // Generate ECDSA P-256 key
    execSync(`openssl ecparam -genkey -name prime256v1 -noout -out "${keyPath}"`, {
      stdio: 'pipe',
    });

    // Generate self-signed certificate
    execSync(
      `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=ZATCA Test/O=Test Org/OU=300075588700003/C=SA"`,
      { stdio: 'pipe' },
    );

    // Convert cert to DER for base64 encoding
    execSync(`openssl x509 -in "${certPath}" -outform DER -out "${certDerPath}"`, {
      stdio: 'pipe',
    });

    const certDer = fs.readFileSync(certDerPath);
    const privateKeyPem = fs.readFileSync(keyPath, 'utf-8');

    return {
      certificateBase64: certDer.toString('base64'),
      privateKeyPem,
    };
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}

/** Minimal ZATCA UBL 2.1 invoice XML for testing signature operations. */
const TEST_INVOICE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>INV-2026-001</cbc:ID>
  <cbc:UUID>550e8400-e29b-41d4-a716-446655440000</cbc:UUID>
  <cbc:IssueDate>2026-04-11</cbc:IssueDate>
  <cbc:IssueTime>12:00:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>300075588700003</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>Acme Saudi LLC</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="SAR">24000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">27600.00</cbc:TaxInclusiveAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ZatcaXAdESSigner', () => {
  let signer: ZatcaXAdESSigner;
  let testCert: CertificateInfo;

  beforeAll(() => {
    signer = new ZatcaXAdESSigner();
    const keys = generateTestCertificate();
    testCert = {
      certificate: keys.certificateBase64,
      privateKey: keys.privateKeyPem,
    };
  });

  // Test 1: sign() produces XML containing <ds:Signature> inside UBLExtensions
  it('sign() produces XML containing ds:Signature inside UBLExtensions', async () => {
    const signedXml = await signer.sign(TEST_INVOICE_XML, testCert);

    expect(signedXml).toContain('<ds:Signature');
    expect(signedXml).toContain('ext:ExtensionContent');
    // Signature should be inside UBLExtensions
    const extIdx = signedXml.indexOf('ext:ExtensionContent');
    const sigIdx = signedXml.indexOf('<ds:Signature');
    expect(sigIdx).toBeGreaterThan(extIdx);
  });

  // Test 2: sign() includes xades:SignedProperties with SigningTime and SigningCertificate
  it('sign() includes xades:SignedProperties with SigningTime and SigningCertificateV2', async () => {
    const signedXml = await signer.sign(TEST_INVOICE_XML, testCert);

    expect(signedXml).toContain('xades:SignedProperties');
    expect(signedXml).toContain('xades:SigningTime');
    expect(signedXml).toContain('xades:SigningCertificate');
    expect(signedXml).toContain('xades:CertDigest');
    expect(signedXml).toContain('xades:IssuerSerial');
  });

  // Test 3: sign() uses Exclusive XML Canonicalization
  it('sign() uses Exclusive XML Canonicalization', async () => {
    const signedXml = await signer.sign(TEST_INVOICE_XML, testCert);

    expect(signedXml).toContain('http://www.w3.org/2001/10/xml-exc-c14n#');
  });

  // Test 4: sign() uses SHA-256 digest and ECDSA-SHA256 signature algorithm
  it('sign() uses SHA-256 digest and ECDSA-SHA256 signature algorithm', async () => {
    const signedXml = await signer.sign(TEST_INVOICE_XML, testCert);

    expect(signedXml).toContain('http://www.w3.org/2001/04/xmlenc#sha256');
    expect(signedXml).toContain('http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256');
  });

  // Test 5: verify() returns valid=true for correctly signed XML
  it('verify() returns valid=true for correctly signed XML', async () => {
    const signedXml = await signer.sign(TEST_INVOICE_XML, testCert);
    const result = await signer.verify(signedXml);

    // No debug needed -- test passes
    expect(result.valid).toBe(true);
    expect(result.signedAt).toBeInstanceOf(Date);
  });

  // Test 6: verify() returns valid=false for tampered XML
  it('verify() returns valid=false for tampered XML', async () => {
    const signedXml = await signer.sign(TEST_INVOICE_XML, testCert);
    // Tamper with the invoice amount
    const tamperedXml = signedXml.replace('27600.00', '99999.99');
    const result = await signer.verify(tamperedXml);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  // Test 7: Private key does not appear in signed XML output
  it('private key does not appear in signed XML output', async () => {
    const signedXml = await signer.sign(TEST_INVOICE_XML, testCert);

    // Extract the raw key data (between PEM headers) for checking
    const keyLines =
      testCert.privateKey
        ?.split('\n')
        .filter(l => l.trim() !== '' && !l.includes('-----BEGIN') && !l.includes('-----END')) ?? [];

    // The private key base64 content should not appear in output
    for (const line of keyLines) {
      if (line.trim().length > 20) {
        // Only check substantial lines
        expect(signedXml).not.toContain(line.trim());
      }
    }
    // Also check for PEM markers
    expect(signedXml).not.toContain('PRIVATE KEY');
  });

  // Test 8: sign() throws when privateKey is missing
  it('sign() throws when privateKey is missing', async () => {
    const noPkCert: CertificateInfo = {
      certificate: testCert.certificate,
      // No privateKey
    };

    await expect(signer.sign(TEST_INVOICE_XML, noPkCert)).rejects.toThrow(
      'ZATCA signing requires privateKey in CertificateInfo',
    );
  });
});
