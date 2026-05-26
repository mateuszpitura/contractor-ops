import { useWhtCalculatorSection } from './hooks/use-wht-calculator-section.js';
import { WhtCalculatorSection } from './wht-calculator-section.js';

// Decision: mutation host — calculator section mounted by SettingsTaxContainer (already
// gates `canView` via Navigate); hook supplies calculator form state + compute handlers.
export function WhtCalculatorSectionContainer() {
  const section = useWhtCalculatorSection();
  return <WhtCalculatorSection {...section} />;
}
