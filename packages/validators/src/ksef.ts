// Backward compatibility — KSeF schemas moved to @contractor-ops/einvoice
// TODO: Remove this file after all consumers switch to @contractor-ops/einvoice
export {
  type KsefConnectionConfig,
  type KsefParsedInvoice,
  type KsefSyncParams,
  ksefAuthMethodEnum,
  ksefConnectionConfigSchema,
  ksefEnvironmentEnum,
  ksefParsedInvoiceSchema,
  ksefSyncParamsSchema,
} from "@contractor-ops/einvoice";
