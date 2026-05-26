/**
 * Renders jurisdiction-specific privacy notice content from the validators
 * catalog. Interim fallback until `legal.getDocument` tRPC exposes CMS Lexical
 * bodies — same source of truth as the React-PDF template.
 */

import type { PrivacyNoticeStructured } from '@contractor-ops/validators';
import { dePrivacyNotice, euPrivacyNotice, gbPrivacyNotice } from '@contractor-ops/validators';

import type { PrivacyJurisdictionSlug } from './privacy-jurisdiction-resolve.js';
import { H1, H2, P } from './privacy-prose.js';

const NOTICES: Record<PrivacyJurisdictionSlug, PrivacyNoticeStructured> = {
  gb: gbPrivacyNotice,
  de: dePrivacyNotice,
  eu: euPrivacyNotice,
};

function sectionId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `section-${index + 1}`;
}

export interface PrivacyNoticeStructuredContentProps {
  jurisdiction: PrivacyJurisdictionSlug;
}

export function PrivacyNoticeStructuredContent({
  jurisdiction,
}: PrivacyNoticeStructuredContentProps) {
  const notice = NOTICES[jurisdiction];

  return (
    <>
      <H1>Privacy Notice — {notice.jurisdiction}</H1>
      <P className="text-muted-foreground">{notice.legalReference}</P>
      {notice.sections.map((section, index) => (
        <section key={section.title}>
          <H2 id={sectionId(section.title, index)}>{section.title}</H2>
          <P>{section.content}</P>
        </section>
      ))}
    </>
  );
}
