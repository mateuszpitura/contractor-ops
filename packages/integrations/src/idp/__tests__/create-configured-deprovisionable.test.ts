import { describe, expect, it } from 'vitest';

import { GoogleWorkspaceAdapter } from '../../adapters/google-workspace-adapter.js';
import { SlackAdapter } from '../../adapters/slack-adapter.js';
import { createConfiguredDeprovisionableAdapter } from '../create-configured-deprovisionable.js';

describe('createConfiguredDeprovisionableAdapter', () => {
  it('returns fresh GoogleWorkspaceAdapter with token', () => {
    const a = createConfiguredDeprovisionableAdapter('GOOGLE_WORKSPACE', 'gws-token');
    const b = createConfiguredDeprovisionableAdapter('GOOGLE_WORKSPACE', 'other');
    expect(a).toBeInstanceOf(GoogleWorkspaceAdapter);
    expect(b).toBeInstanceOf(GoogleWorkspaceAdapter);
    expect(a).not.toBe(b);
  });

  it('returns fresh SlackAdapter with org grid token', () => {
    const adapter = createConfiguredDeprovisionableAdapter('SLACK', 'grid-token');
    expect(adapter).toBeInstanceOf(SlackAdapter);
  });
});
