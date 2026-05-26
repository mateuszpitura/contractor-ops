import { CountryRatesSection } from './country-rates-section.js';
import { useCountryRatesSection } from './hooks/use-country-rates-section.js';

// Decision: data-table host — rates section mounted by SettingsTaxContainer (already
// gates `canView` via Navigate); view delegates loading + per-row state variants to
// the rates table shell.
export function CountryRatesSectionContainer() {
  const section = useCountryRatesSection();
  return <CountryRatesSection {...section} />;
}
