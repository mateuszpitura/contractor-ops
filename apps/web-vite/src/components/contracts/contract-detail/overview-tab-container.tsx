import { useExpiryRemindersEditor } from '../hooks/use-expiry-reminders-editor.js';
import { extractReminderDaysBefore, OverviewTab } from './overview-tab.js';

type OverviewTabContainerProps = {
  contract: Parameters<typeof OverviewTab>[0]['contract'];
};

export function OverviewTabContainer({ contract }: OverviewTabContainerProps) {
  const reminderDaysBefore = extractReminderDaysBefore(contract.metadataJson);
  const reminders = useExpiryRemindersEditor(contract.id, reminderDaysBefore);

  return <OverviewTab contract={contract} reminders={reminders} />;
}
