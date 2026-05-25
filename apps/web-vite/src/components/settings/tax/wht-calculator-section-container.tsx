// Decision: tax section mounted by SettingsTaxContainer (already gates `canView` permission via
// Navigate). Hook owns calculator form state; container is the hook ownership boundary.
import { useWhtCalculatorSection } from './hooks/use-wht-calculator-section.js';
import { WhtCalculatorSection } from './wht-calculator-section.js';

export function WhtCalculatorSectionContainer() {
  const section = useWhtCalculatorSection();
  return <WhtCalculatorSection {...section} />;
}
