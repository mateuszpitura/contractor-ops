import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock file-type (magic byte detection)
// ---------------------------------------------------------------------------

const {
  mockFileTypeFromBuffer,
} = vi.hoisted(() => ({
  mockFileTypeFromBuffer: vi.fn(),
}));

vi.mock('file-type', () => ({
  fileTypeFromBuffer: mockFileTypeFromBuffer,
}));

import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIMES,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
  validateMimeType,
} from '../mime-validator.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('ALLOWED_MIMES contains the 5 expected types', () => {
    expect(ALLOWED_MIMES.has('application/pdf')).toBe(true);
    expect(ALLOWED_MIMES.has('image/png')).toBe(true);
    expect(ALLOWED_MIMES.has('image/jpeg')).toBe(true);
    expect(
      ALLOWED_MIMES.has('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe(true);
    expect(
      ALLOWED_MIMES.has('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true);
    expect(ALLOWED_MIMES.size).toBe(5);
  });

  it('ALLOWED_EXTENSIONS contains expected extensions', () => {
    for (const ext of ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg']) {
      expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
    }
    expect(ALLOWED_EXTENSIONS.size).toBe(6);
  });

  it('MAX_FILE_SIZE_BYTES is 25 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// isAllowedMimeType (pure function)
// ---------------------------------------------------------------------------

describe('isAllowedMimeType', () => {
  it.each([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ])('returns true for allowed MIME type: %s', mime => {
    expect(isAllowedMimeType(mime)).toBe(true);
  });

  it.each([
    'application/x-msdownload', // EXE
    'application/x-bat', // BAT
    'application/x-sh', // SH
    'text/html',
    'application/javascript',
    'application/zip',
    'application/octet-stream',
    'text/plain',
    'image/gif',
    'image/webp',
    'video/mp4',
  ])('returns false for disallowed MIME type: %s', mime => {
    expect(isAllowedMimeType(mime)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAllowedMimeType('')).toBe(false);
  });

  it('is case-sensitive (MIME types are lowercase by spec)', () => {
    expect(isAllowedMimeType('Application/PDF')).toBe(false);
    expect(isAllowedMimeType('IMAGE/PNG')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateMimeType (uses file-type magic bytes)
// ---------------------------------------------------------------------------

describe('validateMimeType', () => {
  it('returns valid=true when detected MIME is in allowed set', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce({ mime: 'application/pdf', ext: 'pdf' });

    const result = await validateMimeType(Buffer.from('fake-pdf-bytes'));

    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('application/pdf');
  });

  it('returns valid=true for PNG', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce({ mime: 'image/png', ext: 'png' });

    const result = await validateMimeType(Buffer.from('fake-png'));
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('image/png');
  });

  it('returns valid=true for JPEG', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce({ mime: 'image/jpeg', ext: 'jpg' });

    const result = await validateMimeType(Buffer.from('fake-jpg'));
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('image/jpeg');
  });

  it('returns valid=false for disallowed detected MIME', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce({
      mime: 'application/x-msdownload',
      ext: 'exe',
    });

    const result = await validateMimeType(Buffer.from('MZ-exe-header'));

    expect(result.valid).toBe(false);
    expect(result.detectedMime).toBe('application/x-msdownload');
  });

  it('returns valid=false with undefined detectedMime when file-type cannot determine type', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce(undefined);

    const result = await validateMimeType(Buffer.from('random-bytes'));

    expect(result.valid).toBe(false);
    expect(result.detectedMime).toBeUndefined();
  });

  it('returns valid=false for empty buffer (no magic bytes)', async () => {
    mockFileTypeFromBuffer.mockResolvedValueOnce(undefined);

    const result = await validateMimeType(Buffer.alloc(0));

    expect(result.valid).toBe(false);
    expect(result.detectedMime).toBeUndefined();
  });

  it('catches spoofed extensions: file claims PDF but magic bytes say EXE', async () => {
    // Simulates a file with .pdf extension but actual EXE content
    mockFileTypeFromBuffer.mockResolvedValueOnce({
      mime: 'application/x-msdownload',
      ext: 'exe',
    });

    const result = await validateMimeType(Buffer.from('MZ-header-disguised-as-pdf'));

    expect(result.valid).toBe(false);
    expect(result.detectedMime).toBe('application/x-msdownload');
  });
});
