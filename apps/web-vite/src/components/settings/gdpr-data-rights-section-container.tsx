import { GdprDataRightsSection } from './gdpr-data-rights-section.js';
import { useGdprDataRightsSection } from './hooks/use-gdpr-data-rights-section.js';

// Decision: mutation host — section gated upstream by SettingsIndexContainer (`privacy`
// tab); hook exposes data-request handlers + isPending consumed inline by the view.
export function GdprDataRightsSectionContainer() {
  const section = useGdprDataRightsSection();
  return <GdprDataRightsSection {...section} />;
}
