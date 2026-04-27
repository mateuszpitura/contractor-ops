// TODO(Plan 74-08): implement OverrideBadge persistence assertions once the
// component lands per CONTEXT.md D-11.

import { describe, it } from 'vitest';

describe('OverrideBadge — D-11 permanent badge', () => {
  it.todo('renders when WorkflowRun.overrideMetadata is present');
  it.todo('does not render when overrideMetadata is null');
  it.todo('tooltip shows reason + actor + date + blockedTaskKind');
  it.todo('badge is keyboard-focusable button (a11y)');
});
