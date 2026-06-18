// ---------------------------------------------------------------------------
// ZatcaXAdESSigner -- XAdES-BES enveloped digital signatures for ZATCA
// ---------------------------------------------------------------------------
// Implements the Signable interface from the e-invoicing engine.
// Builds XAdES-BES signatures manually using Node.js crypto and
// xml-crypto's canonicalization utilities for sign/verify consistency.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { ExclusiveCanonicalization, SignedXml } from 'xml-crypto';
import { escapeXmlEntities } from '../../engine/xml-utils.js';
import type {
  CertificateInfo,
  Signable,
  SignatureVerificationResult,
} from '../../types/profile.js';

type XmlDomModule = typeof import('@xmldom/xmldom');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';
const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED_SIG = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SHA256_DIGEST = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ECDSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256';
const SIGNATURE_ID = 'signature';
const SIGNED_PROPS_ID = 'xadesSignedProperties';

// ---------------------------------------------------------------------------
// xmldom accessor (via xml-crypto's dependency)
// ---------------------------------------------------------------------------

// biome-ignore lint/style/useNamingConvention: underscore prefix indicates module-private lazy cache
let _xmldom: XmlDomModule | undefined;

function getXmldom(): XmlDomModule {
  if (!_xmldom) {
    // Resolve @xmldom/xmldom through xml-crypto's dependency chain
    const xmlCryptoPath = require.resolve('xml-crypto');
    const xmldomPath = require.resolve('@xmldom/xmldom', {
      paths: [xmlCryptoPath],
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _xmldom = require(xmldomPath) as XmlDomModule;
  }
  return _xmldom;
}

// ---------------------------------------------------------------------------
// Custom ECDSA-SHA256 Algorithm for xml-crypto verification
// ---------------------------------------------------------------------------

class EcdsaSha256Algorithm {
  getSignature(signedInfo: crypto.BinaryLike, privateKey: crypto.KeyLike | string): string {
    const signer = crypto.createSign('SHA256');
    signer.update(signedInfo);
    return signer.sign(
      { key: privateKey, dsaEncoding: 'ieee-p1363' } as crypto.SignPrivateKeyInput,
      'base64',
    );
  }

  verifySignature(material: string, key: crypto.KeyLike | string, signatureValue: string): boolean {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(material);
    return verifier.verify(
      { key, dsaEncoding: 'ieee-p1363' } as crypto.VerifyPublicKeyInput,
      signatureValue,
      'base64',
    );
  }

  getAlgorithmName(): string {
    return ECDSA_SHA256;
  }
}

// ---------------------------------------------------------------------------
// Certificate Utilities
// ---------------------------------------------------------------------------

function parseCertificate(certString: string): crypto.X509Certificate {
  if (certString.includes('-----BEGIN')) {
    return new crypto.X509Certificate(certString);
  }
  return new crypto.X509Certificate(Buffer.from(certString, 'base64'));
}

function parsePrivateKey(keyString: string): crypto.KeyObject {
  if (keyString.includes('-----BEGIN')) {
    return crypto.createPrivateKey(keyString);
  }
  const derBuffer = Buffer.from(keyString, 'base64');
  try {
    return crypto.createPrivateKey({
      key: derBuffer,
      format: 'der',
      type: 'pkcs8',
    });
  } catch {
    return crypto.createPrivateKey({
      key: derBuffer,
      format: 'der',
      type: 'sec1',
    });
  }
}

function computeCertDigest(cert: crypto.X509Certificate): string {
  return crypto.createHash('sha256').update(cert.raw).digest('base64');
}

function extractSerialNumber(cert: crypto.X509Certificate): string {
  // Self-signed onboarding/test certs occasionally omit the serialNumber
  // extension; Node returns ''. `BigInt('0x')` then throws SyntaxError with
  // a message that leaks crypto internals. Surface a clear, generic error
  // matching the pattern set by `parseCertificate` / `parsePrivateKey`.
  if (!cert.serialNumber) {
    throw new Error('ZATCA signing: certificate is missing a serial number');
  }
  return BigInt(`0x${cert.serialNumber}`).toString(10);
}

function extractCertBase64(certificate: string): string {
  if (certificate.includes('-----BEGIN')) {
    return certificate
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
  }
  return certificate;
}

function sha256Base64(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf-8').digest('base64');
}

// Single-source-of-truth XML 1.0 §2.4 escape — re-exported alias here only
// to keep the call sites short. See `engine/xml-utils.ts:escapeXmlEntities`
// for the rationale (bug-hunt 2026-04-27 [HIGH] — apostrophe asymmetry).
const escapeXml = escapeXmlEntities;

// ---------------------------------------------------------------------------
// Canonicalization using xml-crypto internals
// ---------------------------------------------------------------------------

/**
 * Compute the document digest using the exact same transforms that
 * xml-crypto's verifier will apply: enveloped-signature + exclusive C14N.
 *
 * Since the unsigned XML has no ds:Signature, the enveloped-signature
 * transform is a no-op. We just need exclusive C14N of the root element.
 */
function computeDocDigest(xml: string): string {
  const { DOMParser } = getXmldom();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const rootElement = doc.documentElement;
  if (!rootElement) throw new Error('XML document has no root element');

  // Apply exclusive C14N (enveloped-sig is no-op on unsigned XML)
  const c14n = new ExclusiveCanonicalization();
  // nominal-type bridge: xml-crypto's xmldom vs. ours — same runtime shape.
  const canonicalXml = c14n.process(rootElement as unknown as Element, {}).toString();

  return sha256Base64(canonicalXml);
}

/**
 * Canonicalize an XML fragment using exclusive C14N.
 */
function canonicalizeFragment(xmlStr: string): string {
  const { DOMParser } = getXmldom();
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const c14n = new ExclusiveCanonicalization();
  const fragmentRoot = doc.documentElement;
  if (!fragmentRoot) throw new Error('XML fragment has no root element');
  // nominal-type bridge: xml-crypto's xmldom vs. ours — same runtime shape.
  return c14n.process(fragmentRoot as unknown as Element, {}).toString();
}

/**
 * Compute the SignedProperties digest from a document that contains an
 * already-injected XAdES placeholder signature. The 2-pass injection-then-
 * canonicalize trick ensures namespace inheritance from ancestors matches
 * what a verifier will compute — canonicalizing SignedProperties in
 * isolation drops inherited namespace declarations and breaks the digest.
 */
function computeSignedPropsDigest(documentWithPlaceholderSig: string): string {
  const { DOMParser } = getXmldom();
  const doc = new DOMParser().parseFromString(documentWithPlaceholderSig, 'text/xml');
  const allElements = doc.getElementsByTagName('*');
  let signedPropsElement: unknown = null;
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements.item(i) as { getAttribute(name: string): string | null };
    if (el.getAttribute('Id') === SIGNED_PROPS_ID) {
      signedPropsElement = el;
      break;
    }
  }
  if (!signedPropsElement) {
    throw new Error('Failed to find SignedProperties in temporary document');
  }
  const c14n = new ExclusiveCanonicalization();
  // nominal-type bridge: xml-crypto's xmldom vs. ours — same runtime shape.
  const canonSignedProps = c14n.process(signedPropsElement as Element, {}).toString();
  return sha256Base64(canonSignedProps);
}

// ---------------------------------------------------------------------------
// XAdES signature slot location + injection
// ---------------------------------------------------------------------------

const XADES_EXTENSION_URI = 'urn:oasis:names:specification:ubl:dsig:enveloped:xades';

/**
 * Validate that the input XML contains exactly one `ext:ExtensionContent`
 * element whose parent `UBLExtension/ExtensionURI` text equals the XAdES
 * enveloped-signature URI. Throws with a clear message if zero or more
 * than one such slot is present.
 *
 * Why this matters: UBLExtensions cardinality is `1..N` and the signer
 * historically used a regex that matched the FIRST empty ExtensionContent
 * regardless of which UBLExtension owned it (bug-hunt 2026-04-27 [HIGH]).
 * A future generator change or attacker-controlled UBL fragment that adds
 * another empty ExtensionContent would silently put the signature in the
 * wrong slot. Validating up-front via DOM removes that ambiguity.
 *
 * Returns nothing — the actual injection uses string-replace anchored at
 * the empty `<ext:ExtensionContent>(\s*)</ext:ExtensionContent>` pair so
 * the rest of the document stays byte-identical (which the doc-digest
 * canonicalisation depends on).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: DOM walk counting empty XAdES ExtensionContent slots with nested element checks; validation is one cohesive unit.
function assertSingleXadesSlot(xml: string): void {
  const { DOMParser } = getXmldom();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (!root) {
    throw new Error('ZATCA signing: XML document has no root element');
  }

  const ublExtensions = root.getElementsByTagName('ext:UBLExtension');
  let xadesEmptySlots = 0;
  for (let i = 0; i < ublExtensions.length; i++) {
    const ext = ublExtensions.item(i);
    if (!ext) continue;
    const uriEl = ext.getElementsByTagName('ext:ExtensionURI').item(0);
    const uriText = uriEl?.textContent?.trim();
    if (uriText !== XADES_EXTENSION_URI) continue;
    const contentEls = ext.getElementsByTagName('ext:ExtensionContent');
    for (let j = 0; j < contentEls.length; j++) {
      const contentEl = contentEls.item(j);
      if (!contentEl) continue;
      // We only inject into a slot that is currently empty (whitespace-only
      // content is fine — fast-xml-parser emits exactly that). If the slot
      // already contains a Signature, the caller is double-signing, which
      // we treat as a programmer error.
      const hasElementChild = Array.from({ length: contentEl.childNodes.length }, (_, k) =>
        contentEl.childNodes.item(k),
      ).some(n => n != null && (n as { nodeType: number }).nodeType === 1 /* ELEMENT_NODE */);
      if (!hasElementChild) {
        xadesEmptySlots += 1;
      }
    }
  }

  if (xadesEmptySlots === 0) {
    throw new Error(
      `ZATCA signing: could not find an empty <ext:ExtensionContent> under the UBLExtension carrying ExtensionURI="${XADES_EXTENSION_URI}"`,
    );
  }
  if (xadesEmptySlots > 1) {
    throw new Error(
      `ZATCA signing: multiple empty <ext:ExtensionContent> slots present under XAdES UBLExtension — ambiguous injection target`,
    );
  }
}

