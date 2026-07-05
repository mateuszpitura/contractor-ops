// Registers every payroll export profile with the shared payroll registry once
// at API boot (mirrors the einvoice profile-registration convention). The
// gusto/quickbooks bridge profiles resolve native-vs-CSV per request via
// dependency-injected context passed through `engine.generate(..., opts)`; the
// CSV fallbacks (gusto-csv/quickbooks-csv) are consumed internally by the
// bridges and are NOT registered as separate user-facing targets.

import {
  registerAdpProfile,
  registerComarchProfile,
  registerDatevProfile,
  registerEnovaProfile,
  registerGustoProfile,
  registerQuickBooksProfile,
  registerRtiEpsProfile,
  registerRtiFpsProfile,
  registerSageDeProfile,
  registerSymfoniaProfile,
} from '@contractor-ops/payroll';

let registered = false;

export function registerAllPayrollProfiles(): void {
  if (registered) return;
  registerSymfoniaProfile();
  registerComarchProfile();
  registerEnovaProfile();
  registerDatevProfile();
  registerSageDeProfile();
  registerRtiFpsProfile();
  registerRtiEpsProfile();
  registerAdpProfile();
  registerGustoProfile();
  registerQuickBooksProfile();
  registered = true;
}
