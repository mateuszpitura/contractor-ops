// Decision: popover widget mounted by SlackUserMapping for each row; container scopes the
// per-user link mutation hook lifecycle.
import { useLinkUserPopover } from './hooks/use-slack-user-mapping.js';
import { LinkUserPopover } from './link-user-popover.js';

interface LinkUserPopoverContainerProps {
  userId: string;
  onLinked: () => void;
}

export function LinkUserPopoverContainer({ userId, onLinked }: LinkUserPopoverContainerProps) {
  const popover = useLinkUserPopover(userId, onLinked);
  return <LinkUserPopover userId={userId} onLinked={onLinked} {...popover} />;
}
