import { useKleinunternehmerToggle } from './hooks/use-kleinunternehmer-toggle.js';
import { KleinunternehmerToggle } from './kleinunternehmer-toggle.js';

interface KleinunternehmerToggleContainerProps {
  orgCountryCode: string | null | undefined;
  isKleinunternehmer: boolean;
}

export function KleinunternehmerToggleContainer({
  orgCountryCode,
  isKleinunternehmer,
}: KleinunternehmerToggleContainerProps) {
  const toggle = useKleinunternehmerToggle();
  if (orgCountryCode !== 'DE') return null;
  return <KleinunternehmerToggle isKleinunternehmer={isKleinunternehmer} toggle={toggle} />;
}
