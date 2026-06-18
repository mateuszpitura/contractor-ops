/** Shape of the `contractor.insights` payload, mirrored for presentational props. */

export interface ContractorAttention {
  atRiskCompliance: number;
  expiringContracts: number;
  paymentBlocked: number;
  stalledOnboarding: number;
  expirySparkline: number[];
}

export interface ContractorComposition {
  lifecycleStage: Record<string, number>;
  type: Record<string, number>;
  jurisdiction: Array<{ countryCode: string; count: number }>;
  health: { green: number; yellow: number; red: number };
}

export interface ContractorInsightsData {
  attention: ContractorAttention;
  composition: ContractorComposition;
  total: number;
}
