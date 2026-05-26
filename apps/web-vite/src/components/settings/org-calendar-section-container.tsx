import {
  useOrgCalendarProviderCard,
  useOrgCalendarSection,
} from './hooks/use-org-calendar-section.js';
import { OrgCalendarSection, OrgCalendarSectionSkeleton } from './org-calendar-section.js';

export function OrgCalendarSectionContainer() {
  const section = useOrgCalendarSection();
  const google = useOrgCalendarProviderCard('google-calendar');
  const outlook = useOrgCalendarProviderCard('outlook-calendar');

  if (section.isLoading) return <OrgCalendarSectionSkeleton t={section.t} />;
  return (
    <OrgCalendarSection
      {...section}
      onGoogleConnect={google.handleConnect}
      onOutlookConnect={outlook.handleConnect}
    />
  );
}
