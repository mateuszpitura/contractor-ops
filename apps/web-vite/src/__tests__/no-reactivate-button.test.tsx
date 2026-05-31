import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('No "Reactivate contractor" button anywhere (Phase 76 SC#7 / IDP-15)', () => {
  it('static grep across apps/web-vite returns no matches for /reactivate.*contractor/i', () => {
    // Scans shipped UI source + locale messages only. Test files are excluded —
    // this very test mentions the forbidden phrase in its own assertions.
    const out = execSync(
      'grep -rIE -i --exclude-dir=__tests__ "reactivate.*contractor|re-?activate.{0,3}contractor" src messages || true',
      { encoding: 'utf8', cwd: process.cwd() },
    );
    expect(out.trim()).toBe('');
  });

  it.todo('RTL: contractor profile page does not render any "Reactivate" labelled button');
  it.todo('RTL: ENDED contractors list does not render any "Reactivate" labelled button');
});
