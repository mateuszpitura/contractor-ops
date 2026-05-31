// Fixture for payment-gate-guard — a payment router whose `create` procedure
// does NOT call assertContractorPaymentEligibility. The guard MUST report it.
// Self-contained (no @contractor-ops/api import) to keep lint-guards dependency-light.

declare const router: (routes: Record<string, unknown>) => unknown;
declare const tenantProcedure: {
  input: (schema: unknown) => {
    mutation: (fn: (args: unknown) => unknown) => unknown;
  };
};

export const paymentRouter = router({
  create: tenantProcedure.input({}).mutation(async () => {
    // BUG (intentional fixture): no assertContractorPaymentEligibility call.
    return { id: 'run_1' };
  }),
  lockAndExport: tenantProcedure.input({}).mutation(async () => {
    // This one DOES call the helper, so it must NOT be reported.
    await assertContractorPaymentEligibility(['ctr_1']);
    return { exportId: 'exp_1' };
  }),
});

declare function assertContractorPaymentEligibility(ids: string[]): Promise<void>;
