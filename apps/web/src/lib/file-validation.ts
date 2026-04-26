/**
 * Validates a bank statement file (extension and size).
 */

const VALID_EXTENSIONS = ['.mt940', '.csv'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateBankStatementFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!VALID_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'FILE_TOO_LARGE' };
  }

  return { valid: true };
}
