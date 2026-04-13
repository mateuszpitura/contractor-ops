// ---------------------------------------------------------------------------
// ZATCA TLV-Encoded QR Code Generator
// ---------------------------------------------------------------------------
// Per D-04: TLV QR code encoding built directly (no ZATCA JS libraries).
// Implements QRCodeable capability hook from Phase 45's engine architecture.
// ---------------------------------------------------------------------------

import QRCode from 'qrcode';
import type { EInvoice } from '../../types/invoice.js';
import type { QRCodeable } from '../../types/profile.js';
import { ZatcaTlvTag } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed supplier name length (DoS protection per T-48-08) */
const MAX_SUPPLIER_NAME_LENGTH = 1000;

// ---------------------------------------------------------------------------
// TLV Encoding Utilities
// ---------------------------------------------------------------------------

/**
 * Encode an array of tag-value fields into a ZATCA TLV binary buffer.
 *
 * TLV format per ZATCA spec:
 * - Tag: 1 byte (unsigned integer)
 * - Length: 1 byte if < 128, 0x81 + 1 byte if 128-255, 0x82 + 2 bytes if 256+
 * - Value: UTF-8 encoded string or raw bytes
 *
 * Fields are concatenated sequentially into a single buffer.
 */
export function encodeTLV(fields: Array<{ tag: number; value: string | Buffer }>): Buffer {
  const chunks: Buffer[] = [];

  for (const field of fields) {
    const valueBuffer =
      typeof field.value === 'string' ? Buffer.from(field.value, 'utf-8') : field.value;

    const tagByte = Buffer.from([field.tag]);
    const lengthBytes = encodeLength(valueBuffer.length);

    chunks.push(tagByte, lengthBytes, valueBuffer);
  }

  return Buffer.concat(chunks);
}

/**
 * Decode a TLV binary buffer into an array of tag-value pairs.
 *
 * Parses sequentially: tag (1 byte), length (variable), value (length bytes).
 * Handles multi-byte length encoding (0x81 and 0x82 prefixes).
 */
export function decodeTLV(buffer: Buffer): Array<{ tag: number; value: Buffer }> {
  const result: Array<{ tag: number; value: Buffer }> = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 1 >= buffer.length) break;

    const tag = buffer[offset] ?? 0;
    offset += 1;

    const { length, bytesRead } = decodeLength(buffer, offset);
    offset += bytesRead;

    if (offset + length > buffer.length) break;

    const value = buffer.subarray(offset, offset + length);
    offset += length;

    result.push({ tag, value: Buffer.from(value) });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Length Encoding Helpers
// ---------------------------------------------------------------------------

/**
 * Encode a length value using ASN.1/BER-style length encoding:
 * - 0-127:   single byte
 * - 128-255: 0x81 + 1 byte
 * - 256+:    0x82 + 2 bytes (big-endian)
 */
function encodeLength(length: number): Buffer {
  if (length < 128) {
    return Buffer.from([length]);
  }
  if (length < 256) {
    return Buffer.from([0x81, length]);
  }
  return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
}

/**
 * Decode a BER-style length from a buffer at the given offset.
 * Returns the decoded length and number of bytes consumed.
 */
function decodeLength(buffer: Buffer, offset: number): { length: number; bytesRead: number } {
  const firstByte = buffer[offset] ?? 0;

  if (firstByte < 128) {
    return { length: firstByte, bytesRead: 1 };
  }

  if (firstByte === 0x81) {
    return { length: buffer[offset + 1] ?? 0, bytesRead: 2 };
  }

  if (firstByte === 0x82) {
    const high = buffer[offset + 1] ?? 0;
    const low = buffer[offset + 2] ?? 0;
    return { length: (high << 8) | low, bytesRead: 3 };
  }

  // Fallback for unexpected encoding
  return { length: firstByte, bytesRead: 1 };
}

// ---------------------------------------------------------------------------
// ZatcaTLVQRCode Class
// ---------------------------------------------------------------------------

/**
 * ZATCA TLV-encoded QR code generator implementing QRCodeable.
 *
 * Generates QR codes containing Tag-Length-Value encoded seller information,
 * VAT details, and (for B2B standard invoices) cryptographic data.
 *
 * Tags 1-5: Required for all invoices (B2C simplified and B2B standard)
 * Tags 6-8: Required for B2B standard invoices (hash, signature, public key)
 */
