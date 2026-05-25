// Decision: section gated upstream by SettingsCalendarContainer (page-level composition). View
// branches on isLoading/provider connection state internally; branches stay in view for test
// compatibility (see __tests__/my-calendar-section.test.tsx).
import { useMyCalendarSection } from './hooks/use-my-calendar-section.js';
import { MyCalendarSection } from './my-calendar-section.js';

export function MyCalendarSectionContainer() {
  const section = useMyCalendarSection();
  return <MyCalendarSection {...section} />;
}
