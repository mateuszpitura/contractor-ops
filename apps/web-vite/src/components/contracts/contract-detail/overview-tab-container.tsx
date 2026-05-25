import { useExpiryRemindersEditor } from '../hooks/use-expiry-reminders-editor.js';
import { OverviewTab } from './overview-tab.js';

type OverviewTabContainerProps = {
  contract: Parameters<typeof OverviewTab>[0]['contract'];
};

export function OverviewTabContainer({ contract }: OverviewTabContainerProps) {
  const metadata = (contract.metadataJson as Record<string, unknown>) ?? {};
  const reminderDaysBefore = (metadata.reminderDaysBefore as number[]) ?? [];
  const reminders = useExpiryRemindersEditor(contract.id, reminderDaysBefore);

  return <OverviewTab contract={contract} reminders={reminders} />;
}
