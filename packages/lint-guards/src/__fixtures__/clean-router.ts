// Fixture for logs-guard — router that does NOT log a `body` field.
// The guard should treat this as zero offences.
//
// We declare a stand-in `createTrpcLogger` shape rather than importing
// `@contractor-ops/logger` so the fixture stays self-contained and the
// `lint-guards` package retains its single-direct-dependency promise.
type Bindings = { procedure: string; type: string };
type StubLogger = {
  info(obj: Record<string, unknown>, msg: string): void;
};

declare function createTrpcLogger(meta: Bindings): StubLogger;

const log = createTrpcLogger({ procedure: 'contractor.create', type: 'mutation' });
log.info({ contractorId: 'c_1' }, 'created'); // no body — clean
