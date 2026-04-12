// ---------------------------------------------------------------------------
// ZATCA Device Onboarding — CSR Generation & Compliance Test Invoices
// ---------------------------------------------------------------------------
// Implements CSR generation with ZATCA-required X.509 subject attributes
// and builds the 6 compliance test invoices required for device onboarding.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import forge from "node-forge";
import type { EInvoice } from "../../types/invoice.js";
import type { ZatcaCsrAttributes, ZatcaTaxDetails } from "./schemas.js";

// ---------------------------------------------------------------------------
// ASN.1 OIDs for Subject Attributes
// ---------------------------------------------------------------------------

const OID = {
  commonName: "2.5.4.3",
  organizationName: "2.5.4.10",
  organizationalUnitName: "2.5.4.11",
  countryName: "2.5.4.6",
  serialNumber: "2.5.4.5",
  uid: "0.9.2342.19200300.100.1.1",
  title: "2.5.4.12",
  registeredAddress: "2.5.4.26",
  businessCategory: "2.5.4.15",
  // EC key OIDs
  ecPublicKey: "1.2.840.10045.2.1",
  prime256v1: "1.2.840.10045.3.1.7",
  ecdsaWithSha256: "1.2.840.10045.4.3.2",
} as const;

// ---------------------------------------------------------------------------
// CSR Generation
// ---------------------------------------------------------------------------

/**
 * Generate a ZATCA-compliant Certificate Signing Request (CSR).
 *
 * - Key pair: ECDSA P-256 (prime256v1)
 * - Subject attributes: CN, O, OU (VAT), C=SA, SN, UID, title, registeredAddress, businessCategory
 *
 * SECURITY: The private key is returned to the caller for immediate storage
 * in Infisical. It MUST NOT be logged, serialized to DB, or returned to clients.
 *
 * @returns CSR in PEM format and private key in PEM format
 */
export function generateZatcaCsr(attributes: ZatcaCsrAttributes): {
  csr: string;
  privateKey: string;
} {
  // 1. Generate ECDSA P-256 key pair using Node.js crypto
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // 2. Build CSR ASN.1 structure manually (forge.pki doesn't support EC keys)
  const csrPem = buildEcdsaCsr(attributes, publicKey as Buffer, privateKey);

  return { csr: csrPem, privateKey };
}

// ---------------------------------------------------------------------------
// ASN.1 Helpers
// ---------------------------------------------------------------------------

const { asn1 } = forge;
const { Class, Type } = asn1;

/** Create an ASN.1 UTF8String attribute value in an RDN SET */
function rdnAttr(oid: string, value: string, valueType = Type.UTF8): forge.asn1.Asn1 {
  return asn1.create(Class.UNIVERSAL, Type.SET, true, [
    asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, [
      // AttributeType (OID)
      asn1.create(Class.UNIVERSAL, Type.OID, false, asn1.oidToDer(oid).getBytes()),
      // AttributeValue
      valueType === Type.PRINTABLESTRING
        ? asn1.create(Class.UNIVERSAL, Type.PRINTABLESTRING, false, value)
        : asn1.create(Class.UNIVERSAL, Type.UTF8, false, value),
    ]),
  ]);
}

/**
 * Build a PKCS#10 CSR with ECDSA P-256 key and ZATCA subject attributes.
 *
 * Structure: CertificationRequest ::= SEQUENCE {
 *   certificationRequestInfo  CertificationRequestInfo,
 *   signatureAlgorithm        AlgorithmIdentifier,
 *   signature                 BIT STRING
 * }
 */
function buildEcdsaCsr(
  attributes: ZatcaCsrAttributes,
  spkiDer: Buffer,
  privateKeyPem: string,
): string {
  // Build Subject Name (RDNSequence)
  const subject = asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, [
    rdnAttr(OID.countryName, attributes.country, Type.PRINTABLESTRING),
    rdnAttr(OID.organizationName, attributes.orgName),
    rdnAttr(OID.organizationalUnitName, attributes.vatNumber),
    rdnAttr(OID.commonName, attributes.commonName),
    rdnAttr(OID.serialNumber, attributes.serialNumber, Type.PRINTABLESTRING),
    rdnAttr(OID.uid, attributes.vatNumber),
    rdnAttr(OID.title, attributes.title),
    rdnAttr(OID.registeredAddress, attributes.registeredAddress),
    rdnAttr(OID.businessCategory, attributes.businessCategory),
  ]);

  // SubjectPublicKeyInfo — use the DER bytes directly from Node.js crypto
  const spkiAsn1 = asn1.fromDer(forge.util.createBuffer(spkiDer.toString("binary")));

  // CertificationRequestInfo
  const certReqInfo = asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, [
    // version: 0
    asn1.create(Class.UNIVERSAL, Type.INTEGER, false, String.fromCharCode(0)),
    // subject
    subject,
    // subjectPKInfo
    spkiAsn1,
    // attributes [0] IMPLICIT (empty for basic CSR)
    asn1.create(Class.CONTEXT_SPECIFIC, 0, true, []),
  ]);

  // DER-encode the CertificationRequestInfo for signing
  const tbsDer = asn1.toDer(certReqInfo);
  const tbsBuffer = Buffer.from(tbsDer.getBytes(), "binary");

  // Sign with ECDSA-SHA256 using Node.js crypto
  const signer = crypto.createSign("SHA256");
  signer.update(tbsBuffer);
  const signature = signer.sign(privateKeyPem);

  // Build complete CertificationRequest
  const certReq = asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, [
    certReqInfo,
    // SignatureAlgorithm: ecdsa-with-SHA256
    asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, [
      asn1.create(Class.UNIVERSAL, Type.OID, false, asn1.oidToDer(OID.ecdsaWithSha256).getBytes()),
    ]),
    // Signature: BIT STRING (first byte = 0 unused bits)
    asn1.create(
      Class.UNIVERSAL,
      Type.BITSTRING,
      false,
      String.fromCharCode(0) + signature.toString("binary"),
    ),
  ]);

  // Encode to PEM
  const derBytes = asn1.toDer(certReq).getBytes();
  const base64 = forge.util.encode64(derBytes);

  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.substring(i, i + 64));
  }

  return `-----BEGIN CERTIFICATE REQUEST-----\n${lines.join("\n")}\n-----END CERTIFICATE REQUEST-----`;
}