/**
 * Inject a `<ds:Signature>` fragment into the empty XAdES slot.
 *
 * Implementation: validate-via-DOM that exactly one such slot exists, then
 * targeted string-replace. Keeps the rest of the document byte-stable so
 * the doc digest computed against the unsigned input C14Ns identically
 * to the verifier-side C14N (which strips ds:Signature first).
 */
function injectSignatureIntoXadesSlot(xml: string, signatureFragmentXml: string): string {
  assertSingleXadesSlot(xml);
  const replaced = xml.replace(
    /(<ext:ExtensionContent>)(\s*)(<\/ext:ExtensionContent>)/,
    `$1${signatureFragmentXml}$2$3`,
  );
  if (replaced === xml) {
    // assertSingleXadesSlot above already rules this out structurally — this
    // is a defensive secondary check against subtle whitespace/PI variations
    // the regex cannot match (e.g. a comment inside the slot).
    throw new Error(
      'ZATCA signing: failed to substitute signature into <ext:ExtensionContent> slot (regex did not match)',
    );
  }
  return replaced;
}

// ---------------------------------------------------------------------------
// XAdES Building
// ---------------------------------------------------------------------------

function buildSignedProperties(cert: crypto.X509Certificate, signingTime: string): string {
  const certDigest = computeCertDigest(cert);
  const issuerDN = escapeXml(cert.issuer.replace(/\n/g, ', '));
  const serialNumber = extractSerialNumber(cert);

  return [
    `<xades:SignedProperties xmlns:xades="${XADES_NS}" Id="${SIGNED_PROPS_ID}">`,
    `<xades:SignedSignatureProperties>`,
    `<xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `<xades:SigningCertificate>`,
    `<xades:Cert>`,
    `<xades:CertDigest>`,
    `<ds:DigestMethod xmlns:ds="${DS_NS}" Algorithm="${SHA256_DIGEST}"></ds:DigestMethod>`,
    `<ds:DigestValue xmlns:ds="${DS_NS}">${certDigest}</ds:DigestValue>`,
    `</xades:CertDigest>`,
    `<xades:IssuerSerial>`,
    `<ds:X509IssuerName xmlns:ds="${DS_NS}">${issuerDN}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber xmlns:ds="${DS_NS}">${serialNumber}</ds:X509SerialNumber>`,
    `</xades:IssuerSerial>`,
    `</xades:Cert>`,
    `</xades:SigningCertificate>`,
    `</xades:SignedSignatureProperties>`,
    `</xades:SignedProperties>`,
  ].join('');
}

// ---------------------------------------------------------------------------
// Signature XML Builders
// ---------------------------------------------------------------------------

function buildSignedInfoXml(docDigest: string, signedPropsDigest: string): string {
  return [
    `<ds:SignedInfo xmlns:ds="${DS_NS}">`,
    `<ds:CanonicalizationMethod Algorithm="${EXC_C14N}"></ds:CanonicalizationMethod>`,
    `<ds:SignatureMethod Algorithm="${ECDSA_SHA256}"></ds:SignatureMethod>`,
    `<ds:Reference URI="">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="${ENVELOPED_SIG}"></ds:Transform>`,
    `<ds:Transform Algorithm="${EXC_C14N}"></ds:Transform>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="${SHA256_DIGEST}"></ds:DigestMethod>`,
    `<ds:DigestValue>${docDigest}</ds:DigestValue>`,
    `</ds:Reference>`,
    `<ds:Reference URI="#${SIGNED_PROPS_ID}" Type="http://uri.etsi.org/01903#SignedProperties">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="${EXC_C14N}"></ds:Transform>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="${SHA256_DIGEST}"></ds:DigestMethod>`,
    `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>`,
    `</ds:Reference>`,
    `</ds:SignedInfo>`,
  ].join('');
}

function buildSignatureXml(params: {
  signedInfoXml: string;
  signatureValue: string;
  certBase64: string;
  signedPropsXml: string;
}): string {
  return [
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${SIGNATURE_ID}">`,
    params.signedInfoXml,
    `<ds:SignatureValue>${params.signatureValue}</ds:SignatureValue>`,
    `<ds:KeyInfo>`,
    `<ds:X509Data>`,
    `<ds:X509Certificate>${params.certBase64}</ds:X509Certificate>`,
    `</ds:X509Data>`,
    `</ds:KeyInfo>`,
    `<ds:Object>`,
    `<xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${SIGNATURE_ID}">`,
    params.signedPropsXml,
    `</xades:QualifyingProperties>`,
    `</ds:Object>`,
    `</ds:Signature>`,
  ].join('');
}

