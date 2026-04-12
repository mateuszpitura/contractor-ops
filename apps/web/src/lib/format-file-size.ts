/**
 * Format a byte count into a human-readable file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Truncate a filename while preserving the file extension.
 *
 * @param name    The original filename.
 * @param maxLen  Maximum character length (default 40).
 */
export function truncateFilename(name: string, maxLen = 40): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf(".");
  if (ext > 0) {
    const extension = name.slice(ext);
    return name.slice(0, maxLen - extension.length - 3) + "..." + extension;
  }
  return name.slice(0, maxLen - 3) + "...";
}