// ---------------------------------------------------------------------------
// Compliance Test Invoice Builder
// ---------------------------------------------------------------------------

/**
 * Invoice type/subtype combinations required for ZATCA compliance checks.
 * 6 test invoices must be submitted successfully during onboarding step 3.
 */
const COMPLIANCE_INVOICE_SPECS = [
  {
    invoiceTypeCode: "388" as const,
    invoiceSubtype: "0100000",
    invoiceType: "standard" as const,
    label: "Standard Tax Invoice",
  },
  {
    invoiceTypeCode: "381" as const,
    invoiceSubtype: "0100000",
    invoiceType: "standard" as const,
    label: "Standard Credit Note",
  },
  {
    invoiceTypeCode: "383" as const,
    invoiceSubtype: "0100000",
    invoiceType: "standard" as const,
    label: "Standard Debit Note",
  },
  {
    invoiceTypeCode: "388" as const,
    invoiceSubtype: "0200000",
    invoiceType: "simplified" as const,
    label: "Simplified Tax Invoice",
  },
  {
    invoiceTypeCode: "381" as const,
    invoiceSubtype: "0200000",
    invoiceType: "simplified" as const,
    label: "Simplified Credit Note",
  },
  {
    invoiceTypeCode: "383" as const,
    invoiceSubtype: "0200000",
    invoiceType: "simplified" as const,
    label: "Simplified Debit Note",
  },
] as const;

/** SHA-256 hash of the string "0" — used as PIH for the first invoice in a chain */
const INITIAL_PIH = crypto.createHash("sha256").update("0").digest("hex");

/**
 * Build 6 compliance test invoices required for ZATCA device onboarding (step 3).
 *
 * Each invoice:
 * - Uses the organization's tax details for the supplier
 * - Uses a standard ZATCA test buyer
 * - Has a single line item (100 SAR + 15% VAT = 115 SAR)
 * - Contains correct ZATCA extensions (ICV, UUID, PIH, type/subtype)
 *
 * @param taxDetails Organization tax details from onboarding step 1
 * @returns Array of 6 EInvoice objects ready for XML generation and signing
 */
export function buildComplianceTestInvoices(taxDetails: ZatcaTaxDetails): EInvoice[] {
  const issueDate = new Date().toISOString().split("T")[0]!;
  const formattedAddress = `${taxDetails.street}, ${taxDetails.district}, ${taxDetails.city} ${taxDetails.postalCode}`;

  return COMPLIANCE_INVOICE_SPECS.map((spec, index) => {
    const invoice: EInvoice = {
      id: `COMPLIANCE-${index + 1}`,
      issueDate,
      invoiceTypeCode: spec.invoiceTypeCode,
      currencyCode: "SAR",
      profileId: "zatca",

      supplier: {
        id: taxDetails.vatNumber,
        name: taxDetails.orgNameArabic,
        address: formattedAddress,
        country: "SA",
      },

      customer: {
        id: "300000000000003",
        name: "Test Buyer",
        country: "SA",
      },

      lines: [
        {
          lineNumber: 1,
          description: "Test Item",
          quantity: 1,
          unitPriceMinor: 10000,
          netAmountMinor: 10000,
          vatRate: "15",
          vatAmountMinor: 1500,
          grossAmountMinor: 11500,
        },
      ],

      taxExclusiveAmount: 10000,
      taxInclusiveAmount: 11500,
      payableAmount: 11500,

      taxBreakdown: [
        {
          taxableAmountMinor: 10000,
          taxAmountMinor: 1500,
          taxCategory: "S",
          percent: 15,
        },
      ],

      extensions: {
        icv: index + 1,
        pih: INITIAL_PIH,
        uuid: crypto.randomUUID(),
        invoiceType: spec.invoiceType,
        invoiceSubtype: spec.invoiceSubtype,
      },
    };

    return invoice;
  });
}
