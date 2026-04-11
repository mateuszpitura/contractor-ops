// Backward compatibility — KSeF schemas moved to @contractor-ops/einvoice
// TODO: Remove this file after all consumers switch to @contractor-ops/einvoice
export {
  ksefConnectionConfigSchema,
  type KsefConnectionConfig,
  ksefParsedInvoiceSchema,
  type KsefParsedInvoice,
  ksefSyncParamsSchema,
  type KsefSyncParams,
  ksefAuthMethodEnum,
  ksefEnvironmentEnum,
} from "@contractor-ops/einvoice";
