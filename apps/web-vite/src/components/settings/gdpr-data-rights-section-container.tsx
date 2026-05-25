// Decision: settings section gated upstream by SettingsIndexContainer (`privacy` tab). Hook owns
// data-request mutation lifecycle; view renders the action buttons + history.

import { GdprDataRightsSection } from './gdpr-data-rights-section.js';
import { useGdprDataRightsSection } from './hooks/use-gdpr-data-rights-section.js';

export function GdprDataRightsSectionContainer() {
  const section = useGdprDataRightsSection();
  return <GdprDataRightsSection {...section} />;
}
