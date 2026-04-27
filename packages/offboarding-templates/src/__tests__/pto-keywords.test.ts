// TODO(Plan 74-02): implement PTO_KEYWORDS assertions once Plan 74-02 lands
// the per-locale (en/pl/de) keyword arrays.

import { describe, it } from 'vitest';

describe('PTO_KEYWORDS — D-08 typed-const', () => {
  it.todo('has en/de/pl keys; no ar');
  it.todo('en includes PTO, OOO, Out of Office, Vacation');
  it.todo('de includes Urlaub, Krank');
  it.todo('pl includes Urlop, Wakacje');
});
