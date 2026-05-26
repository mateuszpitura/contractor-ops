import { useExpiryRemindersEditor } from '../hooks/use-expiry-reminders-editor.js';
import {
  ExpiryRemindersDisplay,
  ExpiryRemindersEditing,
  extractReminderDaysBefore,
  OverviewTab,
} from './overview-tab.js';

type OverviewTabContainerProps = {
  contract: Parameters<typeof OverviewTab>[0]['contract'];
};

export function OverviewTabContainer({ contract }: OverviewTabContainerProps) {
  const reminderDaysBefore = extractReminderDaysBefore(contract.metadataJson);
  const reminders = useExpiryRemindersEditor(contract.id, reminderDaysBefore);

  const remindersEditor = reminders.editing ? (
    <ExpiryRemindersEditing
      remindersText={reminders.reminders}
      setReminders={reminders.setReminders}
      handleSave={reminders.handleSave}
      handleCancel={reminders.handleCancel}
      isPending={reminders.isPending}
    />
  ) : (
    <ExpiryRemindersDisplay
      currentReminders={reminderDaysBefore}
      onStartEditing={reminders.startEditing}
    />
  );

  return (
    <OverviewTab contract={contract} reminders={reminders} remindersEditor={remindersEditor} />
  );
}
