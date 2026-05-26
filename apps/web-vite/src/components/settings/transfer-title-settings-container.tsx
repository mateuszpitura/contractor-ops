import { useTransferTitleSettings } from './hooks/use-transfer-title-settings.js';
import { TransferTitleSettings } from './transfer-title-settings.js';

// Decision: mutation host — section gated upstream by SettingsIndexContainer (`general`
// tab); hook supplies title-transfer form state + save mutation + isPending.
export function TransferTitleSettingsContainer() {
  const settings = useTransferTitleSettings();
  return <TransferTitleSettings {...settings} />;
}