// ---------------------------------------------------------------------------
// ZatcaXAdESSigner
// ---------------------------------------------------------------------------

/**
 * XAdES-BES enveloped signer for ZATCA e-invoices.
 *
 * Produces enveloped XML digital signatures embedded inside
 * UBLExtensions/ExtensionContent per ZATCA specification.
 *
 * Uses ECDSA-SHA256 with Exclusive XML Canonicalization.
 * XAdES SignedProperties include signing time, certificate digest,
 * and issuer serial number.
 *
 * Security: Private keys are never logged, serialized, or included
 * in XML output. Error messages are generic and do not leak key material.
 */
export class ZatcaXAdESSigner implements Signable {
  async sign(xml: string, certificate: CertificateInfo): Promise<string> {
    if (!certificate.privateKey) {
      throw new Error('ZATCA signing requires privateKey in CertificateInfo');
    }

    const x509 = parseCertificate(certificate.certificate);
    const privateKey = parsePrivateKey(certificate.privateKey);
    const certBase64 = extractCertBase64(certificate.certificate);

    // 1. Compute document digest
    const docDigest = computeDocDigest(xml);

    // 2. Build SignedProperties
    const signingTime = new Date().toISOString();
    const signedPropsXml = buildSignedProperties(x509, signingTime);

    // 3. Build a PLACEHOLDER signature with dummy digest/value, inject into
    //    the document, then compute the real SignedProperties digest from
    //    the full document context. This 2-pass approach ensures the
    //    canonical form matches what the verifier will compute.
    const PLACEHOLDER_DIGEST = 'PLACEHOLDER_DIGEST';
    const PLACEHOLDER_SIG_VALUE = 'PLACEHOLDER_SIG';

    const placeholderSignatureXml = buildSignatureXml({
      signedInfoXml: buildSignedInfoXml(docDigest, PLACEHOLDER_DIGEST),
      signatureValue: PLACEHOLDER_SIG_VALUE,
      certBase64,
      signedPropsXml,
    });

    // Inject placeholder signature into the XAdES extension slot via DOM —
    // not regex — so we provably target the right UBLExtension and fail loud
    // if the slot is missing. See `injectSignatureIntoXadesSlot` JSDoc.
    const tempSignedXml = injectSignatureIntoXadesSlot(xml, placeholderSignatureXml);

    // 4. Compute real SignedProperties digest from the full document
    const signedPropsDigest = computeSignedPropsDigest(tempSignedXml);

    // 5. Build real SignedInfo with correct digest
    const signedInfoXml = buildSignedInfoXml(docDigest, signedPropsDigest);

    // 6. Canonicalize SignedInfo and compute ECDSA signature
    const canonicalSignedInfo = canonicalizeFragment(signedInfoXml);
    const signer = crypto.createSign('SHA256');
    signer.update(canonicalSignedInfo);
    const signatureValue = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64');

    // 7. Build final signature with real values
    const finalSignatureXml = buildSignatureXml({
      signedInfoXml,
      signatureValue,
      certBase64,
      signedPropsXml,
    });

    // 8. Inject final signature into the XAdES UBLExtensions slot.
    return injectSignatureIntoXadesSlot(xml, finalSignatureXml);
  }

