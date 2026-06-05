/**
 * Classification advisory banner. Pure presentational.
 */

import { BANNER_IR35_ADVISORY_EN, BANNER_SCHEIN_ADVISORY_DE } from '@contractor-ops/validators';

interface ClassificationAdvisoryBannerProps {
  jurisdiction: string;
}

export function ClassificationAdvisoryBanner({ jurisdiction }: ClassificationAdvisoryBannerProps) {
  const isDE = jurisdiction === 'DE' || jurisdiction === 'AT';
  const phrase = isDE ? BANNER_SCHEIN_ADVISORY_DE : BANNER_IR35_ADVISORY_EN;

  return (
    <div
      role="note"
      aria-label={isDE ? 'Rechtlicher Hinweis' : 'Legal notice'}
      className="sticky top-0 z-10 border-b border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="max-w-4xl">{phrase}</p>
    </div>
  );
}
