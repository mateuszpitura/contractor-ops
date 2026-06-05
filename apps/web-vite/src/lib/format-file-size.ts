/**
 * Byte → human-readable size + filename-extension-preserving truncate.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncateFilename(name: string, maxLen = 40): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0) {
    const extension = name.slice(ext);
    return `${name.slice(0, maxLen - extension.length - 3)}...${extension}`;
  }
  return `${name.slice(0, maxLen - 3)}...`;
}
