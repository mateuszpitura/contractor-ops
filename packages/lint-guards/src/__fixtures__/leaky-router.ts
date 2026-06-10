// Fixture for logs-guard — router that logs a `body` field.
// The guard should flag this with kind: 'unredacted-body-log'.
//
// The fixture uses placeholder shapes (no real-format identifiers).
type Bindings = { procedure: string; type: string };
type StubLogger = {
  info(obj: Record<string, unknown>, msg: string): void;
};

declare function createTrpcLogger(meta: Bindings): StubLogger;

const log = createTrpcLogger({ procedure: 'contractor.create', type: 'mutation' });
log.info({ body: { ssn: '[FIXTURE-PLACEHOLDER]' } }, 'received'); // body — must be flagged
