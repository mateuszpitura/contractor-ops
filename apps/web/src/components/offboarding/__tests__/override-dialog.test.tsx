// TODO(Plan 74-08): implement OverrideDialog dual-validation assertions once
// the dialog component lands per CONTEXT.md D-10.

import { describe, it } from 'vitest';

describe('OverrideDialog — D-10 dual-validation', () => {
  it.todo('submit disabled until reason >= 20 chars AND acknowledged');
  it.todo('discard-confirm AlertDialog opens on ESC when dirty');
  it.todo('server error renders inline above CTA on Zod failure');
  it.todo('focus traps within dialog; restores to override-button on close');
});
