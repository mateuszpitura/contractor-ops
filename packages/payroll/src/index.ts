// ---------------------------------------------------------------------------
// @contractor-ops/payroll — public surface
// ---------------------------------------------------------------------------
//
// Per-market payroll EXPORT adapters (PL / DE / UK / US). This package clones
// the e-invoice profile-registry engine: each target is a PayrollExportProfile
// that maps a PII-masked PayrollFeed to a deterministic file (CSV / XML /
// fixed-width ASCII) or, for native targets, bridges to an integrations
// adapter. It is NOT a payroll engine — it exports employee master data to the
// incumbent system, which computes and files.

export type { PayrollTargetSummary } from './engine/engine.js';
export { PayrollExportEngine } from './engine/engine.js';
// --- Profiles: US CSV file-export --------------------------------------------
export { AdpProfile, registerAdpProfile } from './profiles/adp/index.js';
// --- Profiles: PL file-export ------------------------------------------------
export { ComarchProfile, registerComarchProfile } from './profiles/comarch/index.js';
// --- Profiles: DE file-export ------------------------------------------------
export {
  type DatevConnectConnection,
  type DatevConnectResult,
  DatevProfile,
  pushViaDatevConnect,
  registerDatevProfile,
} from './profiles/datev/index.js';
export { EnovaProfile, registerEnovaProfile } from './profiles/enova/index.js';
// --- Profiles: US native OAuth bridges ---------------------------------------
export {
  type GustoBridgeContext,
  GustoProfile,
  registerGustoProfile,
} from './profiles/gusto/index.js';
export { GustoCsvProfile, registerGustoCsvProfile } from './profiles/gusto-csv/index.js';
export {
  type QuickBooksBridgeContext,
  QuickBooksProfile,
  registerQuickBooksProfile,
} from './profiles/quickbooks/index.js';
export {
  QuickbooksCsvProfile,
  registerQuickbooksCsvProfile,
} from './profiles/quickbooks-csv/index.js';
// --- Profiles: UK RTI file-export --------------------------------------------
export { RtiEpsProfile, registerRtiEpsProfile } from './profiles/rti-eps/index.js';
export { RtiFpsProfile, registerRtiFpsProfile } from './profiles/rti-fps/index.js';
export {
  hasRtiXsdBundle,
  type RtiValidationResult,
  validateRtiXml,
} from './profiles/rti-shared/xsd-validate.js';
export { registerSageDeProfile, SageDeProfile } from './profiles/sage-de/index.js';
export {
  registerSymfoniaProfile,
  type SymfoniaOptions,
  SymfoniaProfile,
} from './profiles/symfonia/index.js';
export { mapUsEmployeeToRow, type UsPayrollRow } from './profiles/us-shared/mapper.js';
export {
  clearProfiles,
  getProfile,
  listProfiles,
  registerProfile,
} from './registry.js';
export type {
  PayrollEmploymentStatus,
  PayrollFeed,
  PayrollFeedEmployee,
} from './types/feed.js';
export {
  PAYROLL_EMPLOYMENT_STATUSES,
  payrollFeedEmployeeSchema,
  payrollFeedSchema,
} from './types/feed.js';
export type {
  PayrollExportExt,
  PayrollExportProfile,
  PayrollExportResult,
} from './types/profile.js';
