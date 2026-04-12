/**
 * ZATCA tRPC accessor — workaround for TypeScript type instantiation depth
 * limit with 40+ routers in AppRouter.
 *
 * The `trpc.zatca` property is valid at runtime but TypeScript cannot resolve
 * it when the AppRouter has too many sub-routers. This file provides a typed
 * accessor that bypasses the depth limitation.
 *
 * When the upstream tRPC type depth issue is resolved, remove this file and
 * use `trpc.zatca` directly.
 */

import type { ZatcaOnboardingState, ZatcaTaxDetails } from "@contractor-ops/einvoice";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types matching tRPC router output
// ---------------------------------------------------------------------------

export interface ComplianceStats {
  total: number;
  cleared: number;
  reported: number;
  rejected: number;
  pending: number;
  warning: number;
}

export interface ComplianceCheckResult {
  type: string;
  invoiceTypeCode: string;
  subtype: string;
  status: "CLEARED" | "REPORTED" | "REJECTED" | "ERROR";
  message?: string;
}

// ---------------------------------------------------------------------------
// Typed accessor
// ---------------------------------------------------------------------------

interface ZatcaTrpcProxy {
  saveTaxDetails: {
    mutationOptions: () => Record<string, unknown>;
  };
  generateCsr: {
    mutationOptions: () => Record<string, unknown>;
  };
  requestComplianceCsid: {
    mutationOptions: () => Record<string, unknown>;
  };
  runComplianceChecks: {
    mutationOptions: () => Record<string, unknown>;
  };
  exchangeProductionCert: {
    mutationOptions: () => Record<string, unknown>;
  };
  getOnboardingState: {
    queryOptions: () => { queryKey: unknown[] };
    queryKey: () => unknown[];
  };
  getComplianceStats: {
    queryOptions: () => { queryKey: unknown[] };
    queryKey: () => unknown[];
  };
  getStatus: {
    queryOptions: (input: { invoiceId: string }) => { queryKey: unknown[] };
    queryKey: () => unknown[];
  };
  resubmit: {
    mutationOptions: () => Record<string, unknown>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const zatcaTrpc = (trpc as any).zatca as ZatcaTrpcProxy;
