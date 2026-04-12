import { z } from "zod";

// ---------------------------------------------------------------------------
// KSeF Connection Config
// ---------------------------------------------------------------------------

export const ksefAuthMethodEnum = z.enum(["token", "certificate"]);

export const ksefEnvironmentEnum = z.enum(["test", "prod"]);

/**
 * Configuration schema for establishing a KSeF API connection.
 * Supports token-based (RSA-OAEP challenge) or certificate-based (XAdES) auth.
 */
export const ksefConnectionConfigSchema = z
  .object({
    authMethod: ksefAuthMethodEnum,
    token: z.string().optional(),
    certificateBase64: z.string().optional(),
    certificatePassword: z.string().optional(),
    environment: ksefEnvironmentEnum.default("prod"),
  })
  .refine(
    (data) => {
      if (data.authMethod === "token") {
        return !!data.token;
      }
      return true;
    },
    {
      message: "Token is required when authMethod is 'token'",
      path: ["token"],
    },
  )
  .refine(
    (data) => {
      if (data.authMethod === "certificate") {
        return !!data.certificateBase64;
      }
      return true;
    },
    {
      message: "Certificate is required when authMethod is 'certificate'",
      path: ["certificateBase64"],
    },
  );

export type KsefConnectionConfig = z.infer<typeof ksefConnectionConfigSchema>;

// ---------------------------------------------------------------------------
// KSeF Parsed Invoice (FA(3) XML mapped structure)
// ---------------------------------------------------------------------------

const ksefPartySchema = z.object({
  nip: z
    .string()
    .length(10)
    .regex(/^\d{10}$/, "NIP must be exactly 10 digits"),
  name: z.string(),
  address: z.string().optional(),
});

const ksefInvoiceLineSchema = z.object({
  lineNumber: z.number(),
  description: z.string(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  unitPriceMinor: z.number().optional(),
  netAmountMinor: z.number().optional(),
  vatRate: z.string().optional(),
  vatAmountMinor: z.number().optional(),
  grossAmountMinor: z.number().optional(),
});

const ksefTotalsSchema = z.object({
  netMinor: z.number(),
  vatMinor: z.number(),
  grossMinor: z.number(),
});

const ksefPaymentSchema = z.object({
  dueDate: z.string().optional(),
  bankAccount: z.string().optional(),
  method: z.string().optional(),
});

/**
 * Schema representing a parsed FA(3) invoice from KSeF.
 * All monetary amounts are in minor units (integer, 1/100 PLN).
 */
export const ksefParsedInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  issueDate: z.string(),
  invoiceType: z.string(),
  currency: z.string().length(3),
  seller: ksefPartySchema,
  buyer: ksefPartySchema.omit({ address: true }),
  lines: z.array(ksefInvoiceLineSchema).min(1),
  totals: ksefTotalsSchema,
  payment: ksefPaymentSchema.optional(),
  ksefReferenceNumber: z.string(),
  upoNumber: z.string().optional(),
});

export type KsefParsedInvoice = z.infer<typeof ksefParsedInvoiceSchema>;

// ---------------------------------------------------------------------------
// KSeF Sync Parameters
// ---------------------------------------------------------------------------

/**
 * Parameters for triggering a KSeF invoice sync.
 */
export const ksefSyncParamsSchema = z.object({
  organizationId: z.string(),
  connectionId: z.string(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type KsefSyncParams = z.infer<typeof ksefSyncParamsSchema>;
