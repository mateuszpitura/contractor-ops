import { useOutOfOfficeSection } from './hooks/use-out-of-office-section.js';
import { OutOfOfficeSection } from './out-of-office-section.js';

// Decision: mutation host — section gated upstream by SettingsIndexContainer
// (`notifications` tab); hook supplies form state + delegate list + save handler.
export function OutOfOfficeSectionContainer() {
  const section = useOutOfOfficeSection();
  return <OutOfOfficeSection {...section} />;
}
