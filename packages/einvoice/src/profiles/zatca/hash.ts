// ---------------------------------------------------------------------------
// ZATCA invoice hash (pre-signing PIH / submission payload basis)
// ---------------------------------------------------------------------------
// Per ZATCA spec: SHA-256 of the C14N-canonicalized invoice XML with
// UBLExtensions, ds:Signature, and the QR AdditionalDocumentReference removed.
// Returns both hex (hash-chain / PIH storage) and base64 (API payload).
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { ExclusiveCanonicalization } from 'xml-crypto';

type XmlDomModule = typeof import('@xmldom/xmldom');

// biome-ignore lint/style/useNamingConvention: module-private lazy cache
let _xmldom: XmlDomModule | undefined;

function getXmldom(): XmlDomModule {
  if (!_xmldom) {
    const xmlCryptoPath = require.resolve('xml-crypto');
    const xmldomPath = require.resolve('@xmldom/xmldom', {
      paths: [xmlCryptoPath],
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _xmldom = require(xmldomPath) as XmlDomModule;
  }
  return _xmldom;
}

export interface ZatcaInvoiceHash {
  /** Lowercase hex digest — stored in ZatcaInvoiceChain / PIH chain */
  hex: string;
  /** Base64 digest — sent in ZATCA clearance/reporting payload `invoiceHash` */
  base64: string;
}

function removeChildByNodeName(
  parent: {
    childNodes: { length: number; item(i: number): unknown };
    removeChild(n: unknown): unknown;
  },
  nodeName: string,
): void {
  for (let i = parent.childNodes.length - 1; i >= 0; i--) {
    const child = parent.childNodes.item(i) as { nodeName?: string } | null;
    if (child?.nodeName === nodeName) {
      parent.removeChild(child);
    }
  }
}

function removeQrDocumentReference(root: {
  getElementsByTagName(name: string): { length: number; item(i: number): unknown };
}): void {
  const refs = root.getElementsByTagName('cac:AdditionalDocumentReference');
  for (let i = refs.length - 1; i >= 0; i--) {
    const ref = refs.item(i) as {
      getElementsByTagName(name: string): {
        item(i: number): { textContent?: string | null } | null;
      };
      parentNode?: { removeChild(n: unknown): unknown } | null;
    } | null;
    if (!ref) continue;
    const idEl = ref.getElementsByTagName('cbc:ID').item(0);
    if (idEl?.textContent?.trim() === 'QR') {
      ref.parentNode?.removeChild(ref);
    }
  }
}

function removeSignatureElements(doc: {
  getElementsByTagNameNS(ns: string, local: string): { length: number; item(i: number): unknown };
}): void {
  const sigs = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature');
  for (let i = sigs.length - 1; i >= 0; i--) {
    const sig = sigs.item(i) as { parentNode?: { removeChild(n: unknown): unknown } | null } | null;
    sig?.parentNode?.removeChild(sig);
  }
}

/**
 * Compute the ZATCA invoice hash from unsigned UBL XML (pre-signing).
 */
export function computeZatcaInvoiceHash(unsignedXml: string): ZatcaInvoiceHash {
  const { DOMParser } = getXmldom();
  const doc = new DOMParser().parseFromString(unsignedXml, 'text/xml');
  const root = doc.documentElement;
  if (!root) {
    throw new Error('ZATCA hash: XML document has no root element');
  }

  removeChildByNodeName(root, 'ext:UBLExtensions');
  removeQrDocumentReference(root);
  removeSignatureElements(doc);

  const c14n = new ExclusiveCanonicalization();
  const canonicalXml = c14n.process(root as unknown as Element, {}).toString();
  const digest = crypto.createHash('sha256').update(canonicalXml, 'utf8').digest();

  return {
    hex: digest.toString('hex'),
    base64: digest.toString('base64'),
  };
}
