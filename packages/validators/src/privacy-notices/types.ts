// Phase 56 · Plan 07 — Shared privacy-notice content shape.
//
// Mirrors (but does not collide with) `PrivacyNoticeContent` in
// `packages/api/src/services/privacy-notice.ts` — the `controller` field is
// injected server-side from Organization.name / countryCode so the static
// content module stays controller-agnostic and can be imported by both
// MDX pages and React-PDF templates without a server round-trip.

export interface PrivacyNoticeSection {
  /** Short section title rendered as an <h2>. */
  title: string;
  /** Plain-text body. Paragraph-splitting is the renderer's responsibility. */
  content: string;
}

export interface PrivacyNoticeStructured {
  /** ISO-3166 alpha-2 (UPPERCASE). 'EU' is an internal fallback pseudo-code. */
  jurisdiction: 'GB' | 'DE' | 'EU';
  /** Human-readable citation of the governing instrument. */
  legalReference: string;
  /** Ordered list of notice sections. Every required Article 13/14 element
   * must have a corresponding section — enforced by per-jurisdiction tests. */
  sections: readonly PrivacyNoticeSection[];
}
