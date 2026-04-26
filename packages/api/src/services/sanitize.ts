/**
 * Strip HTML tags from a string to prevent stored XSS.
 * Removes actual HTML tag patterns while preserving plain text.
 *
 * Applied at API input boundaries as defense-in-depth alongside
 * React's automatic output escaping.
 */
export function stripHtml(input: string): string {
  // Remove script/style tags AND their content first
  let text = input.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Then strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  return text.trim();
}

/**
 * Recursively sanitize all string values in an object.
 * Returns a shallow copy with sanitized strings — does not mutate input.
 */
export function sanitizeStrings<T>(obj: T): T {
  if (typeof obj === 'string') {
    return stripHtml(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeStrings) as T;
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeStrings(value);
    }
    return result as T;
  }

  return obj;
}
