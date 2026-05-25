import { useContractActivityTab } from '../hooks/use-contract-activity-tab.js';

type Amendment = {
  id: string;
  title: string;
  createdAt: string | Date;
};

type ActivityTabProps = {
  contract: {
    id: string;
    status: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    amendments: Amendment[];
    documentCount?: number;
  };
};

export function ActivityTab({ contract }: ActivityTabProps) {
  const { events, formatRelativeTime, isEmpty, emptyLabel } = useContractActivityTab(contract);

  if (isEmpty) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, i) => {
        const Icon = event.icon;
        return (
          <div key={event.key} className="flex items-start gap-3">
            <div className="relative mt-0.5 flex size-6 shrink-0 items-center justify-center">
              <Icon className="size-3.5 text-muted-foreground" />
              {i < events.length - 1 && (
                <div className="absolute top-6 left-1/2 h-4 w-px -translate-x-1/2 bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{event.text}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(event.time)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