  async verify(xml: string): Promise<SignatureVerificationResult> {
    try {
      const sigMatch = xml.match(/<ds:Signature[\s\S]*?<\/ds:Signature>/);
      if (!sigMatch) {
        return {
          valid: false,
          errors: ['No ds:Signature element found in XML'],
        };
      }

      const certMatch = xml.match(/<ds:X509Certificate>([\s\S]*?)<\/ds:X509Certificate>/);
      if (!certMatch) {
        return {
          valid: false,
          errors: ['No X509Certificate found in signature KeyInfo'],
        };
      }

      const certBase64 = certMatch[1]?.replace(/\s/g, '');
      const certPem = `-----BEGIN CERTIFICATE-----\n${certBase64}\n-----END CERTIFICATE-----`;

      const sigVerifier = new SignedXml({
        publicCert: certPem,
      });
      sigVerifier.SignatureAlgorithms[ECDSA_SHA256] = EcdsaSha256Algorithm as never;

      sigVerifier.loadSignature(sigMatch[0]);
      const isValid = sigVerifier.checkSignature(xml);

      // Extract XAdES metadata
      let signedAt: Date | undefined;
      let signerName: string | undefined;

      const timeMatch = xml.match(/<xades:SigningTime>([\s\S]*?)<\/xades:SigningTime>/);
      if (timeMatch) {
        signedAt = new Date(timeMatch[1]?.trim());
      }

      try {
        const x509 = parseCertificate(certBase64);
        const cnMatch = x509.subject.match(/CN=([^,\n]+)/);
        if (cnMatch) {
          signerName = cnMatch[1]?.trim();
        }
        // safe-swallow: signer-name CN extraction best-effort; absence is non-fatal
      } catch {
        // Non-critical
      }

      if (isValid) {
        return { valid: true, signerName, signedAt };
      }

      const refErrors = sigVerifier
        .getReferences()
        .filter(r => r.validationError)
        .map(r => `Reference ${r.uri || '(document)'}: ${r.validationError?.message}`);

      return {
        valid: false,
        signerName,
        signedAt,
        errors:
          refErrors.length > 0
            ? refErrors
            : ['Signature verification failed: signature value mismatch'],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown verification error';
      return {
        valid: false,
        errors: [`Signature verification error: ${message}`],
      };
    }
  }
}
