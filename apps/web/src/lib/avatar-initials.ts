/**
 * Two-character avatar initials used across the app.
 * - Two or more words: first letter of the first word + first letter of the last word.
 * - Single word: first two letters of that word (e.g. "Mateusz" → "MA").
 * - No name: first two characters of email; otherwise "?".
 */
export function getAvatarInitials(name: string | null | undefined, email?: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]![0] ?? "";
      const b = parts[parts.length - 1]![0] ?? "";
      return (a + b).toUpperCase().slice(0, 2);
    }
    const w = parts[0]!;
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w.toUpperCase().slice(0, 1);
  }
  if (email?.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "?";
}
