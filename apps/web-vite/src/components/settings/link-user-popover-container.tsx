import { useLinkUserPopover } from './hooks/use-slack-user-mapping.js';
import { LinkUserPopover } from './link-user-popover.js';

interface LinkUserPopoverContainerProps {
  userId: string;
  onLinked: () => void;
}

// Decision: mutation host — popover mounted by SlackUserMapping per row; hook exposes
// the per-user link mutation handlers + isPending consumed inline by the popover view.
export function LinkUserPopoverContainer({ userId, onLinked }: LinkUserPopoverContainerProps) {
  const popover = useLinkUserPopover(userId, onLinked);
  return <LinkUserPopover userId={userId} onLinked={onLinked} {...popover} />;
}