export class ZatcaTLVQRCode implements QRCodeable {
  /**
   * Generate a QR code PNG buffer for the given ZATCA invoice.
   *
   * Process:
   * 1. Build TLV fields from invoice data
   * 2. Encode as TLV binary
   * 3. Base64-encode the TLV buffer
   * 4. Render as QR code PNG image
   *
   * @throws Error if supplier name exceeds 1000 characters (DoS protection)
   */
  async generateQR(invoice: EInvoice): Promise<Buffer> {
    // DoS protection (T-48-08)
    if (invoice.supplier.name.length > MAX_SUPPLIER_NAME_LENGTH) {
      throw new Error(
        `Supplier name exceeds maximum length of ${MAX_SUPPLIER_NAME_LENGTH} characters`,
      );
    }

    const tlvFields = this.buildTlvFields(invoice);
    const tlvBuffer = encodeTLV(tlvFields);
    const base64String = tlvBuffer.toString('base64');

    const pngBuffer = await QRCode.toBuffer(base64String, {
      type: 'png',
      width: 200,
      errorCorrectionLevel: 'M',
    });

    return Buffer.from(pngBuffer);
  }

  /**
   * Parse QR code TLV data back into partial EInvoice fields.
   *
   * Expects a Buffer containing the base64-encoded TLV string (as UTF-8).
   * This performs data extraction from TLV, not visual QR code scanning.
   */
  async parseQR(data: Buffer): Promise<Partial<EInvoice>> {
    const base64String = data.toString('utf-8');
    const tlvBuffer = Buffer.from(base64String, 'base64');
    const fields = decodeTLV(tlvBuffer);

    const findField = (tag: number): string | undefined => {
      const field = fields.find(f => f.tag === tag);
      return field?.value.toString('utf-8');
    };

    const sellerName = findField(ZatcaTlvTag.SELLER_NAME);
    const vatNumber = findField(ZatcaTlvTag.VAT_NUMBER);
    const timestamp = findField(ZatcaTlvTag.TIMESTAMP);
    const totalStr = findField(ZatcaTlvTag.TOTAL_WITH_VAT);
    const vatStr = findField(ZatcaTlvTag.VAT_AMOUNT);

    return {
      supplier: {
        id: vatNumber ?? '',
        name: sellerName ?? '',
      },
      issueDate: timestamp ?? '',
      taxInclusiveAmount: totalStr ? Math.round(parseFloat(totalStr) * 100) : 0,
      taxBreakdown: [
        {
          taxableAmountMinor: 0,
          taxAmountMinor: vatStr ? Math.round(parseFloat(vatStr) * 100) : 0,
          taxCategory: 'S',
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Build TLV fields from an EInvoice.
   * Tags 1-5 always included. Tags 6-8 only when cryptographic data present.
   */
  private buildTlvFields(invoice: EInvoice): Array<{ tag: number; value: string | Buffer }> {
    const vatAmount = invoice.taxBreakdown.reduce((sum, t) => sum + t.taxAmountMinor, 0);

    const fields: Array<{ tag: number; value: string | Buffer }> = [
      { tag: ZatcaTlvTag.SELLER_NAME, value: invoice.supplier.name },
      { tag: ZatcaTlvTag.VAT_NUMBER, value: invoice.supplier.id },
      { tag: ZatcaTlvTag.TIMESTAMP, value: invoice.issueDate },
      {
        tag: ZatcaTlvTag.TOTAL_WITH_VAT,
        value: (invoice.taxInclusiveAmount / 100).toFixed(2),
      },
      {
        tag: ZatcaTlvTag.VAT_AMOUNT,
        value: (vatAmount / 100).toFixed(2),
      },
    ];

    // B2B tags 6-8: only when cryptographic extensions are present
    const ext = invoice.extensions as Record<string, unknown> | undefined;

    if (ext?.invoiceHash) {
      fields.push({
        tag: ZatcaTlvTag.INVOICE_HASH,
        value: Buffer.from(ext.invoiceHash as string, 'hex'),
      });
    }

    if (ext?.signatureValue) {
      fields.push({
        tag: ZatcaTlvTag.ECDSA_SIGNATURE,
        value: Buffer.from(ext.signatureValue as string, 'base64'),
      });
    }

    if (ext?.publicKey) {
      fields.push({
        tag: ZatcaTlvTag.PUBLIC_KEY,
        value: Buffer.from(ext.publicKey as string, 'base64'),
      });
    }

    return fields;
  }
}
