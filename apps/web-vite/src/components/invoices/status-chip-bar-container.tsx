import { useStatusChipBar } from './hooks/use-status-chip-bar.js';
import { StatusChipBar, StatusChipBarSkeleton } from './status-chip-bar.js';

interface StatusChipBarContainerProps {
  activeStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  disabled?: boolean;
}

export function StatusChipBarContainer(props: StatusChipBarContainerProps) {
  const { isLoading, counts } = useStatusChipBar();

  if (isLoading) return <StatusChipBarSkeleton />;

  return <StatusChipBar {...props} counts={counts} />;
}
