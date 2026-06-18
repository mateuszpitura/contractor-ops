// Pending tax-filing-transmitter implementation — specs kept as todo.
//
// A format-factory transmitter seam mirroring the payment-export factory: one
// generation pipeline, swappable transmit tail. The factory must select
// ManualDownload by default (the TCC-independent GA path) and only select
// IrisA2A when module.iris-efile is enabled (built but dark). Vendor is a stub
// seam.
//
// The factory (`../tax-filing-transmitter`) does not exist yet; specs are kept
// as todo until it is built.

import { describe, it } from 'vitest';

describe('tax-filing-transmitter — factory selection', () => {
  it.todo('selects ManualDownload by default (no TCC, GA path)');

  it.todo('selects IrisA2A only when module.iris-efile is enabled');

  it.todo('keeps Vendor as a stub seam (not selected by the default path)');
});
