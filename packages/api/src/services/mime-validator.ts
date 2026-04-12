import { fileTypeFromBuffer } from 'file-type';

// ---------------------------------------------------------------------------
// Allowed MIME types and extensions for document uploads
// ---------------------------------------------------------------------------

export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'image/png',
  'image/jpeg',
]);

export const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg']);

/** Maximum allowed file size: 25 MB */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Validates MIME type by reading magic bytes from a buffer.
 * Uses the `file-type` package for reliable content-based detection
 * rather than trusting file extensions.
 */
export async function validateMimeType(
  buffer: Buffer,
): Promise<{ valid: boolean; detectedMime: string | undefined }> {
  const result = await fileTypeFromBuffer(buffer);
  const detectedMime = result?.mime;
  return {
    valid: detectedMime !== undefined && ALLOWED_MIMES.has(detectedMime),
    detectedMime,
  };
}

/**
 * Checks if a given MIME type string is in the allowed set.
 * Used for quick pre-validation before upload.
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIMES.has(mimeType);
}
