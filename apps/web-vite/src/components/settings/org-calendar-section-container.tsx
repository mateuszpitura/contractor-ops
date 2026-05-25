// Decision: section composes 2 provider-card hooks (google + outlook) into the org-calendar view.
// View internally branches on provider connection state; container is the multi-hook composition
// boundary that wires both connect handlers.
import {
  useOrgCalendarProviderCard,
  useOrgCalendarSection,
} from './hooks/use-org-calendar-section.js';
import { OrgCalendarSection } from './org-calendar-section.js';

export function OrgCalendarSectionContainer() {
  const section = useOrgCalendarSection();
  const google = useOrgCalendarProviderCard('google-calendar');
  const outlook = useOrgCalendarProviderCard('outlook-calendar');

  return (
    <OrgCalendarSection
      {...section}
      onGoogleConnect={google.handleConnect}
      onOutlookConnect={outlook.handleConnect}
    />
  );
}
