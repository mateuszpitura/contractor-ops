import { useMyCalendarSection } from './hooks/use-my-calendar-section.js';
import { MyCalendarSection, MyCalendarSectionSkeleton } from './my-calendar-section.js';

export function MyCalendarSectionContainer() {
  const section = useMyCalendarSection();
  if (section.isLoading) return <MyCalendarSectionSkeleton />;
  return <MyCalendarSection {...section} />;
}
