// Decision: settings section gated upstream by SettingsIndexContainer (`general` tab). Hook owns
// form state + save mutation; view renders the title-transfer config form.
import { useTransferTitleSettings } from './hooks/use-transfer-title-settings.js';
import { TransferTitleSettings } from './transfer-title-settings.js';

export function TransferTitleSettingsContainer() {
  const settings = useTransferTitleSettings();
  return <TransferTitleSettings {...settings} />;
}
