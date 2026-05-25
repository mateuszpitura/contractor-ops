// Decision: tax section mounted by SettingsTaxContainer (already gates `canView` permission via
// Navigate). View internally branches on isLoading + rate-row state — kept in view for test
// compatibility. Container is the hook ownership boundary.

import { CountryRatesSection } from './country-rates-section.js';
import { useCountryRatesSection } from './hooks/use-country-rates-section.js';

export function CountryRatesSectionContainer() {
  const section = useCountryRatesSection();
  return <CountryRatesSection {...section} />;
}
