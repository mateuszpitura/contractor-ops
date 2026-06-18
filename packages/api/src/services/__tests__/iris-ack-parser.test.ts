// Pending iris-ack-parser implementation — specs kept as todo.
//
// One ack parser feeds BOTH the manual-upload flow (admin uploads the IRS ack
// file) and the dark A2A poll result. It must map all six IRIS acknowledgement
// statuses to a normalized union, surface the Error Information Group for the
// failing/partial cases, and carry the OriginalReceiptId for replacements.
//
// The parser (`../iris-ack-parser`) does not exist yet; specs are kept as todo
// until it is built.

import { describe, it } from 'vitest';

describe('iris-ack-parser — six IRIS statuses', () => {
  it.todo('maps each of the six IRIS acknowledgement statuses');

  it.todo('surfaces the Error Information Group for a rejected ack');

  it.todo('carries the OriginalReceiptId for a replacement acknowledgement');
});
