// Decision: settings section gated upstream by SettingsIndexContainer (`notifications` tab). Hook
// owns form state + delegate list; view renders the toggle + form.
import { useOutOfOfficeSection } from './hooks/use-out-of-office-section.js';
import { OutOfOfficeSection } from './out-of-office-section.js';

export function OutOfOfficeSectionContainer() {
  const section = useOutOfOfficeSection();
  return <OutOfOfficeSection {...section} />;
}
