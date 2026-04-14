import { describe, expect, it } from 'vitest';

import { parseXRechnungCii } from '../parser.js';

describe('parseXRechnungCii stub', () => {
  it('always throws with a descriptive message', () => {
    expect(() => parseXRechnungCii('<xml/>')).toThrowError(
      /not implemented/i,
    );
  });

  it('error message indicates this is intentionally deferred to Phase 62', () => {
    expect(() => parseXRechnungCii('')).toThrowError(
      /Phase 62/,
    );
  });
});
