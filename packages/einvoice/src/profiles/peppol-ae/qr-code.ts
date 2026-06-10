// ---------------------------------------------------------------------------
// UAE FTA QR Code Generator
// ---------------------------------------------------------------------------

import QRCode from 'qrcode';
import type { EInvoice } from '../../types/invoice.js';
import type { QRCodeable } from '../../types/profile.js';

/**
 * UAE FTA QR code implementation for Peppol PINT-AE invoices.
 * Implements the shared QRCodeable interface.
 *
 * QR data contains: seller name, TRN, invoice date, total, VAT amount.
 * Encoded as pipe-delimited string rendered to PNG.
 */
export class PeppolAEQRCode implements QRCodeable {
  /**
   * Generate a QR code PNG buffer for the given invoice.
   * Data format: sellerName|TRN|issueDate|totalInclVAT|vatAmount
   */
  async generateQR(invoice: EInvoice): Promise<Buffer> {
    const vatAmount = invoice.taxBreakdown.reduce((sum, t) => sum + t.taxAmountMinor, 0);

    const qrData = [
      invoice.supplier.name,
      invoice.supplier.id,
      invoice.issueDate,
      (invoice.taxInclusiveAmount / 100).toFixed(2),
      (vatAmount / 100).toFixed(2),
    ].join('|');

    const pngBuffer = await QRCode.toBuffer(qrData, {
      type: 'png',
      width: 200,
      errorCorrectionLevel: 'M',
    });

    return Buffer.from(pngBuffer);
  }

  /**
   * Parse QR code data back into partial EInvoice fields.
   * Note: This performs data extraction from the pipe-delimited string,
   * not visual QR decoding (which would require a separate scanner library).
   */
  async parseQR(data: Buffer): Promise<Partial<EInvoice>> {
    // Attempt to decode the buffer as a UTF-8 string (QR data content)
    const dataStr = data.toString('utf-8');
    const parts = dataStr.split('|');

    if (parts.length < 5) {
      return {};
    }

    const [sellerName, sellerTrn, issueDate, totalStr, vatStr] = parts;

    return {
      supplier: {
        id: sellerTrn ?? '',
        name: sellerName ?? '',
      },
      issueDate: issueDate ?? '',
      taxInclusiveAmount: Math.round(parseFloat(totalStr ?? '0') * 100),
      taxBreakdown: [
        {
          taxableAmountMinor: 0,
          taxAmountMinor: Math.round(parseFloat(vatStr ?? '0') * 100),
          taxCategory: 'S',
        },
      ],
    };
  }
}
